#include "HardwareManager.h"
#include "TaskWatchdog.h"
#include "../../include/Config.h"
#include "../protocols/MqttManager.h"
#include "../protocols/NetworkManager.h"
#include <ArduinoJson.h>
#include <WiFi.h>
#include <map>
#include <ModbusMaster.h>
#include "esp_task_wdt.h"

namespace HardwareManager {

    ModbusMaster node;
    uint32_t currentBaud = 0;
    
    SemaphoreHandle_t modbusMutex;
    TaskHandle_t telemetryTaskHandle = NULL;
    
    // State terakhir output
    std::map<String, int> outputStates;
    
    // Flag interrupt untuk emergency shutdown
    volatile bool emergencyShutdownTriggered = false;
    volatile unsigned long lastInterruptTime = 0;
    
    // Connection stats
    struct {
        unsigned long lastMqttConnected = 0;
        int publishCount = 0;
    } stats;
    
    // Pre-allocated static buffers (GAP #9 fix)
    static StaticJsonDocument<8192> doc;
    static char jsonBuffer[8192];

    // ==================== INTERRUPT HANDLER ====================
    // GAP #11: Interrupt untuk input kritis
    void IRAM_ATTR emergencyInterruptHandler() {
        unsigned long now = millis();
        // Debounce 200ms
        if (now - lastInterruptTime > 200) {
            emergencyShutdownTriggered = true;
            lastInterruptTime = now;
        }
    }

    void IRAM_ATTR gpioInterruptHandler() {
        // Generic interrupt handler — set flag, actual processing in telemetryTask
        emergencyShutdownTriggered = true;
    }

    // ==================== LOCAL CONTROL EVALUATION ====================
    // GAP #7: Edge control & histeresis
    float getSensorValueByName(const String& name) {
        // Cari di input GPIO
        for (const auto& hw : Config::HardwareInputs) {
            if (hw.name == name) {
                if (hw.type == "ANALOG") {
                    return analogRead(hw.pin);
                } else {
                    return digitalRead(hw.pin);
                }
            }
        }
        return NAN;
    }

    void evaluateLocalControl() {
        for (const auto& rule : Config::LocalControlRules) {
            if (!rule.enabled) continue;
            
            float sensorValue = getSensorValueByName(rule.inputSensor);
            if (isnan(sensorValue)) continue;
            
            int currentOutput = outputStates[rule.outputTarget];
            
            if (currentOutput == 0 && sensorValue > rule.thresholdHigh) {
                setOutput(rule.outputTarget, 1);
                Serial.printf("LOCAL CONTROL: %s -> %s ON (%.1f > %.1f)\n",
                    rule.name.c_str(), rule.outputTarget.c_str(),
                    sensorValue, rule.thresholdHigh);
            }
            else if (currentOutput == 1 && sensorValue < rule.thresholdLow) {
                setOutput(rule.outputTarget, 0);
                Serial.printf("LOCAL CONTROL: %s -> %s OFF (%.1f < %.1f)\n",
                    rule.name.c_str(), rule.outputTarget.c_str(),
                    sensorValue, rule.thresholdLow);
            }
        }
    }

