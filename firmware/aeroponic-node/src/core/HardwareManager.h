#ifndef HARDWARE_MANAGER_H
#define HARDWARE_MANAGER_H

#include <Arduino.h>

namespace HardwareManager {
    void init();
    void telemetryTask(void* parameter);
    bool setOutput(String targetName, int value);
    uint16_t scanModbusReg(uint8_t id, uint32_t baud, uint16_t reg, String type, bool& success);
    
    // Synchronous Scan ID
    String runFullScanSync(uint32_t baud);
}

#endif // HARDWARE_MANAGER_H
