/*
 * ======================================================================================
 *  MotorCare V3 Final Optimal — Bản Firmware Arduino (.ino) Độc lập Hoàn chỉnh cho ESP32
 * ======================================================================================
 *  - Tương thích: Arduino IDE (Board: "ESP32 Dev Module") & PlatformIO (espressif32)
 *  - Không cần cài thêm thư viện ngoài (chỉ dùng <Arduino.h> và <Wire.h> có sẵn của ESP32)
 *  - Đã nhúng sẵn toàn bộ lõi C++17 MotorCare V3 Final ngay trong 1 file .ino duy nhất:
 *      1. Quality Gate & Nhánh chẩn đoán điện độc lập (curate)
 *      2. Bộ trích xuất 84 đặc trưng Vật lý & Hình học Bất biến quay 3D SO(3) (float32)
 *      3. Model Decoupled Multi-Head + 5-Stage Physics Guardrails:
 *         - Mặc định: v3_final_accuracy36 (13.508 byte, 99,66% Accuracy, 0% Normal FP)
 *         - Tuỳ chọn: v3_final_lite20 (11.464 byte, bỏ Goertzel FFT, nhanh gấp 2,7x)
 *           -> Đổi "#ifndef MOTORCARE_USE_LITE
#define MOTORCARE_USE_LITE 0
#endif" bên dưới thành 1 nếu muốn dùng bản Lite.
 *      4. Hồ sơ Novelty Shadow Mahalanobis Ledoit-Wolf 20 chiều (1.844 byte)
 *      5. Timeline cố định 10 giây (cảnh báo khi >= 8/10 giây có bằng chứng lỗi)
 *
 *  SƠ ĐỒ ĐẤU NỐI PHẦN CỨNG MẶC ĐỊNH (I2C Fast Mode 400 kHz):
 *    - ESP32 GPIO 21 (SDA)  <--->  MPU6050 SDA + INA219 SDA
 *    - ESP32 GPIO 22 (SCL)  <--->  MPU6050 SCL + INA219 SCL
 *    - ESP32 GPIO 2  (LED)  <--->  Đèn báo trạng thái / Cảnh báo lỗi (Active HIGH)
 *    - Địa chỉ I2C: MPU6050 = 0x68 (thang ±2g, 200 Hz), INA219 = 0x40 (20 Hz)
 * ======================================================================================
 */

#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <ctime>
#include <limits>

// Đặt thành 1 nếu muốn nạp bản siêu nhẹ v3_final_lite20 (bỏ tính phổ Goertzel 101-bin)
#ifndef MOTORCARE_USE_LITE
#define MOTORCARE_USE_LITE 0
#endif

// Các giá trị này được Dashboard tự động thay thế khi tạo gói firmware.
const char *WIFI_SSID = "TEN_WIFI_CUA_BAN";
const char *WIFI_PASSWORD = "MAT_KHAU_WIFI";
const char *SERVER_URL = "http://192.168.1.10:3000/api/devices/readings";
const char *DEVICE_CODE = "MC-EDGE-XXXX";
const char *DEVICE_TOKEN = "DAN_MA_KET_NOI_TU_DASHBOARD";

// Cấu hình chân phần cứng ESP32
constexpr int PIN_I2C_SDA   = 21;
constexpr int PIN_I2C_SCL   = 22;
constexpr int PIN_ALARM_LED = 2;   // LED tích hợp trên hầu hết board ESP32 DevKit
constexpr uint32_t I2C_FREQ_HZ = 400000;

// Địa chỉ I2C mặc định của MPU6050 và INA219
constexpr uint8_t MPU6050_ADDR = 0x68;
constexpr uint8_t INA219_ADDR  = 0x40;

#include "motorcare_v3_final_runtime.h"
#include "motorcare_tls.h"

// ======================================================================================
//  PHẦN DRIVER I2C (MPU6050 200Hz ±2g & INA219 20Hz) + DOUBLE BUFFER FREERTOS ESP32
// ======================================================================================

