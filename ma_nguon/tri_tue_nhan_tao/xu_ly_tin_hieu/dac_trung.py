"""Trích xuất đúng 15 đặc trưng được dùng bởi firmware MotorCare."""
from __future__ import annotations

from collections.abc import Mapping, Sequence

import numpy as np


FEATURE_COLUMNS = [
    "ax_std_g", "ay_std_g", "az_std_g", "dynamic_accel_rms_g",
    "accel_norm_mean_g", "accel_norm_std_g", "accel_norm_p95_g",
    "accel_step_median_g", "accel_step_p95_g", "v_bus_mean_v",
    "v_bus_std_v", "v_bus_min_v", "current_mean_ma",
    "current_std_ma", "current_p95_ma",
]


def extract_features(
    acceleration: Sequence[Sequence[float]],
    electrical: Sequence[Sequence[float]],
    timestamps_us: Sequence[int] | None = None,
) -> dict[str, float]:
    """Tạo đặc trưng từ một cửa sổ 1 giây.

    ``acceleration`` có cột x/y/z (g); ``electrical`` có điện áp (V) và
    dòng (mA). Hàm cố ý dùng cùng ngưỡng và ``ddof=0`` như C++ trên ESP32.
    """
    accel = np.asarray(acceleration, dtype=np.float64)
    power = np.asarray(electrical, dtype=np.float64)
    if accel.ndim != 2 or accel.shape[1] != 3:
        raise ValueError("acceleration phải có dạng (n, 3)")
    if power.ndim != 2 or power.shape[1] != 2:
        raise ValueError("electrical phải có dạng (n, 2)")
    if len(accel) < 160 or len(power) < 12:
        raise ValueError("cửa sổ cần ít nhất 160 mẫu MPU và 12 mẫu INA")
    if not np.isfinite(accel).all() or not np.isfinite(power).all():
        raise ValueError("cửa sổ chứa NaN hoặc vô cực")

    differences = np.diff(accel, axis=0)
    if timestamps_us is not None:
        timestamps = np.asarray(timestamps_us, dtype=np.int64)
        if timestamps.shape != (len(accel),):
            raise ValueError("timestamps_us phải có cùng số mẫu MPU")
        intervals = np.diff(timestamps)
        differences = differences[(intervals > 0) & (intervals <= 7_500)]
    if len(differences) < 100:
        raise ValueError("không đủ cặp MPU liên tiếp hợp lệ")

    axis_std = accel.std(axis=0, ddof=0)
    norms = np.linalg.norm(accel, axis=1)
    steps = np.linalg.norm(differences, axis=1)
    voltage = power[:, 0]
    current = power[:, 1]
    values = [
        *axis_std,
        np.linalg.norm(axis_std),
        norms.mean(), norms.std(ddof=0), np.quantile(norms, 0.95),
        np.quantile(steps, 0.50), np.quantile(steps, 0.95),
        voltage.mean(), voltage.std(ddof=0), voltage.min(),
        current.mean(), current.std(ddof=0), np.quantile(current, 0.95),
    ]
    return dict(zip(FEATURE_COLUMNS, map(float, values), strict=True))


def feature_vector(features: Mapping[str, float]) -> np.ndarray:
    """Đưa mapping đặc trưng về vector có thứ tự cố định của mô hình."""
    missing = [name for name in FEATURE_COLUMNS if name not in features]
    if missing:
        raise ValueError(f"thiếu đặc trưng: {', '.join(missing)}")
    vector = np.asarray([features[name] for name in FEATURE_COLUMNS], dtype=np.float64)
    if not np.isfinite(vector).all():
        raise ValueError("đặc trưng chứa NaN hoặc vô cực")
    return vector
