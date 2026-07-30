(function createFormatters() {
  const dateTime = new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'medium',
  });

  function formatDateTime(value) {
    if (!value) return 'Chưa có';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Không hợp lệ' : dateTime.format(date);
  }

  function number(value, digits = 2) {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat('vi-VN', {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    }).format(value);
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
  }

  window.MotorCareFormat = {
    dateTime: formatDateTime,
    number,
    escapeHtml,
  };
}());
