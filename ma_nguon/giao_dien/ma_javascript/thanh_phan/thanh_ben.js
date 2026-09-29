(function createSidebar() {
  const navigation = [
    ['dashboard', '/dashboard', '▦', 'Dashboard'],
    ['motors', '/motors', '◉', 'Motors'],
    ['calibration', '/calibration', '≡', 'Calibration'],
    ['alerts', '/alerts', '♢', 'Alerts'],
    ['dataset', '/dataset', '▤', 'Dataset'],
    ['settings', '/settings', '⚙', 'Settings'],
  ];

  function initials(name) {
    return String(name || 'MC')
      .split(/\s+/)
      .slice(-2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  function render(user, activePage) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    sidebar.className = 'sidebar';
    const t = window.MotorCareI18n?.t || ((value) => value);
    sidebar.innerHTML = `
      <a class="brand" href="/dashboard">
        <span class="brand-mark" aria-hidden="true"></span>
        <span class="brand-copy">
          <strong>MotorCare Edge AI</strong>
          <small>${t('Motor condition monitoring')}</small>
        </span>
      </a>
      <nav class="sidebar-nav" aria-label="Điều hướng chính">
        ${navigation.map(([key, href, symbol, label]) => `
          <a class="nav-link ${key === activePage ? 'active' : ''}" href="${href}" title="${t(label)}" aria-label="${t(label)}">
            <span class="nav-symbol" aria-hidden="true">${symbol}</span>
            <span>${t(label)}</span>
            ${key === 'alerts' ? '<span class="nav-count" id="navAlertCount">0</span>' : ''}
          </a>
        `).join('')}
      </nav>
      <div class="sidebar-tools" aria-label="${t('Trợ năng nhanh')}">
        <button class="sidebar-tool" id="quickFontButton" type="button" title="${t('Đổi cỡ chữ')}" aria-label="${t('Đổi cỡ chữ')}">
          <span aria-hidden="true">Aa</span>
        </button>
        <button class="sidebar-tool ${window.MotorCareApp?.settings.highContrast ? 'active' : ''}" id="quickContrastButton" type="button" title="${t('Tương phản cao')}" aria-label="${t('Tương phản cao')}">
          <span aria-hidden="true">◐</span>
        </button>
        <button class="sidebar-tool ${window.MotorCareApp?.settings.reducedMotion ? 'active' : ''}" id="quickMotionButton" type="button" title="${t('Giảm chuyển động')}" aria-label="${t('Giảm chuyển động')}">
          <span aria-hidden="true">Ⅱ</span>
        </button>
      </div>
      <div class="sidebar-note">
        ${t('Edge AI đang phân tích trực tiếp trên ESP32 và gửi cảnh báo lên Dashboard.')}
      </div>
      <div class="user-panel">
        <span class="avatar" id="userAvatar"></span>
        <span class="user-meta">
          <strong id="userName"></strong>
          <small id="userRole"></small>
        </span>
        <button class="icon-button" id="logoutButton" type="button" title="${t('Đăng xuất')}" aria-label="${t('Đăng xuất')}">↪</button>
      </div>
    `;

    document.getElementById('userAvatar').textContent = initials(user.fullName || user.name);
    document.getElementById('userName').textContent = user.fullName || user.name;
    document.getElementById('userRole').textContent = user.role;
  }

  window.MotorCareSidebar = { render };
}());