// Cấp phát tĩnh Double Buffer (2 RawWindow) + Runtime ở vùng nhớ toàn cục (SRAM tĩnh, không tốn stack)
static motorcare_runtime::RawWindow g_buffers[2];
static motorcare_runtime::Runtime   g_detector;

static volatile int      g_write_idx = 0;
static volatile uint64_t g_session_id = 1;
static bool              g_mpu_ok = false;
static bool              g_ina_ok = false;

#if defined(ESP32)
static QueueHandle_t     g_window_queue = nullptr;
static QueueHandle_t     g_web_queue = nullptr;

struct WebPayload {
  char json[768];
};
#endif

// Ghi 1 byte vào thanh ghi I2C
static bool i2c_write_reg8(uint8_t addr, uint8_t reg, uint8_t val) {
  Wire.beginTransmission(addr);
  Wire.write(reg);
  Wire.write(val);
  return (Wire.endTransmission() == 0);
}

// Ghi 16-bit (Big-Endian) vào thanh ghi I2C (dùng cho INA219)
static bool i2c_write_reg16(uint8_t addr, uint8_t reg, uint16_t val) {
  Wire.beginTransmission(addr);
  Wire.write(reg);
  Wire.write(uint8_t((val >> 8) & 0xFF));
  Wire.write(uint8_t(val & 0xFF));
  return (Wire.endTransmission() == 0);
}

// Đọc 16-bit (Big-Endian) từ thanh ghi I2C
static bool i2c_read_reg16(uint8_t addr, uint8_t reg, int16_t &out_val) {
  Wire.beginTransmission(addr);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(int(addr), 2) != 2) return false;
  uint16_t hi = Wire.read();
  uint16_t lo = Wire.read();
  out_val = int16_t((hi << 8) | lo);
  return true;
}

// Khởi tạo MPU6050 đúng hợp đồng chất lượng V3 Final: thang ±2g (16384 LSB/g), DLPF 94Hz, 200Hz
static bool init_mpu6050() {
  // Đánh thức MPU6050 (PWR_MGMT_1 = 0x6B -> 0x01: PLL with X axis gyroscope reference)
  if (!i2c_write_reg8(MPU6050_ADDR, 0x6B, 0x01)) return false;
  delay(10);
  // Cấu hình DLPF = 2 (94Hz accel bandwidth, 1kHz internal rate) tại thanh ghi CONFIG (0x1A)
  if (!i2c_write_reg8(MPU6050_ADDR, 0x1A, 0x02)) return false;
  // Chia tần số lấy mẫu SMPLRT_DIV (0x19) = 4 -> 1000Hz / (1 + 4) = 200Hz
  if (!i2c_write_reg8(MPU6050_ADDR, 0x19, 0x04)) return false;
  // Cấu hình thang đo gia tốc ±2g (AFS_SEL = 0 -> 0x00) tại ACCEL_CONFIG (0x1C)
  if (!i2c_write_reg8(MPU6050_ADDR, 0x1C, 0x00)) return false;
  return true;
}

// Đọc 3 trục gia tốc MPU6050 (đổi sang đơn vị g theo chuẩn int16 / 16384.0f)
static bool read_mpu6050_g(float &ax_g, float &ay_g, float &az_g) {
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x3B); // ACCEL_XOUT_H
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(int(MPU6050_ADDR), 6) != 6) return false;
  int16_t raw_ax = int16_t((uint16_t(Wire.read()) << 8) | uint16_t(Wire.read()));
  int16_t raw_ay = int16_t((uint16_t(Wire.read()) << 8) | uint16_t(Wire.read()));
  int16_t raw_az = int16_t((uint16_t(Wire.read()) << 8) | uint16_t(Wire.read()));
  constexpr float INV_16384 = 1.0f / 16384.0f;
  ax_g = float(raw_ax) * INV_16384;
  ay_g = float(raw_ay) * INV_16384;
  az_g = float(raw_az) * INV_16384;
  return true;
}

