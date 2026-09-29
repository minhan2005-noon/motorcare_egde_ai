# MotorCare V1: ESP32 -> Wi-Fi -> web dashboard (LAN)

Bản demo này giữ nguyên model và cách tính lỗi trên ESP32. Cứ mỗi cửa sổ hợp lệ 1 giây, ESP32 gửi JSON qua HTTP POST đến Flask server trên máy tính. Trang web đọc kết quả mới nhất và lịch sử gần đây.

```text
MPU6050 + INA219 -> ESP32 chạy model -> Wi-Fi -> laptop chạy app.py -> trình duyệt
```

Đây là dashboard **trong mạng Wi-Fi nội bộ**, không phải website công khai trên Internet. ESP32 và máy tính phải vào cùng một mạng Wi-Fi 2,4 GHz. Server lưu 50 kết quả gần nhất trong RAM; tắt server thì lịch sử mất.

## 1. Chuẩn bị

- Arduino IDE có gói board ESP32 đã cài.
- Thư viện Arduino `Adafruit INA219` và `Adafruit BusIO`.
- Python 3 trên máy tính. Web server chỉ dùng thư viện có sẵn của Python, không cần `pip install`.
- ESP32, MPU6050, INA219 đấu theo cấu hình MotorCare hiện tại.

## 2. Chạy web server trên Windows

Mở PowerShell trong thư mục `ma_nguon/minh_hoa/motorcare_v1_web_demo`
(File Explorer: mở thư mục, bấm vào thanh địa chỉ, gõ `powershell`, Enter),
rồi chạy:

```powershell
py app.py
```

Giữ cửa sổ PowerShell mở trong suốt lúc demo. Trên chính laptop, mở trình duyệt đến:

```text
http://127.0.0.1:5000
```

Dashboard ban đầu hiện “Đang chờ ESP32”.

## 3. Tìm địa chỉ IPv4 của laptop

Mở một cửa sổ Command Prompt khác, chạy:

```text
ipconfig
```

Trong phần Wi-Fi đang kết nối, tìm `IPv4 Address`, ví dụ `192.168.1.23`. Địa chỉ ví dụ chỉ để minh họa; hãy dùng địa chỉ thật của máy bạn. Không dùng `127.0.0.1` trong URL trên ESP32 vì địa chỉ đó trỏ về chính ESP32.

## 4. Cấu hình sketch ESP32

Mở `ma_nguon/phan_mem_nhung/cham_soc_dong_co.ino` bằng Arduino IDE. Ở đầu
file, sửa ba dòng sau:

```cpp
const char *WIFI_SSID = "TEN_WIFI_CUA_BAN";
const char *WIFI_PASSWORD = "MAT_KHAU_WIFI";
const char *SERVER_URL = "http://192.168.1.10:5000/api/prediction";
```

- Thay `TEN_WIFI_CUA_BAN` bằng tên Wi-Fi.
- Thay `MAT_KHAU_WIFI` bằng mật khẩu Wi-Fi.
- Thay `192.168.1.10` bằng IPv4 laptop vừa xem ở bước 3.
- Giữ nguyên phần `/api/prediction` và cổng `5000`.

Ví dụ nếu IPv4 laptop là `192.168.1.23`:

```cpp
const char *SERVER_URL = "http://192.168.1.23:5000/api/prediction";
```

Không đăng công khai sketch có mật khẩu Wi-Fi. ESP32 chỉ hỗ trợ Wi-Fi 2,4 GHz trong setup này; nếu dùng hotspot, đặt laptop và ESP32 cùng vào hotspot đó.

## 5. Nạp và thử

1. Để `app.py` tiếp tục chạy.
2. Kết nối ESP32 qua cáp USB data.
3. Arduino IDE: mở `MotorCare_V1_Web.ino`, chọn board `ESP32 Dev Module` và đúng cổng COM.
4. Bấm **Verify**, sau đó **Upload**.
5. Mở Serial Monitor ở `115200 baud`.
6. Chờ nhận cảm biến và qua một cửa sổ dự đoán. Serial nên hiện `Web: HTTP 201`.
7. Trên laptop mở `http://127.0.0.1:5000`; trạng thái, xác suất và điện áp/dòng sẽ cập nhật.

Điện thoại cũng có thể mở `http://IP_LAPTOP:5000` nếu cùng mạng và router không bật chế độ cách ly thiết bị. Trên Windows, nếu Firewall hỏi, chỉ cho phép Python trên mạng Private.

## 6. Dữ liệu truyền

Ví dụ một gói JSON từ ESP32:

```json
{
  "state": "jam+sag",
  "jam_probability": 0.974,
  "vibration_probability": 0.002,
  "sag_probability": 0.992,
  "voltage_v": 9.81,
  "current_ma": 150.2,
  "vibration_rms_g": 0.017,
  "uptime_ms": 123456
}
```

`state` là nhãn suy ra bằng ngưỡng 0,5 trên ESP32; web chỉ nhận và hiển thị. Nếu mất Wi-Fi, ESP32 vẫn đo và chạy model, còn lần gửi đó bị bỏ qua; lần dự đoán sau sẽ thử gửi tiếp.

## 7. Lỗi thường gặp

- **Web vẫn “Đang chờ ESP32”**: xem Serial có `HTTP 201` không; kiểm tra IP trong `SERVER_URL`, tên/mật khẩu Wi-Fi, và đảm bảo app.py vẫn chạy.
- **`HTTP -1` / connection refused**: ESP32 không tới được laptop. Kiểm tra cùng Wi-Fi, đúng IPv4 và cho phép Python qua Windows Firewall trên mạng Private.
- **Mở được web trên laptop nhưng không trên điện thoại**: dùng `http://IP_LAPTOP:5000`, không dùng `127.0.0.1`; kiểm tra hai thiết bị cùng Wi-Fi.
- **Compile báo thiếu `WiFi.h` hoặc `HTTPClient.h`**: cài board package ESP32 by Espressif Systems, không tìm hai header này trong Library Manager.
- **Không thấy COM**: thử cáp USB data/cổng USB khác; một số board cần driver USB-UART đúng với chip trên board.

## Giới hạn

Server demo không có đăng nhập và dùng HTTP thường. Chỉ chạy trong mạng riêng đáng tin cậy; đừng port-forward cổng 5000 hoặc mở ra Internet. Muốn xem từ xa cần đưa backend lên hosting có HTTPS/xác thực, rồi thay URL server trong sketch.
