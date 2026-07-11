#ifndef NETWORK_MANAGER_H
#define NETWORK_MANAGER_H

#include <Arduino.h>

class NetworkManager {
public:
    static void init();
    static bool isConnected();

private:
    static void wifiTask(void* parameter);
};

#endif // NETWORK_MANAGER_H
