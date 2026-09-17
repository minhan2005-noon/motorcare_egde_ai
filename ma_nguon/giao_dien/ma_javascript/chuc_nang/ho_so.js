(function createEngineerProfilePage() {
  const PHONE_PATTERN = /^0(3|5|7|8|9)\d{8}$/;
  const CITIZEN_ID_PATTERN = /^\d{12}$/;

  function initials(name) {
    return String(name || 'MC')
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  function normalizePhone(value) {
    let phone = String(value || '').replace(/[.\s-]/g, '');
    if (phone.startsWith('+84')) phone = `0${phone.slice(3)}`;
    return phone;
  }

  function setAlert(element, message = '', type = 'error') {
    element.textContent = message;
    element.className = `profile-alert ${type}`;
    element.hidden = !message;
  }

  function clearFieldErrors(form) {
    form.querySelectorAll('[data-profile-error]').forEach((element) => {
      element.textContent = '';
    });
    form.querySelectorAll('[aria-invalid="true"]').forEach((element) => {
      element.removeAttribute('aria-invalid');
    });
  }

  function setFieldError(form, field, message) {
    const error = form.querySelector(`[data-profile-error="${field}"]`);
    const input = {
      fullName: 'profileFullName',
      email: 'profileEmail',
      phone: 'profilePhone',
      gender: 'profileGender',
      citizenId: 'profileCitizenId',
      currentPassword: 'profileCurrentPassword',
      newPassword: 'profileNewPassword',
      confirmPassword: 'profileConfirmPassword',
    }[field];
    if (error) error.textContent = message;
    document.getElementById(input)?.setAttribute('aria-invalid', 'true');
  }

  function setButtonLoading(button, loading, loadingText) {
    const label = button.querySelector('span');
    if (!button.dataset.defaultLabel) button.dataset.defaultLabel = label.textContent;
    button.disabled = loading;
    label.textContent = loading ? loadingText : button.dataset.defaultLabel;
  }

  function updateIdentity(user) {
    const values = [user.fullName || user.name, user.email, user.phone, user.gender, user.citizenId];
    const completed = values.filter(Boolean).length;
    const percent = Math.round((completed / values.length) * 100);
    const bar = document.getElementById('completionBar');
    const track = document.getElementById('completionTrack');

    document.getElementById('profileAvatar').textContent = initials(user.fullName || user.name);
    document.getElementById('profileRole').textContent = user.role || 'engineer';
    document.getElementById('completionPercent').textContent = `${percent}%`;
    document.getElementById('completionHint').textContent = percent === 100
      ? 'Hồ sơ kỹ sư đã có đầy đủ thông tin.'
      : 'Bổ sung thông tin còn thiếu để hoàn thiện hồ sơ.';
    bar.style.width = `${percent}%`;
    track.setAttribute('aria-valuenow', String(percent));
  }

  function passwordScore(password) {
    return [
      password.length >= 8,
      /[a-z]/.test(password),
      /[A-Z]/.test(password),
      /\d/.test(password),
    ].filter(Boolean).length;
  }

  function bindPasswordVisibility(container) {
    container.querySelectorAll('[data-password-target]').forEach((button) => {
      button.addEventListener('click', () => {
        const input = document.getElementById(button.dataset.passwordTarget);
        const showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        button.classList.toggle('active', !showing);
        button.setAttribute('aria-label', showing ? 'Hiện mật khẩu' : 'Ẩn mật khẩu');
      });
    });
  }

  document.addEventListener('motorcare:ready', (event) => {
    if (document.body.dataset.page !== 'profile') return;

    const user = event.detail.user;
    const profileForm = document.getElementById('engineerProfileForm');
    const passwordForm = document.getElementById('engineerPasswordForm');
    const profileAlert = document.getElementById('profileAlert');
    const passwordAlert = document.getElementById('passwordAlert');
    const saveButton = document.getElementById('saveProfileButton');
    const passwordButton = document.getElementById('changePasswordButton');

    document.getElementById('profileFullName').value = user.fullName || user.name || '';
    document.getElementById('profilePhone').value = user.phone || '';
    document.getElementById('profileEmail').value = user.email || '';
    document.getElementById('profileGender').value = user.gender || '';
    document.getElementById('profileCitizenId').value = user.citizenId || '';
    updateIdentity(user);

    const welcome = document.getElementById('profileWelcome');
    welcome.hidden = !new URLSearchParams(location.search).has('welcome');
    document.getElementById('welcomeClose').addEventListener('click', () => {
      welcome.hidden = true;
      history.replaceState({}, '', '/profile');
    });

    bindPasswordVisibility(passwordForm);

    const newPasswordInput = document.getElementById('profileNewPassword');
    newPasswordInput.addEventListener('input', () => {
      const score = passwordScore(newPasswordInput.value);
      document.querySelectorAll('#securityMeter span').forEach((segment, index) => {
        segment.classList.toggle('active', index < score);
      });
    });

    profileForm.addEventListener('submit', async (submitEvent) => {
      submitEvent.preventDefault();
      clearFieldErrors(profileForm);
      setAlert(profileAlert);

      const payload = {
        fullName: document.getElementById('profileFullName').value.trim(),
        phone: normalizePhone(document.getElementById('profilePhone').value),
        email: document.getElementById('profileEmail').value.trim(),
        gender: document.getElementById('profileGender').value,
        citizenId: document.getElementById('profileCitizenId').value.replace(/\s/g, ''),
      };
      let valid = true;

      if (payload.fullName.length < 2) {
        setFieldError(profileForm, 'fullName', 'Họ tên cần ít nhất 2 ký tự.');
        valid = false;
      }
      if (!document.getElementById('profileEmail').checkValidity()) {
        setFieldError(profileForm, 'email', 'Email không hợp lệ.');
        valid = false;
      }
      if (payload.phone && !PHONE_PATTERN.test(payload.phone)) {
        setFieldError(profileForm, 'phone', 'Nhập số điện thoại Việt Nam gồm 10 chữ số.');
        valid = false;
      }
      if (payload.citizenId && !CITIZEN_ID_PATTERN.test(payload.citizenId)) {
        setFieldError(profileForm, 'citizenId', 'CCCD phải gồm đúng 12 chữ số.');
        valid = false;
      }
      if (!valid) return;

      setButtonLoading(saveButton, true, 'Đang lưu...');
      try {
        const result = await window.UserApi.updateProfile(payload);
        const updatedUser = result.data.user;
        window.MotorCareApp.setUser(updatedUser);
        window.MotorCareApp.refreshShell();
        updateIdentity(updatedUser);
        setAlert(profileAlert, 'Thông tin hồ sơ đã được cập nhật thành công.', 'success');
        window.MotorCareToast?.show('Đã lưu hồ sơ kỹ sư');
      } catch (error) {
        setAlert(profileAlert, error.message);
      } finally {
        setButtonLoading(saveButton, false);
      }
    });

    passwordForm.addEventListener('submit', async (submitEvent) => {
      submitEvent.preventDefault();
      clearFieldErrors(passwordForm);
      setAlert(passwordAlert);

      const currentPassword = document.getElementById('profileCurrentPassword').value;
      const newPassword = newPasswordInput.value;
      const confirmPassword = document.getElementById('profileConfirmPassword').value;
      let valid = true;

      if (!currentPassword) {
        setFieldError(passwordForm, 'currentPassword', 'Vui lòng nhập mật khẩu hiện tại.');
        valid = false;
      }
      if (passwordScore(newPassword) < 4) {
        setFieldError(passwordForm, 'newPassword', 'Mật khẩu cần ít nhất 8 ký tự, có chữ hoa, chữ thường và chữ số.');
        valid = false;
      }
      if (newPassword !== confirmPassword) {
        setFieldError(passwordForm, 'confirmPassword', 'Mật khẩu xác nhận chưa khớp.');
        valid = false;
      }
      if (!valid) return;

      setButtonLoading(passwordButton, true, 'Đang cập nhật...');
      try {
        await window.AuthApi.changePassword(currentPassword, newPassword);
        location.assign('/login');
      } catch (error) {
        setAlert(passwordAlert, error.message);
        setButtonLoading(passwordButton, false);
      }
    });
  });
}());
