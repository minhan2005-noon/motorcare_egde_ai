const httpError = require('../tien_ich/loi_http');

const STATUSES = new Set(['active', 'inactive', 'maintenance']);

function optionalText(value, label, maxLength = 120) {
  if (value === undefined) {
    return undefined;
  }

  const text = String(value).trim();
  if (text.length > maxLength) {
    throw httpError(400, `${label} không được dài quá ${maxLength} ký tự`);
  }
  return text;
}

function optionalNumber(value, label, { min = 0, max = 100000 } = {}) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw httpError(400, `${label} không hợp lệ`);
  }
  return number;
}

function parse(payload, { partial = false } = {}) {
  const data = {};
  const name = optionalText(payload.name, 'Tên motor', 80);

  if (!partial && !name) {
    throw httpError(400, 'Tên motor là bắt buộc');
  }
  if (name !== undefined && !name) {
    throw httpError(400, 'Tên motor không được để trống');
  }

  if (name !== undefined) data.name = name;
  if (payload.deviceCode !== undefined) {
    const code = optionalText(payload.deviceCode, 'Mã thiết bị', 40).toUpperCase();
    if (code && !/^[A-Z0-9-]+$/.test(code)) {
      throw httpError(400, 'Mã thiết bị chỉ gồm chữ, số và dấu gạch ngang');
    }
    data.deviceCode = code;
  }
  if (payload.location !== undefined) data.location = optionalText(payload.location, 'Vị trí');
  if (payload.model !== undefined) data.model = optionalText(payload.model, 'Model');
  if (payload.serialNumber !== undefined) data.serialNumber = optionalText(payload.serialNumber, 'Số serial');
  if (payload.notes !== undefined) data.notes = optionalText(payload.notes, 'Ghi chú', 500);
  if (payload.ratedPowerKw !== undefined) data.ratedPowerKw = optionalNumber(payload.ratedPowerKw, 'Công suất định mức');
  if (payload.ratedVoltage !== undefined) data.ratedVoltage = optionalNumber(payload.ratedVoltage, 'Điện áp định mức');
  if (payload.ratedCurrent !== undefined) data.ratedCurrent = optionalNumber(payload.ratedCurrent, 'Dòng điện định mức');

  if (payload.status !== undefined) {
    if (!STATUSES.has(payload.status)) {
      throw httpError(400, 'Trạng thái motor không hợp lệ');
    }
    data.status = payload.status;
  }

  return data;
}

module.exports = {
  create: (payload) => parse(payload),
  update: (payload) => parse(payload, { partial: true }),
};
