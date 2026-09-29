# MotorCare: dữ liệu chuẩn bị cho học máy

Nguồn: ZIP `drive-download-20260928T134247Z-1-001.zip` do người dùng cung cấp.
Toàn bộ **18 file Excel gốc được giữ nguyên**. Bản này chuẩn hóa 18 cấu hình đo
thuộc 6 nhóm: bình thường; chỉ sụt áp; chỉ kẹt; chỉ rung; kẹt + sụt áp;
rung + sụt áp. Các mức sụt áp được ghi trên tên file là 5, 10, 15, 20, 30%.

## Các file đầu ra

- `motorcare_samples_clean.csv`: 326.541 mẫu MPU đã qua kiểm tra. Mỗi hàng là
  một lần đọc MPU khoảng 5 ms. Các cột INA chỉ có giá trị khi cảm biến INA
  được đọc, khoảng 50 ms/lần. Ô INA trống giữa hai lần đọc là **đúng thiết kế**.
- `motorcare_features_1s.csv`: 1.666 cửa sổ **1 giây không chồng lấn**; mỗi hàng
  có đầy đủ 15 đặc trưng số để thử mô hình và các cột nhãn/nguồn gốc riêng.
- `feature_columns.json`: danh sách **chính xác** các cột được phép đưa vào X.
- `quality_by_source.csv`: số hàng nguồn, hàng bỏ, số đoạn và cửa sổ theo file.
- `quality_by_run.csv`: thời lượng, điện áp, dòng và số cửa sổ theo từng đoạn.
- `summary.json`: tổng hợp số lượng sau xử lý.
- `../tien_ich/bo_du_lieu.py`: mã để chạy lại từ ZIP gốc.

CSV mã hóa UTF-8. Có thể đọc bằng pandas; Excel cũng mở được bằng chức năng
nhập CSV UTF-8 (CSV mẫu sạch không có BOM do được ghi nối theo từng file).

## Quy tắc làm sạch

1. Lấy 10 trường đo theo **vị trí cột** vì một số tiêu đề Excel bị hỏng hoặc
   trượt tên. Chuẩn hóa tên cột và đơn vị về `sample_id`, `t_mpu_us`, `ax_g`,
   `ay_g`, `az_g`, `t_ina_us`, `v_bus_v`, `v_shunt_mv`, `current_ma`, `power_mw`.
2. Bỏ 49 hàng thiếu trường MPU bắt buộc, không phải số hoặc bị trộn chữ/log
   serial. Trong đó có log lỗi và khởi động lại của ESP32.
3. Bỏ 362 hàng có **cả** `ay_g` và `az_g` cùng đúng `-0.126`. Mẫu lặp chính xác
   trên hai trục ở mọi trạng thái nên được coi là nghi lỗi đọc cảm biến. Đây là
   quy tắc thận trọng, chưa được xác nhận bằng phần cứng; ZIP gốc giữ các hàng
   đó để đối chiếu nếu cần. Các xung gia tốc lớn khác được giữ nguyên.
4. Khi số mẫu hoặc dấu thời gian giảm sau khi ESP32 khởi động lại, tách ra
   `run_id` mới. File `vibration_sag_05` có hai đoạn; **hai đoạn này vẫn thuộc
   cùng một buổi đo** `session_id`, không phải hai mẫu lặp độc lập.
5. Giữ riêng tần số MPU (~200 Hz) và INA (~20 Hz), **không điền** giá trị INA
   vào các hàng trống. Chỉ dùng các phép đo INA thật trong mỗi cửa sổ. Không
   đưa `power_mw` vào đặc trưng vì nó gần như phụ thuộc vào điện áp và dòng.
6. Cửa sổ đủ điều kiện có ít nhất **160 mẫu MPU**, **12 mẫu INA** và ít nhất
   100 cặp MPU liên tiếp cách nhau không quá 7,5 ms. Loại 16 cửa sổ thiếu
   mẫu (chủ yếu ở cuối lượt đo). Không nối cửa sổ qua chỗ ESP32 reset.

