# Smart IoT Environment Monitoring & Automatic Appliance Control

A production-style static web dashboard for an ESP32 + DHT11 + LDR + relay system using Firebase Authentication and Realtime Database. The browser never contains a hard-coded user account: registration is open to anyone, while the database is protected by authenticated Firebase access.

## 1. Features

- Open Email/Password registration with Firebase Authentication
- Secure login, logout and `onAuthStateChanged()` route protection
- Optional Google Sign-In button
- Live DHT11 temperature and humidity
- Live ESP32 ADC/LDR reading
- Live bulb state and operating mode
- Manual relay control from the dashboard
- Automatic relay control performed by the ESP32
- Configurable LDR threshold, 0–4095
- Configurable darkness comparison: `LDR < threshold` or `LDR > threshold`
- Realtime Database listeners instead of browser polling
- Bounded history queries: 10 / 25 / 50 / 100 records
- Chart.js analytics
- CSV export generated in the browser
- Dark/light theme persisted in `localStorage`
- Responsive desktop/tablet/mobile layout
- Toast notifications, loading states and friendly error handling
- Firebase Hosting configuration
- ESP32 Wi-Fi, Firebase, DHT11, LDR, relay, automatic control and history logging

## 2. Architecture

```text
DHT11 ─────┐
           ├── ESP32 ── Wi-Fi ── Firebase Realtime Database ── Web Dashboard
LDR ───────┤                    ▲              │
Relay ◄────┘                    │              └── Firebase Authentication
                                │
                             Cloud data
```

The ESP32 is responsible for physical relay control. In automatic mode, it reads the LDR and stored threshold/logic and decides the relay state locally. The web dashboard changes cloud control values; it does not directly switch the GPIO.

## 3. Project files

```text
iot-dashboard/
├── index.html
├── login.html
├── signup.html
├── dashboard.html
├── css/
│   └── style.css
├── js/
│   ├── firebase-config.js
│   ├── auth.js
│   └── dashboard.js
├── esp32/
│   └── esp32_iot.ino
├── database.rules.json
├── firebase.json
├── .firebaserc
├── package.json
└── README.md
```

## 4. Hardware

| Component | ESP32 Pin | Function |
|---|---:|---|
| DHT11 DATA | GPIO 4 | Temperature / humidity |
| LDR analog output | GPIO 34 | ADC light reading |
| Relay IN | GPIO 26 | Bulb/appliance control |
| DHT11 VCC | 3.3 V | Sensor supply |
| DHT11 GND | GND | Common ground |
| LDR divider | 3.3 V / GND | Analog voltage divider |
| Relay VCC | Module-rated supply | Relay supply |
| Relay GND | GND | Common ground |

These are example connections and can be changed in `esp32_iot.ino`.

### Relay safety

A relay module may be active-low or active-high. The code uses:

```cpp
#define RELAY_ACTIVE_LOW true
```

Set it to `false` for an active-high module. Verify the module with a low-voltage test load first. If controlling mains voltage, use an appropriately rated enclosed relay module, fuse/protection, insulation, strain relief and qualified supervision. Do not work on exposed mains wiring while energized.

## 5. Firebase project creation

1. Open Firebase Console.
2. Create a Firebase project.
3. Add a **Web App** to the project.
4. Copy the Web App configuration.
5. Open `js/firebase-config.js`.
6. Replace all `YOUR_...` values with the values supplied by Firebase.
7. Do not commit private service-account credentials. The Web App configuration is not a secret credential; database rules and Authentication provide access control.

Required web values:

