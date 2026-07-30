const loginForm = document.getElementById('loginForm');
const loginAlert = document.getElementById('formAlert');
const loginButton = document.getElementById('submitButton');

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  window.AuthUi.clearErrors();
  window.AuthUi.setAlert(loginAlert, '');

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  let valid = true;

  if (!email) {
    window.AuthUi.setFieldError('email', 'Vui lòng nhập email');
    valid = false;
  }
  if (!password) {
    window.AuthUi.setFieldError('password', 'Vui lòng nhập mật khẩu');
    valid = false;
  }
  if (!valid) return;

  window.AuthUi.setLoading(loginButton, true, 'Đang xác thực...');
  try {
    await window.AuthApi.login({
      email,
      password,
      rememberMe: document.getElementById('rememberMe').checked,
    });
    const returnTo = new URLSearchParams(location.search).get('returnTo');
    const destination = returnTo?.startsWith('/') && !returnTo.startsWith('//')
      ? returnTo
      : '/dashboard';
    location.assign(destination);
  } catch (error) {
    window.AuthUi.setAlert(loginAlert, error.message);
  } finally {
    window.AuthUi.setLoading(loginButton, false);
  }
});
