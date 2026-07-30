(function createSensorApi() {
  const api = window.MotorCareApi;

  window.SensorApi = {
    list: (motorId, query = '') => api.get(
      `/sensors/motors/${encodeURIComponent(motorId)}/readings${query ? `?${query}` : ''}`,
    ),
    latest: (motorId) => api.get(`/sensors/motors/${encodeURIComponent(motorId)}/latest`),
    create: (motorId, payload) => api.post(
      `/sensors/motors/${encodeURIComponent(motorId)}/readings`,
      payload,
    ),
    exportUrl: (motorId) => `/api/sensors/motors/${encodeURIComponent(motorId)}/export`,
  };
}());