    // ==================== INIT ====================
    void init() {
        Serial.println("Initializing Universal Hardware Pins...");
        
        // GAP #11: Attach interrupt untuk input dengan interrupt type
        for (const auto& hw : Config::HardwareInputs) {
            uint8_t mode = INPUT;
            if (hw.pull == "UP") mode = INPUT_PULLUP;
            else if (hw.pull == "DOWN") mode = INPUT_PULLDOWN;
            
            pinMode(hw.pin, mode);
            Serial.printf("Configured Input GPIO %d as %s with PULL_%s (%s)\n", 
                hw.pin, hw.type.c_str(), hw.pull.c_str(), hw.name.c_str());
            
            // Attach interrupt if configured
            if (hw.interrupt != "NONE" && hw.interrupt.length() > 0) {
                int intMode = LOW;
                if (hw.interrupt == "RISING") intMode = RISING;
                else if (hw.interrupt == "FALLING") intMode = FALLING;
                else if (hw.interrupt == "CHANGE") intMode = CHANGE;
                
                attachInterrupt(digitalPinToInterrupt(hw.pin), gpioInterruptHandler, intMode);
                Serial.printf("  -> Interrupt attached: %s\n", hw.interrupt.c_str());
            }
        }

        for (const auto& hw : Config::HardwareOutputs) {
            pinMode(hw.pin, OUTPUT);
            if (hw.type == "PWM") {
                analogWrite(hw.pin, 0);
            } else {
                digitalWrite(hw.pin, LOW);
            }
            outputStates[hw.name] = 0;
            Serial.printf("Configured Output GPIO %d as %s (%s)\n", hw.pin, hw.type.c_str(), hw.name.c_str());
        }

        // Modbus Setup
        modbusMutex = xSemaphoreCreateMutex();
        currentBaud = 0;
        
        if (Config::PIN_RS485_DE != 255) {
            pinMode(Config::PIN_RS485_DE, OUTPUT);
            digitalWrite(Config::PIN_RS485_DE, LOW);
            node.preTransmission([]() { digitalWrite(Config::PIN_RS485_DE, HIGH); });
            node.postTransmission([]() { digitalWrite(Config::PIN_RS485_DE, LOW); });
        }

        // LED indikator (GAP #18)
        if (Config::PIN_LED_INDICATOR != 255) {
            pinMode(Config::PIN_LED_INDICATOR, OUTPUT);
            digitalWrite(Config::PIN_LED_INDICATOR, LOW);
        }

        // Emergency stop pin (GAP #11)
        if (Config::PIN_EMERGENCY_STOP != 255) {
            pinMode(Config::PIN_EMERGENCY_STOP, INPUT_PULLUP);
            attachInterrupt(digitalPinToInterrupt(Config::PIN_EMERGENCY_STOP),
                            emergencyInterruptHandler, FALLING);
            Serial.println("Emergency stop interrupt attached");
        }

        xTaskCreatePinnedToCore(
            telemetryTask, 
            "TelemetryTask", 
            8192, 
            NULL, 
            1, 
            &telemetryTaskHandle, 
            1
        );
    }

