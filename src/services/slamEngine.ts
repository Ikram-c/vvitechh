import { JpegInfo } from '../types';
import { parseJpegInfo } from './jpegInfo';

export interface SlamPreset {
  id: string;
  name: string;
  platform: string;
  maxDimension: number;
  quality: number; // 0..1
  format: 'jpeg' | 'webp';
  simulateChromaSubsampling: boolean;
  applyPreSharpening: boolean;
  sharpenAmount: number; // 0..1
  stripMetadata: boolean;
  description: string;
  simpleDescription: string;
  badgeColor: string;
}

export const SLAM_PRESETS: SlamPreset[] = [
  {
    id: 'instagram',
    name: 'Instagram Feed',
    platform: 'Instagram',
    maxDimension: 1080,
    quality: 0.73,
    format: 'jpeg',
    simulateChromaSubsampling: true,
    applyPreSharpening: true,
    sharpenAmount: 0.28,
    stripMetadata: true,
    description: '1080px MozJPEG q73, 4:2:0 chroma subsampling, subtle edge enhancement, EXIF stripped',
    simpleDescription: 'Instagram standard 1080px photo with mobile data savings',
    badgeColor: 'from-pink-500 to-purple-600'
  },
  {
    id: 'twitter',
    name: 'X (Twitter) Web',
    platform: 'X (Twitter)',
    maxDimension: 2048,
    quality: 0.85,
    format: 'jpeg',
    simulateChromaSubsampling: true,
    applyPreSharpening: false,
    sharpenAmount: 0,
    stripMetadata: true,
    description: '2048px libjpeg-turbo q85, 4:2:0, sRGB color profile preserved, camera EXIF stripped',
    simpleDescription: 'Twitter/X high-res feed compression',
    badgeColor: 'from-sky-500 to-blue-600'
  },
  {
    id: 'facebook',
    name: 'Facebook HQ',
    platform: 'Facebook',
    maxDimension: 2048,
    quality: 0.77,
    format: 'jpeg',
    simulateChromaSubsampling: true,
    applyPreSharpening: true,
    sharpenAmount: 0.18,
    stripMetadata: true,
    description: '2048px JPEG q77, standard 4:2:0 subsampling, metadata stripped',
    simpleDescription: 'Facebook standard full-size upload',
    badgeColor: 'from-blue-600 to-indigo-700'
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Standard',
    platform: 'WhatsApp',
    maxDimension: 1600,
    quality: 0.74,
    format: 'jpeg',
    simulateChromaSubsampling: true,
    applyPreSharpening: false,
    sharpenAmount: 0,
    stripMetadata: true,
    description: '1600px aggressive JPEG q74, 4:2:0 chroma subsampling, chat bandwidth optimized',
    simpleDescription: 'WhatsApp chat photo (heavy compression)',
    badgeColor: 'from-emerald-500 to-green-600'
  },
  {
    id: 'reddit',
    name: 'Reddit Media',
    platform: 'Reddit',
    maxDimension: 1920,
    quality: 0.80,
    format: 'webp',
    simulateChromaSubsampling: true,
    applyPreSharpening: false,
    sharpenAmount: 0,
    stripMetadata: true,
    description: '1920px WebP q80, preview CDN re-encoding, EXIF stripped',
    simpleDescription: 'Reddit feed image preview',
    badgeColor: 'from-orange-500 to-red-600'
  },
  {
    id: 'discord',
    name: 'Discord CDN',
    platform: 'Discord',
    maxDimension: 1920,
    quality: 0.82,
    format: 'webp',
    simulateChromaSubsampling: false,
    applyPreSharpening: false,
    sharpenAmount: 0,
    stripMetadata: true,
    description: '1920px WebP q82 proxy preview cache',
    simpleDescription: 'Discord chat image preview',
    badgeColor: 'from-indigo-500 to-violet-600'
  },
  {
    id: 'threads',
    name: 'Threads Post',
    platform: 'Threads',
    maxDimension: 1080,
    quality: 0.73,
    format: 'jpeg',
    simulateChromaSubsampling: true,
    applyPreSharpening: true,
    sharpenAmount: 0.25,
    stripMetadata: true,
    description: '1080px Meta CDN MozJPEG pipeline, metadata stripped',
    simpleDescription: 'Threads post photo (Instagram-equivalent pipeline)',
    badgeColor: 'from-neutral-700 to-neutral-900'
  }
];

