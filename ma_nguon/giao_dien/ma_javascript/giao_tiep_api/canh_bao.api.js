(function createAlertApi() {
  const api = window.MotorCareApi;

  window.AlertApi = {
    list: (query = '') => api.get(`/alerts${query ? `?${query}` : ''}`),
    setStatus: (id, status) => api.patch(`/alerts/${encodeURIComponent(id)}/status`, { status }),
  };
}());
