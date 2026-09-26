#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <DHT.h>
#include <time.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#define FIREBASE_API_KEY "YOUR_FIREBASE_API_KEY"
#define FIREBASE_DATABASE_URL "YOUR_DATABASE_URL"

#define DHT_PIN 4
#define LDR_PIN 34
#define RELAY_PIN 26
#define DHT_TYPE DHT11

#define LOG_INTERVAL 60000UL
#define SENSOR_INTERVAL 2000UL
#define CONTROL_INTERVAL 1000UL
#define RELAY_ACTIVE_LOW true

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
DHT dht(DHT_PIN, DHT_TYPE);

float temperature = NAN;
float humidity = NAN;
int ldrValue = 0;
bool bulbState = false;
bool previousBulbState = false;
String mode = "manual";
int ldrThreshold = 500;
bool ldrInverted = false;
unsigned long lastSensorMs = 0;
unsigned long lastControlMs = 0;
unsigned long lastLogMs = 0;
unsigned long lastCurrentWriteMs = 0;

void setRelay(bool on) {
  bulbState = on;
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? !on : on);
}

bool firebaseReady() {
  return Firebase.ready() && WiFi.status() == WL_CONNECTED;
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.print("Connecting Wi-Fi");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 20000) {
    delay(500);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" connected");
    Serial.print("IP: "); Serial.println(WiFi.localIP());
  } else {
    Serial.println(" failed; retrying later");
  }
}

void setupFirebase() {
  config.api_key = FIREBASE_API_KEY;
  config.database_url = FIREBASE_DATABASE_URL;
  config.token_status_callback = tokenStatusCallback;
  Firebase.reconnectWiFi(true);
  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("Firebase anonymous authentication ready");
  } else {
    Serial.printf("Firebase sign-up failed: %s\n", config.signer.signupError.message.c_str());
  }
  Firebase.begin(&config, &auth);
  configTime(19800, 0, "pool.ntp.org", "time.nist.gov");
}

void readSensors() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (isnan(h) || isnan(t)) {
    Serial.println("DHT11 read failed; keeping previous valid values");
  } else {
    humidity = h;
    temperature = t;
  }
  ldrValue = analogRead(LDR_PIN);
  Serial.printf("Sensors | T: %.1f C | H: %.1f %% | LDR: %d\n", temperature, humidity, ldrValue);
}

void readControl() {
  if (!firebaseReady()) return;
  String newMode;
  if (Firebase.RTDB.getString(&fbdo, "/iot/control/mode")) {
    newMode = fbdo.stringData();
    if (newMode == "manual" || newMode == "automatic") mode = newMode;
  }
  if (Firebase.RTDB.getInt(&fbdo, "/iot/settings/ldrThreshold")) {
    int value = fbdo.intData();
    if (value >= 0 && value <= 4095) ldrThreshold = value;
  }
  if (Firebase.RTDB.getBool(&fbdo, "/iot/settings/ldrInverted")) ldrInverted = fbdo.boolData();

  if (mode == "manual") {
    if (Firebase.RTDB.getBool(&fbdo, "/iot/control/bulb")) setRelay(fbdo.boolData());
  } else {
    bool dark = ldrInverted ? (ldrValue > ldrThreshold) : (ldrValue < ldrThreshold);
    setRelay(dark);
  }
}

void writeCurrent() {
  if (!firebaseReady() || isnan(temperature) || isnan(humidity)) return;
  FirebaseJson json;
  json.set("temperature", temperature);
  json.set("humidity", humidity);
  json.set("ldr", ldrValue);
  json.set("bulb", bulbState);
  json.set("mode", mode);
  time_t now = time(nullptr);
  if (now < 1000000000) return;
  json.set("timestamp", (int64_t)now * 1000LL);
  if (!Firebase.RTDB.setJSON(&fbdo, "/iot/current", &json)) {
    Serial.printf("Current write failed: %s\n", fbdo.errorReason().c_str());
  }
}

void writeHistory() {
  if (!firebaseReady() || isnan(temperature) || isnan(humidity)) return;
  FirebaseJson json;
  json.set("timestamp", (int64_t)time(nullptr) * 1000LL);
  json.set("temperature", temperature);
  json.set("humidity", humidity);
  json.set("ldr", ldrValue);
  json.set("bulb", bulbState);
  json.set("mode", mode);
  if (!Firebase.RTDB.pushJSON(&fbdo, "/iot/history", &json)) {
    Serial.printf("History write failed: %s\n", fbdo.errorReason().c_str());
  } else {
    Serial.println("History record written");
  }
}

void ensureInitialState() {
  if (!firebaseReady()) return;
  if (!Firebase.RTDB.getString(&fbdo, "/iot/control/mode")) Firebase.RTDB.setString(&fbdo, "/iot/control/mode", "manual");
  if (!Firebase.RTDB.getBool(&fbdo, "/iot/control/bulb")) Firebase.RTDB.setBool(&fbdo, "/iot/control/bulb", false);
  if (!Firebase.RTDB.getInt(&fbdo, "/iot/settings/ldrThreshold")) Firebase.RTDB.setInt(&fbdo, "/iot/settings/ldrThreshold", 500);
  if (!Firebase.RTDB.getBool(&fbdo, "/iot/settings/ldrInverted")) Firebase.RTDB.setBool(&fbdo, "/iot/settings/ldrInverted", false);
}

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? HIGH : LOW);
  analogReadResolution(12);
  dht.begin();
  connectWiFi();
  setupFirebase();
  delay(1000);
  ensureInitialState();
  readSensors();
}

void loop() {
  connectWiFi();
  unsigned long now = millis();
  if (now - lastSensorMs >= SENSOR_INTERVAL) { lastSensorMs = now; readSensors(); }
  if (now - lastControlMs >= CONTROL_INTERVAL) { lastControlMs = now; readControl(); }
  if (firebaseReady()) {
    if (now - lastCurrentWriteMs >= SENSOR_INTERVAL) { lastCurrentWriteMs = now; writeCurrent(); }
    if (now - lastLogMs >= LOG_INTERVAL) { lastLogMs = now; writeHistory(); }
  }
  if (bulbState != previousBulbState) {
    previousBulbState = bulbState;
    Serial.printf("Relay/Bulb: %s | Mode: %s\n", bulbState ? "ON" : "OFF", mode.c_str());
  }
  delay(50);
}
