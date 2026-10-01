(function initializePublicDashboard() {
  window.MotorCareApp = {
    settings: {
      refreshInterval: 3,
    },
  };

  document.dispatchEvent(new CustomEvent('motorcare:ready', {
    detail: {
      settings: window.MotorCareApp.settings,
      page: 'dashboard',
      public: true,
    },
  }));
}());
