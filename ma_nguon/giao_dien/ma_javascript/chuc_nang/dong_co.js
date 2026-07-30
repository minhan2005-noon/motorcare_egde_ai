(function createMotorsPage() {
  const format = window.MotorCareFormat;
  let motors = [];
  let editingId = null;
  let detailMotor = null;

  function setLoading(value) {
    const line = document.getElementById('loadingLine');
    if (line) line.hidden = !value;
  }

  function showModal(motor = null) {
    editingId = motor?.id || null;
    document.getElementById('motorModalTitle').textContent = motor ? 'Cập nhật motor' : 'Thêm motor';
    const form = document.getElementById('motorForm');
    form.reset();
    for (const [key, value] of Object.entries(motor || {})) {
      const field = form.elements.namedItem(key);
      if (field) field.value = value ?? '';
    }
    document.getElementById('motorModal').hidden = false;
    document.getElementById('motorName').focus();
  }

  function closeModal() {
    document.getElementById('motorModal').hidden = true;
    editingId = null;
  }

  function updateSummary() {
    document.getElementById('totalMotors').textContent = motors.length;
    document.getElementById('connectedMotors').textContent = motors.filter((item) => item.connectionStatus === 'connected').length;
    document.getElementById('maintenanceMotors').textContent = motors.filter((item) => item.status === 'maintenance').length;
    document.getElementById('offlineMotors').textContent = motors.filter((item) => item.connectionStatus === 'disconnected').length;
  }

  function renderList() {
    const search = document.getElementById('motorSearch').value.trim().toLowerCase();
    const status = document.getElementById('statusFilter').value;
    const filtered = motors.filter((motor) => {
      const haystack = `${motor.name} ${motor.deviceCode} ${motor.location}`.toLowerCase();
      return (!search || haystack.includes(search)) && (!status || motor.status === status);
    });

    document.getElementById('motorRows').innerHTML = filtered.map((motor) => `
      <tr>
        <td><strong>${format.escapeHtml(motor.name)}</strong><small>${format.escapeHtml(motor.deviceCode)}</small></td>
        <td>${format.escapeHtml(motor.location || 'Chưa cập nhật')}</td>
        <td><strong>${format.escapeHtml(motor.model || 'Chưa cập nhật')}</strong><small>${format.number(motor.ratedPowerKw, 1)} kW · ${format.number(motor.ratedVoltage, 0)} V</small></td>
        <td><span class="status ${motor.status}">${motor.status}</span></td>
        <td><span class="status ${motor.connectionStatus}">${motor.connectionStatus}</span></td>
        <td>
          <div class="table-actions">
            <a class="button secondary small" href="/motors/${motor.id}">Chi tiết</a>
            <button class="icon-button" type="button" data-action="edit" data-id="${motor.id}" title="Chỉnh sửa" aria-label="Chỉnh sửa ${format.escapeHtml(motor.name)}">✎</button>
            <button class="icon-button delete-button" type="button" data-action="delete" data-id="${motor.id}" title="Xóa" aria-label="Xóa ${format.escapeHtml(motor.name)}">×</button>
          </div>
        </td>
      </tr>
    `).join('');
    document.getElementById('motorEmpty').hidden = filtered.length > 0;
  }

  async function loadList() {
    setLoading(true);
    try {
      const result = await window.MotorApi.list();
      motors = result.data.motors;
      updateSummary();
      renderList();
    } catch (error) {
      window.MotorCareToast.show(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function saveMotor(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    ['ratedPowerKw', 'ratedVoltage', 'ratedCurrent'].forEach((field) => {
      if (data[field] === '') delete data[field];
    });
    if (!data.deviceCode) delete data.deviceCode;

    const button = document.getElementById('saveMotorButton');
    button.disabled = true;
    try {
      if (editingId) await window.MotorApi.update(editingId, data);
      else await window.MotorApi.create(data);
      window.MotorCareToast.show(editingId ? 'Đã cập nhật motor' : 'Đã thêm motor');
      closeModal();
      await loadList();
    } catch (error) {
      window.MotorCareToast.show(error.message, 'error');
    } finally {
      button.disabled = false;
    }
  }

  function drawDetailChart(values) {
    const canvas = document.getElementById('detailChart');
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(rect.width, 300);
    const height = Math.max(rect.height, 220);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, width, height);
    const series = values.map((item) => item.vibrationRms).reverse().filter(Number.isFinite);
    if (!series.length) {
      ctx.fillStyle = '#64778b';
      ctx.fillText('Chưa có dữ liệu cảm biến', 20, 40);
      return;
    }
    const min = Math.min(...series);
    const max = Math.max(...series);
    const span = max - min || 1;
    ctx.strokeStyle = '#dce4eb';
    for (let row = 0; row < 4; row += 1) {
      const y = 24 + row * ((height - 48) / 3);
      ctx.beginPath();
      ctx.moveTo(24, y);
      ctx.lineTo(width - 24, y);
      ctx.stroke();
    }
    ctx.beginPath();
    series.forEach((value, index) => {
      const x = 24 + index / Math.max(series.length - 1, 1) * (width - 48);
      const y = 24 + (1 - (value - min) / span) * (height - 48);
      if (!index) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#1769e8';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  function renderDetail(motor, readings) {
    detailMotor = motor;
    document.title = `${motor.name} · MotorCare Edge AI`;
    document.getElementById('detailMotorName').textContent = motor.name;
    document.getElementById('detailMotorCode').textContent = `${motor.deviceCode} · ${motor.location || 'Chưa cập nhật vị trí'}`;
    const connected = motor.connectionStatus === 'connected';
    const status = document.getElementById('detailConnection');
    status.className = `status ${motor.connectionStatus}`;
    status.textContent = connected ? 'Đã kết nối' : 'Mất kết nối';
    const button = document.getElementById('detailConnectButton');
    button.textContent = connected ? 'Ngắt kết nối' : 'Kết nối';
    button.className = `button ${connected ? 'secondary' : 'primary'} small`;

    const latest = readings[0];
    document.getElementById('latestVibration').textContent = latest ? `${format.number(latest.vibrationRms)} mm/s` : '—';
    document.getElementById('latestCurrent').textContent = latest ? `${format.number(latest.currentRms)} A` : '—';
    document.getElementById('latestTemperature').textContent = latest ? `${format.number(latest.temperature, 1)} °C` : '—';
    document.getElementById('latestSound').textContent = latest ? `${format.number(latest.soundLevel, 1)} dB` : '—';

    const facts = [
      ['Trạng thái', motor.status],
      ['Model', motor.model || 'Chưa cập nhật'],
      ['Serial', motor.serialNumber || 'Chưa cập nhật'],
      ['Công suất', `${format.number(motor.ratedPowerKw, 1)} kW`],
      ['Điện áp', `${format.number(motor.ratedVoltage, 0)} V`],
      ['Dòng định mức', `${format.number(motor.ratedCurrent, 1)} A`],
      ['Lần cuối nhận dữ liệu', format.dateTime(motor.lastSeenAt)],
      ['Ghi chú', motor.notes || 'Không có'],
    ];
    document.getElementById('motorFacts').innerHTML = facts.map(([label, value]) => `
      <div class="toggle-row"><span>${format.escapeHtml(label)}</span><strong>${format.escapeHtml(value)}</strong></div>
    `).join('');

    document.getElementById('readingRows').innerHTML = readings.length
      ? readings.slice(0, 30).map((reading) => `
        <tr>
          <td>${format.dateTime(reading.recordedAt)}</td>
          <td>${format.number(reading.vibrationRms)} mm/s</td>
          <td>${format.number(reading.currentRms)} A</td>
          <td>${format.number(reading.temperature, 1)} °C</td>
          <td>${format.number(reading.soundLevel, 1)} dB</td>
          <td>${format.number(reading.rpm, 0)}</td>
        </tr>
      `).join('')
      : '<tr><td colspan="6">Chưa có dữ liệu cảm biến.</td></tr>';
    document.getElementById('exportDetailLink').href = window.SensorApi.exportUrl(motor.id);
    drawDetailChart(readings);
  }

  async function loadDetail() {
    const id = decodeURIComponent(location.pathname.split('/').filter(Boolean).at(-1));
    setLoading(true);
    try {
      const [motorResult, readingsResult] = await Promise.all([
        window.MotorApi.get(id),
        window.SensorApi.list(id, 'limit=100'),
      ]);
      renderDetail(motorResult.data.motor, readingsResult.data.readings);
    } catch (error) {
      window.MotorCareToast.show(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  function initializeList() {
    document.getElementById('addMotorButton').addEventListener('click', () => showModal());
    document.getElementById('closeMotorModal').addEventListener('click', closeModal);
    document.getElementById('cancelMotorModal').addEventListener('click', closeModal);
    document.getElementById('motorForm').addEventListener('submit', saveMotor);
    document.getElementById('motorSearch').addEventListener('input', renderList);
    document.getElementById('statusFilter').addEventListener('change', renderList);
    document.getElementById('motorRows').addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const motor = motors.find((item) => item.id === button.dataset.id);
      if (!motor) return;
      if (button.dataset.action === 'edit') showModal(motor);
      if (button.dataset.action === 'delete' && confirm(`Xóa "${motor.name}" và toàn bộ dữ liệu liên quan?`)) {
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        try {
          const result = await window.MotorApi.remove(motor.id);
          motors = motors.filter((item) => item.id !== motor.id);
          updateSummary();
          renderList();

          const detail = {
            deletedMotorId: result.data.deletedMotorId,
            nextMotorId: result.data.nextMotorId,
            remainingCount: result.data.remainingCount,
          };
          window.MotorCareRouter?.clearCache();
          window.MotorCareApp?.refreshShell();
          document.dispatchEvent(new CustomEvent('motorcare:motors-changed', { detail }));
          try {
            localStorage.setItem('motorcare:motors-changed', JSON.stringify({
              ...detail,
              changedAt: Date.now(),
            }));
          } catch {
            // The same-tab event above still keeps the current interface synchronized.
          }
          await window.MotorCareRouter?.navigate('/dashboard?reset=1', {
            force: true,
            replace: true,
          });
          window.MotorCareToast.show(`Đã xóa ${motor.name}. Dashboard đã được đặt lại.`);
        } catch (error) {
          button.disabled = false;
          button.removeAttribute('aria-busy');
          window.MotorCareToast.show(error.message, 'error');
        }
      }
    });
    loadList();
  }

  function initializeDetail() {
    document.getElementById('detailConnectButton').addEventListener('click', async () => {
      if (!detailMotor) return;
      try {
        await window.MotorApi.setConnection(detailMotor.id, detailMotor.connectionStatus !== 'connected');
        await loadDetail();
      } catch (error) {
        window.MotorCareToast.show(error.message, 'error');
      }
    });
    loadDetail();
  }

  document.addEventListener('motorcare:ready', () => {
    if (document.body.dataset.page !== 'motors') return;
    if (document.body.dataset.view === 'motor-list') initializeList();
    else initializeDetail();
  });
}());
