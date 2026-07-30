const requestForm = document.getElementById('requestResetForm');
const verifyForm = document.getElementById('verifyCodeForm');
const resetForm = document.getElementById('resetPasswordForm');
const requestAlert = document.getElementById('requestAlert');
const verifyAlert = document.getElementById('verifyAlert');
const resetAlert = document.getElementById('resetAlert');
const requestButton = document.getElementById('requestButton');
const verifyButton = document.getElementById('verifyButton');
const resetButton = document.getElementById('resetButton');
const resendButton = document.getElementById('resendButton');
const resetCodeInput = document.getElementById('resetCode');

let recoveryEmail = '';
let verifiedCode = '';
let resendInterval;

function showStep(stepId) {
  document.querySelectorAll('.reset-step').forEach((step) => {
    step.hidden = step.id !== stepId;
  });
}

function startResendCountdown(duration = 60) {
  clearInterval(resendInterval);
  let seconds = duration;
  resendButton.disabled = true;
  resendButton.textContent = `Gửi lại sau ${seconds}s`;

  resendInterval = setInterval(() => {
    seconds -= 1;
    if (seconds <= 0) {
      clearInterval(resendInterval);
      resendButton.disabled = false;
      resendButton.textContent = 'Gửi lại mã';
      return;
    }
    resendButton.textContent = `Gửi lại sau ${seconds}s`;
  }, 1000);
}

function openVerificationStep(email) {
  recoveryEmail = email;
  verifiedCode = '';
  resetCodeInput.value = '';
  document.getElementById('verificationEmail').textContent = email;
  showStep('verifyStep');
  window.AuthUi.setAlert(
    verifyAlert,
    'Nếu email tồn tại, mã xác minh đã được gửi và có hiệu lực 15 phút.',
    'success',
  );
  startResendCountdown();
  resetCodeInput.focus();
}

resetCodeInput.addEventListener('input', () => {
  resetCodeInput.value = resetCodeInput.value.replace(/\D/g, '').slice(0, 6);
});

requestForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  window.AuthUi.clearErrors();
  window.AuthUi.setAlert(requestAlert, '');
  const emailInput = document.getElementById('email');
  const email = emailInput.value.trim().toLowerCase();

  if (!email || !emailInput.checkValidity()) {
    window.AuthUi.setFieldError('email', 'Email không hợp lệ');
    return;
  }

  window.AuthUi.setLoading(requestButton, true, 'Đang gửi mã...');
  try {
    await window.AuthApi.forgotPassword(email);
    openVerificationStep(email);
  } catch (error) {
    window.AuthUi.setAlert(requestAlert, error.message);
  } finally {
    window.AuthUi.setLoading(requestButton, false);
  }
});

verifyForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  window.AuthUi.clearErrors();
  window.AuthUi.setAlert(verifyAlert, '');
  const code = resetCodeInput.value.trim();

  if (!/^\d{6}$/.test(code)) {
    window.AuthUi.setFieldError('resetCode', 'Vui lòng nhập đủ 6 chữ số');
    return;
  }

  window.AuthUi.setLoading(verifyButton, true, 'Đang xác minh...');
  try {
    await window.AuthApi.verifyResetCode(recoveryEmail, code);
    verifiedCode = code;
    showStep('resetStep');
    window.AuthUi.setAlert(resetAlert, 'Xác minh thành công.', 'success');
    document.getElementById('newPassword').focus();
  } catch (error) {
    window.AuthUi.setAlert(verifyAlert, error.message);
  } finally {
    window.AuthUi.setLoading(verifyButton, false);
  }
});

resendButton.addEventListener('click', async () => {
  window.AuthUi.setAlert(verifyAlert, '');
  resendButton.disabled = true;
  resendButton.textContent = 'Đang gửi...';

  try {
    await window.AuthApi.forgotPassword(recoveryEmail);
    resetCodeInput.value = '';
    window.AuthUi.setAlert(
      verifyAlert,
      'Mã mới đã được gửi qua email. Mã cũ không còn hiệu lực.',
      'success',
    );
    startResendCountdown();
  } catch (error) {
    resendButton.disabled = false;
    resendButton.textContent = 'Gửi lại mã';
    window.AuthUi.setAlert(verifyAlert, error.message);
  }
});

document.getElementById('changeEmailButton').addEventListener('click', () => {
  clearInterval(resendInterval);
  showStep('requestStep');
  window.AuthUi.setAlert(requestAlert, '');
  document.getElementById('email').focus();
});

resetForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  window.AuthUi.clearErrors();
  window.AuthUi.setAlert(resetAlert, '');

  const password = document.getElementById('newPassword').value;
  const confirmation = document.getElementById('confirmPassword').value;
  let valid = true;

  if (
    password.length < 8
    || !/[a-z]/.test(password)
    || !/[A-Z]/.test(password)
    || !/\d/.test(password)
  ) {
    window.AuthUi.setFieldError('newPassword', 'Cần 8 ký tự, chữ hoa, chữ thường và chữ số');
    valid = false;
  }
  if (password !== confirmation) {
    window.AuthUi.setFieldError('confirmPassword', 'Mật khẩu nhập lại chưa khớp');
    valid = false;
  }
  if (!valid) return;

  window.AuthUi.setLoading(resetButton, true, 'Đang cập nhật...');
  try {
    await window.AuthApi.resetPassword(recoveryEmail, verifiedCode, password);
    window.AuthUi.setAlert(
      resetAlert,
      'Đổi mật khẩu thành công. Đang chuyển sang đăng nhập...',
      'success',
    );
    setTimeout(() => location.assign('/login'), 1000);
  } catch (error) {
    window.AuthUi.setAlert(resetAlert, error.message);
  } finally {
    window.AuthUi.setLoading(resetButton, false);
  }
});
