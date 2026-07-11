#include "SystemMonitor.h"
#include "../../include/Config.h"
#include <ArduinoJson.h>
#include <WiFi.h>

void SystemMonitor::init() {
    // Create a FreeRTOS task pinned to Core 0 for system diagnostics
    xTaskCreatePinnedToCore(
        SystemMonitor::monitorTask,   // Task function
        "SysMonitorTask",             // Name of task
        4096,                         // Stack size
        NULL,                         // Parameter
        1,                            // Priority
        NULL,                         // Task handle
        0                             // Pin to core 0 (Network/System core)
    );
}

void SystemMonitor::printDiagnostics() {
    Serial.println("--- System Diagnostics ---");
    Serial.print("Free Heap: ");
    Serial.print(ESP.getFreeHeap() / 1024);
    Serial.println(" KB");
    Serial.print("Uptime: ");
    Serial.print(millis() / 1000);
    Serial.println(" s");
    Serial.print("WiFi RSSI: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    Serial.println("--------------------------");
}

String SystemMonitor::getDiagnosticsJSON() {
    StaticJsonDocument<256> doc;
    doc["free_heap_kb"] = ESP.getFreeHeap() / 1024;
    doc["uptime_s"] = millis() / 1000;
    doc["wifi_rssi"] = WiFi.RSSI();
    
    String output;
    serializeJson(doc, output);
    return output;
}

void SystemMonitor::monitorTask(void* parameter) {
    while (true) {
        // printDiagnostics(); // Uncomment for debugging
        
        // Optional: Check if heap is critically low and trigger soft reset
        if (ESP.getFreeHeap() < 10000) {
            Serial.println("CRITICAL: Low memory! Restarting...");
            ESP.restart();
        }

        vTaskDelay(Config::DIAGNOSTICS_INTERVAL / portTICK_PERIOD_MS);
    }
}
