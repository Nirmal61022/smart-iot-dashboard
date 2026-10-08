/**
 * ============================================================================
 * SmartHome.IoT — ESP32 Microcontroller Firmware
 * ============================================================================
 * Hardware Architecture:
 * - Microcontroller: ESP32 Dev Module (Wi-Fi 2.4 GHz)
 * - Temperature & Humidity: DHT11 Sensor (DATA -> GPIO 4)
 * - Ambient Light Sensor: LDR Voltage Divider (ADC -> GPIO 34)
 * - Actuator Module: 5V Optocoupled Relay (IN -> GPIO 26, Active-Low)
 * - Load: Living Room Light / Physical Appliance
 * 
 * Cloud Backend:
 * - Firebase Project: dashboard-e6cea
 * - Realtime Database: https://dashboard-e6cea-default-rtdb.firebaseio.com
 * 
 * Database Schema Synchronized:
 * - /home/bulb/state: "ON" | "OFF"
 * - /home/sensors/temperature: float
 * - /home/sensors/humidity: float
 * - /home/sensors/ldr: int (ADC 0-4095)
 * - /home/sensors/timestamp: unsigned long
 * - /home/system/mode: "MANUAL" | "AUTOMATIC"
 * - /home/system/ldrThreshold: int
 * - /home/logs/<timestamp>: telemetry log packet
 * ============================================================================
 */

#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <DHT.h>
#include <time.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// ---------------- Wi-Fi Credentials ----------------
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// ---------------- Firebase Configuration ------------
#define FIREBASE_API_KEY "AIzaSyA-q-ybqAiPyt1Sn5HQ1g6iuv4HmIgaeA0"
#define FIREBASE_DATABASE_URL "https://bulb-12492-default-rtdb.firebaseio.com"

// ---------------- Hardware Pin Definitions ----------
#define DHT_PIN 4
#define LDR_PIN 34
#define RELAY_PIN 26
#define DHT_TYPE DHT11

// Relay Active-Low Configuration (Most 5V relay boards trigger LOW)
#define RELAY_ACTIVE_LOW true

// Timing Intervals (ms)
#define SENSOR_READ_INTERVAL 3000UL     // Send sensor telemetry every 3s
#define CONTROL_READ_INTERVAL 1000UL    // Check bulb & mode every 1s
#define LOG_INTERVAL 60000UL            // Write historical log record every 60s

// Objects & Instances
DHT dht(DHT_PIN, DHT_TYPE);
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// State Variables
float temperature = NAN;
float humidity = NAN;
int ldrValue = 0;
bool bulbState = false;
String systemMode = "MANUAL";
int ldrThreshold = 400;

unsigned long lastSensorMs = 0;
unsigned long lastControlMs = 0;
unsigned long lastLogMs = 0;

void setPhysicalRelay(bool on) {
  bulbState = on;
  if (RELAY_ACTIVE_LOW) {
    digitalWrite(RELAY_PIN, on ? LOW : HIGH);
  } else {
    digitalWrite(RELAY_PIN, on ? HIGH : LOW);
  }
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.print("Connecting to Wi-Fi");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(500);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println(" Connection timeout. Will retry in loop.");
  }
}

void setupFirebase() {
  config.api_key = FIREBASE_API_KEY;
  config.database_url = FIREBASE_DATABASE_URL;
  config.token_status_callback = tokenStatusCallback;
  
  Firebase.reconnectWiFi(true);
  fbdo.setResponseSize(1024);

  // Authenticate anonymously or using API key
  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("Firebase Auth Client Ready");
  } else {
    Serial.printf("Firebase sign-up error: %s\n", config.signer.signupError.message.c_str());
  }

  Firebase.begin(&config, &auth);
  configTime(19800, 0, "pool.ntp.org", "time.nist.gov"); // IST +5:30
}

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  setPhysicalRelay(false); // Default OFF on boot
  dht.begin();

  connectWiFi();
  setupFirebase();
}

void readSensors() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  int ldr = analogRead(LDR_PIN);

  if (!isnan(t)) temperature = t;
  if (!isnan(h)) humidity = h;
  ldrValue = ldr;

  Serial.printf("[Sensors] Temp: %.1f C | Hum: %.1f %% | LDR: %d\n", temperature, humidity, ldrValue);
}