// Khởi tạo INA219 ở cấu hình chuẩn 32V / 2A (Shunt 0.1 Ohm, Calibration = 4096)
static bool init_ina219() {
  // Calibration register (0x05) = 4096 -> Current_LSB = 0.1 mA (10 LSB / mA)
  if (!i2c_write_reg16(INA219_ADDR, 0x05, 4096)) return false;
  // Config register (0x00) = 0x399F (32V bus range, ±320mV shunt, 12-bit continuous)
  if (!i2c_write_reg16(INA219_ADDR, 0x00, 0x399F)) return false;
  return true;
}

// Đọc điện áp Bus (V) và dòng điện (mA) từ INA219
static bool read_ina219(float &bus_v, float &current_ma) {
  int16_t raw_bus = 0, raw_cur = 0;
  if (!i2c_read_reg16(INA219_ADDR, 0x02, raw_bus)) return false;
  // Re-write calibration phòng trường hợp INA219 vừa power-on reset
  i2c_write_reg16(INA219_ADDR, 0x05, 4096);
  if (!i2c_read_reg16(INA219_ADDR, 0x04, raw_cur)) return false;
  // Bit 3..15 của Bus Voltage Register: 1 LSB = 4 mV = 0.004 V
  bus_v = float((uint16_t(raw_bus) >> 3) * 4) * 0.001f;
  // Với Cal = 4096 và R_shunt = 0.1 Ohm: 1 LSB dòng = 0.1 mA
  current_ma = float(raw_cur) * 0.1f;
  return true;
}

static void set_raw_ina(
  motorcare_runtime::RawIna &sample,
  uint32_t row_us,
  uint32_t measured_us,
  float bus_v,
  float current_ma
) {
  sample.row_us = row_us;
  sample.us = measured_us;
  sample.bus_v = bus_v;
  sample.current_ma = current_ma;
  sample.complete = true;
}

// In tiêu đề CSV và thông tin khởi động
static void print_banner() {
  Serial.println();
  Serial.println(F("================================================================================"));
  Serial.print(F(" MotorCare V3 Final Optimal Runtime | Model: "));
  Serial.print(motorcare_runtime::model_name());
  Serial.print(F(" | Flash Array: "));
  Serial.print(motorcare_runtime::model_array_bytes());
  Serial.println(F(" bytes"));
  Serial.print(F(" Static RAM (2xRawWindow + Runtime + Scratch): "));
  Serial.print(2 * sizeof(motorcare_runtime::RawWindow) +
               sizeof(motorcare_runtime::Runtime) +
               sizeof(motorcare_v3_final_features::Scratch));
  Serial.println(F(" bytes"));
  Serial.println(F("================================================================================"));
  Serial.println(F("slot,reason,elec_ok,v_med_V,i_med_mA,inferred,pred_class,support,p_jam,p_vib,p_sag,pos_jam,pos_vib,pos_sag,alarm_jam,alarm_vib,alarm_sag,shadow_dist,novelty,conflict,infer_us"));
}