export interface SlamResult {
  canvas: HTMLCanvasElement;
  imageData: ImageData;
  blob: Blob;
  file: File;
  fileSize: number;
  width: number;
  height: number;
  format: string;
  thumbnailUrl: string;
  jpegInfo?: JpegInfo;
  preset: SlamPreset;
  pipelineLog: string[];
}

/**
 * Simulates 4:2:0 chroma subsampling in-place or on a buffer.
 * Converts RGB to YCbCr, averages Cb/Cr in 2x2 blocks, and converts back to RGB.
 */
function applyChromaSubsampling420(data: Uint8ClampedArray, width: number, height: number) {
  const ycbcr = new Float32Array(width * height * 3);

  // RGB -> YCbCr
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];

    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
    const cr = 0.5 * r - 0.418688 * g - 0.081312 * b + 128;

    ycbcr[i * 3] = y;
    ycbcr[i * 3 + 1] = cb;
    ycbcr[i * 3 + 2] = cr;
  }

  // 4:2:0 block averaging (2x2)
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      let sumCb = 0;
      let sumCr = 0;
      let count = 0;

      for (let dy = 0; dy < 2 && y + dy < height; dy++) {
        for (let dx = 0; dx < 2 && x + dx < width; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 3;
          sumCb += ycbcr[idx + 1];
          sumCr += ycbcr[idx + 2];
          count++;
        }
      }

      const avgCb = sumCb / count;
      const avgCr = sumCr / count;

      for (let dy = 0; dy < 2 && y + dy < height; dy++) {
        for (let dx = 0; dx < 2 && x + dx < width; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 3;
          ycbcr[idx + 1] = avgCb;
          ycbcr[idx + 2] = avgCr;
        }
      }
    }
  }

  // YCbCr -> RGB
  for (let i = 0; i < width * height; i++) {
    const y = ycbcr[i * 3];
    const cb = ycbcr[i * 3 + 1] - 128;
    const cr = ycbcr[i * 3 + 2] - 128;

    let r = y + 1.402 * cr;
    let g = y - 0.344136 * cb - 0.714136 * cr;
    let b = y + 1.772 * cb;

    data[i * 4] = Math.max(0, Math.min(255, Math.round(r)));
    data[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(g)));
    data[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(b)));
  }
}

/**
 * Applies a 3x3 unsharp mask filter to enhance edges before downsampling/compression
 * (standard Instagram & Meta pre-processing behavior)
 */
function applyUnsharpFilter(ctx: CanvasRenderingContext2D, width: number, height: number, amount: number) {
  if (amount <= 0) return;
  const imgData = ctx.getImageData(0, 0, width, height);
  const src = imgData.data;
  const dst = new Uint8ClampedArray(src.length);
  dst.set(src);

  // Kernel weights for unsharp mask
  // Center = 1 + 4*a, neighbors = -a
  const a = amount;
  const c = 1 + 4 * a;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;

      for (let ch = 0; ch < 3; ch++) {
        const top = ((y - 1) * width + x) * 4 + ch;
        const bottom = ((y + 1) * width + x) * 4 + ch;
        const left = (y * width + (x - 1)) * 4 + ch;
        const right = (y * width + (x + 1)) * 4 + ch;
        const center = idx + ch;

        const val = c * src[center] - a * (src[top] + src[bottom] + src[left] + src[right]);
        dst[center] = Math.max(0, Math.min(255, Math.round(val)));
      }
    }
  }

  ctx.putImageData(new ImageData(dst, width, height), 0, 0);
}

/**
 * Finds the best preset matching a site name or alias
 */
export function getPresetForSite(siteName: string): SlamPreset {
  const norm = siteName.toLowerCase().trim();
  const found = SLAM_PRESETS.find(p => 
    p.platform.toLowerCase() === norm || 
    p.id.toLowerCase() === norm ||
    norm.includes(p.id) ||
    p.platform.toLowerCase().includes(norm)
  );

  return found || SLAM_PRESETS[0]; // fallback to Instagram
}

/**
 * Runs the Lightweight SLAM (Social-media Loss Approximation Model)
 * Transforms an uncompressed or high-res image into the authentic social media version.
 */
