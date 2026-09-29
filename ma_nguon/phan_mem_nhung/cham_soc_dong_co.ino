#include <Wire.h>
#include <Adafruit_INA219.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <cmath>
#include <cstring>

#include "motorcare_features.h"
#include "motorcare_predict.h"

// ESP32 DevKit / ESP32-WROOM, same I2C connections as the MotorCare prototype.
constexpr uint8_t MPU_ADDR = 0x68;
constexpr uint8_t SDA_PIN = 21;
constexpr uint8_t SCL_PIN = 22;
constexpr uint32_t MPU_INTERVAL_US = 5000;   // About 200 Hz
constexpr uint32_t INA_INTERVAL_US = 50000;  // About 20 Hz
constexpr uint32_t WINDOW_US = 1000000;      // One second
constexpr float ACCEL_LSB_PER_G = 8192.0f;   // MPU6050 +/-4 g (register 0x1C=0x08)

// Điền Wi-Fi, địa chỉ MotorCare Node.js và mã do giao diện "Kết nối cảm biến" tạo.
const char *WIFI_SSID = "TEN_WIFI_CUA_BAN";
const char *WIFI_PASSWORD = "MAT_KHAU_WIFI";
const char *SERVER_URL = "http://192.168.1.10:3000/api/devices/readings";
const char *DEVICE_CODE = "MC-EDGE-XXXX";
const char *DEVICE_TOKEN = "DAN_MA_KET_NOI_TU_DASHBOARD";

Adafruit_INA219 ina219(0x40);
McAccel accel[MC_MAX_ACCEL];
McElectrical electrical[MC_MAX_ELECTRICAL];
int accel_count = 0, electrical_count = 0;
uint32_t next_mpu_us, next_ina_us, window_start_us;

static bool write_mpu(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  Wire.write(value);
  return Wire.endTransmission() == 0;
}

static bool read_acceleration(float &x, float &y, float &z) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);  // ACCEL_XOUT_H
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(MPU_ADDR, static_cast<uint8_t>(6)) != 6) return false;
  auto read_word = []() -> int16_t {
    uint16_t hi = static_cast<uint8_t>(Wire.read());
    uint16_t lo = static_cast<uint8_t>(Wire.read());
    return static_cast<int16_t>((hi << 8) | lo);
  };
  // Match the original CSV display precision of 0.001 g.
  x = roundf((read_word() / ACCEL_LSB_PER_G) * 1000.f) / 1000.f;
  y = roundf((read_word() / ACCEL_LSB_PER_G) * 1000.f) / 1000.f;
  z = roundf((read_word() / ACCEL_LSB_PER_G) * 1000.f) / 1000.f;
  return true;
}

static void show_result(const float p[3]) {
  Serial.printf("ket=%.3f  rung=%.3f  sut_ap=%.3f  => ", p[0], p[1], p[2]);
  bool jam = p[0] >= .5f, vibration = p[1] >= .5f, sag = p[2] >= .5f;
  if (!jam && !vibration && !sag) {
    Serial.println("BINH THUONG");
    return;
  }
  bool first = true;
  if (jam) { Serial.print("KET TAI"); first = false; }
  if (vibration) { if (!first) Serial.print(" + "); Serial.print("RUNG"); first = false; }
  if (sag) { if (!first) Serial.print(" + "); Serial.print("SUT AP"); }
  Serial.println();
}

static const char *fault_state(const float p[3]) {
  bool jam = p[0] >= .5f, vibration = p[1] >= .5f, sag = p[2] >= .5f;
  if (jam && vibration && sag) return "jam+vibration+sag";
  if (jam && vibration) return "jam+vibration";
  if (jam && sag) return "jam+sag";
  if (vibration && sag) return "vibration+sag";
  if (jam) return "jam";
  if (vibration) return "vibration";
  if (sag) return "sag";
  return "normal";
}

static void connect_wifi() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("Dang ket noi Wi-Fi: %s\n", WIFI_SSID);
  uint32_t started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 15000) {
    delay(300);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Wi-Fi OK, IP ESP32: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Chua vao duoc Wi-Fi; van do va chay ML, se thu gui lai o cua so sau.");
  }
}

