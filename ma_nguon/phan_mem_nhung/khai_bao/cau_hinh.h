
#include <Wire.h>
#include <Adafruit_INA219.h>
#include <math.h>

// ==========================================
// MOTORCARE - ESP32 + MPU6050 + INA219
// Arduino IDE
// ==========================================

// Chan I2C cua ESP32 thuong
#define SDA_PIN 21
#define SCL_PIN 22

// Dia chi I2C
const uint8_t MPU_ADDR = 0x68;
const uint8_t INA_ADDR = 0x40;

// Khoi tao INA219
Adafruit_INA219 ina219(INA_ADDR);

// Trang thai cam bien
bool mpuOK = false;
bool inaOK = false;

// ==========================================
// 1. KIEM TRA DIA CHI I2C
// ==========================================

bool checkI2C(uint8_t address) {
  Wire.beginTransmission(address);
  return Wire.endTransmission() == 0;
}

// ==========================================
// 2. GHI THANH GHI MPU6050
// ==========================================

bool writeMPU(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(MPU_ADDR);

  Wire.write(reg);
  Wire.write(value);

  return Wire.endTransmission() == 0;
}

// ==========================================
// 3. DOC THANH GHI MPU6050
// ==========================================

bool readMPU(uint8_t reg, uint8_t *data, uint8_t len) {

  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);

  if (Wire.endTransmission(false) != 0) {
    return false;
  }

  // Ep kieu de tranh warning requestFrom
  uint8_t received = Wire.requestFrom(
    (uint8_t)MPU_ADDR,
    (uint8_t)len
  );

  if (received != len) {
    return false;
  }

  for (uint8_t i = 0; i < len; i++) {
    data[i] = Wire.read();
  }

  return true;
}

// ==========================================
// 4. CHUYEN 2 BYTE THANH SO CO DAU
// ==========================================

int16_t toInt16(uint8_t highByte, uint8_t lowByte) {

  uint16_t value =
    ((uint16_t)highByte << 8) | lowByte;

  return (int16_t)value;
}

// ==========================================
// 5. KHOI TAO MPU6050
// ==========================================

bool initMPU() {

  Serial.println();
  Serial.println("Dang kiem tra MPU6050...");

  if (!checkI2C(MPU_ADDR)) {
    Serial.println("LOI: KHONG TIM THAY MPU6050!");
    return false;
  }

  Serial.println("MPU6050 I2C OK!");

  // Doc thanh ghi WHO_AM_I
  uint8_t id = 0;

  if (!readMPU(0x75, &id, 1)) {
    Serial.println("LOI: KHONG DOC DUOC MPU ID!");
    return false;
  }

  Serial.print("WHO_AM_I = 0x");
  Serial.println(id, HEX);

  if (id != 0x68) {
    Serial.println("LOI: ID KHONG KHOP MPU6050!");
    return false;
  }

  // Danh thuc MPU6050
  if (!writeMPU(0x6B, 0x00)) {
    Serial.println("LOI: DANH THUC MPU!");
    return false;
  }

  // Cai dat gia toc +/- 2g
  if (!writeMPU(0x1C, 0x00)) {
    Serial.println("LOI: CAI DAT GIA TOC!");
    return false;
  }

  // Cai dat gyroscope +/- 250 do/giay
  if (!writeMPU(0x1B, 0x00)) {
    Serial.println("LOI: CAI DAT GYROSCOPE!");
    return false;
  }

  delay(100);

  Serial.println("MPU6050 READY!");

  return true;
}

// ==========================================
// 6. KHOI TAO INA219
// ==========================================

bool initINA() {

  Serial.println();
  Serial.println("Dang kiem tra INA219...");

  if (!checkI2C(INA_ADDR)) {
    Serial.println("LOI: KHONG TIM THAY INA219!");
    return false;
  }

  if (!ina219.begin(&Wire)) {
    Serial.println("LOI: KHOI TAO INA219!");
    return false;
  }

  // Cau hinh hieu chuan cua thu vien
  ina219.setCalibration_32V_2A();

  Serial.println("INA219 READY!");

  return true;
}

// ==========================================
// 7. DOC GIA TOC VA GYROSCOPE
// ==========================================