- `apiKey`
- `authDomain`
- `databaseURL`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`

Do not invent these values.

## 6. Authentication setup

In Firebase Console:

**Authentication → Sign-in method → Email/Password → Enable**

This is mandatory for the website.

The site calls:

- `createUserWithEmailAndPassword()` for registration
- `signInWithEmailAndPassword()` for login
- `signOut()` for logout
- `onAuthStateChanged()` for route protection

There is no predefined website email/password and no hard-coded user. Any person can create their own Firebase account.

### Optional Google Sign-In

The login page includes a Google button. Enable Google as an additional Firebase Authentication provider if you want to use it. Email/Password remains mandatory.

### ESP32 authentication

The supplied ESP32 sketch uses Firebase Anonymous Authentication so the physical device can authenticate to the Realtime Database without putting a website user's password into firmware.

Enable:

**Authentication → Sign-in method → Anonymous → Enable**

The anonymous device identity is separate from website users. The current database rules require only an authenticated Firebase identity, which includes this device identity.

For a larger production deployment, use per-device authorization and separate database paths/claims instead of a shared `auth != null` policy.

## 7. Realtime Database setup

Create a Realtime Database instance and select an appropriate deployment region.

The application uses:

```text
iot/
├── current/
│   ├── temperature
│   ├── humidity
│   ├── ldr
│   ├── bulb
│   ├── mode
│   └── timestamp
├── control/
│   ├── bulb
│   └── mode
├── settings/
│   ├── ldrThreshold
│   └── ldrInverted
└── history/
    └── uniqueRecordID/
        ├── timestamp
        ├── temperature
        ├── humidity
        ├── ldr
        ├── bulb
        └── mode
