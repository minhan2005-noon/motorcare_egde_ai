(function createDatasetPage() {
  const format = window.MotorCareFormat;
  let selectedMotorId = '';

  async function loadReadings() {
    selectedMotorId = document.getElementById('datasetMotorSelect').value;
    if (!selectedMotorId) return;
    const query = new URLSearchParams({ limit: '1000' });
    const from = document.getElementById('fromDate').value;
    const to = document.getElementById('toDate').value;
    if (from) query.set('from', new Date(from).toISOString());
    if (to) query.set('to', new Date(to).toISOString());
    document.getElementById('loadingLine').hidden = false;
    try {
      const result = await window.SensorApi.list(selectedMotorId, query.toString());
      const readings = result.data.readings;
      document.getElementById('datasetRows').innerHTML = readings.length
        ? readings.map((item) => `
          <tr>
            <td>${format.dateTime(item.recordedAt)}</td>
            <td>${format.number(item.vibrationRms)} mm/s</td>
            <td>${format.number(item.currentRms)} A</td>
            <td>${format.number(item.temperature, 1)} °C</td>
            <td>${format.number(item.soundLevel, 1)} dB</td>
            <td>${format.number(item.rpm, 0)}</td>
            <td>${format.escapeHtml(item.source)}</td>
          </tr>
        `).join('')
        : '<tr><td colspan="7">Chưa có mẫu đo.</td></tr>';
      document.getElementById('datasetTotal').textContent = `${result.data.total} mẫu đo`;
      document.getElementById('exportLink').href = window.SensorApi.exportUrl(selectedMotorId);
    } catch (error) {
      window.MotorCareToast.show(error.message, 'error');
    } finally {
      document.getElementById('loadingLine').hidden = true;
    }
  }

  function closeModal() {
    document.getElementById('readingModal').hidden = true;
  }

  document.addEventListener('motorcare:ready', async () => {
    if (document.body.dataset.page !== 'dataset') return;
    try {
      const result = await window.MotorApi.list();
      const select = document.getElementById('datasetMotorSelect');
      select.innerHTML = result.data.motors.length
        ? result.data.motors.map((motor) => `<option value="${motor.id}">${format.escapeHtml(motor.name)}</option>`).join('')
        : '<option value="">Chưa có motor</option>';
      await loadReadings();
    } catch (error) {
      window.MotorCareToast.show(error.message, 'error');
    }

    document.getElementById('datasetMotorSelect').addEventListener('change', loadReadings);
    document.getElementById('applyDatasetFilter').addEventListener('click', loadReadings);
    document.getElementById('addReadingButton').addEventListener('click', () => {
      if (!selectedMotorId) {
        window.MotorCareToast.show('Hãy thêm motor trước', 'error');
        return;
      }
      const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
      document.getElementById('recordedAt').value = now.toISOString().slice(0, 16);
      document.getElementById('readingModal').hidden = false;
    });
    document.getElementById('closeReadingModal').addEventListener('click', closeModal);
    document.getElementById('cancelReadingModal').addEventListener('click', closeModal);
    document.getElementById('readingForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      Object.keys(data).forEach((key) => {
        if (data[key] === '') delete data[key];
      });
      data.source = 'manual';
      if (data.recordedAt) data.recordedAt = new Date(data.recordedAt).toISOString();
      try {
        await window.SensorApi.create(selectedMotorId, data);
        window.MotorCareToast.show('Đã lưu mẫu đo');
        event.currentTarget.reset();
        closeModal();
        await loadReadings();
      } catch (error) {
        window.MotorCareToast.show(error.message, 'error');
      }
    });
  });
}());
