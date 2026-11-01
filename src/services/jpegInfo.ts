import { JpegInfo } from '../types';

const STD_LUMA_TABLE = [
  16, 11, 10, 16, 24,  40,  51,  61,
  12, 12, 14, 19, 26,  58,  60,  55,
  14, 13, 16, 24, 40,  57,  69,  56,
  14, 17, 22, 29, 51,  87,  80,  62,
  18, 22, 37, 56, 68,  109, 103, 77,
  24, 35, 55, 64, 81,  104, 113, 92,
  49, 64, 78, 87, 103, 121, 120, 101,
  72, 92, 95, 98, 112, 100, 103, 99
];

const STD_CHROMA_TABLE = [
  17, 18, 24, 47, 99, 99, 99, 99,
  18, 21, 26, 66, 99, 99, 99, 99,
  24, 26, 56, 99, 99, 99, 99, 99,
  47, 66, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99
];

const NATURAL_ORDER = [
  0,  1,  8, 16,  9,  2,  3, 10,
 17, 24, 32, 25, 18, 11,  4,  5,
 12, 19, 26, 33, 40, 48, 41, 34,
 27, 20, 13,  6,  7, 14, 21, 28,
 35, 42, 49, 56, 57, 50, 43, 36,
 29, 22, 15, 23, 30, 37, 44, 51,
 58, 59, 52, 45, 38, 31, 39, 46,
 53, 60, 61, 54, 47, 55, 62, 63
];

function ijgScaleTable(baseTable: number[], quality: number): number[] {
  const q = Math.max(1, Math.min(100, quality));
  const scale = q < 50 ? Math.floor(5000 / q) : 200 - q * 2;
  const out: number[] = new Array(64);
  for (let i = 0; i < 64; i++) {
    const v = Math.floor((baseTable[i] * scale + 50) / 100);
    out[i] = Math.max(1, Math.min(255, v));
  }
  return out;
}

function estimateTableQuality(observed: number[], baseTable: number[]): { quality: number; fitErrorPct: number } {
  let bestQ = 0;
  let bestErr = Number.MAX_VALUE;

  for (let q = 1; q <= 100; q++) {
    const predicted = ijgScaleTable(baseTable, q);
    let err = 0;
    for (let i = 0; i < 64; i++) {
      err += Math.abs(predicted[i] - observed[i]);
    }
    if (err < bestErr) {
      bestErr = err;
      bestQ = q;
    }
  }

  let meanObserved = 0;
  for (let i = 0; i < 64; i++) {
    meanObserved += observed[i];
  }
  meanObserved /= 64;
  const fitErrorPct = meanObserved > 0 ? (100.0 * (bestErr / 64) / meanObserved) : 0;

  return { quality: bestQ, fitErrorPct };
}

function getSubsamplingName(components: number, h0: number, v0: number, h1: number, v1: number): string {
  if (components === 1) return 'gray';
  if (h0 === h1 && v0 === v1) return '4:4:4';
  if (h0 === 2 * h1 && v0 === v1) return '4:2:2';
  if (h0 === 2 * h1 && v0 === 2 * v1) return '4:2:0';
  if (h0 === h1 && v0 === 2 * v1) return '4:4:0';
  if (h0 === 4 * h1 && v0 === v1) return '4:1:1';
  return `${h0}x${v0}:${h1}x${v1}`;
}

