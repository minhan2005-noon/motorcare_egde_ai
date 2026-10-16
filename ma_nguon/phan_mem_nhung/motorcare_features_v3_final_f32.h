// MotorCare V3 Final Unified Float32 Feature Extractor (84 features: 56 V3 base + 8 V4 physics + 20 V3 Final SO(3) Geometric/Covariance/ACF/Coupling invariants).
// Input MUST pass quality gate checks. Plain C++17 for ESP32 and host parity testing.
#pragma once
#include <algorithm>
#include <cmath>
#include <cstdint>

namespace motorcare_v3_final_features {
constexpr int MAX_MPU = 240;
constexpr int MAX_INA = 32;
constexpr int FFT_N = 200;
constexpr int NUM_FEATURES = 84;
constexpr float MC_PI = 3.14159265358979323846f;

struct Mpu { uint32_t us; float x, y, z; };
struct Ina { uint32_t us; float bus_v, current_ma; };
struct Window {
  uint32_t start_us = 0, sequence = 0;
  int nm = 0, ni = 0;
  bool overflow = false, sensor_error = false;
  Mpu m[MAX_MPU];
  Ina e[MAX_INA];
};
struct Scratch {
  float a[MAX_MPU][3], norms[MAX_MPU], steps[MAX_MPU], dyn[MAX_MPU];
  float v[MAX_INA], cur[MAX_INA], powers[MAX_INA];
  float work[MAX_MPU], centered[FFT_N][3], spec[FFT_N / 2 + 1];
};

static Scratch work;

inline float max2(float a, float b) { return a > b ? a : b; }
inline float max3(float a, float b, float c) { return max2(max2(a, b), c); }
inline float mean(const float *a, int n) {
  float s = 0; for (int i = 0; i < n; ++i) s += a[i]; return s / n;
}
inline float stdev(const float *a, int n) {
  float m = mean(a, n), s = 0;
  for (int i = 0; i < n; ++i) { float d = a[i] - m; s += d * d; }
  return std::sqrt(s / n);
}
inline float quantile_sorted(const float *a, int n, float p) {
  float pos = p * (n - 1); int i = static_cast<int>(pos);
  return a[i] + (i + 1 < n ? (pos - i) * (a[i + 1] - a[i]) : 0);
}
inline float quantile(const float *a, int n, float p) {
  for (int i = 0; i < n; ++i) work.work[i] = a[i];
  std::sort(work.work, work.work + n);
  return quantile_sorted(work.work, n, p);
}
inline void five(const float *a, int n, float *out) {
  for (int i = 0; i < n; ++i) work.work[i] = a[i];
  std::sort(work.work, work.work + n);
  const float q05 = quantile_sorted(work.work, n, .05f);
  const float q25 = quantile_sorted(work.work, n, .25f);
  const float q50 = quantile_sorted(work.work, n, .50f);
  const float q75 = quantile_sorted(work.work, n, .75f);
  const float q95 = quantile_sorted(work.work, n, .95f);
  for (int i = 0; i < n; ++i) work.work[i] = std::fabs(a[i] - q50);
  std::sort(work.work, work.work + n);
  out[0] = q05; out[1] = q50; out[2] = q75 - q25;
  out[3] = quantile_sorted(work.work, n, .50f); out[4] = q95;
}

inline void eigenvalues3(double c[3][3], double ev[3]) {
  // Exact 3x3 Jacobi eigendecomposition (SO(3) rotation invariant)
  for (int it = 0; it < 32; ++it) {
    int p = 0, q = 1;
    if (std::fabs(c[0][2]) > std::fabs(c[p][q])) { p = 0; q = 2; }
    if (std::fabs(c[1][2]) > std::fabs(c[p][q])) { p = 1; q = 2; }
    const double scale = std::fabs(c[0][0]) + std::fabs(c[1][1]) + std::fabs(c[2][2]);
    if (std::fabs(c[p][q]) <= 1e-15 * (scale > 1e-30 ? scale : 1e-30)) break;
    const double angle = 0.5 * std::atan2(2.0 * c[p][q], c[q][q] - c[p][p]);
    const double co = std::cos(angle), si = std::sin(angle);
    const double a = c[p][p], b = c[q][q], off = c[p][q];
    c[p][p] = co * co * a - 2.0 * si * co * off + si * si * b;
    c[q][q] = si * si * a + 2.0 * si * co * off + co * co * b;
    c[p][q] = c[q][p] = 0.0;
    for (int k = 0; k < 3; ++k) if (k != p && k != q) {
      const double u = c[k][p], v = c[k][q];
      c[k][p] = c[p][k] = co * u - si * v;
      c[k][q] = c[q][k] = si * u + co * v;
    }
  }
  for (int i = 0; i < 3; ++i) ev[i] = c[i][i] > 0.0 ? c[i][i] : 0.0;
  std::sort(ev, ev + 3, [](double a, double b) { return a > b; });
}

inline bool extract(const Window &w, float out[NUM_FEATURES], bool spectral=true) {
  if (w.overflow || w.sensor_error || w.nm < 160 || w.nm > MAX_MPU ||
      w.ni < 12 || w.ni > MAX_INA) return false;
  uint32_t span = w.m[w.nm - 1].us - w.m[0].us;
  if (span < 900000) return false;
  int adjacent = 0, ns = 0;
  for (int i = 0; i < w.nm; ++i) {
    const Mpu &s = w.m[i];
    if (!std::isfinite(s.x) || !std::isfinite(s.y) || !std::isfinite(s.z)) return false;
    work.a[i][0] = s.x; work.a[i][1] = s.y; work.a[i][2] = s.z;
    work.norms[i] = std::sqrt(float(s.x)*s.x + float(s.y)*s.y + float(s.z)*s.z);
    if (i) {
      uint32_t dt = s.us - w.m[i - 1].us;
      if (dt == 0 || dt > 120000) return false;
      if (dt <= 7500) {
        ++adjacent;
        float dx = s.x - w.m[i-1].x, dy = s.y - w.m[i-1].y, dz = s.z - w.m[i-1].z;
        work.steps[ns++] = std::sqrt(dx*dx + dy*dy + dz*dz);
      }
    }
  }
  if (adjacent < 100) return false;
  for (int i = 0; i < w.ni; ++i) {
    if (!std::isfinite(w.e[i].bus_v) || !std::isfinite(w.e[i].current_ma) ||
        w.e[i].bus_v < 0 || w.e[i].bus_v > 26) return false;
    if (i && (w.e[i].us - w.e[i-1].us == 0)) return false;
    work.v[i] = w.e[i].bus_v; work.cur[i] = w.e[i].current_ma;
    work.powers[i] = work.v[i] * work.cur[i];
  }
  for (int axis = 0; axis < 3; ++axis) {
    for (int i = 0; i < w.nm; ++i) work.work[i] = work.a[i][axis];
    out[axis] = stdev(work.work, w.nm);
  }
  out[3] = std::sqrt(float(out[0])*out[0] + float(out[1])*out[1] + float(out[2])*out[2]);
  out[4] = mean(work.norms, w.nm); out[5] = stdev(work.norms, w.nm);
  out[6] = quantile(work.norms, w.nm, .95f);
  out[7] = quantile(work.steps, ns, .50f); out[8] = quantile(work.steps, ns, .95f);
  out[9] = mean(work.v, w.ni); out[10] = stdev(work.v, w.ni);
  out[11] = *std::min_element(work.v, work.v + w.ni);
  out[12] = mean(work.cur, w.ni); out[13] = stdev(work.cur, w.ni);
  out[14] = quantile(work.cur, w.ni, .95f);

  // Coordinate-wise median dynamic features (indices 15..19, 40, 41, 46 for V2/V3/V4 backward compatibility)
  float med[3];
  for (int axis = 0; axis < 3; ++axis) {
    for (int i = 0; i < w.nm; ++i) work.work[i] = work.a[i][axis];
    med[axis] = quantile(work.work, w.nm, .5f);
  }
  for (int i = 0; i < w.nm; ++i) {
    float x = work.a[i][0]-med[0], y = work.a[i][1]-med[1], z = work.a[i][2]-med[2];
    work.dyn[i] = std::sqrt(x*x + y*y + z*z);
  }
  five(work.dyn, w.nm, out+15);
  five(work.norms, w.nm, out+20);
  five(work.steps, ns, out+25);
  five(work.v, w.ni, out+30);
  five(work.cur, w.ni, out+35);
  float cut = quantile(work.dyn, w.nm, .95f), sq = 0; int trimmed = 0;
  for (int i = 0; i < w.nm; ++i) if (work.dyn[i] <= cut) {
    sq += work.dyn[i]*work.dyn[i]; ++trimmed;
  }
  if (!trimmed) return false;
  out[40] = std::sqrt(sq/trimmed);
  out[41] = out[19] / max2(out[40], 1e-8f);
  out[42] = out[36] / max2(out[31], .1f);
  out[43] = quantile(work.powers, w.ni, .5f);
  out[44] = out[13] / max2(std::fabs(out[12]), 1.0f);
  out[45] = out[10] / max2(std::fabs(out[9]), .1f);
  out[46] = out[26] / max2(out[16], 1e-8f);

  // V4 time-domain invariants (indices 56, 57, 62, 63)
  out[56] = out[24] - out[21]; // norm_centered_p95
  out[57] = max3(out[0], out[1], out[2]) / max2(out[3], 1e-6f); // anisotropy_ratio
  out[62] = out[31] + 0.0012f * max2(out[36] - 150.0f, 0.0f); // v_load_comp (V4)
  out[63] = out[16] / max2(out[44] + 0.005f, 1e-4f); // vib_to_ripple_ratio (V4)

  // V3 Final Modified Weiszfeld Geometric Median dynamic features (indices 64..71, SO(3) rotation equivariant)
  double mean_xyz[3] = {0.0, 0.0, 0.0};
  for (int i = 0; i < w.nm; ++i)
    for (int j = 0; j < 3; ++j) mean_xyz[j] += double(work.a[i][j]) / w.nm;
  double center[3] = {mean_xyz[0], mean_xyz[1], mean_xyz[2]};
  for (int iteration = 0; iteration < 150; ++iteration) {
    double sum[3] = {0.0, 0.0, 0.0}, residual[3] = {0.0, 0.0, 0.0}, total_inv = 0.0;
    int hits = 0;
    for (int i = 0; i < w.nm; ++i) {
      double ds[3], dist2 = 0.0;
      for (int j = 0; j < 3; ++j) { ds[j] = double(work.a[i][j]) - center[j]; dist2 += ds[j] * ds[j]; }
      double dist = std::sqrt(dist2);
      if (dist < 1e-12) { ++hits; continue; }
      double inv = 1.0 / dist;
      total_inv += inv;
      for (int j = 0; j < 3; ++j) { sum[j] += double(work.a[i][j]) * inv; residual[j] += ds[j] * inv; }
    }
    if (total_inv == 0.0) break;
    double radius = std::sqrt(residual[0]*residual[0] + residual[1]*residual[1] + residual[2]*residual[2]);
    double eta = hits ? std::min(1.0, hits / std::max(radius, 1e-30)) : 0.0;
    double change = 0.0;
    for (int j = 0; j < 3; ++j) {
      double next = (1.0 - eta) * sum[j] / total_inv + eta * center[j];
      change += (next - center[j]) * (next - center[j]);
      center[j] = next;
    }
    if (std::sqrt(change) <= 1e-10) break;
  }
  float gmed[3] = {float(center[0]), float(center[1]), float(center[2])};
  for (int i = 0; i < w.nm; ++i) {
    float x = work.a[i][0] - gmed[0], y = work.a[i][1] - gmed[1], z = work.a[i][2] - gmed[2];
    work.dyn[i] = std::sqrt(x*x + y*y + z*z);
  }
  five(work.dyn, w.nm, out + 64); // 64..68: geom_dyn_p05, geom_dyn_median, geom_dyn_iqr, geom_dyn_mad, geom_dyn_p95
  float gcut = quantile(work.dyn, w.nm, .95f), gsq = 0.0f;
  int gtrimmed = 0;
  for (int i = 0; i < w.nm; ++i) if (work.dyn[i] <= gcut) {
    gsq += work.dyn[i] * work.dyn[i]; ++gtrimmed;
  }
  if (!gtrimmed) return false;
  out[69] = std::sqrt(gsq / gtrimmed); // geom_dynamic_trim_rms
  out[70] = out[68] / max2(out[69], 1e-8f); // geom_dynamic_crest_robust
  out[71] = out[26] / max2(out[65], 1e-8f); // geom_accel_step_ratio

  // V3 Final 3x3 Covariance Eigenvalue Invariants (indices 72..76, SO(3) rotation invariant)
  double cov[3][3] = {{0,0,0}, {0,0,0}, {0,0,0}};
  for (int i = 0; i < w.nm; ++i) {
    const double d0 = double(work.a[i][0]) - mean_xyz[0];
    const double d1 = double(work.a[i][1]) - mean_xyz[1];
    const double d2 = double(work.a[i][2]) - mean_xyz[2];
    const double da[3] = {d0, d1, d2};
    for (int r = 0; r < 3; ++r)
      for (int c = 0; c < 3; ++c) cov[r][c] += da[r] * da[c] / w.nm;
  }
  double ev[3];
  eigenvalues3(cov, ev);
  const double cov_e = ev[0] + ev[1] + ev[2];
  const double cov_den = cov_e > 1e-30 ? cov_e : 1e-30;
  const double f0 = ev[0] / cov_den, f1 = ev[1] / cov_den, f2 = ev[2] / cov_den;
  out[72] = float(std::sqrt(ev[0])); // cov_std1
  out[73] = float(std::sqrt(ev[1])); // cov_std2
  out[74] = float(std::sqrt(ev[2])); // cov_std3
  out[75] = float(f0 * f1 * f2); // cov_det_ratio
  out[76] = float(f0*f0 + f1*f1 + f2*f2); // cov_shape

  // 200-Hz linear interpolation grid & Multi-Axis Autocorrelation (indices 77..78, SO(3) rotation invariant)
  int j = 0;
  for (int n = 0; n < FFT_N; ++n) {
    float target = n * 5000.0f;
    while (j + 1 < w.nm && uint32_t(w.m[j+1].us - w.m[0].us) < target) ++j;
    float alpha = 0.0f;
    if (j + 1 < w.nm) alpha = (target - uint32_t(w.m[j].us - w.m[0].us)) /
                              float(w.m[j+1].us - w.m[j].us);
    for (int axis = 0; axis < 3; ++axis) {
      float a = work.a[j][axis], b = j+1 < w.nm ? work.a[j+1][axis] : a;
      work.centered[n][axis] = a + alpha * (b - a);
    }
  }
  for (int axis = 0; axis < 3; ++axis) {
    float sum = 0.0f;
    for (int n = 0; n < FFT_N; ++n) sum += work.centered[n][axis];
    float m = sum / FFT_N;
    for (int n = 0; n < FFT_N; ++n) work.centered[n][axis] -= m;
  }
  double ac_den = 0.0, ac1 = 0.0, ac2 = 0.0;
  for (int n = 0; n < FFT_N; ++n) {
    for (int axis = 0; axis < 3; ++axis) {
      const double v0 = work.centered[n][axis];
      ac_den += v0 * v0;
      if (n + 1 < FFT_N) ac1 += v0 * double(work.centered[n + 1][axis]);
      if (n + 2 < FFT_N) ac2 += v0 * double(work.centered[n + 2][axis]);
    }
  }
  const double ac_div = ac_den > 1e-30 ? ac_den : 1e-30;
  out[77] = float(ac1 / ac_div); // acf_lag1
  out[78] = float(ac2 / ac_div); // acf_lag2

  // V3 Final Universal Couplings & Load-Compensated Voltages (indices 79..83)
  out[79] = out[74] * out[22] * 1000.0f; // whirl_norm_prod = cov_std3 * norm_iqr * 1000
  out[80] = out[26] * out[44]; // electro_mech_step = step_median * current_cv
  out[81] = out[65] / max2(out[44] + 0.005f, 1e-4f); // vib_to_ripple_geom = geom_dyn_median / (current_cv + 0.005)
  out[82] = out[31] + 0.00185f * max2(out[36] - 150.0f, 0.0f); // v_load_comp_v3_final
  out[83] = out[30] + 0.00185f * max2(out[36] - 150.0f, 0.0f); // v_p05_load_comp_v3_final

  if (!spectral) {
    for (int i = 0; i < 47; ++i) if (!std::isfinite(out[i])) return false;
    for (int i = 47; i < 56; ++i) out[i] = 0.0f;
    out[58] = 0.0f; out[59] = 0.0f; out[60] = 0.0f; out[61] = 0.0f;
    if (!std::isfinite(out[56]) || !std::isfinite(out[57]) || !std::isfinite(out[62]) || !std::isfinite(out[63])) return false;
    for (int i = 64; i < NUM_FEATURES; ++i) if (!std::isfinite(out[i])) return false;
    return true;
  }

  // Apply Hann window and compute 101-bin Goertzel power spectrum
  for (int axis = 0; axis < 3; ++axis) {
    for (int n = 0; n < FFT_N; ++n)
      work.centered[n][axis] *= (.5f - .5f * std::cos(2.0f * MC_PI * n / (FFT_N - 1)));
  }
  float total = 0.0f;
  for (int k = 0; k <= FFT_N / 2; ++k) {
    float coefficient = 2.0f * std::cos(2.0f * MC_PI * k / FFT_N), power = 0.0f;
    for (int axis = 0; axis < 3; ++axis) {
      float s1 = 0.0f, s2 = 0.0f;
      for (int n = 0; n < FFT_N; ++n) {
        float s0 = work.centered[n][axis] + coefficient * s1 - s2;
        s2 = s1; s1 = s0;
      }
      power += max2(0.0f, s1*s1 + s2*s2 - coefficient*s1*s2);
    }
    work.spec[k] = k == 0 ? 0.0f : power;
    total += work.spec[k];
  }
  total = max2(total, 1e-16f);
  for (int b = 0; b < 5; ++b) {
    float sum = 0.0f;
    const int lo[] = {1,10,25,50,75}, hi[] = {10,25,50,75,100};
    for (int k = lo[b]; k < hi[b]; ++k) sum += work.spec[k];
    out[47 + b] = sum / total;
  }
  float centroid = 0.0f, entropy = 0.0f, peak = -1.0f; int peak_k = 0;
  for (int k = 0; k <= FFT_N / 2; ++k) {
    float p = work.spec[k] / total; centroid += k * p;
    if (p > 0.0f) entropy -= p * std::log(p);
    if (work.spec[k] > peak) { peak = work.spec[k]; peak_k = k; }
  }
  out[52] = centroid; out[53] = peak_k;
  out[54] = entropy / std::log(FFT_N / 2 + 1.0f);
  out[55] = peak / total;

  // V4/V3 Final spectral invariants (indices 58, 59, 60, 61)
  out[58] = out[50] + out[51]; // spectral_hf_ratio
  out[59] = out[47] + out[48]; // spectral_lf_ratio
  out[60] = out[58] / max2(out[59], 1e-4f); // spectral_hf_to_lf
  out[61] = out[26] * out[58]; // rotational_index

  for (int i = 0; i < NUM_FEATURES; ++i) if (!std::isfinite(out[i])) return false;
  return true;
}
} // namespace motorcare_v3_final_features
