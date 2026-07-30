(function createCalibrationPage() {
  const format = window.MotorCareFormat;
  let motorId = '';

  async function loadHistory() {
    motorId = document.getElementById('calibrationMotorSelect').value;
    if (!motorId) return;
    document.getElementById('loadingLine').hidden = false;
    try {
      const result = await window.CalibrationApi.list(motorId);
      const rows = result.data.calibrations;
      document.getElementById('calibrationRows').innerHTML = rows.length
        ? rows.map((item) => `
          <tr>
            <td>${format.dateTime(item.createdAt)}</td>
            <td>${item.sampleCount}</td>
            <td>
              <strong>Rung ${format.number(item.vibrationBaseline)} · Dòng ${format.number(item.currentBaseline)}</strong>
              <small>Nhiệt ${format.number(item.temperatureBaseline, 1)} · Ồn ${format.number(item.soundBaseline, 1)}</small>
            </td>
            <td>
              <strong>${format.number(item.thresholds.vibrationWarning)} mm/s · ${format.number(item.thresholds.currentWarning)} A</strong>
              <small>${format.number(item.thresholds.temperatureWarning, 1)} °C · ${format.number(item.thresholds.soundWarning, 1)} dB</small>
            </td>
          </tr>
        `).join('')
        : '<tr><td colspan="4">Chưa có lần hiệu chuẩn.</td></tr>';
    } catch (error) {
      window.MotorCareToast.show(error.message, 'error');
    } finally {
      document.getElementById('loadingLine').hidden = true;
    }
  }

  document.addEventListener('motorcare:ready', async () => {
    if (document.body.dataset.page !== 'calibration') return;
    try {
      const result = await window.MotorApi.list();
      const select = document.getElementById('calibrationMotorSelect');
      select.innerHTML = result.data.motors.length
        ? result.data.motors.map((motor) => `<option value="${motor.id}">${format.escapeHtml(motor.name)}</option>`).join('')
        : '<option value="">Chưa có motor</option>';
      await loadHistory();
    } catch (error) {
      window.MotorCareToast.show(error.message, 'error');
    }

    document.getElementById('calibrationMotorSelect').addEventListener('change', loadHistory);
    document.getElementById('calibrationForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!motorId) return;
      const data = Object.fromEntries(new FormData(event.currentTarget));
      Object.keys(data).forEach((key) => {
        if (data[key] === '') delete data[key];
      });
      try {
        await window.CalibrationApi.create(motorId, data);
        window.MotorCareToast.show('Hiệu chuẩn thành công');
        event.currentTarget.reset();
        document.getElementById('sampleCount').value = 30;
        await loadHistory();
      } catch (error) {
        window.MotorCareToast.show(error.message, 'error');
      }
    });
  });
}());