void printMPUData() {

  if (!mpuOK) {
    Serial.println("MPU6050 CHUA KET NOI!");
    return;
  }

  // Doc 14 byte:
  // 6 byte gia toc
  // 2 byte nhiet do
  // 6 byte gyroscope

  uint8_t data[14];

  if (!readMPU(0x3B, data, 14)) {
    Serial.println("LOI: KHONG DOC DUOC MPU6050!");
    return;
  }

  // Gia toc RAW
  int16_t rawAX = toInt16(data[0], data[1]);
  int16_t rawAY = toInt16(data[2], data[3]);
  int16_t rawAZ = toInt16(data[4], data[5]);

  // Gyroscope RAW
  int16_t rawGX = toInt16(data[8], data[9]);
  int16_t rawGY = toInt16(data[10], data[11]);
  int16_t rawGZ = toInt16(data[12], data[13]);

  // Chuyen gia toc sang don vi g
  float ax = rawAX / 16384.0f;
  float ay = rawAY / 16384.0f;
  float az = rawAZ / 16384.0f;

  // Chuyen toc do goc sang do/giay
  float gx = rawGX / 131.0f;
  float gy = rawGY / 131.0f;
  float gz = rawGZ / 131.0f;

  // Do lon vector gia toc
  float total = sqrtf(
    ax * ax + ay * ay + az * az
  );

  Serial.println();
  Serial.println("========== MPU6050 ==========");

  Serial.print("Accel X: ");
  Serial.print(ax, 3);
  Serial.println(" g");

  Serial.print("Accel Y: ");
  Serial.print(ay, 3);
  Serial.println(" g");

  Serial.print("Accel Z: ");
  Serial.print(az, 3);
  Serial.println(" g");

  Serial.print("Total: ");
  Serial.print(total, 3);
  Serial.println(" g");

  Serial.print("Gyro X: ");
  Serial.print(gx, 2);
  Serial.println(" deg/s");

  Serial.print("Gyro Y: ");
  Serial.print(gy, 2);
  Serial.println(" deg/s");

  Serial.print("Gyro Z: ");
  Serial.print(gz, 2);
  Serial.println(" deg/s");
}

// ==========================================
// 8. DOC INA219
// ==========================================

void printINAData() {

  if (!inaOK) {
    Serial.println("INA219 CHUA KET NOI!");
    return;
  }

  if (!checkI2C(INA_ADDR)) {
    Serial.println("LOI: MAT KET NOI INA219!");
    return;
  }

  float busVoltage = ina219.getBusVoltage_V();

  float shuntVoltage = ina219.getShuntVoltage_mV();

  float current = ina219.getCurrent_mA();

  float power = ina219.getPower_mW();

  Serial.println();
  Serial.println("========== INA219 ==========");

  Serial.print("Bus Voltage: ");
  Serial.print(busVoltage, 3);
  Serial.println(" V");

  Serial.print("Shunt Voltage: ");
  Serial.print(shuntVoltage, 3);
  Serial.println(" mV");

  Serial.print("Current: ");
  Serial.print(current, 3);
  Serial.println(" mA");

  Serial.print("Power: ");
  Serial.print(power, 3);
  Serial.println(" mW");
}

// ==========================================
// 9. SETUP
// ==========================================

void setup() {

  Serial.begin(115200);
  delay(1500);

  Serial.println();
  Serial.println("============================");
  Serial.println("MOTORCARE - SENSOR TEST");
  Serial.println("ESP32 + MPU6050 + INA219");
  Serial.println("============================");

  // Khoi tao I2C
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(100000);
  Wire.setTimeOut(50);

  // Khoi tao MPU6050
  mpuOK = initMPU();

  // Khoi tao INA219
  inaOK = initINA();

  Serial.println();
  Serial.println("====== KET QUA KET NOI ======");

  Serial.print("MPU6050: ");
  Serial.println(mpuOK ? "OK" : "ERROR");

  Serial.print("INA219: ");
  Serial.println(inaOK ? "OK" : "ERROR");

  Serial.println("============================");
}

// ==========================================
// 10. LOOP
// ==========================================

void loop() {

  // Kiem tra MPU6050
  printMPUData();

  // Kiem tra INA219
  printINAData();

  Serial.println();
  Serial.println("============================");

  delay(1000);
}


