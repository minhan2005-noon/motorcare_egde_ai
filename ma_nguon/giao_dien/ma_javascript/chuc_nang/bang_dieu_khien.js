(function createDashboardPage() {
  const publicViewToken = location.pathname.startsWith('/view/')
    ? decodeURIComponent(location.pathname.split('/').filter(Boolean).at(-1) || '')
    : '';
  const publicMode = Boolean(publicViewToken);
  const colors = {
    vibration: ['#36c8ff', 'rgba(54, 200, 255, 0.12)', '≈'],
    current: ['#44efad', 'rgba(68, 239, 173, 0.12)', '↯'],
    temperature: ['#ff9f43', 'rgba(255, 159, 67, 0.12)', '°'],
    sound: ['#a78bfa', 'rgba(167, 139, 250, 0.12)', '≋'],
    voltage: ['#a78bfa', 'rgba(167, 139, 250, 0.12)', 'V'],
  };
  let selectedMotor;
  let refreshTimer;
  let refreshTimerGeneration = 0;
  let pairingTimer;
  let pairingInFlight = false;
  let pairingStartedAt = 0;
  let generatedDeviceConfig = '';
  let generatedPublicViewUrl = '';
  let lastDashboardSignature = '';
  let dashboardRequestSequence = 0;
  let dashboardAbortController;

  function drawChart(canvas, values, labels, color, compact = false) {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(Math.floor(rect.width), compact ? 100 : 240);
    const height = Math.max(Math.floor(rect.height), compact ? 30 : 160);
    // A very high device-pixel ratio makes the large live charts expensive to
    // repaint. Two physical pixels per CSS pixel remain sharp on Retina while
    // keeping refreshes smooth on integrated GPUs and mobile devices.
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
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
      ctx.strokeStyle = 'rgba(154, 176, 204, 0.12)';
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

    const trace = new Path2D();
    points.forEach((point, index) => {
      if (index === 0) trace.moveTo(point.x, point.y);
      else {
        const previous = points[index - 1];
        const midpoint = (previous.x + point.x) / 2;
        trace.bezierCurveTo(midpoint, previous.y, midpoint, point.y, point.x, point.y);
      }
    });

    if (!compact) {
      const fill = ctx.createLinearGradient(0, padding, 0, height - padding);
      fill.addColorStop(0, `${color}55`);
      fill.addColorStop(1, `${color}00`);
      const area = new Path2D(trace);
      area.lineTo(points[points.length - 1].x, height - padding);
      area.lineTo(points[0].x, height - padding);
      area.closePath();
      ctx.fillStyle = fill;
      ctx.fill(area);
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = compact ? 2 : 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = compact ? 3 : 7;
    ctx.stroke(trace);
    ctx.shadowBlur = 0;

    if (!compact) {
      const latest = points[points.length - 1];
      ctx.beginPath();
      ctx.arc(latest.x, latest.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    if (!compact && labels.length) {
      ctx.fillStyle = '#7f91aa';
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
      const limits = { vibration: 10, current: 20, temperature: 100, sound: 100, voltage: 240 };
      const progress = Math.min(100, Math.max(8, (Number(item.value) / (limits[item.id] || 100)) * 100));
      return `
        <article class="card metric-card" style="--metric-color:${color};--metric-soft:${soft};--metric-progress:${progress}">
          <div class="metric-ring">
            <div class="metric-ring-inner">
              <span class="metric-icon" aria-hidden="true">${icon}</span>
              <p class="metric-value">
                <strong>${window.MotorCareFormat.number(item.value)}</strong>
                <span>${window.MotorCareFormat.escapeHtml(item.unit)}</span>
              </p>
            </div>
          </div>
          <p class="metric-label">${window.MotorCareFormat.escapeHtml(window.MotorCareI18n?.t(item.label) || item.label)}</p>
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

  function renderDiagnosis(diagnosis = {}) {
    const card = document.querySelector('.ai-card');
    const status = document.getElementById('aiStatus');
    const level = diagnosis.available ? diagnosis.level : 'waiting';
    card.classList.remove('ai-normal', 'ai-warning', 'ai-danger', 'ai-waiting');
    card.classList.add(`ai-${level}`);
    status.className = `status ${level === 'normal' ? 'connected' : level === 'danger' ? 'disconnected' : 'maintenance'}`;
    status.textContent = level === 'normal'
      ? 'Bình thường'
      : level === 'warning'
        ? 'Cần kiểm tra'
        : level === 'danger'
          ? 'Nguy hiểm'
          : 'Chờ dữ liệu';

    document.getElementById('aiMessage').textContent = diagnosis.message || 'Đang chờ kết quả Edge AI';
    document.getElementById('aiDescription').textContent = diagnosis.description
      || 'Bật ESP32 đã ghép nối để gửi kết quả suy luận lên Dashboard.';

    const elementIds = {
      jam: ['aiJamValue', 'aiJamBar'],
      vibration: ['aiVibrationValue', 'aiVibrationBar'],
      sag: ['aiSagValue', 'aiSagBar'],
    };
    (diagnosis.outcomes || []).forEach((outcome) => {
      const ids = elementIds[outcome.id];
      if (!ids) return;
      const available = Number.isFinite(outcome.probability);
      const percent = available ? Math.round(Math.min(Math.max(outcome.probability, 0), 1) * 100) : 0;
      document.getElementById(ids[0]).textContent = available ? `${percent}%` : '—';
      document.getElementById(ids[1]).style.width = `${percent}%`;
      const row = document.querySelector(`[data-ai-outcome="${outcome.id}"]`);
      row.classList.toggle('is-alert', percent >= 50);
    });

    document.getElementById('aiConfidence').textContent = Number.isFinite(diagnosis.confidence)
      ? `Độ tin cậy cao nhất ${Math.round(diagnosis.confidence * 100)}%`
      : 'Độ tin cậy —';
    document.getElementById('aiUpdatedAt').textContent = diagnosis.updatedAt
      ? `Cập nhật ${window.MotorCareFormat.dateTime(diagnosis.updatedAt)}`
      : 'Chưa có dữ liệu AI';
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
    const action = hasMotors || publicMode
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
    document.getElementById('selectedDeviceCode').textContent = '—';
    const connectionButton = document.getElementById('connectionButton');
    connectionButton.disabled = true;
    connectionButton.textContent = 'Kết nối';
    connectionButton.className = 'button primary small';
    renderDiagnosis();
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

  async function copyText(text) {
    if (!text) return false;

    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Safari, embedded browsers and denied clipboard permissions use the
      // selection fallback below.
    }

    const textarea = document.createElement('textarea');
    const activeElement = document.activeElement;
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.setAttribute('aria-hidden', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.append(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    } finally {
      textarea.remove();
      activeElement?.focus?.();
    }
    return copied;
  }

  function downloadBase64File({ filename, contentType, base64 }) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    const objectUrl = URL.createObjectURL(new Blob([bytes], {
      type: contentType || 'application/zip',
    }));
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename || 'MotorCare_firmware.zip';
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  async function checkDevicePairing() {
    const modal = document.getElementById('deviceConnectModal');
    if (pairingInFlight || !selectedMotor || !modal || modal.hidden) return;
    pairingInFlight = true;
    try {
      const result = await window.MotorApi.get(selectedMotor.id);
      if (document.body.dataset.page !== 'dashboard'
          || document.getElementById('deviceConnectModal')?.hidden !== false) return;
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
      if (document.body.dataset.page === 'dashboard') {
        setDeviceModalState(false, error.message);
      }
    } finally {
      pairingInFlight = false;
    }
  }

  function openDeviceModal() {
    if (!selectedMotor) return;
    pairingStartedAt = Date.now();
    generatedDeviceConfig = '';
    generatedPublicViewUrl = '';
    document.getElementById('deviceEndpoint').value = `${location.origin}/api/devices/readings`;
    document.getElementById('pairingDeviceCode').value = selectedMotor.deviceCode;
    document.getElementById('deviceToken').value = '';
    document.getElementById('deviceTokenField').hidden = true;
    document.getElementById('copyDeviceConfig').disabled = true;
    document.getElementById('publicViewUrl').value = '';
    document.getElementById('copyPublicViewUrl').disabled = true;
    document.getElementById('firmwareConfig').textContent = 'Nhập Wi-Fi và nhấn “Tạo & tải gói firmware”.';
    document.getElementById('deviceConnectModal').hidden = false;

    const connected = selectedMotor.connectionStatus === 'connected';
    setDeviceModalState(
      connected,
      connected
        ? `Lần nhận gần nhất: ${window.MotorCareFormat.dateTime(selectedMotor.lastSeenAt)}`
        : 'Nhập Wi-Fi rồi tải gói firmware đã được cấu hình tự động.',
    );

    clearInterval(pairingTimer);
    pairingTimer = setInterval(checkDevicePairing, 2000);
  }

  async function resetDashboardAfterDeletion() {
    lastDashboardSignature = '';
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

  function dashboardSignature(data) {
    return JSON.stringify({
      selectedMotor: data.selectedMotor?.id || null,
      connection: data.connection,
      health: data.health,
      metrics: data.metrics,
      charts: data.charts,
      alerts: data.alerts,
      diagnosis: data.diagnosis,
    });
  }

  async function loadDashboard(motorId, options = {}) {
    const background = options.background === true;
    const loading = document.getElementById('loadingLine');
    const requestSequence = ++dashboardRequestSequence;
    dashboardAbortController?.abort();
    dashboardAbortController = new AbortController();
    if (!background && loading) loading.hidden = false;
    try {
      const endpoint = publicMode
        ? `/dashboard/public/${encodeURIComponent(publicViewToken)}`
        : `/dashboard/overview${motorId ? `?motorId=${encodeURIComponent(motorId)}` : ''}`;
      const result = await window.MotorCareApi.get(endpoint, {
        signal: dashboardAbortController.signal,
      });
      if (requestSequence !== dashboardRequestSequence
          || document.body.dataset.page !== 'dashboard') return;
      const data = result.data;
      const nextSignature = dashboardSignature(data);
      selectedMotor = data.selectedMotor
        ? {
          ...data.selectedMotor,
          connectionStatus: data.connection.status,
          lastSeenAt: data.connection.lastUpdated,
        }
        : null;
      if (background && nextSignature === lastDashboardSignature) return;
      lastDashboardSignature = nextSignature;
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
      renderDiagnosis(data.diagnosis);
      document.getElementById('vibrationChartTitle').textContent = data.charts.vibrationLabel || 'Độ rung RMS';
      document.getElementById('vibrationChartUnit').textContent = data.charts.vibrationUnit || 'mm/s';
    } catch (error) {
      if (error.name === 'AbortError') return;
      window.MotorCareToast.show(error.message, 'error');
    } finally {
      if (!background && loading && requestSequence === dashboardRequestSequence) {
        loading.hidden = true;
      }
    }
  }

  function startDashboardRefresh() {
    clearTimeout(refreshTimer);
    const generation = ++refreshTimerGeneration;
    const refreshInterval = publicMode
      ? 3
      : Number(window.MotorCareApp?.settings.refreshInterval || 10);
    const sceneRate = document.getElementById('sceneRefreshRate');
    if (sceneRate) sceneRate.textContent = `${refreshInterval}s`;

    const scheduleNext = () => {
      if (generation !== refreshTimerGeneration) return;
      refreshTimer = setTimeout(async () => {
        if (!document.hidden
            && document.body.dataset.page === 'dashboard'
            && (selectedMotor || publicMode)) {
          await loadDashboard(selectedMotor?.id, { background: true });
        }
        if (generation === refreshTimerGeneration) scheduleNext();
      }, refreshInterval * 1000);
    };
    scheduleNext();
  }

  document.addEventListener('motorcare:ready', () => {
    clearTimeout(refreshTimer);
    if (document.body.dataset.page !== 'dashboard') {
      refreshTimerGeneration += 1;
      clearInterval(pairingTimer);
      pairingTimer = undefined;
      dashboardRequestSequence += 1;
      dashboardAbortController?.abort();
      return;
    }
    const resetRequested = !publicMode
      && new URLSearchParams(location.search).get('reset') === '1';
    const requestedMotorId = publicMode
      ? null
      : new URLSearchParams(location.search).get('motorId');
    if (resetRequested) resetDashboardAfterDeletion();
    else loadDashboard(requestedMotorId);
    startDashboardRefresh();

    if (publicMode) return;

    document.getElementById('motorSelect').addEventListener('change', (event) => {
      if (!event.target.value) return;
      history.replaceState({}, '', `/dashboard?motorId=${encodeURIComponent(event.target.value)}`);
      loadDashboard(event.target.value);
    });
    document.getElementById('connectionButton').addEventListener('click', openDeviceModal);
    document.getElementById('closeDeviceModal').addEventListener('click', closeDeviceModal);
    document.getElementById('deviceConnectModal').addEventListener('click', (event) => {
      if (event.target.id === 'deviceConnectModal') closeDeviceModal();
    });
    document.getElementById('downloadFirmwarePackage').addEventListener('click', async () => {
      if (!selectedMotor) return;
      const wifiSsidInput = document.getElementById('firmwareWifiSsid');
      const wifiPasswordInput = document.getElementById('firmwareWifiPassword');
      const wifiSsid = wifiSsidInput.value.trim();
      const wifiPassword = wifiPasswordInput.value;
      const ssidBytes = new TextEncoder().encode(wifiSsid).length;
      if (!wifiSsid || ssidBytes > 32) {
        wifiSsidInput.focus();
        window.MotorCareToast.show('Tên Wi-Fi phải có từ 1 đến 32 byte', 'error');
        return;
      }
      if (wifiPassword && (wifiPassword.length < 8 || wifiPassword.length > 63)) {
        wifiPasswordInput.focus();
        window.MotorCareToast.show('Mật khẩu Wi-Fi phải có từ 8 đến 63 ký tự hoặc để trống', 'error');
        return;
      }

      const button = document.getElementById('downloadFirmwarePackage');
      button.disabled = true;
      button.textContent = 'Đang đóng gói...';
      try {
        const result = await window.MotorApi.createFirmwarePackage(selectedMotor.id, {
          ssid: wifiSsid,
          password: wifiPassword,
        });
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
        generatedPublicViewUrl = result.data.view.url;
        document.getElementById('publicViewUrl').value = generatedPublicViewUrl;
        document.getElementById('copyPublicViewUrl').disabled = false;
        downloadBase64File(result.data.firmware);
        wifiPasswordInput.value = '';
        pairingStartedAt = Date.now();
        setDeviceModalState(false, 'Gói đã tải xuống. Giải nén, mở bằng PlatformIO, chọn Upload rồi bật ESP32.');
        window.MotorCareToast.show('Đã tự nhúng cấu hình, tải firmware và tạo link xem');
      } catch (error) {
        window.MotorCareToast.show(error.message, 'error');
      } finally {
        button.disabled = false;
        button.textContent = 'Tạo & tải gói firmware mới';
      }
    });
    document.getElementById('copyDeviceConfig').addEventListener('click', async () => {
      if (!generatedDeviceConfig) return;
      const copied = await copyText(generatedDeviceConfig);
      if (copied) {
        window.MotorCareToast.show('Đã sao chép cấu hình ESP32');
      } else {
        const config = document.getElementById('firmwareConfig');
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(config);
        selection.removeAllRanges();
        selection.addRange(range);
        window.MotorCareToast.show('Không thể sao chép tự động — cấu hình đã được chọn, hãy nhấn Ctrl+C', 'error');
      }
    });
    document.getElementById('generatePublicViewUrl').addEventListener('click', async () => {
      if (!selectedMotor) return;
      const button = document.getElementById('generatePublicViewUrl');
      button.disabled = true;
      button.textContent = 'Đang tạo...';
      try {
        const result = await window.MotorApi.createPublicViewToken(selectedMotor.id);
        generatedPublicViewUrl = result.data.view.url;
        document.getElementById('publicViewUrl').value = generatedPublicViewUrl;
        document.getElementById('copyPublicViewUrl').disabled = false;
        window.MotorCareToast.show('Đã tạo link xem mới; link cũ đã hết hiệu lực');
      } catch (error) {
        window.MotorCareToast.show(error.message, 'error');
      } finally {
        button.disabled = false;
        button.textContent = 'Tạo link mới';
      }
    });
    document.getElementById('copyPublicViewUrl').addEventListener('click', async () => {
      if (!generatedPublicViewUrl) return;
      const copied = await copyText(generatedPublicViewUrl);
      if (copied) {
        window.MotorCareToast.show('Đã sao chép link xem cho khách hàng');
      } else {
        const input = document.getElementById('publicViewUrl');
        input.focus();
        input.select();
        window.MotorCareToast.show('Link đã được chọn, hãy nhấn Ctrl+C', 'error');
      }
    });
  });

  function refreshVisibleDashboard() {
    if (document.hidden || document.body.dataset.page !== 'dashboard' || !selectedMotor) return;
    loadDashboard(selectedMotor.id, { background: true });
  }

  document.addEventListener('visibilitychange', refreshVisibleDashboard);
  window.addEventListener('focus', refreshVisibleDashboard);
  window.addEventListener('pageshow', refreshVisibleDashboard);

  document.addEventListener('motorcare:settings-changed', () => {
    if (document.body.dataset.page !== 'dashboard') return;
    startDashboardRefresh();
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
