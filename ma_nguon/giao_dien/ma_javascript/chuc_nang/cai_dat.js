(function createSettingsPage() {
  function bindTabs() {
    const tabs = [...document.querySelectorAll('[data-settings-tab]')];
    const panels = [...document.querySelectorAll('.settings-panel')];

    function activate(tab) {
      tabs.forEach((item) => {
        const selected = item === tab;
        item.classList.toggle('active', selected);
        item.setAttribute('aria-selected', String(selected));
        item.tabIndex = selected ? 0 : -1;
      });
      panels.forEach((panel) => {
        const selected = panel.id === tab.dataset.settingsTab;
        panel.classList.toggle('active', selected);
        panel.hidden = !selected;
      });
      tab.focus();
    }

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activate(tab));
      tab.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        let nextIndex = index;
        if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = tabs.length - 1;
        activate(tabs[nextIndex]);
      });
    });
  }

  function collectSettings() {
    return {
      language: document.getElementById('languageSelect').value,
      theme: document.getElementById('themeSelect').value,
      fontScale: document.getElementById('fontScaleSelect').value,
      density: document.getElementById('densitySelect').value,
      emailNotifications: document.getElementById('emailNotifications').checked,
      browserNotifications: document.getElementById('browserNotifications').checked,
      highContrast: document.getElementById('highContrast').checked,
      reducedMotion: document.getElementById('reducedMotion').checked,
      refreshInterval: Number(document.getElementById('refreshIntervalSelect').value),
    };
  }

  function fillSettings(settings) {
    document.getElementById('languageSelect').value = settings.language;
    document.getElementById('themeSelect').value = settings.theme;
    document.getElementById('fontScaleSelect').value = settings.fontScale;
    document.getElementById('densitySelect').value = settings.density;
    document.getElementById('emailNotifications').checked = settings.emailNotifications;
    document.getElementById('browserNotifications').checked = settings.browserNotifications;
    document.getElementById('highContrast').checked = settings.highContrast;
    document.getElementById('reducedMotion').checked = settings.reducedMotion;
    document.getElementById('refreshIntervalSelect').value = String(settings.refreshInterval);
  }

  document.addEventListener('motorcare:ready', async (event) => {
    if (document.body.dataset.page !== 'settings') return;

    const user = event.detail.user;
    const settings = event.detail.settings;
    const status = document.getElementById('settingsSaveStatus');
    bindTabs();
    fillSettings(settings);
    document.getElementById('profileName').value = user.fullName || user.name;
    document.getElementById('profileEmail').value = user.email;

    document.querySelector('.settings-workspace').addEventListener('change', (changeEvent) => {
      if (!changeEvent.target.closest('#profileForm, #passwordForm')) {
        window.MotorCareApp.setSettings(collectSettings());
        status.textContent = 'Bạn có thay đổi chưa lưu.';
        status.classList.add('unsaved');
      }
    });

    document.getElementById('profileForm').addEventListener('submit', async (submitEvent) => {
      submitEvent.preventDefault();
      const data = Object.fromEntries(new FormData(submitEvent.currentTarget));
      try {
        const result = await window.UserApi.updateProfile(data);
        window.MotorCareApp.setUser(result.data.user);
        window.MotorCareApp.refreshShell();
        window.MotorCareToast.show('Đã lưu hồ sơ');
      } catch (error) {
        window.MotorCareToast.show(error.message, 'error');
      }
    });

    document.getElementById('saveSettingsButton').addEventListener('click', async () => {
      const button = document.getElementById('saveSettingsButton');
      const nextSettings = collectSettings();
      button.disabled = true;
      status.textContent = 'Đang lưu tùy chọn...';

      try {
        if (
          nextSettings.browserNotifications
          && 'Notification' in window
          && Notification.permission === 'default'
        ) {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            nextSettings.browserNotifications = false;
            document.getElementById('browserNotifications').checked = false;
          }
        }

        const result = await window.UserApi.updateSettings(nextSettings);
        window.MotorCareApp.setSettings(result.data.settings);
        window.MotorCareI18n.setLanguage(result.data.settings.language);
        window.MotorCareApp.refreshShell();
        status.textContent = 'Đã đồng bộ tùy chọn với tài khoản.';
        status.classList.remove('unsaved');
        window.MotorCareToast.show('Đã lưu tùy chọn');
      } catch (error) {
        status.textContent = 'Chưa thể lưu. Vui lòng thử lại.';
        window.MotorCareToast.show(error.message, 'error');
      } finally {
        button.disabled = false;
      }
    });

    document.getElementById('passwordForm').addEventListener('submit', async (submitEvent) => {
      submitEvent.preventDefault();
      try {
        await window.AuthApi.changePassword(
          document.getElementById('currentPassword').value,
          document.getElementById('newPassword').value,
        );
        location.assign('/login');
      } catch (error) {
        window.MotorCareToast.show(error.message, 'error');
      }
    });

    document.getElementById('logoutAllButton').addEventListener('click', async () => {
      if (!confirm('Đăng xuất khỏi tất cả thiết bị?')) return;
      try {
        await window.AuthApi.logoutAll();
      } finally {
        location.assign('/login');
      }
    });
  });
}());
