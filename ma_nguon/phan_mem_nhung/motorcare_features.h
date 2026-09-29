#pragma once

#include <algorithm>
#include <cmath>
#include <cstdint>

// Pure C++ so the feature calculation can also be checked on a PC.
struct McAccel { uint32_t t_us; float x, y, z; };
struct McElectrical { float voltage_v, current_ma; };

constexpr int MC_MAX_ACCEL = 240;
constexpr int MC_MAX_ELECTRICAL = 40;

static inline float mc_mean(const float* a, int n) {
  float s = 0;
  for (int k = 0; k < n; ++k) s += a[k];
  return s / n;
}

static inline float mc_std(const float* a, int n, float avg) {
  float sum = 0;
  for (int k = 0; k < n; ++k) {
    float d = a[k] - avg;
    sum += d * d;
  }
  return sqrtf(sum / n);  // numpy std(ddof=0)
}

static inline float mc_percentile(const float* a, int n, float p) {
  float sorted[MC_MAX_ACCEL];
  for (int k = 0; k < n; ++k) sorted[k] = a[k];
  std::sort(sorted, sorted + n);
  float pos = (n - 1) * p;  // numpy.quantile, linear interpolation
  int lo = static_cast<int>(pos);
  int hi = std::min(lo + 1, n - 1);
  return sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo]);
}

// Order EXACTLY matches tri_tue_nhan_tao/du_lieu/feature_columns.json.
static inline bool mc_extract_features(const McAccel* a, int na,
                                       const McElectrical* e, int ne,
                                       float f[15]) {
  if (na < 160 || na > MC_MAX_ACCEL || ne < 12 || ne > MC_MAX_ELECTRICAL)
    return false;

  float sx = 0, sy = 0, sz = 0;
  float norms[MC_MAX_ACCEL], steps[MC_MAX_ACCEL];
  for (int k = 0; k < na; ++k) {
    sx += a[k].x; sy += a[k].y; sz += a[k].z;
    norms[k] = sqrtf(a[k].x * a[k].x + a[k].y * a[k].y + a[k].z * a[k].z);
  }
  float mx = sx / na, my = sy / na, mz = sz / na;
  float vx = 0, vy = 0, vz = 0;
  int ns = 0;
  for (int k = 0; k < na; ++k) {
    float dx = a[k].x - mx, dy = a[k].y - my, dz = a[k].z - mz;
    vx += dx * dx; vy += dy * dy; vz += dz * dz;
    if (k && static_cast<uint32_t>(a[k].t_us - a[k-1].t_us) <= 7500U) {
      dx = a[k].x - a[k-1].x;
      dy = a[k].y - a[k-1].y;
      dz = a[k].z - a[k-1].z;
      steps[ns++] = sqrtf(dx * dx + dy * dy + dz * dz);
    }
  }
  if (ns < 100) return false;

  f[0] = sqrtf(vx / na); f[1] = sqrtf(vy / na); f[2] = sqrtf(vz / na);
  f[3] = sqrtf(f[0]*f[0] + f[1]*f[1] + f[2]*f[2]);
  f[4] = mc_mean(norms, na);
  f[5] = mc_std(norms, na, f[4]);
  f[6] = mc_percentile(norms, na, .95f);
  f[7] = mc_percentile(steps, ns, .5f);
  f[8] = mc_percentile(steps, ns, .95f);

  float volts[MC_MAX_ELECTRICAL], amps[MC_MAX_ELECTRICAL];
  float min_v = e[0].voltage_v;
  for (int k = 0; k < ne; ++k) {
    volts[k] = e[k].voltage_v;
    amps[k] = e[k].current_ma;
    if (volts[k] < min_v) min_v = volts[k];
  }
  f[9] = mc_mean(volts, ne);
  f[10] = mc_std(volts, ne, f[9]);
  f[11] = min_v;
  f[12] = mc_mean(amps, ne);
  f[13] = mc_std(amps, ne, f[12]);
  f[14] = mc_percentile(amps, ne, .95f);
  return true;
}
