const nodemailer = require('nodemailer');
const appConfig = require('../cau_hinh/ung_dung.cau_hinh');
const httpError = require('../tien_ich/loi_http');

let transporter;

function emailError(status, message) {
  const error = httpError(status, message);
  error.expose = true;
  return error;
}

function isConfigured() {
  const { email } = appConfig;
  return Boolean((email.service || email.host) && email.user && email.pass && email.from);
}

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  if (!isConfigured()) {
    throw emailError(
      503,
      'Dịch vụ email chưa được cấu hình. Vui lòng thiết lập SMTP trong file .env',
    );
  }

  const { email } = appConfig;
  const transportOptions = {
    auth: {
      user: email.user,
      pass: email.pass,
    },
  };

  if (email.service) {
    transportOptions.service = email.service;
  } else {
    transportOptions.host = email.host;
    transportOptions.port = email.port;
    transportOptions.secure = email.secure;
  }

  transporter = nodemailer.createTransport(transportOptions);
  return transporter;
}

async function sendPasswordResetCode({ recipient, code, expiresInMinutes }) {
  if (appConfig.env === 'test') {
    return { messageId: 'test-password-reset-email' };
  }

  try {
    return await getTransporter().sendMail({
      from: appConfig.email.from,
      to: recipient,
      subject: 'Mã xác minh đặt lại mật khẩu MotorCare Edge AI',
      text: [
        `Mã xác minh của bạn là: ${code}`,
        `Mã có hiệu lực trong ${expiresInMinutes} phút.`,
        'Nếu bạn không yêu cầu đổi mật khẩu, hãy bỏ qua email này.',
      ].join('\n\n'),
      html: `
        <div style="max-width:560px;margin:0 auto;padding:28px;font-family:Arial,sans-serif;color:#173042">
          <h2 style="margin:0 0 14px;color:#0f5f7d">MotorCare Edge AI</h2>
          <p>Bạn vừa yêu cầu đặt lại mật khẩu.</p>
          <p>Mã xác minh của bạn là:</p>
          <p style="margin:22px 0;font-size:32px;font-weight:700;letter-spacing:8px;color:#126f9b">${code}</p>
          <p>Mã có hiệu lực trong <strong>${expiresInMinutes} phút</strong>.</p>
          <p style="color:#637988;font-size:13px">Nếu bạn không yêu cầu đổi mật khẩu, hãy bỏ qua email này.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error('Không thể gửi email đặt lại mật khẩu:', error.message);
    if (error.expose) {
      throw error;
    }
    throw emailError(502, 'Không thể gửi mã xác minh qua email. Vui lòng kiểm tra cấu hình SMTP');
  }
}

module.exports = {
  isConfigured,
  sendPasswordResetCode,
};
