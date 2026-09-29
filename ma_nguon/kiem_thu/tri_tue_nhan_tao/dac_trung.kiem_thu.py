import importlib.util
import unittest
from pathlib import Path

import numpy as np


MODULE_PATH = Path(__file__).parents[2] / "tri_tue_nhan_tao/xu_ly_tin_hieu/dac_trung.py"
SPEC = importlib.util.spec_from_file_location("motorcare_features", MODULE_PATH)
FEATURES = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(FEATURES)


class FeatureExtractionTest(unittest.TestCase):
    def test_feature_order_and_values_are_finite(self):
        t = np.arange(200, dtype=np.int64) * 5_000
        phase = np.linspace(0, 4 * np.pi, 200)
        acceleration = np.column_stack([
            0.1 * np.sin(phase),
            0.2 * np.cos(phase),
            1.0 + 0.05 * np.sin(phase * 2),
        ])
        electrical = np.column_stack([
            np.linspace(11.8, 11.6, 20),
            np.linspace(120.0, 150.0, 20),
        ])
        result = FEATURES.extract_features(acceleration, electrical, t)
        self.assertEqual(list(result), FEATURES.FEATURE_COLUMNS)
        self.assertTrue(np.isfinite(list(result.values())).all())
        self.assertAlmostEqual(result["v_bus_min_v"], 11.6)

    def test_rejects_incomplete_window(self):
        with self.assertRaisesRegex(ValueError, "160 mẫu MPU"):
            FEATURES.extract_features(np.zeros((10, 3)), np.zeros((12, 2)))


if __name__ == "__main__":
    unittest.main()