static void send_to_web(const float features[15], const float p[3]) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Web: bo qua gui vi ESP32 chua co Wi-Fi.");
    return;
  }

  char payload[520];
  snprintf(payload, sizeof(payload),
    "{\"deviceCode\":\"%s\",\"state\":\"%s\",\"jam_probability\":%.6f,\"vibration_probability\":%.6f,\"sag_probability\":%.6f,\"voltage_v\":%.4f,\"current_ma\":%.3f,\"vibration_rms_g\":%.5f,\"uptime_ms\":%lu}",
    DEVICE_CODE,
    fault_state(p), p[0], p[1], p[2], features[9], features[12], features[3],
    static_cast<unsigned long>(millis()));

  HTTPClient http;
  http.setTimeout(800);
  if (!http.begin(SERVER_URL)) {
    Serial.println("Web: URL server khong hop le.");
    return;
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Code", DEVICE_CODE);
  http.addHeader("X-Device-Token", DEVICE_TOKEN);
  int response = http.POST(reinterpret_cast<uint8_t *>(payload), strlen(payload));
  if (response > 0) {
    Serial.printf("Web: HTTP %d\n", response);
  } else {
    Serial.printf("Web: gui that bai (%s)\n", http.errorToString(response).c_str());
  }
  http.end();
}

static void finish_window() {
  float features[15];
  if (!mc_extract_features(accel, accel_count, electrical, electrical_count, features)) {
    Serial.printf("Khong du du lieu: MPU=%d, INA=%d; bo qua cua so nay\n",
                  accel_count, electrical_count);
  } else {
    float probability[3];
    mc_predict(features, probability);
    Serial.printf("Do duoc: V=%.3f, I=%.1f mA, dao_dong=%.3f g\n",
                  features[9], features[12], features[3]);
    show_result(probability);
    send_to_web(features, probability);
  }
  accel_count = 0;
  electrical_count = 0;
}

void setup() {
  Serial.begin(115200);
  delay(400);
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(400000);

  if (!write_mpu(0x6B, 0x00) || !write_mpu(0x1C, 0x08)) {
    Serial.println("Khong khoi tao duoc MPU6050 tai 0x68");
    while (true) delay(1000);
  }
  if (!ina219.begin()) {
    Serial.println("Khong tim thay INA219 tai 0x40");
    while (true) delay(1000);
  }
  ina219.setCalibration_32V_2A();

  float check[3];
  mc_predict(MC_TEST_X, check);
  Serial.printf("Tu kiem tra ESP32: %.6f, %.6f, %.6f\n", check[0], check[1], check[2]);
  Serial.printf("Mong doi tu Python: %.6f, %.6f, %.6f\n",
                MC_TEST_Y[0], MC_TEST_Y[1], MC_TEST_Y[2]);
  connect_wifi();
  Serial.println("Bat dau MotorCare V1: 1 du doan moi giay");

  uint32_t start = micros();
  window_start_us = start;
  next_mpu_us = start;
  next_ina_us = start;
}

void loop() {
  uint32_t now = micros();
  if (static_cast<int32_t>(now - next_mpu_us) >= 0) {
    next_mpu_us += MPU_INTERVAL_US;
    if (static_cast<int32_t>(now - next_mpu_us) > 0)
      next_mpu_us = now + MPU_INTERVAL_US;  // Never take catch-up duplicates
    float x, y, z;
    if (accel_count < MC_MAX_ACCEL && read_acceleration(x, y, z) &&
        !(y == -.126f && z == -.126f)) {
      accel[accel_count++] = {now, x, y, z};
    }
  }
  now = micros();
  if (static_cast<int32_t>(now - next_ina_us) >= 0) {
    next_ina_us += INA_INTERVAL_US;
    if (static_cast<int32_t>(now - next_ina_us) > 0)
      next_ina_us = now + INA_INTERVAL_US;
    float volts = ina219.getBusVoltage_V();
    float current = ina219.getCurrent_mA();
    if (electrical_count < MC_MAX_ELECTRICAL && std::isfinite(volts) &&
        std::isfinite(current) && volts >= 0 && volts <= 24) {
      electrical[electrical_count++] = {volts, current};
    }
  }
  if (static_cast<uint32_t>(micros() - window_start_us) >= WINDOW_US) {
    finish_window();
    window_start_us = micros();
  }
}
