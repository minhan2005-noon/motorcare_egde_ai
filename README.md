# MotorCare Edge AI

Ứng dụng Express + SQLite/Turso để quản lý motor, dữ liệu cảm biến, cảnh báo và
dashboard vận hành. Mô hình Edge AI chạy trực tiếp trên ESP32 và gửi kết quả
chẩn đoán lên Dashboard theo thời gian thực.

## Chạy dự án

```bash
npm install
cp .env.example .env
npm start
```

Mở `http://localhost:3000`.

Tài khoản demo được tạo tự động ở lần chạy đầu:

- Email: `demo@motorcare.vn`
- Mật khẩu: `MotorCare123!`

Khi chạy local, database được tạo tại `data/motorcare.sqlite`. Các migration
nằm trong `ma_nguon/may_chu/co_so_du_lieu/chuyen_doi`.

## Lệnh chính

```bash
npm run dev
npm test
npm run db:check
npm run db:seed
```

`db:check` chạy migration còn thiếu, ping database và đối chiếu số migration
đã áp dụng với mã nguồn. Endpoint `/api/health/ready` cung cấp cùng trạng thái
cho hệ thống triển khai; `/api/health` chỉ là liveness nhẹ.

## API

Tất cả API nghiệp vụ, trừ đăng ký/đăng nhập/quên mật khẩu, yêu cầu cookie phiên
đăng nhập hoặc header `Authorization: Bearer <token>`.

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/logout-all`
- `POST /api/auth/forgot-password`
- `POST /api/auth/verify-reset-code`
- `POST /api/auth/reset-password`
- `POST /api/auth/change-password`
- `GET|POST /api/motors`
- `GET|PATCH|DELETE /api/motors/:id`
- `PATCH /api/motors/:id/connection`
- `POST /api/motors/:id/device-token`
- `POST /api/devices/readings` (xác thực bằng `X-Device-Code` và `X-Device-Token`)
- `GET|POST /api/sensors/motors/:motorId/readings`
- `GET /api/sensors/motors/:motorId/latest`
- `GET /api/sensors/motors/:motorId/export`
- `GET /api/alerts`
- `PATCH /api/alerts/:id/status`
- `GET|POST /api/calibrations/motors/:motorId`
- `GET /api/dashboard/overview`
- `PATCH /api/users/profile`
- `GET|PATCH /api/users/settings`

## Gửi mã quên mật khẩu qua email

Điền cấu hình SMTP trong `.env`. Với Gmail, bật xác minh hai bước, tạo App
Password 16 ký tự và dùng App Password cho `SMTP_PASS`, không dùng mật khẩu
đăng nhập Gmail:

```env
SMTP_SERVICE=gmail
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
MAIL_FROM=MotorCare Edge AI <your-email@gmail.com>
```

Luồng đặt lại mật khẩu gồm ba bước: gửi OTP 6 số qua email, xác minh OTP, sau đó
đặt mật khẩu mới. Mã hết hạn sau 15 phút, tối đa 5 lần nhập sai và chỉ dùng được
một lần. OTP chỉ được gửi qua email và không hiển thị trên giao diện. Trong
`NODE_ENV=test`, API trả `developmentResetCode` để kiểm thử tự động; chế độ chạy
thật không trả mã OTP trong API.

## Phạm vi AI

Source từ bộ MotorCare trên Google Drive đã được sắp vào các khu vực sẵn có:

- `ma_nguon/phan_mem_nhung`: sketch ESP32, trích xuất 15 đặc trưng và trọng số
  mô hình MLP `15 -> 12 -> 8 -> 3`.
- `ma_nguon/tri_tue_nhan_tao/tien_ich/bo_du_lieu.py`: làm sạch dữ liệu đo và
  tạo các cửa sổ đặc trưng một giây.
- `ma_nguon/tri_tue_nhan_tao/du_lieu`: mô tả dữ liệu, thứ tự đặc trưng và bản
  tóm tắt bộ dữ liệu đã tiền xử lý.
Để chạy pipeline tiền xử lý:

```bash
python3 -m pip install -r ma_nguon/tri_tue_nhan_tao/requirements.txt
python3 ma_nguon/tri_tue_nhan_tao/tien_ich/bo_du_lieu.py original.zip \
  --out ma_nguon/tri_tue_nhan_tao/du_lieu