// Chạy tự kiểm tra (Self-Test) ngay khi bật nguồn (Kiểm tra mẫu Normal & mẫu Rung + Sụt áp)
static void run_boot_selftest() {
  static motorcare_runtime::RawWindow test_w;
  const uint32_t anchor = 1000000;

  // Ca 1: Motor quay êm bình thường (12.2V, 920mA với nhấp nhô chuyển mạch tự nhiên, biên độ động ~0.010g @ ~90Hz)
  test_w.nm = 200; test_w.ni = 20; test_w.observed_span_us = 995000;
  test_w.mpu_overflow = test_w.ina_overflow = test_w.mpu_error = test_w.ina_error = false;
  for (int i = 0; i < 200; ++i) {
    float ax = 0.012f * std::sin(2.8f * i) + 0.002f * std::cos(0.7f * i);
    float ay = 0.004f * std::cos(2.8f * i);
    float az = 1.002f + 0.002f * std::sin(1.4f * i);
    test_w.m[i] = {anchor + uint32_t(i * 5000), ax, ay, az};
  }
  for (int i = 0; i < 20; ++i) {
    uint32_t t_us = anchor + uint32_t(i * 50000);
    float cur = 920.0f + 110.0f * std::sin(1.7f * i);
    set_raw_ina(test_w.e[i], t_us, t_us, 12.20f, cur);
  }
  uint32_t t0 = micros();
  auto out1 = g_detector.process(test_w, 999998ULL, 0ULL);
  uint32_t dt1_us = micros() - t0;

  // Ca 2: Motor lỗi Rung mạnh + Sụt áp nguồn (V = 7.2V, biên độ rung 3D ~0.55g)
  for (int i = 0; i < 200; ++i) {
    float ax = 0.65f * std::sin(0.9f * i) + 0.25f * std::cos(2.2f * i);
    float ay = 0.45f * std::cos(0.9f * i) + 0.18f * std::sin(1.5f * i);
    float az = 1.00f + 0.35f * std::sin(0.6f * i + 0.4f);
    test_w.m[i] = {anchor + uint32_t(i * 5000), ax, ay, az};
  }
  for (int i = 0; i < 20; ++i) {
    uint32_t t_us = anchor + uint32_t(i * 50000);
    float cur = 810.0f + 95.0f * std::sin(1.5f * i);
    set_raw_ina(test_w.e[i], t_us, t_us, 7.20f, cur);
  }
  uint32_t t1 = micros();
  auto out2 = g_detector.process(test_w, 999999ULL, 0ULL);
  uint32_t dt2_us = micros() - t1;
  g_detector.reset(); // Xóa lịch sử self-test trước khi vào phiên đo thật

#if MOTORCARE_USE_LITE
  const char* const* cnames = motorcare_v3_final_lite::class_names;
#else
  const char* const* cnames = motorcare_v3_final_accuracy::class_names;
#endif
  Serial.print(F("[SELF-TEST 1/2 Normal] class="));
  Serial.print(out1.inferred ? cnames[out1.class_index] : "ERR");
  Serial.print(F(" (p=")); Serial.print(out1.max_support, 4);
  Serial.print(F(", ")); Serial.print(dt1_us); Serial.print(F(" us) | "));
  Serial.print(F("[SELF-TEST 2/2 Vib+Sag] class="));
  Serial.print(out2.inferred ? cnames[out2.class_index] : "ERR");
  Serial.print(F(" (p=")); Serial.print(out2.max_support, 4);
  Serial.print(F(", ")); Serial.print(dt2_us); Serial.println(F(" us)"));
}

#if defined(ESP32)
static bool sync_tls_clock() {
  if (!String(SERVER_URL).startsWith("https://")) return true;

  time_t now = 0;
  time(&now);
  if (now >= 1700000000) return true;

  configTime(0, 0, "pool.ntp.org", "time.google.com");
  const uint32_t started = millis();
  while (now < 1700000000 && millis() - started < 10000) {
    time(&now);
    delay(200);
  }
  return now >= 1700000000;
}

static void connect_wifi() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[WEB] Dang ket noi Wi-Fi: %s\n", WIFI_SSID);

  const uint32_t started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 15000) {
    delay(300);
    Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print(F("[WEB] Wi-Fi OK, IP ESP32: "));
    Serial.println(WiFi.localIP());
    Serial.println(sync_tls_clock()
      ? F("[WEB] Dong ho TLS san sang.")
      : F("[WEB] Chua dong bo duoc dong ho; HTTPS co the tam thoi that bai."));
  } else {
    Serial.println(F("[WEB] Chua co Wi-Fi; Edge AI van chay va se thu lai o cua so sau."));
  }
}

