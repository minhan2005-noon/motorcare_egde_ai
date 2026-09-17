# MotorCare Edge AI

Ứng dụng Express + SQLite để quản lý motor, dữ liệu cảm biến, cảnh báo và
dashboard vận hành. Phần suy luận AI được chừa điểm tích hợp riêng và chưa được
triển khai trong repository này.

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

Database được tạo tại `data/motorcare.sqlite`. Các migration nằm trong
`ma_nguon/may_chu/co_so_du_lieu/chuyen_doi`.

## Lệnh chính

```bash
npm run dev
npm test
npm run db:seed
```

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
- `GET|POST /api/sensors/motors/:motorId/readings`
- `GET /api/sensors/motors/:motorId/latest`
- `GET /api/sensors/motors/:motorId/export`
- `GET /api/alerts`
- `PATCH /api/alerts/:id/status`
- `GET|POST /api/calibrations/motors/:motorId`
- `GET /api/dashboard/overview`
- `PATCH /api/users/profile`
- `GET|PATCH /api/users/settings`

Sau khi đăng nhập hoặc đăng ký, người dùng được đưa tới `/profile` để cập nhật
họ tên, số điện thoại, email, giới tính, CCCD và mật khẩu. Các trường số điện
thoại/CCCD có thể để trống nhưng phải đúng định dạng và không được trùng khi đã nhập.

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

Dashboard hiển thị trạng thái chờ tích hợp tại `/api/ai/inference`. Nhóm AI có
thể nối route này vào mô hình sau mà không phải thay đổi các API database,
authentication, motor, sensor hay alert.