```

Huấn luyện, đánh giá và chạy suy luận bằng pipeline Python:

```bash
python3 ma_nguon/tri_tue_nhan_tao/huan_luyen/huan_luyen_mo_hinh.py \
  ma_nguon/tri_tue_nhan_tao/du_lieu/motorcare_features_1s.csv \
  --firmware-header ma_nguon/phan_mem_nhung/model_weights.h
python3 ma_nguon/tri_tue_nhan_tao/huan_luyen/danh_gia_mo_hinh.py \
  ma_nguon/tri_tue_nhan_tao/mo_hinh/motorcare_mlp.joblib \
  ma_nguon/tri_tue_nhan_tao/du_lieu/motorcare_features_1s.csv
python3 ma_nguon/kiem_thu/tri_tue_nhan_tao/dac_trung.kiem_thu.py
```

Pipeline chia train/test theo `session_id`, lưu model cùng metadata/metrics và
có thể xuất trực tiếp trọng số C++ cho firmware. Không chia ngẫu nhiên theo
cửa sổ vì cách đó làm rò rỉ dữ liệu giữa các đoạn của cùng buổi đo.

Dashboard Express nhận trực tiếp trạng thái AI và xác suất kẹt tải, rung bất
thường, sụt áp từ ESP32 qua `POST /api/devices/readings`. Kết quả được lưu cùng
dữ liệu cảm biến, hiển thị trong thẻ **Chẩn đoán trực tiếp** và tự tạo cảnh báo
AI khi xác suất đạt từ 50%. Có thể thay đổi ngưỡng bằng biến môi trường
`AI_ALERT_THRESHOLD`.

## Kết nối ESP32 và cảm biến thật

1. Chạy MotorCare trên máy tính cùng mạng Wi-Fi với ESP32.
2. Mở Dashboard, chọn motor và nhấn **Kết nối cảm biến** hoặc **Thiết lập**.
3. Nhấn **Tạo mã kết nối**. Giao diện tự ưu tiên địa chỉ IPv4 LAN của máy chủ.
4. Sao chép ba dòng `SERVER_URL`, `DEVICE_CODE`, `DEVICE_TOKEN` vào
   `ma_nguon/phan_mem_nhung/cham_soc_dong_co.ino`, đồng thời điền Wi-Fi.
5. Nạp firmware và bật ESP32. Dashboard tự chuyển sang trạng thái trực tuyến
   khi nhận gói dữ liệu đầu tiên; không cần đổi trạng thái bằng tay.

Mã kết nối chỉ hiện một lần và được lưu trên server dưới dạng SHA-256. Tạo mã
mới sẽ vô hiệu hóa mã cũ. Có thể điều chỉnh thời gian xác định mất kết nối bằng
biến môi trường `DEVICE_OFFLINE_SECONDS` (mặc định 90 giây).

## Triển khai Vercel

Repository có `index.js` ở thư mục gốc để Vercel nhận diện Express và tự tạo
tài nguyên tĩnh trong bước build. Production dùng Turso để lưu bền vững tài
khoản, phiên đăng nhập, motor, dữ liệu cảm biến và cảnh báo giữa các lần Vercel
khởi động function. Cấu hình đồng thời hai biến môi trường sau trong project:

```env
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-database-token
```

Nếu không có cấu hình Turso, ứng dụng tự dùng SQLite local. Trên Vercel, chế độ
dự phòng này dùng `/tmp/motorcare.sqlite` và chỉ phù hợp để kiểm thử tạm thời.
