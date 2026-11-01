import { SmartArtifactsConfig, ArtifactTelemetry } from '../types';

export interface ArtifactDetectionResult {
  edgeMask: Uint8Array; // 0..255 strength of edge degradation
  ringingMask: Uint8Array; // 0..255 strength of ringing artifact
  telemetry: ArtifactTelemetry;
}

/**
 * Fast separable 1D box dilation for binary/grayscale mask
 */
function dilateMask(src: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const temp = new Uint8Array(width * height);
  const dst = new Uint8Array(width * height);

  // Horizontal dilation pass
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      let maxVal = 0;
      const xStart = Math.max(0, x - radius);
      const xEnd = Math.min(width - 1, x + radius);
      for (let kx = xStart; kx <= xEnd; kx++) {
        const v = src[rowOffset + kx];
        if (v > maxVal) {
          maxVal = v;
          if (maxVal === 255) break;
        }
      }
      temp[rowOffset + x] = maxVal;
    }
  }

  // Vertical dilation pass
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let maxVal = 0;
      const yStart = Math.max(0, y - radius);
      const yEnd = Math.min(height - 1, y + radius);
      for (let ky = yStart; ky <= yEnd; ky++) {
        const v = temp[ky * width + x];
        if (v > maxVal) {
          maxVal = v;
          if (maxVal === 255) break;
        }
      }
      dst[y * width + x] = maxVal;
    }
  }

  return dst;
}

/**
 * Computer Vision Algorithm to detect high-contrast edges and ringing artifacts (Gibbs phenomenon)
 */
export function detectArtifacts(
  origPixels: Uint8ClampedArray,
  sitePixels: Uint8ClampedArray,
  width: number,
  height: number,
  config: SmartArtifactsConfig
): ArtifactDetectionResult {
  const pixelCount = width * height;
  const edgeMask = new Uint8Array(pixelCount);
  const ringingMask = new Uint8Array(pixelCount);

  // 1. Compute Luminance for original and site
  const yOrig = new Float32Array(pixelCount);
  const ySite = new Float32Array(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    yOrig[i] = 0.299 * origPixels[idx] + 0.587 * origPixels[idx + 1] + 0.114 * origPixels[idx + 2];
    ySite[i] = 0.299 * sitePixels[idx] + 0.587 * sitePixels[idx + 1] + 0.114 * sitePixels[idx + 2];
  }

  // 2. Compute Sobel gradient magnitude for original and site
  const gOrig = new Float32Array(pixelCount);
  const gSite = new Float32Array(pixelCount);

  // Sensitivity scales edge threshold: higher sensitivity detects more subtle edges
  const sensitivity = Math.max(0.1, Math.min(1.0, config.sensitivity ?? 0.5));
  const edgeThreshold = 95 - sensitivity * 65; // ~30..90 range
  const ringingErrorMin = 18 - sensitivity * 14; // ~4..18 luminance delta

  const strongEdgeMap = new Uint8Array(pixelCount);
  let totalEdgePixels = 0;
  let degradedEdgePixels = 0;

  for (let y = 1; y < height - 1; y++) {
    const prevRow = (y - 1) * width;
    const currRow = y * width;
    const nextRow = (y + 1) * width;

    for (let x = 1; x < width - 1; x++) {
      const idx = currRow + x;

      // Sobel Original
      const gxO = 
        -yOrig[prevRow + x - 1] + yOrig[prevRow + x + 1]
        -2 * yOrig[currRow + x - 1] + 2 * yOrig[currRow + x + 1]
        -yOrig[nextRow + x - 1] + yOrig[nextRow + x + 1];

      const gyO = 
        -yOrig[prevRow + x - 1] - 2 * yOrig[prevRow + x] - yOrig[prevRow + x + 1]
        +yOrig[nextRow + x - 1] + 2 * yOrig[nextRow + x] + yOrig[nextRow + x + 1];

      const magO = Math.sqrt(gxO * gxO + gyO * gyO) * 0.25;
      gOrig[idx] = magO;

      // Sobel Site
      const gxS = 
        -ySite[prevRow + x - 1] + ySite[prevRow + x + 1]
        -2 * ySite[currRow + x - 1] + 2 * ySite[currRow + x + 1]
        -ySite[nextRow + x - 1] + ySite[nextRow + x + 1];

      const gyS = 
        -ySite[prevRow + x - 1] - 2 * ySite[prevRow + x] - ySite[prevRow + x + 1]
        +ySite[nextRow + x - 1] + 2 * ySite[nextRow + x] + ySite[nextRow + x + 1];

      const magS = Math.sqrt(gxS * gxS + gyS * gyS) * 0.25;
      gSite[idx] = magS;

      // Strong Edge Classification
      if (magO >= edgeThreshold) {
        strongEdgeMap[idx] = 255;
        totalEdgePixels++;

        // Edge degradation: blur, loss of gradient steepness, or color fringe directly on edge
        const gradientDrop = magO - magS;
        const absLumaErr = Math.abs(ySite[idx] - yOrig[idx]);

        if (gradientDrop > 6 || absLumaErr > 8) {
          degradedEdgePixels++;
          const edgeScore = Math.min(255, Math.round(Math.max(gradientDrop * 3, absLumaErr * 4)));
          edgeMask[idx] = edgeScore;
        }
      }
    }
  }

  // 3. Dilate strong edges to identify the perimeter zone where ringing / Gibbs oscillations live
  const radius = Math.max(1, Math.min(6, config.radius ?? 3));
  const dilatedEdgeZone = dilateMask(strongEdgeMap, width, height, radius);

  // 4. Detect Ringing Artifacts in the perimeter zone (Dilation \ Edge)
  let ringingPixelCount = 0;
  let perimeterZoneCount = 0;

  for (let y = 1; y < height - 1; y++) {
    const rowOffset = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = rowOffset + x;

      // Must be in the perimeter zone of a strong edge, but NOT on the edge itself
      if (dilatedEdgeZone[idx] > 0 && strongEdgeMap[idx] === 0) {
        perimeterZoneCount++;

        // Ringing occurs where original is relatively smooth, but site exhibits error / ripple
        const origGrad = gOrig[idx];
        const isOriginalFlatEnough = origGrad < edgeThreshold * 0.75;

        if (isOriginalFlatEnough) {
          const lumaDelta = Math.abs(ySite[idx] - yOrig[idx]);
          const siteGrad = gSite[idx];
          
          // Ringing condition: significant error + artificial gradient or ripple induced by DCT quantization
          const isRinging = lumaDelta > ringingErrorMin && (siteGrad > origGrad + 2 || lumaDelta > ringingErrorMin * 1.5);

          if (isRinging) {
            ringingPixelCount++;
            // Normalize ringing intensity
            const intensity = Math.min(255, Math.round((lumaDelta / 45) * 255));
            ringingMask[idx] = Math.max(120, intensity);
          }
        }
      }
    }
  }

  const edgeDegradationPct = totalEdgePixels > 0 
    ? Math.round((degradedEdgePixels / totalEdgePixels) * 1000) / 10 
    : 0;

  const ringingSeverityPct = perimeterZoneCount > 0 
    ? Math.round((ringingPixelCount / perimeterZoneCount) * 1000) / 10 
    : 0;

  const telemetry: ArtifactTelemetry = {
    totalEdgePixels,
    degradedEdgePixels,
    edgeDegradationPct,
    ringingPixels: ringingPixelCount,
    ringingSeverityPct,
    computedAt: Date.now()
  };

  return {
    edgeMask,
    ringingMask,
    telemetry
  };
}

