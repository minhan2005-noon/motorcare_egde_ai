const alertRepository = require('../kho_du_lieu/canh_bao.kho_du_lieu');
const motorService = require('./dong_co.dich_vu');
const httpError = require('../tien_ich/loi_http');

const SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);
const STATUSES = new Set(['open', 'acknowledged', 'resolved']);

async function listAlerts(userId, query = {}) {
  if (query.motorId) {
    await motorService.getMotor(userId, query.motorId);
  }
  if (query.severity && !SEVERITIES.has(query.severity)) {
    throw httpError(400, 'Mức cảnh báo không hợp lệ');
  }
  if (query.status && !STATUSES.has(query.status)) {
    throw httpError(400, 'Trạng thái cảnh báo không hợp lệ');
  }

  const alerts = await alertRepository.findByOwner(userId, query);
  const openCount = await alertRepository.countOpenByOwner(userId);
  return { alerts, openCount };
}

async function getOwnedAlert(userId, id) {
  const alert = await alertRepository.findById(id);
  if (!alert) {
    throw httpError(404, 'Không tìm thấy cảnh báo');
  }
  await motorService.getMotor(userId, alert.motorId);
  return alert;
}

async function changeStatus(userId, id, status) {
  const alert = await getOwnedAlert(userId, id);
  if (!STATUSES.has(status)) {
    throw httpError(400, 'Trạng thái cảnh báo không hợp lệ');
  }
  if (alert.status === 'resolved' && status !== 'resolved') {
    throw httpError(409, 'Cảnh báo đã xử lý không thể mở lại');
  }
  return alertRepository.updateStatus(id, status, userId);
}

module.exports = {
  listAlerts,
  changeStatus,
};
