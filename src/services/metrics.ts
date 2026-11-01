import { MetricType, ComparisonStats, TonalRangeFilter } from '../types';

// Constants
const PI = Math.PI;
const DEG2RAD = PI / 180.0;
const RAD2DEG = 180.0 / PI;

// Precomputed sRGB to linear LUT (0..255)
const SRGB_TO_LINEAR_LUT: Float32Array = (() => {
  const lut = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255.0;
    lut[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  return lut;
})();

// CIE Lab companding function
function labF(t: number): number {
  const EPSILON = 216.0 / 24389.0;
  const KAPPA = 24389.0 / 27.0;
  return t > EPSILON ? Math.cbrt(t) : (KAPPA * t + 16.0) / 116.0;
}

// Convert sRGB 8-bit to CIE Lab [L, a, b]
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const rLin = SRGB_TO_LINEAR_LUT[r];
  const gLin = SRGB_TO_LINEAR_LUT[g];
  const bLin = SRGB_TO_LINEAR_LUT[b];

  // sRGB D65 to XYZ
  const X = 0.4124564 * rLin + 0.3575761 * gLin + 0.1804375 * bLin;
  const Y = 0.2126729 * rLin + 0.7151522 * gLin + 0.0721750 * bLin;
  const Z = 0.0193339 * rLin + 0.1191920 * gLin + 0.9503041 * bLin;

  // D65 reference white
  const Xn = 0.95047;
  const Yn = 1.0;
  const Zn = 1.08883;

  const fx = labF(X / Xn);
  const fy = labF(Y / Yn);
  const fz = labF(Z / Zn);

  const L = 116.0 * fy - 16.0;
  const aVal = 500.0 * (fx - fy);
  const bVal = 200.0 * (fy - fz);

  return [L, aVal, bVal];
}

export function deltaE76(L1: number, a1: number, b1: number, L2: number, a2: number, b2: number): number {
  const dL = L1 - L2;
  const da = a1 - a2;
  const db = b1 - b2;
  return Math.sqrt(dL * dL + da * da + db * db);
}

// Full CIEDE2000 (Sharma, Wu & Dalal 2005)
export function deltaE2000(L1: number, a1: number, b1: number, L2: number, a2: number, b2: number): number {
  const Lbar = (L1 + L2) * 0.5;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) * 0.5;

  const Cbar7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1.0 - Math.sqrt(Cbar7 / (Cbar7 + 6103515625.0))); // 25^7 = 6103515625

  const a1p = (1.0 + G) * a1;
  const a2p = (1.0 + G) * a2;

  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const Cbarp = (C1p + C2p) * 0.5;

  let h1p = (Math.atan2(b1, a1p) * RAD2DEG + 360.0) % 360.0;
  let h2p = (Math.atan2(b2, a2p) * RAD2DEG + 360.0) % 360.0;
  if (C1p === 0) h1p = 0;
  if (C2p === 0) h2p = 0;

  let dhp = 0;
  if (C1p * C2p !== 0) {
    const diff = h2p - h1p;
    if (Math.abs(diff) <= 180.0) {
      dhp = diff;
    } else if (diff > 180.0) {
      dhp = diff - 360.0;
    } else {
      dhp = diff + 360.0;
    }
  }

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  const dHp = 2.0 * Math.sqrt(C1p * C2p) * Math.sin(dhp * 0.5 * DEG2RAD);

  let hbarp = 0;
  if (C1p * C2p === 0) {
    hbarp = h1p + h2p;
  } else {
    const sum = h1p + h2p;
    if (Math.abs(h1p - h2p) <= 180.0) {
      hbarp = sum * 0.5;
    } else if (sum < 360.0) {
      hbarp = (sum + 360.0) * 0.5;
    } else {
      hbarp = (sum - 360.0) * 0.5;
    }
  }

  const T = 1.0 -
    0.17 * Math.cos((hbarp - 30.0) * DEG2RAD) +
    0.24 * Math.cos(2.0 * hbarp * DEG2RAD) +
    0.32 * Math.cos((3.0 * hbarp + 6.0) * DEG2RAD) -
    0.20 * Math.cos((4.0 * hbarp - 63.0) * DEG2RAD);

  const dTheta = 30.0 * Math.exp(-Math.pow((hbarp - 275.0) / 25.0, 2));
  const Cbarp7 = Math.pow(Cbarp, 7);
  const RC = 2.0 * Math.sqrt(Cbarp7 / (Cbarp7 + 6103515625.0));
  const RT = -Math.sin(2.0 * dTheta * DEG2RAD) * RC;

  const Lbar50Sq = Math.pow(Lbar - 50.0, 2);
  const SL = 1.0 + (0.015 * Lbar50Sq) / Math.sqrt(20.0 + Lbar50Sq);
  const SC = 1.0 + 0.045 * Cbarp;
  const SH = 1.0 + 0.015 * Cbarp * T;

  const vL = dLp / SL;
  const vC = dCp / SC;
  const vH = dHp / SH;

  const deSq = vL * vL + vC * vC + vH * vH + RT * vC * vH;
  return Math.sqrt(Math.max(0, deSq));
}

