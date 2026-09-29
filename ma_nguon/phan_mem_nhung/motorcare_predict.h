#pragma once

#include <cmath>
#include "model_weights.h"

static inline float mc_relu(float z) { return z > 0 ? z : 0; }
static inline float mc_sigmoid(float z) {
  if (z >= 0) return 1.0f / (1.0f + expf(-z));
  float e = expf(z);
  return e / (1.0f + e);
}

// Pure C++ forward pass for the exact 15 -> 12 -> 8 -> 3 trained MLP.
// Output order: jam, vibration, sag. No TensorFlow runtime is needed.
static inline void mc_predict(const float input[15], float output[3]) {
  float h1[12], h2[8], z[15];
  for (int k = 0; k < 15; ++k)
    z[k] = (input[k] - MC_MEAN[k]) / MC_SCALE[k];
  for (int j = 0; j < 12; ++j) {
    float sum = MC_B0[j];
    for (int k = 0; k < 15; ++k) sum += z[k] * MC_W0[k][j];
    h1[j] = mc_relu(sum);
  }
  for (int j = 0; j < 8; ++j) {
    float sum = MC_B1[j];
    for (int k = 0; k < 12; ++k) sum += h1[k] * MC_W1[k][j];
    h2[j] = mc_relu(sum);
  }
  for (int j = 0; j < 3; ++j) {
    float sum = MC_B2[j];
    for (int k = 0; k < 8; ++k) sum += h2[k] * MC_W2[k][j];
    output[j] = mc_sigmoid(sum);
  }
}

