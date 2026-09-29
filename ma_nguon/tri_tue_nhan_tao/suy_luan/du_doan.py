"""Suy luận bằng artifact Python, dùng cùng thứ tự đặc trưng với ESP32."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd


LABELS = ["jam", "vibration", "sag"]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("model", type=Path)
    parser.add_argument("input", type=Path, help="CSV hoặc JSON object/array")
    parser.add_argument("--columns", type=Path, default=Path(__file__).parents[1] / "du_lieu/feature_columns.json")
    parser.add_argument("--threshold", type=float, default=0.5)
    args = parser.parse_args()

    columns = json.loads(args.columns.read_text(encoding="utf-8"))
    if args.input.suffix.casefold() == ".csv":
        frame = pd.read_csv(args.input)
    else:
        payload = json.loads(args.input.read_text(encoding="utf-8"))
        frame = pd.DataFrame(payload if isinstance(payload, list) else [payload])
    missing = [column for column in columns if column not in frame]
    if missing:
        raise ValueError(f"đầu vào thiếu đặc trưng: {', '.join(missing)}")

    model = joblib.load(args.model)
    probability = np.asarray(model.predict_proba(frame[columns]), dtype=float)
    output = []
    for row in probability:
        probabilities = {label: float(value) for label, value in zip(LABELS, row, strict=True)}
        output.append({
            "probabilities": probabilities,
            "activeFaults": [label for label, value in probabilities.items() if value >= args.threshold],
        })
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
