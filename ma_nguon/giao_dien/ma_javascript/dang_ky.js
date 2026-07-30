const registerForm = document.getElementById('registerForm');
const registerAlert = document.getElementById('formAlert');
const registerButton = document.getElementById('submitButton');
const passwordInput = document.getElementById('password');

function updatePasswordRules() {
  const password = passwordInput.value;
  const rules = {
    length: password.length >= 8,
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    number: /\d/.test(password),
  };
  Object.entries(rules).forEach(([name, valid]) => {
    document.querySelector(`[data-rule="${name}"]`)?.classList.toggle('ok', valid);
  });
  return Object.values(rules).every(Boolean);
}

passwordInput.addEventListener('input', updatePasswordRules);

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  window.AuthUi.clearErrors();
  window.AuthUi.setAlert(registerAlert, '');

  const fullName = document.getElementById('fullName').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = passwordInput.value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  let valid = true;

  if (fullName.length < 2) {
    window.AuthUi.setFieldError('fullName', 'Họ tên cần ít nhất 2 ký tự');
    valid = false;
  }
  if (!email || !document.getElementById('email').checkValidity()) {
    window.AuthUi.setFieldError('email', 'Email không hợp lệ');
    valid = false;
  }
  if (!updatePasswordRules()) {
    window.AuthUi.setFieldError('password', 'Mật khẩu chưa đáp ứng yêu cầu');
    valid = false;
  }
  if (password !== confirmPassword) {
    window.AuthUi.setFieldError('confirmPassword', 'Mật khẩu nhập lại chưa khớp');
    valid = false;
  }
  if (!document.getElementById('acceptTerms').checked) {
    window.AuthUi.setAlert(registerAlert, 'Bạn cần xác nhận điều kiện sử dụng');
    valid = false;
  }
  if (!valid) return;

  window.AuthUi.setLoading(registerButton, true, 'Đang tạo tài khoản...');
  try {
    await window.AuthApi.register({ fullName, email, password });
    location.assign('/dashboard');
  } catch (error) {
    window.AuthUi.setAlert(registerAlert, error.message);
  } finally {
    window.AuthUi.setLoading(registerButton, false);
  }
});
