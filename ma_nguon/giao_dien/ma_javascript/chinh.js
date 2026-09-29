(function initializeApplication() {
  const storageKey = 'motorcare:appearance';
  const state = {
    user: null,
    settings: {
      language: 'vi',
      theme: 'system',
      fontScale: 'normal',
      density: 'comfortable',
      highContrast: false,
      reducedMotion: false,
      refreshInterval: 10,
    },
  };

  function applySettings(settings, persist = true) {
    const root = document.documentElement;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const resolvedTheme = settings.theme === 'system'
      ? (prefersDark ? 'dark' : 'light')
      : settings.theme;

    root.dataset.theme = resolvedTheme;
    root.dataset.themePreference = settings.theme;
    root.dataset.fontScale = settings.fontScale;
    root.dataset.density = settings.density;
    root.dataset.contrast = settings.highContrast ? 'high' : 'normal';
    root.dataset.motion = settings.reducedMotion ? 'reduced' : 'full';
    root.style.colorScheme = resolvedTheme;

    if (persist) {
      localStorage.setItem(storageKey, JSON.stringify(settings));
    }
  }

  try {
    state.settings = {
      ...state.settings,
      ...JSON.parse(localStorage.getItem(storageKey) || '{}'),
    };
  } catch {
    localStorage.removeItem(storageKey);
  }
  applySettings(state.settings, false);

  function isEditableTarget(target) {
    return target instanceof Element
      && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
  }

  ['copy', 'cut', 'paste'].forEach((eventName) => {
    document.addEventListener(eventName, (event) => {
      if (!isEditableTarget(event.target)) event.preventDefault();
    });
  });

  document.addEventListener('keydown', (event) => {
    const shortcut = (event.ctrlKey || event.metaKey)
      && ['c', 'x', 'v'].includes(event.key.toLowerCase());
    if (shortcut && !isEditableTarget(event.target)) event.preventDefault();
  });

  function bindShellEvents() {
    document.getElementById('mobileMenuButton')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.toggle('open');
    });
    document.getElementById('logoutButton')?.addEventListener('click', async () => {
      try {
        await window.AuthApi.logout();
      } finally {
        location.assign('/login');
      }
    });

    document.getElementById('quickFontButton')?.addEventListener('click', () => {
      const sizes = ['small', 'normal', 'large'];
      const next = sizes[(sizes.indexOf(state.settings.fontScale) + 1) % sizes.length];
      saveQuickSettings({ fontScale: next }, `Cỡ chữ: ${next}`);
    });
    document.getElementById('quickContrastButton')?.addEventListener('click', () => {
      saveQuickSettings(
        { highContrast: !state.settings.highContrast },
        state.settings.highContrast ? 'Đã tắt tương phản cao' : 'Đã bật tương phản cao',
      );
    });
    document.getElementById('quickMotionButton')?.addEventListener('click', () => {
      saveQuickSettings(
        { reducedMotion: !state.settings.reducedMotion },
        state.settings.reducedMotion ? 'Đã bật chuyển động' : 'Đã giảm chuyển động',
      );
    });
  }

  async function saveQuickSettings(patch, message) {
    const optimistic = { ...state.settings, ...patch };
    state.settings = optimistic;
    applySettings(optimistic);
    try {
      const result = await window.MotorCareApi.patch('/users/settings', optimistic);
      state.settings = result.data.settings;
      applySettings(state.settings);
      refreshShell();
      document.dispatchEvent(new CustomEvent('motorcare:settings-changed', {
        detail: { settings: state.settings },
      }));
      window.MotorCareToast?.show(message);
    } catch (error) {
      window.MotorCareToast?.show(error.message, 'error');
    }
  }

  async function updateAlertCount() {
    try {
      const alerts = await window.AlertApi.list('status=open&limit=1');
      const badge = document.getElementById('navAlertCount');
      if (badge) {
        const count = alerts.data.openCount;
        badge.textContent = count > 99 ? '99+' : String(count);
      }
    } catch {
      // Navigation remains usable when the alert count cannot be loaded.
    }
  }

  function refreshShell() {
    window.MotorCareSidebar.render(state.user, document.body.dataset.page);
    bindShellEvents();
    updateAlertCount();
  }

  async function activatePage() {
    ensureAccessibilityShell();
    applySettings(state.settings);
    window.MotorCareI18n?.setLanguage(state.settings.language);
    refreshShell();
    window.MotorCareI18n?.apply(document.querySelector('.main-panel'));

    document.dispatchEvent(new CustomEvent('motorcare:ready', {
      detail: {
        user: state.user,
        settings: state.settings,
        page: document.body.dataset.page,
        view: document.body.dataset.view,
      },
    }));
  }

  function ensureAccessibilityShell() {
    document.querySelector('.main-panel')?.setAttribute('id', 'mainContent');
    if (!document.querySelector('.skip-link')) {
      const skipLink = document.createElement('a');
      skipLink.className = 'skip-link';
      skipLink.href = '#mainContent';
      skipLink.textContent = 'Bỏ qua điều hướng';
      document.body.prepend(skipLink);
    }
    if (!document.getElementById('appLiveRegion')) {
      const liveRegion = document.createElement('div');
      liveRegion.id = 'appLiveRegion';
      liveRegion.className = 'sr-only';
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', 'polite');
      document.body.append(liveRegion);
    }
  }

  window.MotorCareApp = {
    activatePage,
    refreshShell,
    get user() {
      return state.user;
    },
    get settings() {
      return state.settings;
    },
    setSettings(settings) {
      state.settings = { ...state.settings, ...settings };
      applySettings(state.settings);
      document.dispatchEvent(new CustomEvent('motorcare:settings-changed', {
        detail: { settings: state.settings },
      }));
    },
    setUser(user) {
      state.user = user;
      window.motorcareUser = user;
    },
  };

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.settings.theme === 'system') applySettings(state.settings, false);
  });

  (async () => {
    try {
      const result = await window.AuthApi.me();
      state.user = result.data.user;

      try {
        const settingsResult = await window.MotorCareApi.get('/users/settings');
        state.settings = settingsResult.data.settings || state.settings;
        applySettings(state.settings);
      } catch {
        // The application can still load with the default language.
      }

      window.motorcareUser = state.user;
      await activatePage();
    } catch (error) {
      if (error.status !== 401) {
        window.MotorCareToast?.show(error.message, 'error');
      }
    }
  })();
}());
