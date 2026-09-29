"""Đánh giá một artifact MotorCare trên CSV đặc trưng mà không huấn luyện lại."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import classification_report, hamming_loss


LABELS = ["jam", "vibration", "sag"]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("model", type=Path)
    parser.add_argument("features_csv", type=Path)
    parser.add_argument("--columns", type=Path, default=Path(__file__).parents[1] / "du_lieu/feature_columns.json")
    parser.add_argument("--threshold", type=float, default=0.5)
    args = parser.parse_args()
    if not 0 < args.threshold < 1:
        raise ValueError("threshold phải nằm trong khoảng (0, 1)")

    columns = json.loads(args.columns.read_text(encoding="utf-8"))
    frame = pd.read_csv(args.features_csv)
    missing = [column for column in [*columns, *LABELS] if column not in frame]
    if missing:
        raise ValueError(f"CSV thiếu cột: {', '.join(missing)}")
    model = joblib.load(args.model)
    probability = np.asarray(model.predict_proba(frame[columns]), dtype=float)
    prediction = (probability >= args.threshold).astype(np.int8)
    truth = frame[LABELS].to_numpy(dtype=np.int8)
    result = {
        "rows": len(frame),
        "threshold": args.threshold,
        "hamming_loss": float(hamming_loss(truth, prediction)),
        "classification": classification_report(
            truth, prediction, target_names=LABELS, zero_division=0, output_dict=True,
        ),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
