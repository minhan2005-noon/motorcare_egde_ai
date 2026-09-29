function offlineAfterMs() {
  return Math.max(Number(process.env.DEVICE_OFFLINE_SECONDS) || 90, 10) * 1000;
}

function isDeviceOnline(motor, now = Date.now()) {
  if (!motor || motor.connectionStatus !== 'connected' || !motor.lastSeenAt) return false;
  const lastSeen = new Date(motor.lastSeenAt).getTime();
  return Number.isFinite(lastSeen) && now - lastSeen <= offlineAfterMs();
}

function withEffectiveConnectionStatus(motor, now = Date.now()) {
  if (!motor) return motor;
  return {
    ...motor,
    connectionStatus: isDeviceOnline(motor, now) ? 'connected' : 'disconnected',
  };
}

module.exports = {
  isDeviceOnline,
  withEffectiveConnectionStatus,
};
