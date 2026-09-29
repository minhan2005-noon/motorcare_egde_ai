(function createDashboardPage() {
  const colors = {
    vibration: ['#1d6ef2', '#eaf2ff', '≈'],
    current: ['#0b9f62', '#e8f7f0', '↯'],
    temperature: ['#e86f20', '#fff0e6', '°'],
    sound: ['#7357d9', '#f0ebff', '≋'],
    voltage: ['#7357d9', '#f0ebff', 'V'],
  };
  let selectedMotor;
  let refreshTimer;
  let pairingTimer;
  let pairingStartedAt = 0;
  let generatedDeviceConfig = '';

  function drawChart(canvas, values, labels, color, compact = false) {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(Math.floor(rect.width), compact ? 100 : 240);
    const height = Math.max(Math.floor(rect.height), compact ? 30 : 160);
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;

    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, width, height);

    const clean = values.filter((value) => Number.isFinite(value));
    if (!clean.length) {
      ctx.fillStyle = '#7a8b9b';
      ctx.font = '12px sans-serif';
      ctx.fillText('Chưa có dữ liệu', 14, height / 2);
      return;
    }

    const padding = compact ? 3 : 28;
    const min = Math.min(...clean);
    const max = Math.max(...clean);
    const span = max - min || 1;

    if (!compact) {
      ctx.strokeStyle = '#e4eaf0';
      ctx.lineWidth = 1;
      for (let index = 0; index < 4; index += 1) {
        const y = padding + ((height - padding * 2) / 3) * index;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
      }
    }

    const points = values.map((value, index) => ({
      x: padding + (index / Math.max(values.length - 1, 1)) * (width - padding * 2),
      y: padding + (1 - ((value ?? min) - min) / span) * (height - padding * 2),
    }));

    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = compact ? 2 : 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    if (!compact && labels.length) {
      ctx.fillStyle = '#718295';
      ctx.font = '10px sans-serif';
      [0, Math.floor(labels.length / 2), labels.length - 1].forEach((index) => {
        ctx.fillText(labels[index] || '', points[index].x - 14, height - 7);
      });
    }
  }

  function renderMetrics(metrics) {
    const container = document.getElementById('metricCards');
    container.innerHTML = metrics.map((item) => {
      const [color, soft, icon] = colors[item.id];
      const trend = item.change > 0 ? `+${item.change}` : item.change;
      return `
        <article class="card metric-card" style="--metric-color:${color};--metric-soft:${soft}">
          <span class="metric-icon" aria-hidden="true">${icon}</span>
          <p class="metric-label">${window.MotorCareFormat.escapeHtml(window.MotorCareI18n?.t(item.label) || item.label)}</p>
          <p class="metric-value">
            <strong>${window.MotorCareFormat.number(item.value)}</strong>
            <span>${window.MotorCareFormat.escapeHtml(item.unit)}</span>
          </p>
          <div class="metric-trend">
            <span><b>${trend || 0}%</b> trong chuỗi đo</span>
            <canvas id="${item.id}Spark"></canvas>
          </div>
        </article>
      `;
    }).join('');

    metrics.forEach((item) => {
      drawChart(
        document.getElementById(`${item.id}Spark`),
        item.values,
        [],
        colors[item.id][0],
        true,
      );
    });
  }

  function renderAlerts(alerts) {
    const rows = document.getElementById('alertRows');
    if (!alerts.length) {
      rows.innerHTML = '<tr><td colspan="5">Không có cảnh báo cho motor này.</td></tr>';
      return;
    }
    rows.innerHTML = alerts.map((alert) => `
      <tr>
        <td>${window.MotorCareFormat.dateTime(alert.createdAt)}</td>
        <td>${window.MotorCareFormat.escapeHtml(alert.motorName)}</td>
        <td>${window.MotorCareFormat.escapeHtml(alert.type)}</td>
        <td><span class="status ${alert.severity}">${alert.severity}</span></td>
        <td><span class="status ${alert.status}">${alert.status}</span></td>
      </tr>
    `).join('');
  }

  function renderEmpty(motors = [], resetAfterDeletion = false) {
    selectedMotor = null;
    document.body.classList.toggle('dashboard-reset-mode', resetAfterDeletion);
    const grid = document.getElementById('dashboardGrid');
    grid.classList.add('is-empty');
    grid.querySelector('.dashboard-empty')?.remove();

    const hasMotors = motors.length > 0;
    const title = hasMotors && resetAfterDeletion
      ? 'Dashboard đã được đặt lại'
      : 'Chưa có motor để theo dõi';
    const message = hasMotors && resetAfterDeletion
      ? 'Motor vừa chọn đã được xóa. Chọn một motor khác để xem dữ liệu mới.'
      : 'Thêm motor đầu tiên, sau đó ghi dữ liệu cảm biến để dashboard hiển thị biểu đồ.';
    const action = hasMotors
      ? ''
      : '<a class="button primary" href="/motors">Thêm motor</a>';

    grid.insertAdjacentHTML('beforeend', `
      <div class="card empty-state dashboard-empty">
        <div>
          <strong>${title}</strong>
          <p>${message}</p>
          ${action}
        </div>
      </div>
    `);

    const select = document.getElementById('motorSelect');
    select.innerHTML = hasMotors
      ? `
        <option value="" selected>Chọn motor để xem dữ liệu</option>
        ${motors.map((motor) => `
          <option value="${motor.id}">${window.MotorCareFormat.escapeHtml(motor.name)}</option>
        `).join('')}
      `
      : '<option value="">Chưa có motor</option>';
    select.disabled = !hasMotors;
    const status = document.getElementById('connectionStatus');
    status.className = 'status disconnected control-status';
    status.textContent = 'Chưa kết nối';
    document.getElementById('connectionStatusText').textContent = 'Chưa kết nối';
    document.getElementById('commandLastUpdated').textContent = 'Chưa có dữ liệu mới';
    document.getElementById('selectedMotorName').textContent = 'Trạng thái vận hành';
    document.getElementById('selectedMotorLocation').textContent = 'Chọn một motor để bắt đầu theo dõi dữ liệu cảm biến.';
    document.getElementById('selectedDeviceCode').textContent = '—';
    const connectionButton = document.getElementById('connectionButton');
    connectionButton.disabled = true;
    connectionButton.textContent = 'Kết nối';
    connectionButton.className = 'button primary small';
  }

  function clearEmpty() {
    document.body.classList.remove('dashboard-reset-mode');
    const grid = document.getElementById('dashboardGrid');
    grid.classList.remove('is-empty');
    grid.querySelector('.dashboard-empty')?.remove();
  }

  function closeDeviceModal() {
    document.getElementById('deviceConnectModal').hidden = true;
    clearInterval(pairingTimer);
    pairingTimer = undefined;
  }

  function setDeviceModalState(connected, message) {
    const state = document.getElementById('deviceLiveState');
    state.classList.toggle('connected', connected);
    document.getElementById('deviceLiveTitle').textContent = connected
      ? 'Đã nhận dữ liệu từ cảm biến'
      : 'Đang chờ cảm biến gửi dữ liệu';
    document.getElementById('deviceLiveMessage').textContent = message;
  }

  async function checkDevicePairing() {
    if (!selectedMotor || document.getElementById('deviceConnectModal').hidden) return;
    try {
      const result = await window.MotorApi.get(selectedMotor.id);
      const motor = result.data.motor;
      const lastSeenAt = motor.lastSeenAt ? new Date(motor.lastSeenAt).getTime() : 0;
      if (lastSeenAt >= pairingStartedAt - 1000) {
        setDeviceModalState(true, `Gói dữ liệu mới nhất: ${window.MotorCareFormat.dateTime(motor.lastSeenAt)}`);
        clearInterval(pairingTimer);
        pairingTimer = undefined;
        window.MotorCareToast.show('Cảm biến thật đã kết nối thành công');
        await loadDashboard(motor.id);
      }
    } catch (error) {
      setDeviceModalState(false, error.message);
    }
  }

  function openDeviceModal() {
    if (!selectedMotor) return;
    pairingStartedAt = Date.now();
    generatedDeviceConfig = '';
    document.getElementById('deviceEndpoint').value = `${location.origin}/api/devices/readings`;
    document.getElementById('pairingDeviceCode').value = selectedMotor.deviceCode;
    document.getElementById('deviceToken').value = '';
    document.getElementById('deviceTokenField').hidden = true;
    document.getElementById('copyDeviceConfig').disabled = true;
    document.getElementById('firmwareConfig').textContent = 'Nhấn “Tạo mã kết nối” để nhận cấu hình firmware.';
    document.getElementById('deviceConnectModal').hidden = false;

    const connected = selectedMotor.connectionStatus === 'connected';
    setDeviceModalState(
      connected,
      connected
        ? `Lần nhận gần nhất: ${window.MotorCareFormat.dateTime(selectedMotor.lastSeenAt)}`
        : 'Tạo mã kết nối, nạp cấu hình vào ESP32 và bật thiết bị.',
    );

    clearInterval(pairingTimer);
    pairingTimer = setInterval(checkDevicePairing, 2000);
  }

  async function resetDashboardAfterDeletion() {
    const loading = document.getElementById('loadingLine');
    loading.hidden = false;
    try {
      const result = await window.MotorApi.list();
      renderEmpty(result.data.motors, true);
    } catch (error) {
      renderEmpty([], true);
      window.MotorCareToast.show(error.message, 'error');
    } finally {
      loading.hidden = true;
    }
  }

  async function loadDashboard(motorId) {
    const loading = document.getElementById('loadingLine');
    loading.hidden = false;
    try {
      const result = await window.MotorCareApi.get(
        `/dashboard/overview${motorId ? `?motorId=${encodeURIComponent(motorId)}` : ''}`,
      );
      const data = result.data;
      selectedMotor = data.selectedMotor
        ? {
          ...data.selectedMotor,
          connectionStatus: data.connection.status,
          lastSeenAt: data.connection.lastUpdated,
        }
        : null;
      if (!selectedMotor) {
        renderEmpty();
        return;
      }

      clearEmpty();
      const select = document.getElementById('motorSelect');
      select.disabled = false;
      select.innerHTML = data.motors.map((motor) => `
        <option value="${motor.id}" ${motor.id === selectedMotor.id ? 'selected' : ''}>
          ${window.MotorCareFormat.escapeHtml(motor.name)}
        </option>
      `).join('');

      const connected = data.connection.status === 'connected';
      const status = document.getElementById('connectionStatus');
      status.className = `status ${data.connection.status} control-status`;
      status.textContent = connected ? 'Đã kết nối' : 'Mất kết nối';
      document.getElementById('connectionStatusText').textContent = connected ? 'Thiết bị đang trực tuyến' : 'Thiết bị đang ngoại tuyến';
      document.getElementById('commandLastUpdated').textContent = data.connection.lastUpdated
        ? `Cập nhật ${window.MotorCareFormat.dateTime(data.connection.lastUpdated)}`
        : 'Chưa có dữ liệu mới';
      document.getElementById('selectedMotorName').textContent = selectedMotor.name;
      document.getElementById('selectedMotorLocation').textContent = selectedMotor.location || 'Chưa cập nhật vị trí thiết bị';
      document.getElementById('selectedDeviceCode').textContent = data.connection.deviceId || '—';
      const button = document.getElementById('connectionButton');
      button.disabled = false;
      button.textContent = connected ? 'Thiết lập' : 'Kết nối cảm biến';
      button.className = `button ${connected ? 'secondary' : 'primary'} small`;

      document.getElementById('healthScore').innerHTML = `${data.health.score}<small>%</small>`;
      document.getElementById('healthStatus').textContent = data.health.status;
      document.getElementById('lastUpdated').textContent = window.MotorCareFormat.dateTime(data.connection.lastUpdated);
      const gauge = document.getElementById('healthGauge');
      gauge.style.setProperty('--score', data.health.score);
      gauge.classList.toggle('gauge-danger', data.health.score < 50);
      gauge.classList.toggle('gauge-warning', data.health.score >= 50 && data.health.score < 75);

      renderMetrics(data.metrics);
      renderAlerts(data.alerts);
      drawChart(document.getElementById('vibrationChart'), data.charts.vibration, data.charts.labels, colors.vibration[0]);
      drawChart(document.getElementById('currentChart'), data.charts.current, data.charts.labels, colors.current[0]);
      drawChart(document.getElementById('temperatureChart'), data.charts.temperature, data.charts.labels, colors.temperature[0]);
      document.getElementById('aiMessage').textContent = data.diagnosis.message;
      document.getElementById('aiEndpoint').textContent = data.diagnosis.integrationEndpoint;
      document.getElementById('vibrationChartTitle').textContent = data.charts.vibrationLabel || 'Độ rung RMS';
      document.getElementById('vibrationChartUnit').textContent = data.charts.vibrationUnit || 'mm/s';
    } catch (error) {
      window.MotorCareToast.show(error.message, 'error');
    } finally {
      loading.hidden = true;
    }
  }

  document.addEventListener('motorcare:ready', () => {
    if (document.body.dataset.page !== 'dashboard') return;
    clearInterval(refreshTimer);
    const resetRequested = new URLSearchParams(location.search).get('reset') === '1';
    if (resetRequested) resetDashboardAfterDeletion();
    else loadDashboard();
    window.MotorCareMotorScene?.mount();
    const refreshInterval = Number(window.MotorCareApp?.settings.refreshInterval || 10);
    const sceneRate = document.getElementById('sceneRefreshRate');
    if (sceneRate) sceneRate.textContent = `${refreshInterval}s`;
    refreshTimer = setInterval(() => {
      if (!document.hidden && document.body.dataset.page === 'dashboard' && selectedMotor) {
        loadDashboard(selectedMotor.id);
      }
    }, refreshInterval * 1000);

    document.getElementById('motorSelect').addEventListener('change', (event) => {
      if (!event.target.value) return;
      history.replaceState({}, '', '/dashboard');
      loadDashboard(event.target.value);
    });
    document.getElementById('connectionButton').addEventListener('click', openDeviceModal);
    document.getElementById('closeDeviceModal').addEventListener('click', closeDeviceModal);
    document.getElementById('deviceConnectModal').addEventListener('click', (event) => {
      if (event.target.id === 'deviceConnectModal') closeDeviceModal();
    });
    document.getElementById('generateDeviceToken').addEventListener('click', async () => {
      if (!selectedMotor) return;
      const button = document.getElementById('generateDeviceToken');
      button.disabled = true;
      button.textContent = 'Đang tạo...';
      try {
        const result = await window.MotorApi.createDeviceToken(selectedMotor.id);
        const { deviceCode, token, endpoint } = result.data.setup;
        document.getElementById('deviceEndpoint').value = endpoint;
        generatedDeviceConfig = [
          `const char *SERVER_URL = "${endpoint}";`,
          `const char *DEVICE_CODE = "${deviceCode}";`,
          `const char *DEVICE_TOKEN = "${token}";`,
        ].join('\n');
        document.getElementById('deviceToken').value = token;
        document.getElementById('deviceTokenField').hidden = false;
        document.getElementById('firmwareConfig').textContent = generatedDeviceConfig;
        document.getElementById('copyDeviceConfig').disabled = false;
        setDeviceModalState(false, 'Mã đã sẵn sàng. Nạp cấu hình vào ESP32 và bật thiết bị.');
      } catch (error) {
        window.MotorCareToast.show(error.message, 'error');
      } finally {
        button.disabled = false;
        button.textContent = 'Tạo mã mới';
      }
    });
    document.getElementById('copyDeviceConfig').addEventListener('click', async () => {
      if (!generatedDeviceConfig) return;
      try {
        await navigator.clipboard.writeText(generatedDeviceConfig);
        window.MotorCareToast.show('Đã sao chép cấu hình ESP32');
      } catch {
        window.MotorCareToast.show('Không thể sao chép tự động', 'error');
      }
    });
  });

  document.addEventListener('motorcare:settings-changed', () => {
    if (document.body.dataset.page !== 'dashboard') return;
    clearInterval(refreshTimer);
    window.MotorCareMotorScene?.mount();
    const refreshInterval = Number(window.MotorCareApp?.settings.refreshInterval || 10);
    const sceneRate = document.getElementById('sceneRefreshRate');
    if (sceneRate) sceneRate.textContent = `${refreshInterval}s`;
    refreshTimer = setInterval(() => {
      if (!document.hidden && document.body.dataset.page === 'dashboard' && selectedMotor) {
        loadDashboard(selectedMotor.id);
      }
    }, refreshInterval * 1000);
  });

  function refreshAfterMotorChange() {
    if (document.body.dataset.page !== 'dashboard') return;
    history.replaceState({}, '', '/dashboard?reset=1');
    resetDashboardAfterDeletion();
  }

  document.addEventListener('motorcare:motors-changed', (event) => {
    refreshAfterMotorChange(event.detail);
  });

  window.addEventListener('storage', (event) => {
    if (event.key !== 'motorcare:motors-changed' || !event.newValue) return;
    try {
      refreshAfterMotorChange(JSON.parse(event.newValue));
    } catch {
      refreshAfterMotorChange();
    }
  });
}());
