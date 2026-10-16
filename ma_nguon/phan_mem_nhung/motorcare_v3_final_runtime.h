// MotorCare V3 Final Unified Portable Runtime (Quality Gate + 84-Feature Extractor + V3 Final Decoupled Multi-Head + Confirmed-Normal Shadow Profile + 10-Slot Timeline).
// Include in exactly one implementation unit; one feature worker at a time.
#pragma once
#include <limits>
#include "motorcare_features_v3_final_f32.h"
#include "motorcare_profile_features.h"
#include "motorcare_normal_profile.h"

#ifndef MOTORCARE_USE_LITE
#define MOTORCARE_USE_LITE 0
#endif
#if MOTORCARE_USE_LITE
#include "motorcare_v3_final_lite.h"
#else
#include "motorcare_v3_final_accuracy.h"
#endif

namespace motorcare_runtime {
using motorcare_v3_final_features::Mpu;
using motorcare_v3_final_features::Window;
constexpr int MAX_MPU = motorcare_v3_final_features::MAX_MPU;
constexpr int MAX_INA = motorcare_v3_final_features::MAX_INA;
constexpr int NUM_FEATURES = motorcare_v3_final_features::NUM_FEATURES;
constexpr int SIGNS = 3; // jam, vibration, sag
constexpr int8_t UNKNOWN = -1;

struct RawIna {
  uint32_t row_us = 0, us = 0;
  float bus_v = 0, current_ma = 0;
  bool complete = true;
};
struct RawWindow {
  int nm = 0, ni = 0;
  uint32_t observed_span_us = 0;
  bool mpu_overflow = false, ina_overflow = false;
  bool mpu_error = false, ina_error = false;
  Mpu m[MAX_MPU];
  RawIna e[MAX_INA];
};
enum class Reason {
  Valid, Unpowered, MpuInvalid, MpuInsufficient, InaInsufficient, Timing,
  Overflow, SensorError, FeatureError, ModelError
};
inline const char* reason_name(Reason r) {
  switch (r) {
    case Reason::Valid: return "valid";
    case Reason::Unpowered: return "unpowered";
    case Reason::MpuInvalid: return "mpu_range_or_pattern";
    case Reason::MpuInsufficient: return "mpu_insufficient";
    case Reason::InaInsufficient: return "ina_insufficient";
    case Reason::Timing: return "timing_or_coverage";
    case Reason::Overflow: return "overflow";
    case Reason::SensorError: return "sensor_error";
    case Reason::FeatureError: return "feature_error";
    default: return "model_error";
  }
}
struct Quality {
  Reason reason = Reason::MpuInsufficient;
  int raw_mpu = 0, invalid_mpu = 0, kept_mpu = 0, kept_ina = 0, electrical_ina = 0;
  bool electrical_valid = false, supply_off = false;
  float voltage_median = std::numeric_limits<float>::quiet_NaN();
  float current_median = std::numeric_limits<float>::quiet_NaN();
};

inline bool forward(uint32_t newer, uint32_t older) {
  const uint32_t dt = newer - older;
  return dt != 0 && dt < 0x80000000u;
}
inline uint32_t distance_us(uint32_t a, uint32_t b) {
  const uint32_t f = a - b, r = b - a; return f < r ? f : r;
}
inline bool invalid_mpu(const Mpu& s) {
  return !std::isfinite(s.x) || !std::isfinite(s.y) || !std::isfinite(s.z) ||
    std::fabs(s.x) > 2 || std::fabs(s.y) > 2 || std::fabs(s.z) > 2 ||
    (s.x == 0 && s.y == 0 && s.z == 0) ||
    (s.y == -.126f && s.z == -.126f) || (s.y == -.063f && s.z == -.063f);
}

inline Quality curate(const RawWindow& raw, Window& clean) {
  Quality q; q.raw_mpu = raw.nm;
  clean.nm = clean.ni = 0; clean.overflow = clean.sensor_error = false;
  const bool mpu_capacity = raw.nm >= 0 && raw.nm <= MAX_MPU && !raw.mpu_overflow;
  const bool ina_capacity = raw.ni >= 0 && raw.ni <= MAX_INA && !raw.ina_overflow;
  uint32_t span = raw.observed_span_us;
  if (!span && mpu_capacity && raw.nm > 1) span = raw.m[raw.nm - 1].us - raw.m[0].us;
  bool raw_timing = true;
  if (mpu_capacity) for (int i = 0; i < raw.nm; ++i) {
    if (i && (!forward(raw.m[i].us, raw.m[i - 1].us) ||
              raw.m[i].us - raw.m[i - 1].us > 250000)) raw_timing = false;
    if (invalid_mpu(raw.m[i])) ++q.invalid_mpu;
    else clean.m[clean.nm++] = raw.m[i];
  }
  bool ina_timing = true, have_ina = false; uint32_t previous_ina = 0;
  if (ina_capacity && !raw.ina_error) for (int i = 0; i < raw.ni; ++i) {
    const RawIna& s = raw.e[i];
    if (!s.complete || !std::isfinite(s.bus_v) || !std::isfinite(s.current_ma) ||
        s.bus_v < 0 || s.bus_v > 26 || distance_us(s.us, s.row_us) > 100000) continue;
    if (have_ina && s.us == previous_ina) continue;
    if (have_ina && !forward(s.us, previous_ina)) { ina_timing = false; break; }
    clean.e[clean.ni++] = {s.us, s.bus_v, s.current_ma};
    previous_ina = s.us; have_ina = true;
  }
  q.kept_mpu = clean.nm; q.electrical_ina = clean.ni;
  q.electrical_valid = ina_capacity && !raw.ina_error && ina_timing &&
    clean.ni >= 12 && span >= 900000 && span < 1000000 &&
    clean.e[clean.ni - 1].us - clean.e[0].us >= 700000 &&
    clean.e[clean.ni - 1].us - clean.e[0].us < 0x80000000u;
  if (q.electrical_valid) {
    float v[MAX_INA], c[MAX_INA];
    for (int i = 0; i < clean.ni; ++i) { v[i] = clean.e[i].bus_v; c[i] = clean.e[i].current_ma; }
    q.voltage_median = motorcare_v3_final_features::quantile(v, clean.ni, .5f);
    q.current_median = motorcare_v3_final_features::quantile(c, clean.ni, .5f);
    q.supply_off = q.voltage_median < .2f && std::fabs(q.current_median) < 5;
  }
  clean.ni = 0; have_ina = false; previous_ina = 0; bool core_ina_timing = true;
  if (ina_capacity && !raw.ina_error && mpu_capacity) for (int i = 0; i < raw.ni; ++i) {
    const RawIna& s = raw.e[i]; bool row_valid = false;
    for (int j = 0; j < raw.nm; ++j) if (raw.m[j].us == s.row_us) {
      row_valid = !invalid_mpu(raw.m[j]); break;
    }
    if (!row_valid || !s.complete || !std::isfinite(s.bus_v) ||
        !std::isfinite(s.current_ma) || s.bus_v < 0 || s.bus_v > 26 ||
        distance_us(s.us, s.row_us) > 100000) continue;
    if (have_ina && s.us == previous_ina) continue;
    if (have_ina && !forward(s.us, previous_ina)) { core_ina_timing = false; break; }
    clean.e[clean.ni++] = {s.us, s.bus_v, s.current_ma};
    previous_ina = s.us; have_ina = true;
  }
  q.kept_ina = clean.ni;
  if (q.supply_off) q.reason = Reason::Unpowered;
  else if (!mpu_capacity) q.reason = Reason::Overflow;
  else if (raw.mpu_error) q.reason = Reason::SensorError;
  else if (raw.nm && q.invalid_mpu * 20 > raw.nm) q.reason = Reason::MpuInvalid;
  else if (clean.nm < 160) q.reason = Reason::MpuInsufficient;
  else if (!q.electrical_valid) q.reason = Reason::InaInsufficient;
  else {
    int adjacent = 0; bool timing = raw_timing && core_ina_timing && clean.ni >= 12;
    const uint32_t clean_span = clean.m[clean.nm - 1].us - clean.m[0].us;
    timing = timing && clean_span >= 900000 && clean_span < 1000000;
    for (int i = 1; i < clean.nm; ++i) {
      const uint32_t dt = clean.m[i].us - clean.m[i - 1].us;
      if (!forward(clean.m[i].us, clean.m[i - 1].us) || dt > 120000) timing = false;
      if (dt > 0 && dt <= 7500) ++adjacent;
    }
    q.reason = timing && adjacent >= 100 ? Reason::Valid : Reason::Timing;
  }
  return q;
}

struct TimelineState {
  bool accepted = false;
  uint8_t positive[SIGNS] = {0, 0, 0}, known[SIGNS] = {0, 0, 0};
  bool alarm[SIGNS] = {false, false, false};
};
class Timeline10 {
  int8_t slots_[10][SIGNS];
  int next_ = 0;
  uint64_t session_ = 0, last_ = 0;
  bool started_ = false;
  void append(const int8_t* evidence) {
    for (int j = 0; j < SIGNS; ++j) slots_[next_][j] = evidence[j];
    next_ = (next_ + 1) % 10;
  }
public:
  Timeline10() { reset(); }
  void reset() {
    for (auto& row : slots_) for (int8_t& v : row) v = UNKNOWN;
    next_ = 0; started_ = false;
  }
  TimelineState state() const {
    TimelineState out;
    for (const auto& row : slots_) for (int j = 0; j < SIGNS; ++j) {
      out.known[j] += row[j] >= 0; out.positive[j] += row[j] == 1;
    }
    for (int j = 0; j < SIGNS; ++j) out.alarm[j] = out.positive[j] >= 8;
    return out;
  }
  TimelineState push(uint64_t session, uint64_t slot, const int8_t* evidence) {
    if (started_ && session == session_ && slot <= last_) return state();
    if (!started_ || session != session_) reset();
    else {
      const uint64_t skipped = slot - last_ - 1;
      const int8_t missing[SIGNS] = {UNKNOWN, UNKNOWN, UNKNOWN};
      if (skipped >= 10) reset();
      else for (uint64_t i = 0; i < skipped; ++i) append(missing);
    }
    append(evidence); session_ = session; last_ = slot; started_ = true;
    TimelineState out = state(); out.accepted = true; return out;
  }
};

inline void signs(const float* p, float* fault_support) {
  fault_support[0] = p[0] + p[1];
  fault_support[1] = p[4] + p[5];
  fault_support[2] = p[1] + p[3] + p[5];
}
inline bool model_predict(const float* f84, float* p) {
#if MOTORCARE_USE_LITE
  return motorcare_v3_final_lite::predict_from_core84(f84, p);
#else
  return motorcare_v3_final_accuracy::predict_from_core84(f84, p);
#endif
}
constexpr bool use_spectral() {
#if MOTORCARE_USE_LITE
  return false;
#else
  return true;
#endif
}
constexpr unsigned model_array_bytes() {
#if MOTORCARE_USE_LITE
  return motorcare_v3_final_lite::MODEL_ARRAY_BYTES;
#else
  return motorcare_v3_final_accuracy::MODEL_ARRAY_BYTES;
#endif
}
inline const char* model_name() {
#if MOTORCARE_USE_LITE
  return "v3_final_lite20";
#else
  return "v3_final_accuracy36";
#endif
}
struct Output {
  Quality quality;
  bool inferred = false, classifier_known = false, profile_known = false;
  bool novelty = false, conflict = false, historical_alarm_with_unknown = false;
  int class_index = -1;
  float probability[6] = {0, 0, 0, 0, 0, 0}, max_support = 0;
  float fault_support[SIGNS] = {0, 0, 0};
  int8_t evidence[SIGNS] = {UNKNOWN, UNKNOWN, UNKNOWN};
  double normal_distance = std::numeric_limits<double>::quiet_NaN();
  TimelineState timeline;
};
class Runtime {
  Window clean_;
  float core_[NUM_FEATURES], invariant_[20];
  Timeline10 timeline_;
public:
  void reset() { timeline_.reset(); }
  Output process(const RawWindow& raw, uint64_t session, uint64_t slot) {
    Output out; out.quality = curate(raw, clean_);
    if (out.quality.reason == Reason::Valid) {
      if (!motorcare_v3_final_features::extract(clean_, core_, use_spectral()))
        out.quality.reason = Reason::FeatureError;
      else if (!model_predict(core_, out.probability))
        out.quality.reason = Reason::ModelError;
      else {
        out.inferred = true; out.class_index = 0;
        for (int j = 0; j < 6; ++j) if (out.probability[j] > out.probability[out.class_index]) out.class_index = j;
        out.max_support = out.probability[out.class_index];
        out.classifier_known = out.max_support >= .7f;
        signs(out.probability, out.fault_support);
        if (out.classifier_known) for (int j = 0; j < SIGNS; ++j)
          out.evidence[j] = out.fault_support[j] >= .5f ? 1 : 0;
        if (motorcare_profile_features::extract(clean_, core_, invariant_))
          out.profile_known = motorcare_normal_profile::evaluate(invariant_, out.normal_distance, out.novelty);
        if (out.profile_known && out.classifier_known)
          out.conflict = (out.class_index == 2 && out.novelty) || (out.class_index != 2 && !out.novelty);
      }
    }
    out.timeline = timeline_.push(session, slot, out.evidence);
    for (int j = 0; j < SIGNS; ++j) if (out.timeline.alarm[j] && out.evidence[j] < 0)
      out.historical_alarm_with_unknown = true;
    return out;
  }
  const float* core_features() const { return core_; }
  const float* profile_features() const { return invariant_; }
};
} // namespace motorcare_runtime
