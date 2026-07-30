(function createUserApi() {
  const api = window.MotorCareApi;

  window.UserApi = {
    updateProfile: (payload) => api.patch('/users/profile', payload),
    getSettings: () => api.get('/users/settings'),
    updateSettings: (payload) => api.patch('/users/settings', payload),
  };
}());
