# Hướng dẫn Tích hợp Runtime C++17 MotorCare V3 Final trên ESP32

`edge/motorcare_v3_final_runtime.h` hợp nhất toàn bộ chuỗi xử lý của `MotorCare_V3_Design`, `MotorCare_V3_Experiments` và `MotorCare_V4_Design` vào một lõi C++17 duy nhất, bộ nhớ tĩnh cố định, không cấp phát động:

1. **Quality Gate & Nhánh Điện Độc lập (`curate()`)**: Kiểm tra từng mẫu MPU6050 (`±2g`, lọc mẫu kẹt/NaN, tối đa 5% mẫu lỗi, khoảng phủ `≥0,9s`, tối소 `160` mẫu MPU và `100` cặp kề `≤7,5ms`, hỗ trợ tràn `uint32_t micros()`) và kênh INA219 (`0–26V`, tối thiểu `12` mẫu, khoảng phủ `≥0,7s`, phát hiện `supply_off` khi `V < 0,2V` và `|I| < 5mA`). Khi MPU lỗi, nhánh điện độc lập vẫn giữ nguyên `voltage_median` và `current_median`.
2. **Trích xuất 84 Đặc trưng Vật lý & Hình học Bất biến (`motorcare_features_v3_final_f32.h`)**:
   - Chỉ số `0..55`: 56 đặc trưng cơ sở V3 (`v2_core56`).
   - Chỉ số `56..63`: 8 đặc trưng vật lý V4 (`v4_core64`).
   - Chỉ số `64..83`: 20 đặc trưng V3 Final gồm tâm **Modified Weiszfeld Geometric Median** (`geom_dyn_*`), **Trị riêng Ma trận Hiệp phương sai 3D Jacobi** (`cov_std1..3`, `cov_det_ratio`, `cov_shape`), **Tự tương quan Đa trục 200Hz** (`acf_lag1`, `acf_lag2`), **Ghép cặp Cơ-Điện-Xoáy 3D** (`whirl_norm_prod`, `electro_mech_step`, `vib_to_ripple_geom`) và **Điện áp Bù Nội trở Tải Thực** (`v_load_comp_v3_final`, `v_p05_load_comp_v3_final` với $R_{\text{eff}} = 1,85\text{ m}\Omega$).
3. **Suy luận Đa Nhánh Phân tách + 5 Lớp Ràng buộc Vật lý (`motorcare_v3_final_accuracy.h` / `motorcare_v3_final_lite.h`)**:
   - Mặc định nạp `v3_final_accuracy36` (`13.508 byte`, có tính phổ).
   - Đặt cờ biên dịch `-DMOTORCARE_USE_LITE=1` để nạp `v3_final_lite20` (`11.464 byte`, bỏ hoàn toàn vòng lặp Goertzel 101-bin).
4. **Hồ sơ Novelty Shadow Mahalanobis (`motorcare_normal_profile.h` & `motorcare_profile_features.h`)**:
   - Chạy song song trên 20 đặc trưng bất biến (`invariant20`), xuất `normal_distance`, cờ `novelty` và `conflict` mà không bao giờ tự ý ghi đè cảnh báo lỗi.
5. **Timeline Cố định 10 Slot (`Timeline10`, quy tắc `≥8/10`)**:
   - Giữ 10 slot thời gian thực (1 giây/slot). Slot `UNKNOWN` giữ nguyên trong mẫu số 10, không xóa lịch sử khi mất 1 giây, tự động chèn gap và mở session mới khi reset hoặc đổi cách gá.

## Cách gọi trong Firmware ESP32

```cpp
// Chỉ include trong đúng 1 đơn vị biên dịch (.cpp) của worker task
// Để dùng bản siêu nhẹ không tính phổ: #define MOTORCARE_USE_LITE 1
#include "motorcare_v3_final_runtime.h"

static motorcare_runtime::Runtime detector;
static motorcare_runtime::RawWindow closed_window;

void worker_step(uint64_t session_id, uint64_t wall_clock_second) {
  // closed_window đã được task thu điền từ double-buffer
  motorcare_runtime::Output out = detector.process(closed_window, session_id, wall_clock_second);

  if (out.quality.electrical_valid) {
    // Luôn có điện áp/dòng đại diện ngay cả khi MPU hỏng
    float v_bus = out.quality.voltage_median;
    float i_ma  = out.quality.current_median;
  }

  if (out.inferred) {
    int cls = out.class_index; // 0:jam, 1:jam_sag, 2:normal, 3:sag, 4:vibration, 5:vibration_sag
    float conf = out.max_support;
    bool alarm_jam = out.timeline.alarm[0];
    bool alarm_vib = out.timeline.alarm[1];
    bool alarm_sag = out.timeline.alarm[2];
    bool shadow_novelty  = out.novelty;
    bool shadow_conflict = out.conflict;
  }
}
```

## Ngân sách Bộ nhớ Đã Kiểm chứng (`sizeof` trên Host)

| Thành phần | Kích thước (Byte) | Ghi chú |
|---|---:|---|
| `RawWindow` | `4.496 B` | Tối đa 240 mẫu MPU + 32 mẫu INA |
| `Runtime` | `4.728 B` | Gồm `clean_` Window (`4.244 B`), `core_[84]`, `invariant_[20]`, `Timeline10` (`64 B`) |
| `Scratch` dùng chung | `9.908 B` | Cấp phát tĩnh cho worker trích xuất đặc trưng |
| **Tổng RAM tĩnh (`2 RawWindow + Runtime + Scratch`)** | **`23.628 B`** | Nhỏ gọn, an toàn cho SRAM của ESP32 |
| Mảng hằng `motorcare_v3_final_accuracy.h` (Flash/RODATA) | **`13.508 B`** | 742 node / 399 lá (giảm 55,0% so với V3 Accuracy56) |
| Mảng hằng `motorcare_v3_final_lite.h` (Flash/RODATA) | **`11.464 B`** | 632 node / 340 lá (giảm 44,8% so với V3 Lite20, bỏ Goertzel) |
| Mảng hằng `motorcare_normal_profile.h` (Flash/RODATA) | **`1.844 B`** | Hồ sơ Mahalanobis Ledoit–Wolf 20 chiều |