static void json_number(char *buffer, size_t size, bool available, double value, int precision) {
  if (!available || !std::isfinite(value)) {
    snprintf(buffer, size, "null");
    return;
  }
  snprintf(buffer, size, "%.*f", precision, value);
}

static void enqueue_for_web(
  const motorcare_runtime::Output &out,
  const char *class_name,
  float vibration_rms_g
) {
  if (!g_web_queue || (!out.quality.electrical_valid && !out.inferred)) return;

  char voltage[24], current[24], vibration[24];
  char jam[24], vibration_probability[24], sag[24], normal_distance[32];
  json_number(voltage, sizeof(voltage), out.quality.electrical_valid,
              out.quality.voltage_median, 4);
  json_number(current, sizeof(current), out.quality.electrical_valid,
              std::fabs(out.quality.current_median), 3);
  json_number(vibration, sizeof(vibration), out.inferred, vibration_rms_g, 6);
  json_number(jam, sizeof(jam), out.inferred, out.fault_support[0], 6);
  json_number(vibration_probability, sizeof(vibration_probability), out.inferred,
              out.fault_support[1], 6);
  json_number(sag, sizeof(sag), out.inferred, out.fault_support[2], 6);
  json_number(normal_distance, sizeof(normal_distance), out.profile_known,
              out.normal_distance, 4);

  WebPayload payload{};
  snprintf(payload.json, sizeof(payload.json),
    "{\"deviceCode\":\"%s\",\"firmware_version\":\"v3_final\","
    "\"model\":\"%s\",\"state\":\"%s\",\"quality\":\"%s\","
    "\"jam_probability\":%s,\"vibration_probability\":%s,"
    "\"sag_probability\":%s,\"voltage_v\":%s,\"current_ma\":%s,"
    "\"vibration_rms_g\":%s,\"normal_distance\":%s,"
    "\"novelty\":%s,\"conflict\":%s,"
    "\"alarm_jam\":%s,\"alarm_vibration\":%s,\"alarm_sag\":%s,"
    "\"uptime_ms\":%lu}",
    DEVICE_CODE,
    motorcare_runtime::model_name(),
    out.inferred ? class_name : "unknown",
    motorcare_runtime::reason_name(out.quality.reason),
    jam, vibration_probability, sag, voltage, current, vibration, normal_distance,
    out.novelty ? "true" : "false",
    out.conflict ? "true" : "false",
    out.timeline.alarm[0] ? "true" : "false",
    out.timeline.alarm[1] ? "true" : "false",
    out.timeline.alarm[2] ? "true" : "false",
    static_cast<unsigned long>(millis()));

  if (xQueueSend(g_web_queue, &payload, 0) == pdTRUE) return;

  WebPayload discarded{};
  xQueueReceive(g_web_queue, &discarded, 0);
  xQueueSend(g_web_queue, &payload, 0);
  Serial.println(F("[WEB] Hang doi day, da bo goi cu nhat."));
}

static void web_task(void *) {
  WebPayload payload{};
  for (;;) {
    if (xQueueReceive(g_web_queue, &payload, portMAX_DELAY) != pdTRUE) continue;
    if (WiFi.status() != WL_CONNECTED) {
      WiFi.reconnect();
      Serial.println(F("[WEB] Chua co Wi-Fi, bo qua goi hien tai."));
      continue;
    }
    if (!sync_tls_clock()) {
      Serial.println(F("[WEB] Chua co thoi gian chinh xac de xac minh TLS."));
      continue;
    }

    HTTPClient http;
    WiFiClientSecure secure_client;
    http.setConnectTimeout(3000);
    http.setTimeout(5000);

    bool started = false;
    if (String(SERVER_URL).startsWith("https://")) {
      secure_client.setCACert(MOTORCARE_ROOT_CA);
      started = http.begin(secure_client, SERVER_URL);
    } else {
      started = http.begin(SERVER_URL);
    }
    if (!started) {
      Serial.println(F("[WEB] SERVER_URL khong hop le."));
      continue;
    }

    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-Code", DEVICE_CODE);
    http.addHeader("X-Device-Token", DEVICE_TOKEN);
    const int response = http.POST(
      reinterpret_cast<uint8_t *>(payload.json),
      strlen(payload.json)
    );
    if (response > 0) {
      Serial.printf("[WEB] HTTP %d\n", response);
    } else {
      Serial.printf("[WEB] Gui that bai (%s)\n", http.errorToString(response).c_str());
    }
    http.end();
  }
}
#endif

