(function createMotorApi() {
  const api = window.MotorCareApi;

  window.MotorApi = {
    list: () => api.get('/motors'),
    get: (id) => api.get(`/motors/${encodeURIComponent(id)}`),
    create: (payload) => api.post('/motors', payload),
    update: (id, payload) => api.patch(`/motors/${encodeURIComponent(id)}`, payload),
    remove: (id) => api.delete(`/motors/${encodeURIComponent(id)}`),
    setConnection: (id, connected) => api.patch(
      `/motors/${encodeURIComponent(id)}/connection`,
      { connected },
    ),
    createDeviceToken: (id) => api.post(
      `/motors/${encodeURIComponent(id)}/device-token`,
      {},
    ),
  };
}());
