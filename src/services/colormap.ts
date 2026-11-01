import { ColorMapType } from '../types';

interface Stop {
  t: number;
  r: number;
  g: number;
  b: number;
}

const INFERNO_STOPS: Stop[] = [
  { t: 0.00, r: 0.001, g: 0.000, b: 0.014 },
  { t: 0.13, r: 0.098, g: 0.033, b: 0.234 },
  { t: 0.25, r: 0.259, g: 0.039, b: 0.406 },
  { t: 0.38, r: 0.425, g: 0.099, b: 0.432 },
  { t: 0.50, r: 0.578, g: 0.148, b: 0.404 },
  { t: 0.63, r: 0.735, g: 0.215, b: 0.330 },
  { t: 0.75, r: 0.865, g: 0.316, b: 0.226 },
  { t: 0.88, r: 0.955, g: 0.485, b: 0.083 },
  { t: 0.95, r: 0.988, g: 0.647, b: 0.040 },
  { t: 1.00, r: 0.988, g: 0.998, b: 0.645 }
];

const VIRIDIS_STOPS: Stop[] = [
  { t: 0.00, r: 0.267, g: 0.005, b: 0.329 },
  { t: 0.13, r: 0.282, g: 0.140, b: 0.458 },
  { t: 0.25, r: 0.254, g: 0.265, b: 0.530 },
  { t: 0.38, r: 0.207, g: 0.372, b: 0.553 },
  { t: 0.50, r: 0.164, g: 0.471, b: 0.558 },
  { t: 0.63, r: 0.128, g: 0.567, b: 0.551 },
  { t: 0.75, r: 0.135, g: 0.659, b: 0.518 },
  { t: 0.88, r: 0.267, g: 0.749, b: 0.441 },
  { t: 0.95, r: 0.478, g: 0.821, b: 0.318 },
  { t: 1.00, r: 0.993, g: 0.906, b: 0.144 }
];

const HEAT_STOPS: Stop[] = [
  { t: 0.00, r: 0.0, g: 0.0, b: 0.0 },
  { t: 0.35, r: 0.75, g: 0.05, b: 0.0 },
  { t: 0.70, r: 1.0, g: 0.75, b: 0.0 },
  { t: 1.00, r: 1.0, g: 1.0, b: 1.0 }
];

const ICE_STOPS: Stop[] = [
  { t: 0.00, r: 0.02, g: 0.02, b: 0.10 },
  { t: 0.40, r: 0.05, g: 0.30, b: 0.75 },
  { t: 0.75, r: 0.30, g: 0.80, b: 1.00 },
  { t: 1.00, r: 1.00, g: 1.00, b: 1.00 }
];

const ALERT_STOPS: Stop[] = [
  { t: 0.00, r: 0.15, g: 0.0, b: 0.0 },
  { t: 1.00, r: 1.00, g: 0.05, b: 0.05 }
];

const GRAY_STOPS: Stop[] = [
  { t: 0.00, r: 0.0, g: 0.0, b: 0.0 },
  { t: 1.00, r: 1.0, g: 1.0, b: 1.0 }
];

const COLORMAP_MAP: Record<ColorMapType, Stop[]> = {
  inferno: INFERNO_STOPS,
  viridis: VIRIDIS_STOPS,
  heat: HEAT_STOPS,
  ice: ICE_STOPS,
  alert: ALERT_STOPS,
  gray: GRAY_STOPS
};

export const COLORMAP_LABELS: Record<ColorMapType, string> = {
  inferno: 'Inferno',
  viridis: 'Viridis',
  heat: 'Heat',
  ice: 'Ice',
  alert: 'Red alert',
  gray: 'Grayscale'
};

export function evaluateColormap(stops: Stop[], t: number): [number, number, number] {
  const u = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i + 2 < stops.length && u > stops[i + 1].t) {
    i++;
  }
  const a = stops[i];
  const b = stops[i + 1];
  const factor = b.t > a.t ? (u - a.t) / (b.t - a.t) : 0;
  return [
    Math.round(255 * (a.r + (b.r - a.r) * factor)),
    Math.round(255 * (a.g + (b.g - a.g) * factor)),
    Math.round(255 * (a.b + (b.b - a.b) * factor))
  ];
}

export function getColorAt(colormap: ColorMapType, t: number): [number, number, number] {
  const stops = COLORMAP_MAP[colormap] || INFERNO_STOPS;
  return evaluateColormap(stops, t);
}

// Precomputed 256-entry Uint8Array LUT for each colormap [R, G, B, R, G, B, ...]
const PRECOMPUTED_LUTS: Record<ColorMapType, Uint8Array> = {} as any;

export function getColormapLUT(colormap: ColorMapType): Uint8Array {
  if (PRECOMPUTED_LUTS[colormap]) {
    return PRECOMPUTED_LUTS[colormap];
  }
  const stops = COLORMAP_MAP[colormap] || INFERNO_STOPS;
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const [r, g, b] = evaluateColormap(stops, t);
    lut[i * 3] = r;
    lut[i * 3 + 1] = g;
    lut[i * 3 + 2] = b;
  }
  PRECOMPUTED_LUTS[colormap] = lut;
  return lut;
}

export function getColormapCssGradient(colormap: ColorMapType): string {
  const stops = COLORMAP_MAP[colormap] || INFERNO_STOPS;
  const gradientStops = stops.map(s => {
    const r = Math.round(s.r * 255);
    const g = Math.round(s.g * 255);
    const b = Math.round(s.b * 255);
    const pct = Math.round(s.t * 100);
    return `rgb(${r},${g},${b}) ${pct}%`;
  });
  return `linear-gradient(to right, ${gradientStops.join(', ')})`;
}
