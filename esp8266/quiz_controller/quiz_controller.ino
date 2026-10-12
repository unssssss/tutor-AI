#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>

// change these before uploading
const char* WIFI_SSID = "your_wifi_name";
const char* WIFI_PASSWORD = "your_wifi_password";

// change this to your computer's local ip address, the one running the flask backend
const char* SERVER_HOST = "192.168.1.100";
const int SERVER_PORT = 5000;

// pins, chosen to avoid the esp8266 boot sensitive pins
const int YES_BUTTON = 5;   // D1
const int NO_BUTTON  = 4;   // D2
const int GREEN_LED  = 14;  // D5
const int RED_LED    = 12;  // D6
const int BUZZER     = 13;  // D7

const unsigned long DEBOUNCE_MS = 300;
const unsigned long HEARTBEAT_MS = 5000;

unsigned long lastPressTime = 0;
unsigned long lastHeartbeat = 0;
bool busy = false;

void setup() {
  Serial.begin(115200);

  pinMode(YES_BUTTON, INPUT_PULLUP);
  pinMode(NO_BUTTON, INPUT_PULLUP);
  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(BUZZER, OUTPUT);

  digitalWrite(GREEN_LED, LOW);
  digitalWrite(RED_LED, LOW);
  digitalWrite(BUZZER, LOW);

  connectWifi();
}

void connectWifi() {
  Serial.print("connecting to wifi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(300);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("");
    Serial.print("connected, ip: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("");
    Serial.println("could not connect yet, will keep retrying in the loop");
  }
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
    return;
  }

  if (!busy) {
    if (digitalRead(YES_BUTTON) == LOW && millis() - lastPressTime > DEBOUNCE_MS) {
      lastPressTime = millis();
      sendAnswer("yes");
    } else if (digitalRead(NO_BUTTON) == LOW && millis() - lastPressTime > DEBOUNCE_MS) {
      lastPressTime = millis();
      sendAnswer("no");
    }
  }

  if (millis() - lastHeartbeat > HEARTBEAT_MS) {
    lastHeartbeat = millis();
    sendHeartbeat();
  }
}

void sendAnswer(String answer) {
  busy = true;

  WiFiClient client;
  HTTPClient http;
  String url = "http://" + String(SERVER_HOST) + ":" + String(SERVER_PORT) + "/answer";

  http.begin(client, url);
  http.addHeader("Content-Type", "text/plain");
  int code = http.POST(answer);

  String result = "";
  if (code == 200) {
    result = http.getString();
  }
  http.end();

  result.trim();
  result.toUpperCase();

  Serial.print("sent ");
  Serial.print(answer);
  Serial.print(", got ");
  Serial.println(result);

  if (result == "CORRECT") {
    playCorrect();
  } else if (result == "WRONG") {
    playWrong();
  } else {
    playError();
  }

  busy = false;
}

void sendHeartbeat() {
  WiFiClient client;
  HTTPClient http;
  String url = "http://" + String(SERVER_HOST) + ":" + String(SERVER_PORT) + "/esp/ping";
  http.begin(client, url);
  http.GET();
  http.end();
}

void playCorrect() {
  digitalWrite(GREEN_LED, HIGH);
  digitalWrite(BUZZER, HIGH);
  delay(1000);
  digitalWrite(BUZZER, LOW);
  digitalWrite(GREEN_LED, LOW);
}

void playWrong() {
  digitalWrite(RED_LED, HIGH);
  for (int i = 0; i < 3; i++) {
    digitalWrite(BUZZER, HIGH);
    delay(500);
    digitalWrite(BUZZER, LOW);
    delay(200);
  }
  digitalWrite(RED_LED, LOW);
}

void playError() {
  for (int i = 0; i < 2; i++) {
    digitalWrite(GREEN_LED, HIGH);
    digitalWrite(RED_LED, HIGH);
    delay(150);
    digitalWrite(GREEN_LED, LOW);
    digitalWrite(RED_LED, LOW);
    delay(150);
  }
}