// 11x11 Gaussian Kernel with sigma = 1.5 (Wang et al. 2004)
const GAUSSIAN_11 = (() => {
  const size = 11;
  const half = 5;
  const sigma = 1.5;
  const k = new Float32Array(size);
  let sum = 0;
  for (let i = 0; i < size; i++) {
    const x = i - half;
    k[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
    sum += k[i];
  }
  for (let i = 0; i < size; i++) {
    k[i] /= sum;
  }
  return k;
})();

// Separable Gaussian blur on single-channel Float32Array
function gaussianBlur2D(src: Float32Array, w: number, h: number): Float32Array {
  const temp = new Float32Array(w * h);
  const dst = new Float32Array(w * h);
  const k = GAUSSIAN_11;
  const half = 5;

  // Horizontal pass
  for (let y = 0; y < h; y++) {
    const rowOffset = y * w;
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let i = 0; i < 11; i++) {
        const sx = Math.min(w - 1, Math.max(0, x + i - half));
        sum += src[rowOffset + sx] * k[i];
      }
      temp[rowOffset + x] = sum;
    }
  }

  // Vertical pass
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let i = 0; i < 11; i++) {
        const sy = Math.min(h - 1, Math.max(0, y + i - half));
        sum += temp[sy * w + x] * k[i];
      }
      dst[y * w + x] = sum;
    }
  }

  return dst;
}

