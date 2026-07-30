(function createCalibrationApi() {
  const api = window.MotorCareApi;

  window.CalibrationApi = {
    list: (motorId) => api.get(`/calibrations/motors/${encodeURIComponent(motorId)}`),
    create: (motorId, payload) => api.post(
      `/calibrations/motors/${encodeURIComponent(motorId)}`,
      payload,
    ),
  };
}());