// Xử lý và in kết quả của 1 cửa sổ 1 giây
static void process_and_log_window(const motorcare_runtime::RawWindow &win, uint64_t session_id, uint64_t slot_idx) {
  uint32_t t0 = micros();
  motorcare_runtime::Output out = g_detector.process(win, session_id, slot_idx);
  uint32_t infer_us = micros() - t0;

  const char* cls_name = "UNKNOWN";
  if (out.inferred && out.class_index >= 0 && out.class_index < 6) {
#if MOTORCARE_USE_LITE
    cls_name = motorcare_v3_final_lite::class_names[out.class_index];
#else
    cls_name = motorcare_v3_final_accuracy::class_names[out.class_index];
#endif
  }

  bool any_alarm = out.timeline.alarm[0] || out.timeline.alarm[1] || out.timeline.alarm[2];
  digitalWrite(PIN_ALARM_LED, any_alarm ? HIGH : LOW);

  // In dòng CSV chuẩn lên Serial Monitor / Serial Plotter
  Serial.print((unsigned long)slot_idx); Serial.print(',');
  Serial.print(motorcare_runtime::reason_name(out.quality.reason)); Serial.print(',');
  Serial.print(out.quality.electrical_valid ? 1 : 0); Serial.print(',');
  if (out.quality.electrical_valid) {
    Serial.print(out.quality.voltage_median, 3); Serial.print(',');
    Serial.print(out.quality.current_median, 1); Serial.print(',');
  } else {
    Serial.print(F("NaN,NaN,"));
  }
  Serial.print(out.inferred ? 1 : 0); Serial.print(',');
  Serial.print(cls_name); Serial.print(',');
  Serial.print(out.max_support, 4); Serial.print(',');
  Serial.print(out.fault_support[0], 4); Serial.print(',');
  Serial.print(out.fault_support[1], 4); Serial.print(',');
  Serial.print(out.fault_support[2], 4); Serial.print(',');
  Serial.print(int(out.timeline.positive[0])); Serial.print(',');
  Serial.print(int(out.timeline.positive[1])); Serial.print(',');
  Serial.print(int(out.timeline.positive[2])); Serial.print(',');
  Serial.print(out.timeline.alarm[0] ? 1 : 0); Serial.print(',');
  Serial.print(out.timeline.alarm[1] ? 1 : 0); Serial.print(',');
  Serial.print(out.timeline.alarm[2] ? 1 : 0); Serial.print(',');
  if (out.profile_known) {
    Serial.print(out.normal_distance, 3);
  } else {
    Serial.print(F("NaN"));
  }
  Serial.print(',');
  Serial.print(out.novelty ? 1 : 0); Serial.print(',');
  Serial.print(out.conflict ? 1 : 0); Serial.print(',');
  Serial.println((unsigned long)infer_us);

#if defined(ESP32)
  const float vibration_rms_g = out.inferred ? g_detector.core_features()[3] : NAN;
  enqueue_for_web(out, cls_name, vibration_rms_g);
#endif
}

#if defined(ESP32)
// Item gửi qua Queue từ Task Thu (Core 1) sang Task Suy luận (Core 0)
struct QueueItem {
  int buffer_index;
  uint64_t session_id;
  uint64_t slot_index;
};

