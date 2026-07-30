(function createToast() {
  function show(message, type = 'success') {
    let region = document.querySelector('.toast-region');
    if (!region) {
      region = document.createElement('div');
      region.className = 'toast-region';
      region.setAttribute('aria-live', 'polite');
      document.body.append(region);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    region.append(toast);
    setTimeout(() => toast.remove(), 3600);
  }

  window.MotorCareToast = { show };
}());