    // ==================== TELEMETRY TASK ====================
    void telemetryTask(void* parameter) {
        uint32_t delayTime = Config::MQTT_PUBLISH_INTERVAL > 0 ? Config::MQTT_PUBLISH_INTERVAL : 5000;
        
        while (true) {
            TaskWatchdog::heartbeat("TelemetryTask"); // GAP #5
            
            // GAP #11: Cek flag interrupt untuk emergency shutdown
            if (emergencyShutdownTriggered) {
                emergencyShutdownTriggered = false;
                Serial.println("EMERGENCY: Shutdown triggered by interrupt!");
                
                for (const auto& hw : Config::HardwareOutputs) {
                    if (hw.type == "PWM") {
                        analogWrite(hw.pin, 0);
                    } else {
                        digitalWrite(hw.pin, LOW);
                    }
                    outputStates[hw.name] = 0;
                }
                
                // Kirim alert via MQTT
                String alertPayload = "{\"alert\":\"EMERGENCY_SHUTDOWN\",\"node_id\":\"" 
                    + Config::NODE_ID + "\",\"uptime_s\":" + String(millis() / 1000) + "}";
                if (MqttManager::isConnected()) {
                    MqttManager::publish(Config::TOPIC_ALERT, alertPayload);
                }
            }
            
            doc.clear();
            
            // System Info
            doc["node_id"] = Config::NODE_ID;
            doc["fw_version"] = Config::FW_VERSION;
            
            // Network Info
            JsonObject network = doc.createNestedObject("network");
            network["ssid"] = Config::WIFI_SSID;
            network["ip_address"] = WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : "Not Connected";
            network["wifi_rssi"] = WiFi.RSSI();
            
            // Device Hardware Info
            JsonObject devInfo = doc.createNestedObject("device_info");
            devInfo["uptime_s"] = millis() / 1000;
            devInfo["cpu_freq_mhz"] = ESP.getCpuFreqMHz();
            devInfo["free_heap_kb"] = ESP.getFreeHeap() / 1024;
            devInfo["flash_size_mb"] = ESP.getFlashChipSize() / (1024 * 1024);
            
            // Connection stats (GAP #18)
            JsonObject connStats = doc.createNestedObject("connection_stats");
            connStats["mqtt_connected"] = MqttManager::isConnected();
            connStats["uptime_s"] = millis() / 1000;
            
            // Sensor Telemetry
            JsonObject telemetry = doc.createNestedObject("telemetry");
            
            JsonObject inputsObj = telemetry.createNestedObject("inputs");
            for (const auto& hw : Config::HardwareInputs) {
                if (hw.type == "ANALOG") {
                    inputsObj[hw.name] = analogRead(hw.pin);
                } else {
                    int val = digitalRead(hw.pin);
                    if (hw.invert) val = !val;
                    inputsObj[hw.name] = val;
                }
            }
    
            JsonObject outputsObj = telemetry.createNestedObject("outputs");
            for (const auto& hw : Config::HardwareOutputs) {
                outputsObj[hw.name] = outputStates[hw.name];
            }
    
            // --- Modbus Polling ---
            JsonObject modbusObj = telemetry.createNestedObject("modbus");
            if (xSemaphoreTake(modbusMutex, pdMS_TO_TICKS(1000)) == pdTRUE) {
                for (const auto& ms : Config::HardwareModbus) {
                    if (currentBaud != ms.baudrate) {
                        Serial2.end();
                        vTaskDelay(100 / portTICK_PERIOD_MS);
                        Serial2.begin(ms.baudrate, SERIAL_8N1, Config::PIN_RS485_RX, Config::PIN_RS485_TX);
                        vTaskDelay(300 / portTICK_PERIOD_MS);
                        currentBaud = ms.baudrate;
                    }
                    node.begin(ms.slave_id, Serial2);
                    
                    JsonObject modbusDev = modbusObj.createNestedObject(ms.name);
                    
                    for (const auto& reg : ms.registers) {
                        uint8_t result;
                        if (reg.type == "INPUT") {
                            result = node.readInputRegisters(reg.address, 1);
                        } else {
                            result = node.readHoldingRegisters(reg.address, 1);
                        }
                        
                        if (result == node.ku8MBSuccess) {
                            float val = node.getResponseBuffer(0) * reg.multiplier;
                            modbusDev[reg.name] = val;
                        }
                        vTaskDelay(10 / portTICK_PERIOD_MS);
                    }
                }
                xSemaphoreGive(modbusMutex);
            }
            
            // GAP #7: Evaluate local control rules
            evaluateLocalControl();
            
            // Publish via MQTT
            memset(jsonBuffer, 0, sizeof(jsonBuffer));
            serializeJson(doc, jsonBuffer, sizeof(jsonBuffer) - 1);
            if (MqttManager::isConnected()) {
                MqttManager::publish(Config::TOPIC_TELEMETRY, String(jsonBuffer));
                stats.lastMqttConnected = millis();
                stats.publishCount++;
            }
            
            // LED indikator (GAP #18)
            if (Config::PIN_LED_INDICATOR != 255) {
                digitalWrite(Config::PIN_LED_INDICATOR, MqttManager::isConnected() ? HIGH : LOW);
            }
            
            ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(delayTime));
        }
    }
    
    // ==================== SET OUTPUT ====================
    bool setOutput(String targetName, int value) {
        for (const auto& hw : Config::HardwareOutputs) {
            if (hw.name == targetName) {
                if (hw.type == "PWM") {
                    value = constrain(value, 0, 255);
                    analogWrite(hw.pin, value);
                    Serial.printf("Actuator: Setting PWM %s (GPIO %d) to %d\n", targetName.c_str(), hw.pin, value);
                } else {
                    value = value > 0 ? 1 : 0;
                    digitalWrite(hw.pin, value > 0 ? HIGH : LOW);
                    Serial.printf("Actuator: Setting DIGITAL %s (GPIO %d) to %d\n", targetName.c_str(), hw.pin, value);
                }
                outputStates[targetName] = value;
                if (telemetryTaskHandle != NULL) {
                    xTaskNotifyGive(telemetryTaskHandle);
                }
                return true;
            }
        }
        Serial.printf("Actuator: Target '%s' not found in Output Configuration.\n", targetName.c_str());
        return false;
    }

    // ==================== MODBUS SCAN (GAP #6: dengan watchdog feed) ====================
    String runFullScanSync(uint32_t baud) {
        String scanResultsJson = "[";
        bool firstFound = true;
        
        if (xSemaphoreTake(modbusMutex, portMAX_DELAY) == pdTRUE) {
            Serial2.end();
            vTaskDelay(100 / portTICK_PERIOD_MS);
            Serial2.begin(baud, SERIAL_8N1, Config::PIN_RS485_RX, Config::PIN_RS485_TX);
            vTaskDelay(300 / portTICK_PERIOD_MS);
            currentBaud = baud;
            
            Serial.println("\n================================");
            Serial.printf("STARTING MODBUS SCAN ON %d BAUD\n", baud);
            Serial.println("================================");
            
            for (uint16_t id = 1; id <= 247; id++) {
                // GAP #6: Feed watchdog setiap iterasi
                esp_task_wdt_reset();
                TaskWatchdog::heartbeat("TelemetryTask");
                
                Serial.printf("Checking Slave ID %d ... ", id);
                node.begin(id, Serial2);
                uint8_t result = node.readHoldingRegisters(0, 1);
                
                if (result == node.ku8MBSuccess) {
                    Serial.println("FOUND");
                    Serial.printf("Register0 = %d\n", node.getResponseBuffer(0));
                    if (!firstFound) scanResultsJson += ",";
                    scanResultsJson += String(id);
                    firstFound = false;
                } else if (result >= node.ku8MBIllegalFunction && result <= node.ku8MBSlaveDeviceFailure) {
                    Serial.println("FOUND (Exception)");
                    if (!firstFound) scanResultsJson += ",";
                    scanResultsJson += String(id);
                    firstFound = false;
                } else {
                    Serial.printf("No Response (%d)\n", result);
                }
                vTaskDelay(50 / portTICK_PERIOD_MS);
            }
            Serial.println("================================");
            Serial.println("SCAN COMPLETE");
            Serial.println("================================");
            xSemaphoreGive(modbusMutex);
        }
        
        scanResultsJson += "]";
        return scanResultsJson;
    }
    
    uint16_t scanModbusReg(uint8_t id, uint32_t baud, uint16_t reg, String type, bool& success) {
        if (xSemaphoreTake(modbusMutex, pdMS_TO_TICKS(5000)) == pdTRUE) {
            if (currentBaud != baud) {
                Serial2.end();
                vTaskDelay(100 / portTICK_PERIOD_MS);
                Serial2.begin(baud, SERIAL_8N1, Config::PIN_RS485_RX, Config::PIN_RS485_TX);
                vTaskDelay(300 / portTICK_PERIOD_MS);
                currentBaud = baud;
            }
            Serial.printf("Scanning %s Register %d on ID %d (Baud: %d)... ", type.c_str(), reg, id, baud);
            node.begin(id, Serial2);
            uint8_t result;
            if (type == "INPUT") {
                result = node.readInputRegisters(reg, 1);
            } else {
                result = node.readHoldingRegisters(reg, 1);
            }
            uint16_t val = 0;
            if (result == node.ku8MBSuccess) {
                success = true;
                val = node.getResponseBuffer(0);
                Serial.printf("SUCCESS! Value = %d\n", val);
            } else {
                success = false;
                Serial.printf("FAILED (Error Code: %d)\n", result);
            }
            xSemaphoreGive(modbusMutex);
            return val;
        }
        Serial.println("FAILED (Could not take Modbus Mutex)");
        success = false;
        return 0;
    }
}