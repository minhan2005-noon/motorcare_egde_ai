ALTER TABLE motors ADD COLUMN device_token_hash TEXT;

ALTER TABLE sensor_readings ADD COLUMN acceleration_rms_g REAL;
ALTER TABLE sensor_readings ADD COLUMN voltage_v REAL;
ALTER TABLE sensor_readings ADD COLUMN fault_state TEXT;
ALTER TABLE sensor_readings ADD COLUMN jam_probability REAL;
ALTER TABLE sensor_readings ADD COLUMN vibration_probability REAL;
ALTER TABLE sensor_readings ADD COLUMN sag_probability REAL;
ALTER TABLE sensor_readings ADD COLUMN uptime_ms INTEGER;