void syncSensorsToCloud() {
  if (!Firebase.ready()) return;

  FirebaseJson json;
  if (!isnan(temperature)) json.set("temperature", temperature);
  if (!isnan(humidity)) json.set("humidity", humidity);
  json.set("ldr", ldrValue);
  
  time_t now;
  time(&now);
  json.set("timestamp", (double)((now > 100000) ? (now * 1000ULL) : millis()));

  if (Firebase.RTDB.setJSON(&fbdo, "/home/sensors", &json)) {
    Serial.println("[Cloud] Telemetry written to /home/sensors");
  } else {
    Serial.printf("[Cloud Error] Sensors write failed: %s\n", fbdo.errorReason().c_str());
  }
}

void readSystemControl() {
  if (!Firebase.ready()) return;

  // Read Operating Mode
  if (Firebase.RTDB.getString(&fbdo, "/home/system/mode")) {
    String m = fbdo.stringData();
    m.toUpperCase();
    if (m == "MANUAL" || m == "AUTOMATIC") {
      systemMode = m;
    }
  }

  // Read Threshold
  if (Firebase.RTDB.getInt(&fbdo, "/home/system/ldrThreshold")) {
    int th = fbdo.intData();
    if (th > 0 && th < 4096) ldrThreshold = th;
  }

  // Mode Evaluation
  if (systemMode == "AUTOMATIC") {
    // If LDR < threshold (darkness) -> turn bulb ON
    // If LDR > threshold (bright) -> turn bulb OFF
    bool shouldBeOn = (ldrValue < ldrThreshold);
    if (shouldBeOn != bulbState) {
      setPhysicalRelay(shouldBeOn);
      Firebase.RTDB.setString(&fbdo, "/home/bulb/state", shouldBeOn ? "ON" : "OFF");
      Serial.printf("[Auto Logic] LDR %d vs %d -> Bulb %s\n", ldrValue, ldrThreshold, shouldBeOn ? "ON" : "OFF");
    }
  } else {
    // MANUAL Mode: obey /home/bulb/state from web dashboard
    if (Firebase.RTDB.getString(&fbdo, "/home/bulb/state")) {
      String cloudBulbState = fbdo.stringData();
      cloudBulbState.toUpperCase();
      bool targetOn = (cloudBulbState == "ON");
      if (targetOn != bulbState) {
        setPhysicalRelay(targetOn);
        Serial.printf("[Manual Actuator] Bulb switched to: %s\n", targetOn ? "ON" : "OFF");
      }
    }
  }
}

void writeHistoricalLog() {
  if (!Firebase.ready() || isnan(temperature) || isnan(humidity)) return;

  FirebaseJson logPacket;
  time_t now;
  time(&now);
  double epochMs = (now > 100000) ? (double)(now * 1000ULL) : (double)millis();

  logPacket.set("timestamp", epochMs);
  logPacket.set("temperature", temperature);
  logPacket.set("humidity", humidity);
  logPacket.set("ldr", ldrValue);
  logPacket.set("bulbState", bulbState ? "ON" : "OFF");
  logPacket.set("mode", systemMode);
  logPacket.set("note", "ESP32 Auto Log");

  String logPath = "/home/logs/" + String((unsigned long)now);
  if (Firebase.RTDB.setJSON(&fbdo, logPath, &logPacket)) {
    Serial.println("[History] Log packet archived to Firebase");
  }
}

void loop() {
  connectWiFi();

  unsigned long currentMs = millis();

  // 1. Control loop (Bulb actuator & mode sync)
  if (currentMs - lastControlMs >= CONTROL_READ_INTERVAL) {
    lastControlMs = currentMs;
    readSystemControl();
  }

  // 2. Sensor reading & cloud telemetry stream
  if (currentMs - lastSensorMs >= SENSOR_READ_INTERVAL) {
    lastSensorMs = currentMs;
    readSensors();
    syncSensorsToCloud();
  }

  // 3. Periodic history logging
  if (currentMs - lastLogMs >= LOG_INTERVAL) {
    lastLogMs = currentMs;
    writeHistoricalLog();
  }

  delay(20);
}
