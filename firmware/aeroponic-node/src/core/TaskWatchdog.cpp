#include "TaskWatchdog.h"
#include <Arduino.h>

std::vector<ManagedTask> TaskWatchdog::tasks;
SemaphoreHandle_t TaskWatchdog::mutex = NULL;

void TaskWatchdog::init() {
    mutex = xSemaphoreCreateMutex();
    
    xTaskCreatePinnedToCore(
        TaskWatchdog::watchdogTask,
        "WatchdogTask",
        4096,
        NULL,
        2,  // High priority
        NULL,
        0   // Core 0
    );
    Serial.println("TaskWatchdog: Initialized");
}

void TaskWatchdog::registerTask(const char* name, TaskHandle_t handle, unsigned long timeoutMs, void (*restartFunc)()) {
    if (xSemaphoreTake(mutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        ManagedTask t;
        t.name = String(name);
        t.handle = handle;
        t.lastHeartbeatMs = millis();
        t.timeoutMs = timeoutMs;
        t.restartFunc = restartFunc;
        tasks.push_back(t);
        xSemaphoreGive(mutex);
        
        Serial.printf("TaskWatchdog: Registered '%s' (timeout: %lu ms)\n", name, timeoutMs);
    }
}

void TaskWatchdog::heartbeat(const char* taskName) {
    if (xSemaphoreTake(mutex, pdMS_TO_TICKS(10)) == pdTRUE) {
        for (auto& t : tasks) {
            if (t.name == taskName) {
                t.lastHeartbeatMs = millis();
                break;
            }
        }
        xSemaphoreGive(mutex);
    }
}

void TaskWatchdog::watchdogTask(void* parameter) {
    vTaskDelay(5000 / portTICK_PERIOD_MS); // Initial delay to let tasks start
    
    while (true) {
        if (xSemaphoreTake(mutex, pdMS_TO_TICKS(100)) == pdTRUE) {
            unsigned long now = millis();
            
            for (auto& t : tasks) {
                unsigned long elapsed = now - t.lastHeartbeatMs;
                
                if (elapsed > t.timeoutMs && t.timeoutMs > 0) {
                    Serial.printf("WATCHDOG: Task '%s' timeout! Elapsed: %lu ms, Limit: %lu ms\n",
                                  t.name.c_str(), elapsed, t.timeoutMs);
                    
                    // Try to restart the task if a restart function is provided
                    if (t.restartFunc != nullptr) {
                        if (t.handle != NULL) {
                            vTaskDelete(t.handle);
                            t.handle = NULL;
                        }
                        Serial.printf("WATCHDOG: Restarting task '%s'...\n", t.name.c_str());
                        t.restartFunc();
                    } else {
                        Serial.printf("WATCHDOG: No restart function for '%s'. Resetting ESP32...\n", t.name.c_str());
                        delay(1000);
                        ESP.restart();
                    }
                    
                    t.lastHeartbeatMs = millis();
                }
            }
            xSemaphoreGive(mutex);
        }
        
        vTaskDelay(5000 / portTICK_PERIOD_MS); // Check every 5 seconds
    }
}