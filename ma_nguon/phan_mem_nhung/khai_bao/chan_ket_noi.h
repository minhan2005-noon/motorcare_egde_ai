
#include <Wire.h>
#include <Adafruit_INA219.h>

// ==========================================
// MOTORCARE - ESP32 + MPU6050 + INA219
// ==========================================

// Chan I2C
#define SDA_PIN 21
#define SCL_PIN 22

// Dia chi I2C
#define MPU_ADDR 0x68
#define INA_ADDR 0x40

// Chon che do xuat du lieu:
// 0 = Toan bo du lieu MPU + INA cho Python
// 1 = Bieu do gia toc MPU6050
// 2 = Bieu do van toc goc MPU6050
// 3 = Bieu do dien ap INA219
// 4 = Bieu do dong dien INA219
// 5 = Bieu do cong suat INA219

#define VIEW_MODE 0

// Chu ky lay mau: 100 ms = 10 mau/giay
const unsigned long SAMPLE_MS = 100;

unsigned long lastSample = 0;

Adafruit_INA219 ina219(INA_ADDR);

// ==========================================
// GHI THANH GHI MPU6050
// ==========================================

bool writeMPU(uint8_t reg, uint8_t value) {

  Wire.beginTransmission(MPU_ADDR);

  Wire.write(reg);
  Wire.write(value);

  return Wire.endTransmission() == 0;
}

// ==========================================
// DOC 2 BYTE THANH SO NGUYEN 16 BIT
// ==========================================

int16_t readInt16() {

  uint16_t highByte = Wire.read();
  uint16_t lowByte  = Wire.read();

  return (int16_t)((highByte << 8) | lowByte);
}

// ==========================================
// DOC GIA TOC VA VAN TOC GOC
// ==========================================

bool readMPU(
  float &ax,
  float &ay,
  float &az,
  float &gx,
  float &gy,
  float &gz
) {

  Wire.beginTransmission(MPU_ADDR);

  Wire.write(0x3B);

  if (Wire.endTransmission(false) != 0) {
    return false;
  }

  if (Wire.requestFrom(
        (uint16_t)MPU_ADDR,
        (uint8_t)14,
        true
      ) != 14) {
    return false;
  }

  int16_t rawAX = readInt16();
  int16_t rawAY = readInt16();
  int16_t rawAZ = readInt16();

  // Bo qua du lieu nhiet do
  readInt16();

  int16_t rawGX = readInt16();
  int16_t rawGY = readInt16();
  int16_t rawGZ = readInt16();

  // Gia toc: thang do +/- 2g
  ax = rawAX / 16384.0f;
  ay = rawAY / 16384.0f;
  az = rawAZ / 16384.0f;

  // Van toc goc: thang do +/- 250 do/s
  gx = rawGX / 131.0f;
  gy = rawGY / 131.0f;
  gz = rawGZ / 131.0f;

  return true;
}

// ==========================================
// HAM XUAT DU LIEU CHO BIEU DO
// ==========================================

void plotValue(
  const char* name,
  float value,
  bool last = false
) {

  Serial.print(name);
  Serial.print(":");
  Serial.print(value, 3);

  if (last) {
    Serial.println();
  } else {
    Serial.print('\t');
  }
}

// ==========================================
// SETUP
// ==========================================

void setup() {

  Serial.begin(115200);

  Wire.begin(SDA_PIN, SCL_PIN);

  Wire.setClock(100000);

  delay(200);

  // Khoi dong MPU6050
  if (!writeMPU(0x6B, 0x00)) {
    Serial.println("LOI: Khong tim thay MPU6050");

    while (true) {
      delay(1000);
    }
  }

  // Gia toc +/- 2g
  writeMPU(0x1C, 0x00);

  // Van toc goc +/- 250 do/s
  writeMPU(0x1B, 0x00);

  // Khoi dong INA219
  if (!ina219.begin()) {

    Serial.println("LOI: Khong tim thay INA219");

    while (true) {
      delay(1000);
    }
  }

  Serial.println("MotorCare READY");
}

// ==========================================
// LOOP
// ==========================================

void loop() {

  unsigned long now = millis();

  if (now - lastSample < SAMPLE_MS) {
    return;
  }

  lastSample = now;

  // --------------------------------------
  // 1. DOC MPU6050
  // --------------------------------------

  float ax, ay, az;
  float gx, gy, gz;

  if (!readMPU(ax, ay, az, gx, gy, gz)) {
    return;
  }

  // --------------------------------------
  // 2. DOC INA219
  // --------------------------------------

  float busVoltage = ina219.getBusVoltage_V();

  float shuntVoltage = ina219.getShuntVoltage_mV();

  float current = ina219.getCurrent_mA();

  float power = ina219.getPower_mW();

  // Dien ap tai tai
  float loadVoltage =
    busVoltage + shuntVoltage / 1000.0f;

  // --------------------------------------
  // 3. XUAT BIEU DO
  // --------------------------------------

  #if VIEW_MODE == 0

    // Toan bo du lieu cho Python

    plotValue("ax_g", ax);
    plotValue("ay_g", ay);
    plotValue("az_g", az);

    plotValue("gx_dps", gx);
    plotValue("gy_dps", gy);
    plotValue("gz_dps", gz);

    plotValue("voltage_V", loadVoltage);
    plotValue("current_mA", current);
    plotValue("power_mW", power, true);

  #elif VIEW_MODE == 1

    // Gia toc MPU6050

    plotValue("AX_g", ax);
    plotValue("AY_g", ay);
    plotValue("AZ_g", az, true);

  #elif VIEW_MODE == 2

    // Van toc goc MPU6050

    plotValue("GX_dps", gx);
    plotValue("GY_dps", gy);
    plotValue("GZ_dps", gz, true);

  #elif VIEW_MODE == 3

    plotValue("Voltage_V", loadVoltage, true);

  #elif VIEW_MODE == 4

    plotValue("Current_mA", current, true);

  #elif VIEW_MODE == 5

    plotValue("Power_mW", power, true);

  #endif
}