export async function runSlamCompression(
  source: HTMLCanvasElement | ImageData,
  preset: SlamPreset,
  baseFileName: string = 'social_compressed'
): Promise<SlamResult> {
  const pipelineLog: string[] = [];

  // 1. Calculate target dimensions respecting social platform constraints
  let srcW = source.width;
  let srcH = source.height;
  let targetW = srcW;
  let targetH = srcH;

  const maxDim = preset.maxDimension;
  if (srcW > maxDim || srcH > maxDim) {
    if (srcW >= srcH) {
      targetW = maxDim;
      targetH = Math.max(1, Math.round((srcH / srcW) * maxDim));
    } else {
      targetH = maxDim;
      targetW = Math.max(1, Math.round((srcW / srcH) * maxDim));
    }
    pipelineLog.push(`Rescaled from ${srcW}×${srcH} to ${targetW}×${targetH} px (max ${maxDim}px constraint)`);
  } else {
    pipelineLog.push(`Kept resolution at ${targetW}×${targetH} px (within ${maxDim}px cap)`);
  }

  // 2. High-quality downsampling canvas
  const workCanvas = document.createElement('canvas');
  workCanvas.width = targetW;
  workCanvas.height = targetH;
  const ctx = workCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Failed to create canvas context');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (source instanceof HTMLCanvasElement) {
    ctx.drawImage(source, 0, 0, targetW, targetH);
  } else {
    // source is ImageData
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = srcW;
    tempCanvas.height = srcH;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.putImageData(source, 0, 0);
      ctx.drawImage(tempCanvas, 0, 0, targetW, targetH);
    }
  }

  // 3. Pre-sharpening (simulates Instagram/Meta edge enhancement pass)
  if (preset.applyPreSharpening && preset.sharpenAmount > 0) {
    applyUnsharpFilter(ctx, targetW, targetH, preset.sharpenAmount);
    pipelineLog.push(`Applied pre-sharpening filter (kernel strength: ${preset.sharpenAmount})`);
  }

  // 4. Chroma Subsampling 4:2:0 simulation
  if (preset.simulateChromaSubsampling && preset.format === 'jpeg') {
    const rawData = ctx.getImageData(0, 0, targetW, targetH);
    applyChromaSubsampling420(rawData.data, targetW, targetH);
    ctx.putImageData(rawData, 0, 0);
    pipelineLog.push('Simulated 4:2:0 YCbCr chroma subsampling (2×2 color decimation)');
  }

  // 5. Encode to simulated platform format & quality
  const mimeType = preset.format === 'webp' ? 'image/webp' : 'image/jpeg';
  pipelineLog.push(`Re-encoded as ${preset.format.toUpperCase()} at quality factor ~${Math.round(preset.quality * 100)}%`);

  const blob: Blob = await new Promise((resolve, reject) => {
    workCanvas.toBlob(
      b => {
        if (b) resolve(b);
        else reject(new Error('Failed to export canvas to blob'));
      },
      mimeType,
      preset.quality
    );
  });

  if (preset.stripMetadata) {
    pipelineLog.push('Sanitized all EXIF camera tags, GPS location, and ICC profiles (privacy stripping)');
  }

  // 6. Decode back into memory so we have exact compressed pixels + parse JPEG forensics
  const fileExt = preset.format === 'webp' ? 'webp' : 'jpg';
  const cleanBaseName = baseFileName.replace(/\.[^/.]+$/, '');
  const outFileName = `${cleanBaseName}_${preset.id}.${fileExt}`;
  const file = new File([blob], outFileName, { type: mimeType });

  const arrayBuf = await blob.arrayBuffer();
  let jpegInfo = undefined;
  if (preset.format === 'jpeg') {
    try {
      jpegInfo = parseJpegInfo(arrayBuf) || undefined;
    } catch {
      // non-fatal
    }
  }

  // Final canvas with exact post-compression pixels
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = targetW;
  finalCanvas.height = targetH;
  const finalCtx = finalCanvas.getContext('2d');

  const finalImg = new Image();
  const blobUrl = URL.createObjectURL(blob);

  await new Promise<void>((resolve, reject) => {
    finalImg.onload = () => {
      if (finalCtx) {
        finalCtx.drawImage(finalImg, 0, 0);
      }
      resolve();
    };
    finalImg.onerror = reject;
    finalImg.src = blobUrl;
  });

  URL.revokeObjectURL(blobUrl);

  const finalImageData = finalCtx?.getImageData(0, 0, targetW, targetH) || 
    ctx.getImageData(0, 0, targetW, targetH);

  const thumbUrl = finalCanvas.toDataURL('image/jpeg', 0.85);

  return {
    canvas: finalCanvas,
    imageData: finalImageData,
    blob,
    file,
    fileSize: blob.size,
    width: targetW,
    height: targetH,
    format: fileExt,
    thumbnailUrl: thumbUrl,
    jpegInfo,
    preset,
    pipelineLog
  };
}
