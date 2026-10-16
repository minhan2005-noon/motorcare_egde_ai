// invariant20 counterpart of src/features.py, from already curated samples.
// Reuses geometric feature Scratch; run with the single feature worker.
#pragma once
#include "motorcare_features_v3_final_f32.h"

namespace motorcare_profile_features {
inline void eigenvalues3(double c[3][3], double ev[3]) {
  // Jacobi rotations avoid an eigenvector/axis convention in the input features.
  for (int it=0; it<32; ++it) {
    int p=0, q=1;
    if (std::fabs(c[0][2])>std::fabs(c[p][q])) { p=0; q=2; }
    if (std::fabs(c[1][2])>std::fabs(c[p][q])) { p=1; q=2; }
    const double scale=std::fabs(c[0][0])+std::fabs(c[1][1])+std::fabs(c[2][2]);
    if (std::fabs(c[p][q]) <= 1e-15*(scale > 1e-30 ? scale : 1e-30)) break;
    const double angle=.5*std::atan2(2*c[p][q], c[q][q]-c[p][p]);
    const double co=std::cos(angle), si=std::sin(angle);
    const double a=c[p][p], b=c[q][q], off=c[p][q];
    c[p][p]=co*co*a-2*si*co*off+si*si*b;
    c[q][q]=si*si*a+2*si*co*off+co*co*b;
    c[p][q]=c[q][p]=0;
    for (int k=0; k<3; ++k) if (k!=p && k!=q) {
      const double u=c[k][p], v=c[k][q];
      c[k][p]=c[p][k]=co*u-si*v;
      c[k][q]=c[q][k]=si*u+co*v;
    }
  }
  for (int i=0; i<3; ++i) ev[i]=c[i][i] > 0 ? c[i][i] : 0;
  std::sort(ev, ev+3, [](double a, double b) { return a>b; });
}

inline bool extract(const motorcare_v3_final_features::Window& w,
                    const float core[84], float out[20]) {
  using namespace motorcare_v3_final_features;
  if (w.nm<160 || w.nm>MAX_MPU) return false;
  double center[3]={0,0,0};
  for (int i=0; i<w.nm; ++i) {
    center[0]+=w.m[i].x; center[1]+=w.m[i].y; center[2]+=w.m[i].z;
  }
  for (double& v: center) v/=w.nm;
  double covariance[3][3]={{0,0,0},{0,0,0},{0,0,0}};
  for (int i=0; i<w.nm; ++i) {
    const double a[]={w.m[i].x-center[0], w.m[i].y-center[1], w.m[i].z-center[2]};
    double norm2=0;
    for (int j=0; j<3; ++j) {
      norm2+=a[j]*a[j];
      for (int k=0; k<3; ++k) covariance[j][k]+=a[j]*a[k]/w.nm;
    }
    work.dyn[i]=float(std::sqrt(norm2));
  }
  float stats[5]; five(work.dyn,w.nm,stats);
  out[0]=stats[1]; out[1]=stats[2]; out[2]=stats[4];
  const float cut=quantile(work.dyn,w.nm,.95f);
  double sq=0; int count=0;
  for (int i=0; i<w.nm; ++i) if (work.dyn[i]<=cut) {
    sq+=double(work.dyn[i])*work.dyn[i]; ++count;
  }
  if (!count) return false;
  out[3]=float(std::sqrt(sq/count));
  out[4]=out[2]/max2(out[3],1e-8f);
  out[5]=core[21]; out[6]=core[22]; out[7]=core[24];
  double ev[3]; eigenvalues3(covariance,ev);
  const double energy=ev[0]+ev[1]+ev[2];
  const double den=energy>1e-30 ? energy : 1e-30;
  out[8]=0;
  for (int j=0; j<3; ++j) {
    const double frac=ev[j]/den;
    out[9+j]=float(frac); out[8]+=float(frac*frac);
  }
  const int index[]={31,32,36,37,44,42,43,45};
  for (int j=0; j<8; ++j) out[12+j]=core[index[j]];
  for (int j=0; j<20; ++j) if (!std::isfinite(out[j])) return false;
  return true;
}
} // namespace motorcare_profile_features