/**
 * Palette colors for Smart Artifact Highlights
 */
export function getArtifactPalette(style: 'neon' | 'amber' | 'cyber'): {
  edgeRgb: [number, number, number];
  edgeName: string;
  ringingRgb: [number, number, number];
  ringingName: string;
} {
  switch (style) {
    case 'amber':
      return {
        edgeRgb: [250, 204, 21], // Vivid Golden Yellow
        edgeName: 'Edge Drift (Amber)',
        ringingRgb: [239, 68, 68], // Bright Crimson Red
        ringingName: 'Ringing Ripple (Crimson)'
      };
    case 'cyber':
      return {
        edgeRgb: [168, 85, 247], // Electric Violet / Purple
        edgeName: 'Edge Drift (Violet)',
        ringingRgb: [34, 197, 94], // Neon Fluorescent Green
        ringingName: 'Ringing Ripple (Lime)'
      };
    case 'neon':
    default:
      return {
        edgeRgb: [6, 182, 212], // Electric Cyan
        edgeName: 'Edge Drift (Cyan)',
        ringingRgb: [244, 63, 94], // Vivid Hot Pink / Rose
        ringingName: 'Ringing Ripple (Magenta)'
      };
  }
}

/**
 * Overlays computer vision detected edges and ringing artifacts onto the Heatmap canvas pixels
 */
export function overlayArtifactsOnHeatmap(
  heatData: Uint8ClampedArray,
  edgeMask: Uint8Array,
  ringingMask: Uint8Array,
  width: number,
  height: number,
  config: SmartArtifactsConfig
): void {
  const pixelCount = width * height;
  const mode = config.mode || 'both';
  const showEdges = mode === 'both' || mode === 'edges';
  const showRinging = mode === 'both' || mode === 'ringing';
  const alphaFactor = Math.max(0.1, Math.min(1.0, config.overlayIntensity ?? 0.85));

  const palette = getArtifactPalette(config.highlightStyle || 'neon');
  const [er, eg, eb] = palette.edgeRgb;
  const [rr, rg, rb] = palette.ringingRgb;

  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    const rVal = showRinging ? ringingMask[i] : 0;
    const eVal = showEdges ? edgeMask[i] : 0;

    if (rVal === 0 && eVal === 0) continue;

    const baseAlpha = heatData[idx + 3] / 255.0;

    // Ringing gets highest priority if present in perimeter
    if (rVal > 0) {
      const ringStrength = (rVal / 255.0) * alphaFactor;
      
      // Blend with underlying heatmap or make opaque
      const outAlpha = Math.max(baseAlpha, ringStrength);
      heatData[idx] = Math.round(heatData[idx] * (1 - ringStrength) + rr * ringStrength);
      heatData[idx + 1] = Math.round(heatData[idx + 1] * (1 - ringStrength) + rg * ringStrength);
      heatData[idx + 2] = Math.round(heatData[idx + 2] * (1 - ringStrength) + rb * ringStrength);
      heatData[idx + 3] = Math.round(Math.max(200, outAlpha * 255));
    } else if (eVal > 0) {
      const edgeStrength = (eVal / 255.0) * alphaFactor * 0.9;
      
      const outAlpha = Math.max(baseAlpha, edgeStrength);
      heatData[idx] = Math.round(heatData[idx] * (1 - edgeStrength) + er * edgeStrength);
      heatData[idx + 1] = Math.round(heatData[idx + 1] * (1 - edgeStrength) + eg * edgeStrength);
      heatData[idx + 2] = Math.round(heatData[idx + 2] * (1 - edgeStrength) + eb * edgeStrength);
      heatData[idx + 3] = Math.round(Math.max(190, outAlpha * 255));
    }
  }
}