// Task Thu mẫu cảm biến tốc độ cao (200Hz MPU6050 + 20Hz INA219) ghim trên Core 1
static void acquisition_task(void *pvParameters) {
  (void)pvParameters;
  uint64_t slot_index = 0;
  uint32_t slot_start_us = micros();
  uint32_t next_sample_us = slot_start_us;
  int sample_tick = 0;

  motorcare_runtime::RawWindow *cur = &g_buffers[g_write_idx];
  cur->nm = 0; cur->ni = 0;
  cur->observed_span_us = 0;
  cur->mpu_overflow = cur->ina_overflow = cur->mpu_error = cur->ina_error = false;

  for (;;) {
    uint32_t now_us = micros();
    // Chờ đến đúng mốc 5000 us (200 Hz)
    int32_t wait_us = int32_t(next_sample_us - now_us);
    if (wait_us > 1500) {
      vTaskDelay(pdMS_TO_TICKS(wait_us / 1000));
      continue;
    } else if (wait_us > 0) {
      delayMicroseconds(wait_us);
    }
    uint32_t sample_us = micros();
    next_sample_us += 5000;
    // Nếu bị trễ quá 250ms (ví dụ bus bị treo), mở session mới
    if (int32_t(sample_us - next_sample_us) > 250000) {
      ++g_session_id;
      slot_index = 0;
      slot_start_us = sample_us;
      next_sample_us = sample_us + 5000;
      cur->nm = 0; cur->ni = 0;
      cur->mpu_overflow = cur->ina_overflow = cur->mpu_error = cur->ina_error = false;
      sample_tick = 0;
    }

    // Kiểm tra kết thúc cửa sổ 1 giây (1.000.000 us hoặc đủ 200 mẫu MPU)
    if (uint32_t(sample_us - slot_start_us) >= 1000000U || cur->nm >= 200) {
      cur->observed_span_us = (cur->nm > 1) ? (cur->m[cur->nm - 1].us - cur->m[0].us) : uint32_t(sample_us - slot_start_us);
      int closed_idx = g_write_idx;
      g_write_idx = 1 - g_write_idx;
      QueueItem item = {closed_idx, g_session_id, slot_index};
      xQueueSend(g_window_queue, &item, 0);

      ++slot_index;
      slot_start_us = sample_us;
      cur = &g_buffers[g_write_idx];
      cur->nm = 0; cur->ni = 0;
      cur->observed_span_us = 0;
      cur->mpu_overflow = cur->ina_overflow = cur->mpu_error = cur->ina_error = false;
      sample_tick = 0;
    }

    // 1. Đọc MPU6050 ở 200 Hz
    float ax = 0, ay = 0, az = 0;
    bool mpu_read_ok = g_mpu_ok && read_mpu6050_g(ax, ay, az);
    if (!mpu_read_ok) {
      cur->mpu_error = true;
    } else {
      if (cur->nm < motorcare_runtime::MAX_MPU) {
        cur->m[cur->nm++] = {sample_us, ax, ay, az};
      } else {
        cur->mpu_overflow = true;
      }
    }

    // 2. Đọc INA219 mỗi 10 chu kỳ MPU (50 ms = 20 Hz)
    if (sample_tick % 10 == 0) {
      float bus_v = 0, cur_ma = 0;
      uint32_t ina_us = micros();
      bool ina_read_ok = g_ina_ok && read_ina219(bus_v, cur_ma);
      if (!ina_read_ok) {
        cur->ina_error = true;
      } else {
        if (cur->ni < motorcare_runtime::MAX_INA) {
          set_raw_ina(cur->e[cur->ni++], sample_us, ina_us, bus_v, cur_ma);
        } else {
          cur->ina_overflow = true;
        }
      }
    }
    ++sample_tick;
  }
}

