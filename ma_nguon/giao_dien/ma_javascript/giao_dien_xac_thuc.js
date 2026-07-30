(function createAuthUi() {
  const panel = document.querySelector('.auth-panel');
  if (panel) {
    panel.id = 'mainContent';
    panel.tabIndex = -1;
    const skipLink = document.createElement('a');
    skipLink.className = 'auth-skip-link';
    skipLink.href = '#mainContent';
    skipLink.textContent = 'Bỏ qua phần giới thiệu';
    document.body.prepend(skipLink);
  }

  function setAlert(element, message, type = 'error') {
    element.textContent = message || '';
    element.classList.toggle('success', type === 'success');
    element.hidden = !message;
  }

  function setFieldError(field, message) {
    const element = document.querySelector(`[data-error-for="${field}"]`);
    if (element) element.textContent = message || '';
  }

  function clearErrors() {
    document.querySelectorAll('.field-error').forEach((element) => {
      element.textContent = '';
    });
  }

  function setLoading(button, loading, label) {
    if (!button.dataset.label) button.dataset.label = button.textContent;
    button.disabled = loading;
    button.textContent = loading ? label : button.dataset.label;
  }

  document.querySelectorAll('[data-toggle-password]').forEach((button) => {
    button.setAttribute('aria-label', 'Hiện mật khẩu');
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.togglePassword);
      input.type = input.type === 'password' ? 'text' : 'password';
      button.textContent = input.type === 'password' ? '◉' : '○';
      button.setAttribute('aria-pressed', String(input.type === 'text'));
      button.setAttribute(
        'aria-label',
        input.type === 'password' ? 'Hiện mật khẩu' : 'Ẩn mật khẩu',
      );
    });
  });

  document.querySelectorAll('.auth-button').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      const rect = button.getBoundingClientRect();
      const bubble = document.createElement('span');
      bubble.className = 'button-bubble';
      bubble.style.left = `${event.clientX - rect.left - 7}px`;
      bubble.style.top = `${event.clientY - rect.top - 7}px`;
      button.append(bubble);
      setTimeout(() => bubble.remove(), 600);
    });
  });

  window.AuthUi = {
    setAlert,
    setFieldError,
    clearErrors,
    setLoading,
  };
}());
