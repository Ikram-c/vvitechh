export type MetricType = 
  | 'abs_diff' 
  | 'luma_diff' 
  | 'delta_e76' 
  | 'delta_e2000' 
  | 'ssim' 
  | 'squared_error';

export type ColorMapType = 
  | 'inferno' 
  | 'viridis' 
  | 'heat' 
  | 'ice' 
  | 'alert' 
  | 'gray';

export type LayoutMode = 
  | 'loupe' 
  | 'left_right' 
  | 'top_bottom' 
  | 'split_lr' 
  | 'split_tb' 
  | 'survey';

export type LoupeSubMode = 
  | 'overlay' 
  | 'after' 
  | 'heat' 
  | 'before';

export interface JpegInfo {
  ok: boolean;
  progressive: boolean;
  width: number;
  height: number;
  components: number;
  quantTables: number;
  estimatedLumaQuality: number;
  estimatedChromaQuality: number;
  lumaFitErrorPct: number;
  chromaFitErrorPct: number;
  isCustomTable: boolean;
  subsampling: string;
  hasExif: boolean;
  hasIcc: boolean;
  hasXmp: boolean;
  tables?: number[][];
}

export interface SlotMedia {
  id: string;
  name: string;
  type: 'original' | 'site';
  siteName: string;
  siteNotes?: string;
  url?: string;
  file?: File;
  isVideo: boolean;
  videoDuration?: number;
  width: number;
  height: number;
  fileSize: number;
  format: string;
  imageData?: ImageData;
  canvas?: HTMLCanvasElement;
  thumbnailUrl?: string;
  jpegInfo?: JpegInfo;
  loading: boolean;
  error?: string;
  videoElement?: HTMLVideoElement;
}

export interface ComparisonStats {
  psnrDb: number;
  ssimMean: number;
  deltaE2000Mean: number;
  deltaE2000Max: number;
  visibleChangesPct: number; // Share of pixels with dE2000 > 2.3
  untouchedPixelsPct: number; // Bit-identical pixels
  meanAbsDiff: number;
  minVal: number;
  maxVal: number;
  meanVal: number;
  medianVal: number;
  p95Val: number;
  p99Val: number;
  histogram: number[]; // 64 bins
  compareWidth: number;
  compareHeight: number;
  computedAt: number;
  isIdentical: boolean;
  roi?: {
    x: number;
    y: number;
    width: number;
    height: number;
    fullWidth: number;
    fullHeight: number;
  };
  tonalFilter?: {
    min: number;
    max: number;
    channel: 'luma' | 'r' | 'g' | 'b';
    matchingPixels: number;
    matchingPixelsPct: number;
  };
}

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  active: boolean;
}

export interface TonalRangeFilter {
  min: number;
  max: number;
  active: boolean;
  channel: 'luma' | 'r' | 'g' | 'b';
}

export interface HeatmapResult {
  metric: MetricType;
  stats: ComparisonStats;
  diffBuffer: Float32Array; // raw metric value per pixel
  width: number;
  height: number;
  heatCanvas?: HTMLCanvasElement;
}

export interface SmartArtifactsConfig {
  enabled: boolean;
  mode: 'both' | 'ringing' | 'edges';
  sensitivity: number; // 0..1
  radius: number; // 1..6
  highlightStyle: 'neon' | 'amber' | 'cyber';
  overlayIntensity: number; // 0..1
}

export interface ArtifactTelemetry {
  totalEdgePixels: number;
  degradedEdgePixels: number;
  edgeDegradationPct: number;
  ringingPixels: number;
  ringingSeverityPct: number;
  computedAt: number;
}

export interface HeatmapConfig {
  metric: MetricType;
  colormap: ColorMapType;
  intensity: number; // 0..1
  proportional: boolean;
  autoScale: boolean;
  manualMax: number;
  gamma: number; // 0.25..3.0
  threshold: number; // 0..1
  blockView: boolean;
  overlayBase: 'site' | 'original';
  smartArtifacts?: SmartArtifactsConfig;
  tonalFilter?: TonalRangeFilter;
}

export interface ViewConfig {
  zoom: number; // 1.0 = 100%
  panX: number;
  panY: number;
  fitZoom: number;
  linkedFocus: boolean;
  showLoupe: boolean;
  loupeZoom: number;
  splitPos: number; // 0..1
  splitAngle: number; // 0 or 90
  swapped: boolean;
  loupeSubMode: LoupeSubMode;
}

export interface SiteDefinition {
  name: string;
  aliases: string[];
  hosts: string[];
  notes: string;
}

export interface VideoSamplePoint {
  timeSec: number;
  psnr: number;
  ssim: number;
}