// Task Worker tính 84 đặc trưng + suy luận V3 Final + Hồ sơ Shadow + Timeline trên Core 0
static void inference_worker_task(void *pvParameters) {
  (void)pvParameters;
  QueueItem item;
  for (;;) {
    if (xQueueReceive(g_window_queue, &item, portMAX_DELAY) == pdTRUE) {
      process_and_log_window(g_buffers[item.buffer_index], item.session_id, item.slot_index);
    }
  }
}
#endif // defined(ESP32)

void setup() {
  pinMode(PIN_ALARM_LED, OUTPUT);
  digitalWrite(PIN_ALARM_LED, LOW);

  Serial.begin(115200);
  delay(200);

  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL, I2C_FREQ_HZ);
  g_mpu_ok = init_mpu6050();
  g_ina_ok = init_ina219();

  print_banner();
  Serial.print(F("[I2C INIT] MPU6050 (0x68): "));
  Serial.print(g_mpu_ok ? F("OK (±2g, 200Hz)") : F("NOT FOUND"));
  Serial.print(F(" | INA219 (0x40): "));
  Serial.println(g_ina_ok ? F("OK (32V/2A, 20Hz)") : F("NOT FOUND"));

  // Chạy kiểm tra nội bộ 1 cửa sổ mẫu ngay khi khởi động
  run_boot_selftest();

#if defined(ESP32)
  connect_wifi();
  g_window_queue = xQueueCreate(2, sizeof(QueueItem));
  g_web_queue = xQueueCreate(6, sizeof(WebPayload));
  if (!g_window_queue || !g_web_queue) {
    Serial.println(F("[BOOT] Khong tao duoc hang doi FreeRTOS."));
    while (true) delay(1000);
  }
  // Mạng chạy riêng để HTTP/TLS không chặn lấy mẫu hoặc suy luận.
  xTaskCreatePinnedToCore(web_task, "MC_Web", 8192, nullptr, 1, nullptr, 0);
  // Khởi tạo Task Worker suy luận trên Core 0 (stack 8192 byte)
  xTaskCreatePinnedToCore(inference_worker_task, "MC_Infer", 8192, nullptr, 2, nullptr, 0);
  // Khởi tạo Task Thu mẫu 200Hz/20Hz trên Core 1 (stack 4096 byte, ưu tiên cao)
  xTaskCreatePinnedToCore(acquisition_task,      "MC_Acq",   4096, nullptr, 3, nullptr, 1);
#endif
}

void loop() {
#if defined(ESP32)
  // Trên ESP32, thu mẫu, suy luận và gửi web chạy trong 3 FreeRTOS Task độc lập.
  vTaskDelay(pdMS_TO_TICKS(1000));
#else
  // Fallback tuần tự nếu biên dịch thử trên vi điều khiển không có FreeRTOS
  static uint64_t slot_idx = 0;
  motorcare_runtime::RawWindow &w = g_buffers[0];
  w.nm = 0; w.ni = 0;
  w.mpu_overflow = w.ina_overflow = w.mpu_error = w.ina_error = false;
  uint32_t start_us = micros();
  for (int i = 0; i < 200; ++i) {
    uint32_t now_us = start_us + uint32_t(i * 5000);
    while (int32_t(now_us - micros()) > 0) {}
    uint32_t s_us = micros();
    float ax = 0, ay = 0, az = 0;
    if (g_mpu_ok && read_mpu6050_g(ax, ay, az)) {
      w.m[w.nm++] = {s_us, ax, ay, az};
    } else {
      w.mpu_error = true;
    }
    if (i % 10 == 0) {
      float bv = 0, cma = 0;
      uint32_t e_us = micros();
      if (g_ina_ok && read_ina219(bv, cma)) {
        set_raw_ina(w.e[w.ni++], s_us, e_us, bv, cma);
      } else {
        w.ina_error = true;
      }
    }
  }
  w.observed_span_us = (w.nm > 1) ? (w.m[w.nm - 1].us - w.m[0].us) : 1000000U;
  process_and_log_window(w, g_session_id, slot_idx++);
#endif
}
