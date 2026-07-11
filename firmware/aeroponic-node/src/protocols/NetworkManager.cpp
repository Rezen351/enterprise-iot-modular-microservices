#include "NetworkManager.h"
#include "WebConfigPortal.h"
#include "../../include/Config.h"
#include <WiFi.h>

void NetworkManager::init() {
    // Keep WiFi task running independently to ensure reconnects don't block the main loop
    xTaskCreatePinnedToCore(
        NetworkManager::wifiTask,
        "WiFiTask",
        8192, // Increased stack for WebServer
        NULL,
        2, // Higher priority for network
        NULL,
        0
    );
}

bool NetworkManager::isConnected() {
    return WiFi.status() == WL_CONNECTED;
}

void NetworkManager::wifiTask(void* parameter) {
    // Enable dual mode: Access Point & Station
    WiFi.mode(WIFI_AP_STA);
    
    // Always start Captive Portal on boot
    WebConfigPortal::startAP();
    bool portalStarted = true;
    
    while (true) {
        if (WiFi.status() != WL_CONNECTED) {
            Serial.print("Connecting to WiFi: ");
            Serial.println(Config::WIFI_SSID);
            
            if (Config::WIFI_EAP_IDENTITY.length() > 0) {
                Serial.println("Using WPA2-Enterprise (Eduroam/Radius) mode...");
                WiFi.disconnect(true);  // Disconnect from any previous AP
                // Identity and Username are usually the same for PEAP
                WiFi.begin(Config::WIFI_SSID, WPA2_AUTH_PEAP, Config::WIFI_EAP_IDENTITY, Config::WIFI_EAP_IDENTITY, Config::WIFI_EAP_PASSWORD);
            } else {
                Serial.println("Using standard WPA2-Personal mode...");
                WiFi.begin(Config::WIFI_SSID.c_str(), Config::WIFI_PASS.c_str());
            }
            
            // Wait up to 10 seconds for connection
            int retries = 0;
            while (WiFi.status() != WL_CONNECTED && retries < 20) {
                vTaskDelay(500 / portTICK_PERIOD_MS);
                WebConfigPortal::loop(); // Keep portal alive during connection
                Serial.print(".");
                retries++;
            }
            Serial.println();
            
            if (WiFi.status() == WL_CONNECTED) {
                Serial.println("WiFi Connected!");
                Serial.print("IP Address: ");
                Serial.println(WiFi.localIP());
            } else {
                Serial.println("WiFi Connect Failed! Retrying in 5 seconds...");
            }
        }

        
        if (portalStarted) {
            WebConfigPortal::loop();
            vTaskDelay(10 / portTICK_PERIOD_MS); // Yield to other tasks
        } else {
            // Wait 5 seconds before checking connection again if not in AP mode
            vTaskDelay(5000 / portTICK_PERIOD_MS);
        }
    }
}
