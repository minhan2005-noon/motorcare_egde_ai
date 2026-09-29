"""MotorCare: clean serial exports and build non-overlapping 1 s ML windows.

Usage: python ma_nguon/tri_tue_nhan_tao/tien_ich/bo_du_lieu.py original.zip --out ma_nguon/tri_tue_nhan_tao/du_lieu
Requires: pandas, numpy, openpyxl. Original Excel files are never modified.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd


RAW = ["sample_id", "t_mpu_us", "ax_g", "ay_g", "az_g", "t_ina_us",
       "v_bus_v", "v_shunt_mv", "current_ma", "power_mw"]
INA = RAW[5:]
FEATURES = ["ax_std_g", "ay_std_g", "az_std_g", "dynamic_accel_rms_g",
            "accel_norm_mean_g", "accel_norm_std_g", "accel_norm_p95_g",
            "accel_step_median_g", "accel_step_p95_g", "v_bus_mean_v",
            "v_bus_std_v", "v_bus_min_v", "current_mean_ma",
            "current_std_ma", "current_p95_ma"]
MIN_MPU = 160
MIN_INA = 12


def label_from_path(path: str) -> tuple[str, int, int, int]:
    folder, name = Path(path).parent.name.casefold(), Path(path).stem.casefold()
    jam = int("kẹt" in folder)
    vibration = int("rung" in folder)
    sag = int("sụt" in folder)
    if "bình thường" in folder:
        assert not (jam or vibration or sag)
        return "normal", 0, 0, 0
    assert (jam or vibration or sag) and not (jam and vibration), path
    m = re.search(r"(?<!\d)(5|10|15|20|30)(?!\d)", name)
    if sag:
        assert m is not None, path
        pct = int(m.group(1))
    else:
        assert m is None, path
        pct = 0
    condition = ("jam" if jam else "vibration" if vibration else "sag")
    if (jam or vibration) and sag:
        condition += "_sag"
    return condition, jam, vibration, pct


def one_window(g: pd.DataFrame, session_id: str, run_id: str, condition: str, jam: int,
               vibration: int, pct: int, source_file: str, window_start: int):
    a = g[["ax_g", "ay_g", "az_g"]].to_numpy(dtype=float)
    e = g.loc[g["v_bus_v"].notna(), ["v_bus_v", "current_ma"]]
    if len(g) < MIN_MPU or len(e) < MIN_INA:
        return None
    norm = np.linalg.norm(a, axis=1)
    # Ignore acceleration differences across skipped sampling intervals.
    adjacent = np.diff(g.t_mpu_us.to_numpy(dtype=np.int64))
    step = np.linalg.norm(np.diff(a, axis=0)[(adjacent > 0) & (adjacent <= 7_500)], axis=1)
    if len(step) < 100:
        return None
    v, i = e.v_bus_v.to_numpy(), e.current_ma.to_numpy()
    std = np.std(a, axis=0)
    return {
        "window_id": f"{run_id}__w{window_start:04d}",
        "session_id": session_id, "run_id": run_id,
        "source_file": source_file, "condition": condition,
        "jam": jam, "vibration": vibration, "sag": int(pct > 0),
        "sag_pct_setpoint": pct, "window_start_s": window_start,
        "window_end_s": window_start+1, "mpu_samples": len(g),
        "ina_samples": len(e),
        "ax_std_g": std[0], "ay_std_g": std[1], "az_std_g": std[2],
        "dynamic_accel_rms_g": np.linalg.norm(std),
        "accel_norm_mean_g": norm.mean(), "accel_norm_std_g": norm.std(),
        "accel_norm_p95_g": np.quantile(norm, .95),
        "accel_step_median_g": np.median(step),
        "accel_step_p95_g": np.quantile(step, .95),
        "v_bus_mean_v": v.mean(), "v_bus_std_v": v.std(),
        "v_bus_min_v": v.min(), "current_mean_ma": i.mean(),
        "current_std_ma": i.std(), "current_p95_ma": np.quantile(i, .95),
    }


def run(archive: Path, out: Path):
    out.mkdir(parents=True, exist_ok=True)
    sample_path = out / "motorcare_samples_clean.csv"
    sample_path.unlink(missing_ok=True)
    windows = []
    qa = []
    runs = []
    with zipfile.ZipFile(archive) as zf:
        names = sorted(n for n in zf.namelist()
                       if n.lower().endswith(".xlsx") and not n.startswith("__MACOSX/"))
        assert len(names) == 18, f"Expected 18 source files, got {len(names)}"
        seen_conditions = set()
        for name in names:
            assert ".." not in Path(name).parts
            condition, jam, vibration, pct = label_from_path(name)
            session_id = f"{condition}_{pct:02d}"
            key = (condition, pct)
            assert key not in seen_conditions, f"Duplicate condition: {key}"
            seen_conditions.add(key)
            source_bytes = zf.read(name)
            source = Path(name).name
            raw = pd.read_excel(io.BytesIO(source_bytes), sheet_name=0)
            assert raw.shape[1] >= 10, name
            d = raw.iloc[:, :10].copy()
            d.columns = RAW
            for col in RAW:
                d[col] = pd.to_numeric(d[col], errors="coerce")
            numeric_ok = np.isfinite(d[RAW[:5]].to_numpy(dtype=float)).all(axis=1)
            numeric_ok &= (d.sample_id > 0) & (d.t_mpu_us >= 0)
            numeric_ok &= (d.sample_id % 1 == 0) & (d.t_mpu_us % 1 == 0)
            # A repeated exact value on BOTH Y and Z occurs in every state,
            # including a stationary fan; treat that pair as a read artifact.
            suspect_pair = (d.ay_g == -.126) & (d.az_g == -.126)
            kept = d.loc[numeric_ok & ~suspect_pair].copy()
            assert not kept.empty, name
            ina_count = kept[INA].notna().sum(axis=1)
            partial = ina_count.between(1, len(INA)-1)
            if partial.any():
                kept.loc[partial, INA] = np.nan
            full = kept[INA].notna().all(axis=1)
            ina_bad = (full & ((kept.v_bus_v < 0) | (kept.v_bus_v > 24) |
                               ((kept.t_ina_us-kept.t_mpu_us).abs() > 50_000)))
            if ina_bad.any():
                kept.loc[ina_bad, INA] = np.nan
            # Reboot creates a decreased sample ID and timestamp. Never mix it
            # into the same run even if the source spreadsheet is one file.
            new_run = (kept.sample_id.diff() <= 0) | (kept.t_mpu_us.diff() <= 0)
            kept["run_number"] = new_run.cumsum().astype(int) + 1
            kept["session_id"] = session_id
            kept["run_id"] = (session_id + "__run" +
                              kept.run_number.astype(str).str.zfill(2))
            kept["source_file"] = source
            kept["condition"] = condition
            kept["jam"] = jam
            kept["vibration"] = vibration
            kept["sag"] = int(pct > 0)
            kept["sag_pct_setpoint"] = pct
            kept["sample_id"] = kept.sample_id.astype("int64")
            kept["t_mpu_us"] = kept.t_mpu_us.astype("int64")
            kept["t_ina_us"] = kept.t_ina_us.astype("Int64")
            kept["t_rel_s"] = (kept.t_mpu_us - kept.groupby("run_id").t_mpu_us.transform("first"))/1e6
            kept["window_start_s"] = np.floor(kept.t_rel_s).astype("int64")
            for run_id, part in kept.groupby("run_id", sort=False):
                valid_windows = 0
                rejected_windows = 0
                for sec, g in part.groupby("window_start_s", sort=True):
                    w = one_window(g, session_id, run_id, condition, jam,
                                   vibration, pct, source, int(sec))
                    if w is None:
                        rejected_windows += 1
                    else:
                        windows.append(w)
                        valid_windows += 1
                runs.append({"session_id": session_id, "run_id": run_id, "source_file": source,
                             "condition": condition, "sag_pct_setpoint": pct,
                             "samples": len(part), "ina_samples": int(part.v_bus_v.notna().sum()),
                             "duration_s": (part.t_mpu_us.iloc[-1]-part.t_mpu_us.iloc[0])/1e6,
                             "windows_kept": valid_windows,
                             "windows_rejected_low_samples": rejected_windows,
                             "median_voltage_v": part.v_bus_v.median(),
                             "median_current_ma": part.current_ma.median()})
            columns = ["source_file", "session_id", "run_id", "condition", "jam", "vibration", "sag",
                       "sag_pct_setpoint", "sample_id", "t_mpu_us", "t_rel_s",
                       "ax_g", "ay_g", "az_g", "t_ina_us", "v_bus_v", "v_shunt_mv",
                       "current_ma", "power_mw", "window_start_s"]
            kept[columns].to_csv(sample_path, mode="a", index=False,
                                 header=not sample_path.exists(), encoding="utf-8",
                                 float_format="%.6f")
            qa.append({"session_id": session_id, "source_file": source, "condition": condition,
                       "sag_pct_setpoint": pct, "sha256": hashlib.sha256(source_bytes).hexdigest(),
                       "rows_input": len(d), "rows_invalid_numeric_or_serial": int((~numeric_ok).sum()),
                       "rows_suspect_yz_pair": int((numeric_ok & suspect_pair).sum()),
                       "rows_clean": len(kept), "partial_ina_rows_cleared": int(partial.sum()),
                       "implausible_ina_rows_cleared": int(ina_bad.sum()),
                       "ina_measurements_clean": int(kept.v_bus_v.notna().sum()),
                       "run_count": int(kept.run_number.nunique()),
                       "windows_kept": sum(r["windows_kept"] for r in runs if r["source_file"] == source),
                       "windows_rejected_low_samples": sum(r["windows_rejected_low_samples"]
                                                           for r in runs if r["source_file"] == source)})
    assert len(seen_conditions) == 18
    feature_df = pd.DataFrame(windows)
    assert feature_df[FEATURES].notna().all().all()
    assert not feature_df.window_id.duplicated().any()
    assert not feature_df.run_id.isna().any()
    assert feature_df.groupby(["run_id", "window_start_s"]).size().max() == 1
    feature_df.to_csv(out / "motorcare_features_1s.csv", index=False,
                      encoding="utf-8-sig", float_format="%.6f")
    pd.DataFrame(qa).to_csv(out / "quality_by_source.csv", index=False, encoding="utf-8-sig")
    pd.DataFrame(runs).to_csv(out / "quality_by_run.csv", index=False, encoding="utf-8-sig")
    (out / "feature_columns.json").write_text(json.dumps(FEATURES, indent=2), encoding="utf-8")
    summary = {"source_files": len(qa), "condition_variants": len(seen_conditions),
               "condition_families": 6, "recording_segments": len(runs),
               "input_rows": int(sum(q["rows_input"] for q in qa)),
               "removed_corrupt_rows": int(sum(q["rows_invalid_numeric_or_serial"] for q in qa)),
               "removed_suspect_accel_rows": int(sum(q["rows_suspect_yz_pair"] for q in qa)),
               "clean_sample_rows": int(sum(q["rows_clean"] for q in qa)),
               "ina_measurements": int(sum(q["ina_measurements_clean"] for q in qa)),
               "one_second_windows": int(len(feature_df)),
               "windows_rejected": int(sum(q["windows_rejected_low_samples"] for q in qa))}
    (out / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2),
                                       encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("archive", type=Path)
    p.add_argument("--out", type=Path, default=Path("MotorCare_ML_preprocessed"))
    args = p.parse_args()
    run(args.archive, args.out)
