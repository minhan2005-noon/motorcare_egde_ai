(function createAuthApi() {
  const api = window.MotorCareApi;

  window.AuthApi = {
    register: (payload) => api.post('/auth/register', payload),
    login: (payload) => api.post('/auth/login', payload),
    me: () => api.get('/auth/me'),
    logout: () => api.post('/auth/logout'),
    logoutAll: () => api.post('/auth/logout-all'),
    forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
    verifyResetCode: (email, code) => api.post('/auth/verify-reset-code', { email, code }),
    resetPassword: (email, code, password) => api.post('/auth/reset-password', {
      email,
      code,
      password,
    }),
    changePassword: (currentPassword, newPassword) => api.post('/auth/change-password', {
      currentPassword,
      newPassword,
    }),
  };
}());
