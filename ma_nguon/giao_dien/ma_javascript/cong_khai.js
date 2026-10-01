(function initializePublicDashboard() {
  window.MotorCareApp = {
    settings: {
      refreshInterval: 5,
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
