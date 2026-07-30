(function createAlertsPage() {
  const format = window.MotorCareFormat;
  let alerts = [];

  function updateSummary() {
    document.getElementById('openCount').textContent = alerts.filter((item) => item.status === 'open').length;
    document.getElementById('highCount').textContent = alerts.filter((item) => ['critical', 'high'].includes(item.severity)).length;
    document.getElementById('ackCount').textContent = alerts.filter((item) => item.status === 'acknowledged').length;
    document.getElementById('resolvedCount').textContent = alerts.filter((item) => item.status === 'resolved').length;
  }

  function render() {
    const rows = document.getElementById('alertTableRows');
    rows.innerHTML = alerts.map((alert) => `
      <tr>
        <td>${format.dateTime(alert.createdAt)}</td>
        <td><strong>${format.escapeHtml(alert.motorName)}</strong><small>${format.escapeHtml(alert.type)}</small></td>
        <td>${format.escapeHtml(alert.message)}</td>
        <td><span class="status ${alert.severity}">${alert.severity}</span></td>
        <td><span class="status ${alert.status}">${alert.status}</span></td>
        <td>
          <div class="table-actions">
            ${alert.status === 'open' ? `<button class="button secondary small" data-id="${alert.id}" data-status="acknowledged">Xác nhận</button>` : ''}
            ${alert.status !== 'resolved' ? `<button class="button primary small" data-id="${alert.id}" data-status="resolved">Đã xử lý</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');
    document.getElementById('alertEmpty').hidden = alerts.length > 0;
    updateSummary();
  }

  async function load() {
    document.getElementById('loadingLine').hidden = false;
    const query = new URLSearchParams();
    const motorId = document.getElementById('motorFilter').value;
    const severity = document.getElementById('severityFilter').value;
    const status = document.getElementById('alertStatusFilter').value;
    if (motorId) query.set('motorId', motorId);
    if (severity) query.set('severity', severity);
    if (status) query.set('status', status);

    try {
      const result = await window.AlertApi.list(query.toString());
      alerts = result.data.alerts;
      render();
    } catch (error) {
      window.MotorCareToast.show(error.message, 'error');
    } finally {
      document.getElementById('loadingLine').hidden = true;
    }
  }

  document.addEventListener('motorcare:ready', async () => {
    if (document.body.dataset.page !== 'alerts') return;
    try {
      const motors = await window.MotorApi.list();
      document.getElementById('motorFilter').insertAdjacentHTML(
        'beforeend',
        motors.data.motors.map((motor) => `<option value="${motor.id}">${format.escapeHtml(motor.name)}</option>`).join(''),
      );
    } catch (error) {
      window.MotorCareToast.show(error.message, 'error');
    }

    ['motorFilter', 'severityFilter', 'alertStatusFilter'].forEach((id) => {
      document.getElementById(id).addEventListener('change', load);
    });
    document.getElementById('alertTableRows').addEventListener('click', async (event) => {
      const button = event.target.closest('[data-status]');
      if (!button) return;
      button.disabled = true;
      try {
        await window.AlertApi.setStatus(button.dataset.id, button.dataset.status);
        window.MotorCareToast.show('Đã cập nhật cảnh báo');
        await load();
      } catch (error) {
        window.MotorCareToast.show(error.message, 'error');
        button.disabled = false;
      }
    });
    load();
  });
}());