export function parseJpegInfo(buffer: ArrayBuffer): JpegInfo | null {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 4 || bytes[0] !== 0xFF || bytes[1] !== 0xD8) {
    return null; // Not a JPEG
  }

  const info: JpegInfo = {
    ok: false,
    progressive: false,
    width: 0,
    height: 0,
    components: 0,
    quantTables: 0,
    estimatedLumaQuality: 0,
    estimatedChromaQuality: 0,
    lumaFitErrorPct: 0,
    chromaFitErrorPct: 0,
    isCustomTable: false,
    subsampling: '?',
    hasExif: false,
    hasIcc: false,
    hasXmp: false,
    tables: []
  };

  const tables: (number[] | null)[] = [null, null, null, null];
  let lumaSlot = 0;
  let chromaSlot = 1;
  let h0 = 1, v0 = 1, h1 = 1, v1 = 1;

  let offset = 2;
  const len = bytes.length;

  while (offset + 4 < len) {
    if (bytes[offset] !== 0xFF) {
      offset++;
      continue;
    }

    // Skip fill bytes
    while (offset < len && bytes[offset] === 0xFF) {
      offset++;
    }
    if (offset >= len) break;

    const marker = bytes[offset++];
    if (marker === 0xD9 || marker === 0xDA) {
      // EOI or SOS (Start of Scan - image data begins)
      break;
    }
    // Standalone markers without length
    if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) {
      continue;
    }

    if (offset + 2 > len) break;
    const segLen = (bytes[offset] << 8) | bytes[offset + 1];
    if (segLen < 2 || offset + segLen > len) break;

    const segData = bytes.subarray(offset + 2, offset + segLen);

    // APP1: EXIF / XMP
    if (marker === 0xE1) {
      if (segData.length >= 6) {
        const tag = String.fromCharCode(...segData.subarray(0, 4));
        if (tag === 'Exif') {
          info.hasExif = true;
        } else {
          const str = String.fromCharCode(...segData.subarray(0, Math.min(30, segData.length)));
          if (str.includes('http://ns.adobe.com/xap') || str.includes('xmp')) {
            info.hasXmp = true;
          }
        }
      }
    }

    // APP2: ICC_PROFILE
    if (marker === 0xE2) {
      if (segData.length >= 12) {
        const tag = String.fromCharCode(...segData.subarray(0, 11));
        if (tag === 'ICC_PROFILE') {
          info.hasIcc = true;
        }
      }
    }

    // DQT: Define Quantization Table(s)
    if (marker === 0xDB) {
      let p = 0;
      while (p < segData.length) {
        const precision = segData[p] >> 4;
        const slot = segData[p] & 0x0F;
        p++;
        if (slot > 3) break;
        const entryBytes = precision !== 0 ? 2 : 1;
        if (p + 64 * entryBytes > segData.length) break;

        const table = new Array(64);
        for (let k = 0; k < 64; k++) {
          const naturalIdx = NATURAL_ORDER[k];
          if (precision !== 0) {
            table[naturalIdx] = (segData[p] << 8) | segData[p + 1];
            p += 2;
          } else {
            table[naturalIdx] = segData[p++];
          }
        }
        tables[slot] = table;
        info.quantTables++;
      }
    }

    // SOF0..SOF15 (except DHT 0xC4, JPG 0xC8, DAC 0xCC)
    const isSof = marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC;
    if (isSof && segData.length >= 6) {
      info.ok = true;
      // Progressive SOFs: SOF2 0xC2, SOF6 0xC6, SOF10 0xCA, SOF14 0xCE
      info.progressive = marker === 0xC2 || marker === 0xC6 || marker === 0xCA || marker === 0xCE;
      info.height = (segData[1] << 8) | segData[2];
      info.width = (segData[3] << 8) | segData[4];
      info.components = segData[5];

      for (let c = 0; c < info.components && c < 4; c++) {
        const at = 6 + c * 3;
        if (at + 2 >= segData.length) break;
        const hv = segData[at + 1];
        const h = Math.max(1, hv >> 4);
        const v = Math.max(1, hv & 0x0F);
        const slot = segData[at + 2] & 3;
        if (c === 0) {
          h0 = h;
          v0 = v;
          lumaSlot = slot;
        } else if (c === 1) {
          h1 = h;
          v1 = v;
          chromaSlot = slot;
        }
      }
    }

    offset += segLen;
  }

  if (info.ok) {
    info.subsampling = getSubsamplingName(info.components, h0, v0, h1, v1);

    if (tables[lumaSlot]) {
      const lumaEst = estimateTableQuality(tables[lumaSlot]!, STD_LUMA_TABLE);
      info.estimatedLumaQuality = lumaEst.quality;
      info.lumaFitErrorPct = Math.round(lumaEst.fitErrorPct * 10) / 10;
      if (lumaEst.fitErrorPct > 8.0) {
        info.isCustomTable = true;
      }
    }

    if (tables[chromaSlot]) {
      const chromaEst = estimateTableQuality(tables[chromaSlot]!, STD_CHROMA_TABLE);
      info.estimatedChromaQuality = chromaEst.quality;
      info.chromaFitErrorPct = Math.round(chromaEst.fitErrorPct * 10) / 10;
      if (chromaEst.fitErrorPct > 8.0) {
        info.isCustomTable = true;
      }
    }

    info.tables = tables.filter(t => t !== null) as number[][];
    return info;
  }

  return null;
}