```

### Field meaning

- `current.temperature`: latest DHT11 temperature in °C
- `current.humidity`: latest relative humidity in %
- `current.ldr`: ESP32 ADC value, normally 0–4095 with 12-bit ADC configuration
- `current.bulb`: actual relay state reported by ESP32
- `current.mode`: `manual` or `automatic`
- `current.timestamp`: latest epoch timestamp in milliseconds
- `control.bulb`: dashboard command consumed by the ESP32 in manual mode
- `control.mode`: requested operating mode
- `settings.ldrThreshold`: darkness boundary from 0 to 4095
- `settings.ldrInverted`: `false` means LDR below threshold is dark; `true` means LDR above threshold is dark
- `history/*`: bounded periodic sensor snapshots

## 8. Security rules

Deploy `database.rules.json` rather than public rules. The important access condition is:

```json
".read": "auth != null",
".write": "auth != null"
```

So an unauthenticated browser cannot read or write the database. Validation rules also constrain mode, bulb state, threshold and LDR ranges.

**Important architecture limitation:** these rules authorize all authenticated identities to the shared `iot` device. That is appropriate for a classroom/single-device prototype where authenticated users are allowed to operate the same IoT installation. For a multi-tenant commercial product, change the schema to per-user/per-device paths and authorize `auth.uid` against the owning user/device.

## 9. LDR threshold logic

The physical meaning of an LDR ADC value depends on which side of the voltage divider the LDR and fixed resistor occupy.

Default:

```text
LDR < Threshold  → DARK
```

Optional inverted logic:

```text
LDR > Threshold  → DARK
```

The dashboard stores the selected logic in `iot/settings/ldrInverted`, and the ESP32 reads the same value. Therefore browser and hardware use the same decision rule.

## 10. ESP32 libraries

Install these Arduino libraries:

- DHT sensor library by Adafruit
- Adafruit Unified Sensor
- Firebase Arduino Client Library for ESP8266 and ESP32 by Mobizt

The Firebase library's `TokenHelper.h` and `RTDBHelper.h` are included by the library's examples/addons and are referenced by the sketch.

## 11. ESP32 configuration

Open `esp32/esp32_iot.ino` and change:

```cpp
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#define FIREBASE_API_KEY "YOUR_FIREBASE_API_KEY"
#define FIREBASE_DATABASE_URL "YOUR_DATABASE_URL"
```

Pins and timing are also configurable:

```cpp
#define DHT_PIN 4
#define LDR_PIN 34
#define RELAY_PIN 26
#define LOG_INTERVAL 60000UL
#define RELAY_ACTIVE_LOW true
```

`LOG_INTERVAL` defaults to 60 seconds to avoid unnecessary Firebase writes.

## 12. Uploading ESP32

1. Install Arduino IDE.
2. Add the ESP32 board package.
3. Select your ESP32 board and COM port.
4. Install the libraries listed above.
5. Enable Anonymous Authentication in Firebase.
6. Paste Wi-Fi and Firebase configuration into the sketch.
7. Upload.
8. Open Serial Monitor at `115200` baud.
9. Confirm Wi-Fi connection, Firebase readiness and sensor readings.

The sketch retries Wi-Fi when disconnected and keeps previous valid DHT values when a DHT11 read fails.

## 13. Running locally

Because the application uses ES modules, serve the folder through HTTP rather than opening the HTML files with `file://`.

Simple option:

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

Or install Firebase CLI and use the Hosting emulator.

## 14. Firebase Hosting

From the project directory:

```bash
npm install
npx firebase login
npx firebase use --add
```

When prompted, select your Firebase project. Alternatively replace `YOUR_FIREBASE_PROJECT_ID` in `.firebaserc` with your project ID.

Then deploy:

```bash
npx firebase deploy
```

The `firebase.json` file is already configured to host the project root and deploy the database rules.

If you only want hosting:

```bash
npx firebase deploy --only hosting
```

If you only want database rules:

```bash
npx firebase deploy --only database
```

Firebase will print the hosted URL after a successful deployment.

## 15. Testing checklist

### Authentication

- [ ] Email/Password provider enabled
- [ ] New account can register
- [ ] Different emails can create different accounts
- [ ] Duplicate email produces a useful error
- [ ] Weak password is rejected
- [ ] Wrong login is rejected
- [ ] Logout returns to login
- [ ] Direct dashboard access while signed out redirects to login

### Firebase

- [ ] Web configuration replaced
- [ ] Realtime Database created
- [ ] Rules deployed
- [ ] Anonymous provider enabled for ESP32
- [ ] `/iot/current` updates
- [ ] `/iot/control` updates
- [ ] `/iot/settings` updates
- [ ] `/iot/history` receives records

### Dashboard

- [ ] Temperature displays live
- [ ] Humidity displays live
- [ ] LDR displays live
- [ ] Bulb state displays live
- [ ] Manual ON/OFF command works
- [ ] Automatic/manual mode works
- [ ] Threshold saves
- [ ] LDR logic saves
- [ ] Chart renders
- [ ] 10/25/50/100 history limit works
- [ ] Latest history appears first
- [ ] CSV downloads
- [ ] Dark/light theme persists
- [ ] Mobile layout works
- [ ] Connection status changes when Firebase disconnects

### ESP32

- [ ] Wi-Fi connects
- [ ] DHT11 readings are valid
- [ ] LDR returns 0–4095 range
- [ ] Firebase connection succeeds
- [ ] Manual relay control works
- [ ] Automatic control works
- [ ] Threshold is read from Firebase
- [ ] Inverted logic works
- [ ] History records are created every 60 seconds
- [ ] Wi-Fi recovery works
- [ ] DHT failure does not overwrite valid readings with invalid data

## 16. 5-minute demonstration

1. Open the hosted website.
2. Create a new account.
3. Login.
4. Show temperature, humidity and LDR live values.
5. Show Firebase connected status.
6. Switch to Manual.
7. Turn the bulb ON.
8. Turn the bulb OFF.
9. Switch to Automatic.
10. Set a threshold appropriate for your LDR circuit.
11. Cover the LDR.
12. Show the ESP32 automatically changing the relay/bulb.
13. Uncover the LDR and show the opposite decision.
14. Open Analytics and change the metric/record limit.
15. Open History.
16. Download `iot-sensor-history.csv`.
17. Toggle dark/light mode.
18. Logout.

## 17. Troubleshooting

### Dashboard says Firebase connection failed

- Check `js/firebase-config.js`.
- Verify Realtime Database URL.
- Confirm internet access.
- Confirm Firebase project is active.
- Confirm database rules are deployed.

### Login says invalid credential

- Verify Email/Password provider is enabled.
- Confirm the account exists.
- Reset the password from Firebase Authentication if needed.

### ESP32 connects to Wi-Fi but not Firebase

- Verify API key and database URL.
- Confirm Anonymous Authentication is enabled.
- Check Serial Monitor output.
- Confirm the Firebase library is installed correctly.

### LDR direction seems backwards

Change the dashboard setting to `LDR > Threshold`, or change the stored `ldrInverted` value. This is determined by the voltage-divider topology.

### Relay works opposite to dashboard

Change:

```cpp
#define RELAY_ACTIVE_LOW true
```

to:

```cpp
#define RELAY_ACTIVE_LOW false
```

### History time is wrong

The ESP32 uses NTP time. Keep it connected to the internet long enough for time synchronization before the first history write.

### History query performance warning

`database.rules.json` includes a `timestamp` index under `iot/history`. Deploy the rules after changing them.

## 18. Project demonstration explanation

This is a closed-loop IoT system. Sensors are sampled by the ESP32. The ESP32 publishes the latest measurements to Firebase Realtime Database. The web dashboard subscribes to those values using Firebase realtime listeners, so the UI changes without polling or page refresh.

For manual control, the dashboard writes `iot/control/bulb`. The ESP32 reads that command and drives the relay. For automatic control, the ESP32 reads the LDR, threshold and inversion setting and performs the actual decision locally. The resulting physical relay state is then written back to `iot/current/bulb`, allowing the dashboard to show the reported hardware state.

History is written once per `LOG_INTERVAL` instead of continuously. The dashboard fetches only a bounded number of records and generates CSV entirely in the browser.

## 19. Viva questions and answers

### 1. What is ESP32?
ESP32 is a Wi-Fi/Bluetooth-enabled microcontroller family commonly used for IoT systems.

### 2. Why is ESP32 used here?
It provides GPIO, ADC and Wi-Fi in one low-cost controller, so it can read sensors and communicate with Firebase.

### 3. What does DHT11 measure?
DHT11 measures temperature and relative humidity.

### 4. What is an LDR?
An LDR is a light-dependent resistor whose resistance changes with incident light.

### 5. Why is a voltage divider used with an LDR?
The divider converts the LDR resistance change into a voltage that the ESP32 ADC can measure.

### 6. What is ADC?
ADC converts an analog voltage into a digital number. This project uses a 12-bit ESP32 ADC reading, nominally 0–4095.

### 7. Why is GPIO 34 used for the LDR?
GPIO 34 is an ADC-capable input on common ESP32 boards and is input-only, which suits an analog sensor.

### 8. What is a relay?
A relay is an electrically controlled switch that lets a low-voltage control circuit switch a separate load circuit.

### 9. Why is relay logic configurable?
Relay modules differ; some turn ON with LOW and others with HIGH.

### 10. What is Firebase Realtime Database?
It is a cloud-hosted JSON database that synchronizes data to connected clients in realtime.

### 11. Why use realtime listeners?
Listeners push changes to the browser when data changes, avoiding continuous browser polling.

### 12. How does authentication work?
Firebase Authentication creates and verifies user identities using Email/Password in this project.

### 13. Is registration restricted to one email?
No. Any valid user can create an account; there is no predefined website account.

### 14. Does open registration mean the database is public?
No. Database access requires a Firebase authenticated identity under the supplied rules.

### 15. What is manual mode?
The dashboard writes the desired bulb state, and the ESP32 follows that command.

### 16. What is automatic mode?
The ESP32 evaluates LDR value against the configured threshold and controls the relay itself.

### 17. Why must automatic control run on the ESP32?
The hardware controller must remain responsible for the physical output; the browser should not be the only control authority.

### 18. Why is the history interval 60 seconds?
A 60-second interval provides useful trend data while reducing unnecessary database writes and bandwidth.

### 19. Why limit history queries?
Unlimited reads can increase latency and Firebase usage. The dashboard deliberately fetches only 10, 25, 50 or 100 records.

### 20. How does CSV export work?
JavaScript converts the already-loaded history records into CSV text and downloads a browser-generated Blob.

### 21. What happens if Firebase disconnects?
The dashboard's `.info/connected` listener changes the UI to Connection Lost. Firebase clients can reconnect automatically when connectivity returns.

### 22. Why can LDR darkness logic be inverted?
The ADC direction depends on which component is placed on the high side of the voltage divider.

### 23. Why store both control and current state?
`control` represents the requested command, while `current` represents the latest state reported by the ESP32.

### 24. What is the purpose of `onAuthStateChanged()`?
It detects whether a Firebase user session exists and protects the dashboard route.

### 25. How would you make this multi-user commercially secure?
Use per-user/per-device database paths, Firebase Security Rules based on `auth.uid`, device ownership, stronger device credentials/claims and least-privilege authorization.

## 20. Production limitations to understand

This project is complete for a single shared IoT prototype/dashboard. The supplied minimum security policy is intentionally based on `auth != null`, as requested. It does not implement multi-tenant ownership isolation. Therefore all authenticated users who can access this Firebase project can access the shared `iot` device data/control.

For deployment beyond a classroom/prototype environment, implement per-user/per-device authorization before connecting valuable or safety-critical appliances.

The browser uses CDN-hosted Firebase and Chart.js modules. For a fully self-contained build, these dependencies can be bundled locally with a build tool, but that is not required for Firebase Hosting.