// Rec. 601 luma helper
export function rec601Luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function computeComparison(
  origPixels: Uint8ClampedArray,
  sitePixels: Uint8ClampedArray,
  width: number,
  height: number,
  metric: MetricType,
  blockView: boolean = false,
  tonalFilter?: TonalRangeFilter
): { diffBuffer: Float32Array; stats: ComparisonStats } {
  const pixelCount = width * height;
  const diffBuffer = new Float32Array(pixelCount);

  const isTonalFilterActive = Boolean(
    tonalFilter &&
    tonalFilter.active &&
    (tonalFilter.min > 0 || tonalFilter.max < 255)
  );
  const tMin = isTonalFilterActive && tonalFilter ? Math.min(tonalFilter.min, tonalFilter.max) : 0;
  const tMax = isTonalFilterActive && tonalFilter ? Math.max(tonalFilter.min, tonalFilter.max) : 255;
  const tChannel = tonalFilter?.channel || 'luma';

  // Keep a mask of pixels inside the selected tonal range
  const inRangeMask = isTonalFilterActive ? new Uint8Array(pixelCount) : null;
  let matchingPixels = 0;

  let sumSquaredErr = 0;
  let untouchedCount = 0;
  let visibleChangesCount = 0;
  let sumAbsDiff = 0;
  let sumDE2000 = 0;
  let maxDE2000 = 0;

  // Temporary buffers for SSIM if needed
  let lumaOrig: Float32Array | null = null;
  let lumaSite: Float32Array | null = null;

  if (metric === 'ssim') {
    lumaOrig = new Float32Array(pixelCount);
    lumaSite = new Float32Array(pixelCount);
  }

  // Primary pass over pixels
  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    const r1 = origPixels[idx];
    const g1 = origPixels[idx + 1];
    const b1 = origPixels[idx + 2];

    const r2 = sitePixels[idx];
    const g2 = sitePixels[idx + 1];
    const b2 = sitePixels[idx + 2];

    const y1 = rec601Luma(r1, g1, b1);
    const y2 = rec601Luma(r2, g2, b2);

    if (metric === 'ssim') {
      lumaOrig![i] = y1;
      lumaSite![i] = y2;
    }

    if (isTonalFilterActive && inRangeMask) {
      const levelVal =
        tChannel === 'r'
          ? r2
          : tChannel === 'g'
          ? g2
          : tChannel === 'b'
          ? b2
          : Math.round(y2);
      if (levelVal < tMin || levelVal > tMax) {
        inRangeMask[i] = 0;
        diffBuffer[i] = 0;
        continue;
      }
      inRangeMask[i] = 1;
      matchingPixels++;
    } else {
      matchingPixels++;
    }

    const dr = r2 - r1;
    const dg = g2 - g1;
    const db = b2 - b1;

    const isUntouched = dr === 0 && dg === 0 && db === 0;
    if (isUntouched) {
      untouchedCount++;
    }

    const sqErr = (dr * dr + dg * dg + db * db) / 3.0;
    sumSquaredErr += sqErr;

    const absDiff = Math.max(Math.abs(dr), Math.abs(dg), Math.abs(db));
    sumAbsDiff += absDiff;

    // Delta E 2000 calculation for statistics
    const [L1, a1, b1Val] = rgbToLab(r1, g1, b1);
    const [L2, a2, b2Val] = rgbToLab(r2, g2, b2);
    const de00 = isUntouched ? 0 : deltaE2000(L1, a1, b1Val, L2, a2, b2Val);
    sumDE2000 += de00;
    if (de00 > maxDE2000) maxDE2000 = de00;
    if (de00 > 2.3) visibleChangesCount++;

    // Calculate requested metric for diffBuffer
    if (metric === 'abs_diff') {
      diffBuffer[i] = absDiff;
    } else if (metric === 'luma_diff') {
      diffBuffer[i] = Math.abs(y2 - y1);
    } else if (metric === 'delta_e76') {
      diffBuffer[i] = isUntouched ? 0 : deltaE76(L1, a1, b1Val, L2, a2, b2Val);
    } else if (metric === 'delta_e2000') {
      diffBuffer[i] = de00;
    } else if (metric === 'squared_error') {
      diffBuffer[i] = sqErr;
    }
  }

  const effectiveCount = Math.max(1, matchingPixels);
  let ssimMean = 1.0;

  // Complete SSIM computation (Wang et al. 2004)
  if (metric === 'ssim' && lumaOrig && lumaSite) {
    const C1 = (0.01 * 255) ** 2; // 6.5025
    const C2 = (0.03 * 255) ** 2; // 58.5225

    const muX = gaussianBlur2D(lumaOrig, width, height);
    const muY = gaussianBlur2D(lumaSite, width, height);

    const lumaOrigSq = new Float32Array(pixelCount);
    const lumaSiteSq = new Float32Array(pixelCount);
    const lumaOrigSite = new Float32Array(pixelCount);

    for (let i = 0; i < pixelCount; i++) {
      lumaOrigSq[i] = lumaOrig[i] * lumaOrig[i];
      lumaSiteSq[i] = lumaSite[i] * lumaSite[i];
      lumaOrigSite[i] = lumaOrig[i] * lumaSite[i];
    }

    const sigmaX2 = gaussianBlur2D(lumaOrigSq, width, height);
    const sigmaY2 = gaussianBlur2D(lumaSiteSq, width, height);
    const sigmaXY = gaussianBlur2D(lumaOrigSite, width, height);

    let sumSSIM = 0;
    for (let i = 0; i < pixelCount; i++) {
      if (inRangeMask && inRangeMask[i] === 0) {
        diffBuffer[i] = 0;
        continue;
      }
      const mx = muX[i];
      const my = muY[i];
      const mx2 = mx * mx;
      const my2 = my * my;
      const mxmy = mx * my;

      const varX = sigmaX2[i] - mx2;
      const varY = sigmaY2[i] - my2;
      const covXY = sigmaXY[i] - mxmy;

      const num = (2 * mxmy + C1) * (2 * covXY + C2);
      const den = (mx2 + my2 + C1) * (varX + varY + C2);
      const ssimVal = Math.min(1.0, Math.max(0.0, den > 0 ? num / den : 1.0));

      // 1 - SSIM structural loss for heatmap
      diffBuffer[i] = Math.max(0, 1.0 - ssimVal);
      sumSSIM += ssimVal;
    }
    ssimMean = sumSSIM / effectiveCount;
  } else {
    // Estimate SSIM quickly if another metric was active
    const C1 = (0.01 * 255) ** 2;
    const C2 = (0.03 * 255) ** 2;
    const mse = sumSquaredErr / effectiveCount;
    ssimMean = Math.max(0, Math.min(1, 1 - mse / (255 * 255 + C1 + C2)));
  }

  // Apply 8x8 block view averaging if enabled
  if (blockView) {
    const blockSize = 8;
    for (let by = 0; by < height; by += blockSize) {
      for (let bx = 0; bx < width; bx += blockSize) {
        let blockSum = 0;
        let count = 0;
        const ey = Math.min(height, by + blockSize);
        const ex = Math.min(width, bx + blockSize);
        for (let y = by; y < ey; y++) {
          const row = y * width;
          for (let x = bx; x < ex; x++) {
            blockSum += diffBuffer[row + x];
            count++;
          }
        }
        const blockAvg = count > 0 ? blockSum / count : 0;
        for (let y = by; y < ey; y++) {
          const row = y * width;
          for (let x = bx; x < ex; x++) {
            if (!inRangeMask || inRangeMask[row + x] === 1) {
              diffBuffer[row + x] = blockAvg;
            }
          }
        }
      }
    }
  }

  // Calculate statistics over diffBuffer (for in-range pixels)
  let minVal = Number.MAX_VALUE;
  let maxVal = -Number.MAX_VALUE;
  let sumVal = 0;

  for (let i = 0; i < pixelCount; i++) {
    if (inRangeMask && inRangeMask[i] === 0) continue;
    const v = diffBuffer[i];
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
    sumVal += v;
  }
  if (minVal === Number.MAX_VALUE) minVal = 0;
  if (maxVal === -Number.MAX_VALUE) maxVal = 0;

  const meanVal = effectiveCount > 0 ? sumVal / effectiveCount : 0;

  // 64-bin histogram for display & 1024-bin fine histogram for percentiles
  const HIST_BINS = 64;
  const FINE_BINS = 1024;
  const histogram = new Array(HIST_BINS).fill(0);
  const fineHist = new Array(FINE_BINS).fill(0);
  const range = maxVal > 0 ? maxVal : 1.0;

  for (let i = 0; i < pixelCount; i++) {
    if (inRangeMask && inRangeMask[i] === 0) continue;
    const v = diffBuffer[i];
    const bin = Math.min(HIST_BINS - 1, Math.max(0, Math.floor((v / range) * HIST_BINS)));
    histogram[bin]++;

    const fineBin = Math.min(FINE_BINS - 1, Math.max(0, Math.floor((v / range) * FINE_BINS)));
    fineHist[fineBin]++;
  }

  // Calculate percentiles
  const p50Count = Math.floor(effectiveCount * 0.50);
  const p95Count = Math.floor(effectiveCount * 0.95);
  const p99Count = Math.floor(effectiveCount * 0.99);

  let cumulative = 0;
  let medianVal = 0;
  let p95Val = 0;
  let p99Val = 0;

  for (let b = 0; b < FINE_BINS; b++) {
    cumulative += fineHist[b];
    const binValue = (b + 0.5) * (range / FINE_BINS);
    if (medianVal === 0 && cumulative >= p50Count) medianVal = binValue;
    if (p95Val === 0 && cumulative >= p95Count) p95Val = binValue;
    if (p99Val === 0 && cumulative >= p99Count) p99Val = binValue;
  }

  // PSNR
  const mse = sumSquaredErr / effectiveCount;
  const isIdentical = untouchedCount === effectiveCount;
  const psnrDb = isIdentical ? 99.0 : mse > 0 ? 10.0 * Math.log10((255.0 * 255.0) / mse) : 99.0;

  const stats: ComparisonStats = {
    psnrDb: Math.round(psnrDb * 10) / 10,
    ssimMean: Math.round(ssimMean * 1000) / 1000,
    deltaE2000Mean: Math.round((sumDE2000 / effectiveCount) * 100) / 100,
    deltaE2000Max: Math.round(maxDE2000 * 100) / 100,
    visibleChangesPct: Math.round((visibleChangesCount / effectiveCount) * 1000) / 10,
    untouchedPixelsPct: Math.round((untouchedCount / effectiveCount) * 1000) / 10,
    meanAbsDiff: Math.round((sumAbsDiff / effectiveCount) * 10) / 10,
    minVal: Math.round(minVal * 100) / 100,
    maxVal: Math.round(maxVal * 100) / 100,
    meanVal: Math.round(meanVal * 100) / 100,
    medianVal: Math.round(medianVal * 100) / 100,
    p95Val: Math.round(p95Val * 100) / 100,
    p99Val: Math.round(p99Val * 100) / 100,
    histogram,
    compareWidth: width,
    compareHeight: height,
    computedAt: Date.now(),
    isIdentical,
    ...(isTonalFilterActive
      ? {
          tonalFilter: {
            min: tMin,
            max: tMax,
            channel: tChannel,
            matchingPixels,
            matchingPixelsPct: Math.round((matchingPixels / pixelCount) * 1000) / 10
          }
        }
      : {})
  };

  return { diffBuffer, stats };
}