Không làm chuẩn hóa theo trung bình của toàn bộ dữ liệu, không chia ngẫu nhiên
các hàng để tạo train/test, và không thay giá trị bất thường chưa có căn cứ
rõ ràng bằng giá trị trung bình.

## Ý nghĩa cột và nhãn

- `condition`: `normal`, `sag`, `jam`, `vibration`, `jam_sag`, `vibration_sag`.
- `jam`, `vibration`, `sag`: ba nhãn nhị phân 0/1, có thể dùng cho mô hình đa
  nhãn. Không có ví dụ **kẹt + rung** hoặc **kẹt + rung + sụt áp** trong ZIP.
- `sag_pct_setpoint`: mức **đặt theo tên file**, không phải phần trăm tính lại
  từ điện áp BUS thực đo.
- `session_id`: một file/buổi đo nguồn. Dùng để nhóm khi kiểm định sau này.
- `run_id`: một đoạn có đồng hồ liên tục; có thể có nhiều đoạn trong một
  `session_id` nếu ESP32 khởi động lại.
- `window_id`, `window_start_s`, `source_file`, `mpu_samples`, `ina_samples`:
  thông tin truy vết và chất lượng cửa sổ, **không** đưa vào đầu vào X.
- `ax_std_g`, `ay_std_g`, `az_std_g`: độ lệch chuẩn gia tốc trên từng trục.
- `dynamic_accel_rms_g`: căn bậc hai của tổng ba phương sai trục, đo mức dao
  động sau khi bỏ độ lệch tĩnh của cảm biến/trọng lực trong cửa sổ.
- `accel_norm_*`: trung bình, độ lệch chuẩn, phân vị 95 của độ lớn vector
  gia tốc; `accel_step_*` là mức thay đổi giữa các mẫu MPU liên tiếp hợp lệ.
- `v_bus_*`, `current_*`: thống kê điện áp và dòng trong cùng cửa sổ.

## Bắt đầu bằng Python hoặc Colab

Giải nén ZIP kết quả rồi chạy:

```python
import json
import pandas as pd

df = pd.read_csv("motorcare_features_1s.csv")
with open("feature_columns.json", encoding="utf-8") as f:
    feature_columns = json.load(f)

X = df[feature_columns]                  # Chỉ tín hiệu, không có nhãn/tên file
y = df[["jam", "vibration", "sag"]]  # 3 nhãn có thể đồng thời bằng 1
groups = df["session_id"]               # Giữ nguyên nhóm khi kiểm định
print(X.shape, y.value_counts())
```

Nếu cần dự đoán cấp sụt áp 5/10/15/20/30, `sag_pct_setpoint` là **nhãn**,
không được thêm vào X. Chỉ chuẩn hóa đặc trưng sau khi đã chia tập và chỉ
`fit` bộ chuẩn hóa trên train.

## Giới hạn cần biết trước khi đánh giá mô hình

Mỗi cấu hình đo hiện chỉ có **một buổi đo nguồn**. 1.666 cửa sổ là những phần
liên tiếp của 18 buổi đo, không phải 1.666 thí nghiệm độc lập. Điểm số từ
chia ngẫu nhiên theo hàng/cửa sổ sẽ dễ quá lạc quan. Để có test đáng tin,
thu thêm vài buổi độc lập **cho từng cấu hình**, thay đổi ngày đo, cách gắn
cảm biến và mức tải trong phạm vi sử dụng. Khi đó mới chia theo `session_id`
và kiểm tra từng kiểu lỗi. Dữ liệu này phù hợp làm prototype trên hệ hiện tại;
khả năng nhận diện lỗi thật ở quạt khác chưa được kiểm chứng.

Chạy lại từ thư mục gốc repository:
`python ma_nguon/tri_tue_nhan_tao/tien_ich/bo_du_lieu.py original.zip --out output_folder`
(cần `pandas`, `numpy`, `openpyxl`).
