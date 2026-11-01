import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  BarChart3, 
  Video as VideoIcon, 
  Sliders, 
  Download, 
  HelpCircle,
  Play,
  RotateCcw,
  Sparkles,
  Activity,
  CheckCircle2,
  HardDrive,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  FileText,
  Layers,
  Zap,
  Target,
  Crop,
  Focus
} from 'lucide-react';
import { 
  MetricType, 
  ColorMapType, 
  HeatmapConfig, 
  ComparisonStats, 
  SlotMedia,
  VideoSamplePoint,
  SmartArtifactsConfig,
  ArtifactTelemetry,
  CropRegion
} from '../types';
import { COLORMAP_LABELS, getColormapCssGradient } from '../services/colormap';
import { RgbHistogramPanel } from './RgbHistogramPanel';
import { detectArtifacts, getArtifactPalette } from '../services/artifactDetection';

interface RightPanelProps {
  config: HeatmapConfig;
  onChangeConfig: (updates: Partial<HeatmapConfig>) => void;
  stats: ComparisonStats | null;
  activeSite: SlotMedia | null;
  original: SlotMedia | null;
  cropRegion?: CropRegion | null;
  onClearCrop?: () => void;
  onActivateCropTool?: () => void;
  onExportPng: () => void;
  onExportReport?: () => void;
  onOpenBatchProcessing?: () => void;
  isVideo: boolean;
  videoCurrentTime: number;
  videoDuration: number;
  onVideoSeek: (timeSec: number) => void;
  onVideoStep: (deltaSec: number) => void;
  onSampleVideoQuality: () => void;
  videoSamples: VideoSamplePoint[];
  isSamplingVideo: boolean;
  simpleMode?: boolean;
}

const METRIC_OPTIONS: { id: MetricType; name: string; unit: string; description: string }[] = [
  {
    id: 'delta_e2000',
    name: 'Colour diff ΔE2000',
    unit: 'ΔE',
    description: 'CIEDE2000 perceptual standard. ~1 is just noticeable, 2.3 is JND, >5 is obvious.'
  },
  {
    id: 'ssim',
    name: 'Structural loss (1 - SSIM)',
    unit: '1 - SSIM',
    description: 'Wang et al. 2004. Highlights blur, ringing and compression blockiness.'
  },
  {
    id: 'abs_diff',
    name: 'Absolute difference',
    unit: 'levels (0-255)',
    description: 'Max |after - before| over R, G, B. Shows every altered pixel.'
  },
  {
    id: 'luma_diff',
    name: 'Luma difference',
    unit: 'levels (0-255)',
    description: 'Rec.601 luma difference. Ignores chroma shifts.'
  },
  {
    id: 'delta_e76',
    name: 'Colour diff ΔE76',
    unit: 'ΔE',
    description: 'Euclidean distance in CIELAB space.'
  },
  {
    id: 'squared_error',
    name: 'Squared error',
    unit: 'levels²',
    description: 'Mean of squared channel differences. Root of PSNR calculation.'
  }
];

const COLORMAP_OPTIONS: ColorMapType[] = ['inferno', 'viridis', 'heat', 'ice', 'alert', 'gray'];

export const RightPanel: React.FC<RightPanelProps> = ({
  config,
  onChangeConfig,
  stats,
  activeSite,
  original,
  cropRegion,
  onClearCrop,
  onActivateCropTool,
  onExportPng,
  onExportReport,
  onOpenBatchProcessing,
  isVideo,
  videoCurrentTime,
  videoDuration,
  onVideoSeek,
  onVideoStep,
  onSampleVideoQuality,
  videoSamples,
  isSamplingVideo,
  simpleMode = false
}) => {
  const [activeTab, setActiveTab] = useState<'heatmap' | 'histogram' | 'stats' | 'video'>('heatmap');
  const [logHistogram, setLogHistogram] = useState(true);
  const [showAdvancedMath, setShowAdvancedMath] = useState(false);

  // Interpretation helper for PSNR
  const getPsnrInterpretation = (psnr: number) => {
    if (psnr >= 99.0) return 'Bit-identical (lossless)';
    if (psnr >= 45.0) return 'Visually lossless';
    if (psnr >= 35.0) return 'Good quality';
    if (psnr >= 30.0) return 'Minor artifacts';
    return 'Obvious degradation';
  };

  // Interpretation helper for SSIM
  const getSsimInterpretation = (ssim: number) => {
    if (ssim >= 0.999) return 'Identical structure';
    if (ssim >= 0.98) return 'Excellent structure';
    if (ssim >= 0.95) return 'Good similarity';
    if (ssim >= 0.90) return 'Fair structure';
    return 'Degraded textures & edges';
  };

  // Simple Mode overall score helper
  const getSimpleQualityScore = (ssim: number, psnr: number) => {
    if (ssim >= 0.98 && psnr >= 40) {
      return {
        label: 'Excellent Match',
        description: 'Hard to tell apart from the original even up close.',
        color: 'text-emerald-400',
        bg: 'bg-emerald-950/40 border-emerald-800/60'
      };
    }
    if (ssim >= 0.93 && psnr >= 34) {
      return {
        label: 'Good Social Web Quality',
        description: 'Light compression typical of Instagram or Discord.',
        color: 'text-blue-400',
        bg: 'bg-blue-950/40 border-blue-800/60'
      };
    }
    if (ssim >= 0.86) {
      return {
        label: 'Noticeably Compressed',
        description: 'Fine details, textures, or text edges softened.',
        color: 'text-amber-400',
        bg: 'bg-amber-950/40 border-amber-800/60'
      };
    }
    return {
      label: 'Heavy Quality Loss',
      description: 'Visible blur and blocky compression artifacts.',
      color: 'text-red-400',
      bg: 'bg-red-950/40 border-red-800/60'
    };
  };

  const currentScaleMax = config.autoScale 
    ? (stats ? stats.p99Val : config.manualMax) 
    : config.manualMax;

  // Smart Artifact Detection state
  const smartArtifacts: SmartArtifactsConfig = config.smartArtifacts || {
    enabled: false,
    mode: 'both',
    sensitivity: 0.5,
    radius: 3,
    highlightStyle: 'neon',
    overlayIntensity: 0.85
  };

  const [artifactTelemetry, setArtifactTelemetry] = useState<ArtifactTelemetry | null>(null);

  // Compute live artifact telemetry when smart artifacts tool is active
  useEffect(() => {
    if (!smartArtifacts.enabled || !original?.canvas || !activeSite?.canvas) {
      setArtifactTelemetry(null);
      return;
    }

    const w = activeSite.width || original.width;
    const h = activeSite.height || original.height;
    if (w <= 0 || h <= 0) return;

    try {
      const oCanvas = document.createElement('canvas');
      oCanvas.width = w;
      oCanvas.height = h;
      const oCtx = oCanvas.getContext('2d');

      const sCanvas = document.createElement('canvas');
      sCanvas.width = w;
      sCanvas.height = h;
      const sCtx = sCanvas.getContext('2d');

      if (!oCtx || !sCtx) return;

      oCtx.drawImage(original.canvas, 0, 0, w, h);
      const origPixels = oCtx.getImageData(0, 0, w, h).data;

      sCtx.drawImage(activeSite.canvas, 0, 0, w, h);
      const sitePixels = sCtx.getImageData(0, 0, w, h).data;

      const res = detectArtifacts(origPixels, sitePixels, w, h, smartArtifacts);
      setArtifactTelemetry(res.telemetry);
    } catch (e) {
      console.warn('Artifact telemetry calculation error:', e);
    }
  }, [
    smartArtifacts.enabled,
    smartArtifacts.sensitivity,
    smartArtifacts.radius,
    smartArtifacts.mode,
    original?.canvas,
    activeSite?.canvas,
    activeSite?.width,
    activeSite?.height,
    original?.width,
    original?.height
  ]);

  const updateSmartArtifacts = (updates: Partial<SmartArtifactsConfig>) => {
    onChangeConfig({
      smartArtifacts: {
        ...smartArtifacts,
        ...updates
      }
    });
  };

  const palette = getArtifactPalette(smartArtifacts.highlightStyle || 'neon');

  return (
    <aside className="w-80 h-full bg-neutral-900 border-l border-neutral-800 flex flex-col text-xs select-none z-10 overflow-hidden">
      {/* Tab navigation */}
      <div className="flex border-b border-neutral-800 bg-neutral-950/60 p-1 gap-1">
        <button
          onClick={() => setActiveTab('heatmap')}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded font-medium transition-all ${
            activeTab === 'heatmap'
              ? 'bg-neutral-800 text-blue-300 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
          title="Heat Map Controls & Tuning"
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Heat Map</span>
        </button>

        <button
          onClick={() => setActiveTab('histogram')}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded font-medium transition-all ${
            activeTab === 'histogram'
              ? 'bg-neutral-800 text-blue-300 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
          title="D3 RGB & Luma Histogram: identify clipping and posterization"
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Histogram</span>
        </button>

        <button
          onClick={() => setActiveTab('stats')}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded font-medium transition-all ${
            activeTab === 'stats'
              ? 'bg-neutral-800 text-blue-300 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
          title="Image-Wide Statistics"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Stats</span>
        </button>

        {isVideo && (
          <button
            onClick={() => setActiveTab('video')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded font-medium transition-all ${
              activeTab === 'video'
                ? 'bg-neutral-800 text-blue-300 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <VideoIcon className="w-3.5 h-3.5" />
            <span>Video</span>
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* ================= HEAT MAP TAB ================= */}
        {activeTab === 'heatmap' && (
          <div className="space-y-4">
            {/* Metric Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider flex items-center justify-between">
                <span>{simpleMode ? 'Comparison Mode' : 'Metric'}</span>
                <span className="text-neutral-500 font-normal lowercase">(Key: M)</span>
              </label>
              <select
                value={config.metric}
                onChange={e => onChangeConfig({ metric: e.target.value as MetricType })}
                className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1.5 text-neutral-200 text-xs outline-none focus:border-blue-500 cursor-pointer"
              >
                {METRIC_OPTIONS.map(m => {
                  let displayName = `${m.name} (${m.unit})`;
                  if (simpleMode) {
                    if (m.id === 'delta_e2000') displayName = 'Human Eye Color Match (Recommended)';
                    else if (m.id === 'ssim') displayName = 'Sharpness & Blur (Texture loss)';
                    else if (m.id === 'abs_diff') displayName = 'All Changed Pixels (Every edit)';
                    else if (m.id === 'luma_diff') displayName = 'Brightness Changes Only';
                    else if (m.id === 'delta_e76') displayName = 'Color Shift (Basic)';
                    else if (m.id === 'squared_error') displayName = 'Math Pixel Error (MSE)';
                  }
                  return (
                    <option key={m.id} value={m.id}>
                      {displayName}
                    </option>
                  );
                })}
              </select>
              <p className="text-[10px] text-neutral-500 leading-normal">
                {simpleMode ? (
                  config.metric === 'delta_e2000' ? 'Measures color differences exactly the way human eyes perceive them.' :
                  config.metric === 'ssim' ? 'Shows where compression blurred details or introduced blockiness.' :
                  config.metric === 'abs_diff' ? 'Highlights every single pixel that changed value.' :
                  METRIC_OPTIONS.find(m => m.id === config.metric)?.description
                ) : (
                  METRIC_OPTIONS.find(m => m.id === config.metric)?.description
                )}
              </p>
            </div>

            {/* Colormap Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider">
                Colour Ramp
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {COLORMAP_OPTIONS.map(c => {
                  const isSelected = config.colormap === c;
                  return (
                    <button
                      key={c}
                      onClick={() => onChangeConfig({ colormap: c })}
                      className={`flex flex-col p-1.5 rounded border text-left transition-all ${
                        isSelected
                          ? 'bg-neutral-950 border-blue-500 shadow-sm'
                          : 'bg-neutral-950/40 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-[10px] font-medium ${isSelected ? 'text-blue-300' : 'text-neutral-300'}`}>
                          {COLORMAP_LABELS[c]}
                        </span>
                      </div>
                      <div
                        className="h-2.5 w-full rounded-sm"
                        style={{ background: getColormapCssGradient(c) }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Legend Bar */}
            <div className="space-y-1 bg-neutral-950/60 p-2 rounded border border-neutral-800">
              <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
                <span>0.00</span>
                <span>Max: {currentScaleMax > 0 ? currentScaleMax.toFixed(2) : '1.0'}</span>
              </div>
              <div
                className="h-3.5 w-full rounded"
                style={{ background: getColormapCssGradient(config.colormap) }}
              />
              {stats && (
                <div className="flex justify-between text-[9px] text-neutral-500 pt-0.5">
                  <span>mean: {stats.meanVal}</span>
                  <span>p95: {stats.p95Val}</span>
                  <span>p99: {stats.p99Val}</span>
                </div>
              )}
            </div>

            {/* Intensity & Proportional */}
            <div className="space-y-2 bg-neutral-950/40 p-2.5 rounded border border-neutral-800">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-neutral-300 font-medium">
                  Overlay Intensity
                </span>
                <span className="text-[10px] font-mono text-neutral-400">
                  {Math.round(config.intensity * 100)}% (Key: [ / ])
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={config.intensity}
                onChange={e => onChangeConfig({ intensity: parseFloat(e.target.value) })}
                className="w-full accent-blue-500 h-1 bg-neutral-800 rounded appearance-none cursor-pointer"
              />

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.proportional}
                  onChange={e => onChangeConfig({ proportional: e.target.checked })}
                  className="accent-blue-500 w-3.5 h-3.5 rounded cursor-pointer"
                />
                <span className="text-[11px] text-neutral-300">
                  Opacity follows error (proportional)
                </span>
              </label>
            </div>

            {/* Scaling: Auto (p99) vs Manual */}
            <div className="space-y-2 bg-neutral-950/40 p-2.5 rounded border border-neutral-800">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.autoScale}
                    onChange={e => onChangeConfig({ autoScale: e.target.checked })}
                    className="accent-blue-500 w-3.5 h-3.5 rounded cursor-pointer"
                  />
                  <span className="text-[11px] text-neutral-300 font-medium">
                    Auto scale (99th percentile)
                  </span>
                </label>
                {stats && (
                  <span className="text-[10px] font-mono text-blue-400">
                    p99: {stats.p99Val}
                  </span>
                )}
              </div>

              {!config.autoScale && (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[10px] text-neutral-400">
                    <span>Manual Scale Max</span>
                    <span className="font-mono">{config.manualMax}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="0.5"
                    value={config.manualMax}
                    onChange={e => onChangeConfig({ manualMax: parseFloat(e.target.value) })}
                    className="w-full accent-blue-500 h-1 bg-neutral-800 rounded appearance-none cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Gamma & Threshold */}
            <div className="space-y-3 bg-neutral-950/40 p-2.5 rounded border border-neutral-800">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-neutral-300">
                  <span>Gamma curve</span>
                  <span className="text-[10px] font-mono text-neutral-400">
                    {config.gamma.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.25"
                  max="3.0"
                  step="0.05"
                  value={config.gamma}
                  onChange={e => onChangeConfig({ gamma: parseFloat(e.target.value) })}
                  className="w-full accent-blue-500 h-1 bg-neutral-800 rounded appearance-none cursor-pointer"
                />
                <span className="text-[9px] text-neutral-500 block">
                  &lt; 1.0 boosts faint subtle artifacts
                </span>
              </div>

              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[11px] text-neutral-300">
                  <span>Cut-off threshold</span>
                  <span className="text-[10px] font-mono text-neutral-400">
                    {(config.threshold * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.5"
                  step="0.01"
                  value={config.threshold}
                  onChange={e => onChangeConfig({ threshold: parseFloat(e.target.value) })}
                  className="w-full accent-blue-500 h-1 bg-neutral-800 rounded appearance-none cursor-pointer"
                />
              </div>

              {/* 8x8 Block View */}
              <div className="pt-1 border-t border-neutral-800/80">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.blockView}
                    onChange={e => onChangeConfig({ blockView: e.target.checked })}
                    className="accent-blue-500 w-3.5 h-3.5 rounded cursor-pointer"
                  />
                  <span className="text-[11px] text-neutral-300">
                    8×8 JPEG block view (Key: B)
                  </span>
                </label>
              </div>
            </div>

            {/* ================= SMART ARTIFACT DETECTION TOOL ================= */}
            <div className={`p-3 rounded-lg border transition-all ${
              smartArtifacts.enabled 
                ? 'bg-neutral-950 border-cyan-500/50 shadow-sm shadow-cyan-950/40' 
                : 'bg-neutral-950/40 border-neutral-800'
            }`}>
              {/* Tool Header & Master Switch */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                    smartArtifacts.enabled ? 'bg-cyan-500/20 text-cyan-400' : 'bg-neutral-850 text-neutral-400'
                  }`}>
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-neutral-200 flex items-center gap-1.5">
                      <span>Smart Artifact Detection</span>
                      {smartArtifacts.enabled && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                          CV Active
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-neutral-400">
                      Edge gradient & Gibbs ringing analyzer
                    </div>
                  </div>
                </div>

                {/* Toggle button */}
                <button
                  type="button"
                  onClick={() => updateSmartArtifacts({ enabled: !smartArtifacts.enabled })}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                    smartArtifacts.enabled ? 'bg-cyan-600' : 'bg-neutral-800'
                  }`}
                  title={smartArtifacts.enabled ? 'Disable Smart Artifact Detection' : 'Enable Smart Artifact Detection'}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      smartArtifacts.enabled ? 'translate-x-4.5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {smartArtifacts.enabled && (
                <div className="mt-3 pt-3 border-t border-neutral-800/80 space-y-3 animate-in fade-in duration-200">
                  {/* Target Mode Segmented Buttons */}
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-neutral-400 tracking-wider block mb-1.5">
                      Highlight Target Mode
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-neutral-900 p-0.5 rounded border border-neutral-800">
                      <button
                        type="button"
                        onClick={() => updateSmartArtifacts({ mode: 'both' })}
                        className={`py-1 rounded text-[10px] transition-all cursor-pointer ${
                          smartArtifacts.mode === 'both'
                            ? 'bg-neutral-800 text-white font-semibold shadow-xs'
                            : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        All Artifacts
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSmartArtifacts({ mode: 'ringing' })}
                        className={`py-1 rounded text-[10px] transition-all cursor-pointer ${
                          smartArtifacts.mode === 'ringing'
                            ? 'bg-neutral-800 text-rose-300 font-semibold shadow-xs'
                            : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                        title="Highlight Gibbs phenomenon ripples and mosquito noise halos around high-contrast edges"
                      >
                        Ringing Only
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSmartArtifacts({ mode: 'edges' })}
                        className={`py-1 rounded text-[10px] transition-all cursor-pointer ${
                          smartArtifacts.mode === 'edges'
                            ? 'bg-neutral-800 text-cyan-300 font-semibold shadow-xs'
                            : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                        title="Highlight high-contrast edge attenuation, blur, and chromatic distortion"
                      >
                        Edges Only
                      </button>
                    </div>
                  </div>

                  {/* Highlight Palette Scheme */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-semibold uppercase text-neutral-400 tracking-wider">
                        Overlay Palette
                      </label>
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className="flex items-center gap-1 font-mono">
                          <span 
                            className="w-2 h-2 rounded-xs inline-block" 
                            style={{ backgroundColor: `rgb(${palette.edgeRgb.join(',')})` }} 
                          />
                          <span className="text-neutral-400 text-[9px]">Edge</span>
                        </span>
                        <span className="flex items-center gap-1 font-mono">
                          <span 
                            className="w-2 h-2 rounded-xs inline-block" 
                            style={{ backgroundColor: `rgb(${palette.ringingRgb.join(',')})` }} 
                          />
                          <span className="text-neutral-400 text-[9px]">Ringing</span>
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1">
                      {(['neon', 'amber', 'cyber'] as const).map(styleKey => (
                        <button
                          key={styleKey}
                          type="button"
                          onClick={() => updateSmartArtifacts({ highlightStyle: styleKey })}
                          className={`px-2 py-1.5 rounded border text-[10px] capitalize font-medium flex items-center justify-between transition-all cursor-pointer ${
                            smartArtifacts.highlightStyle === styleKey
                              ? 'bg-neutral-900 border-cyan-500 text-cyan-200 shadow-xs'
                              : 'bg-neutral-900/40 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                          }`}
                        >
                          <span>{styleKey}</span>
                          <div className="flex gap-0.5">
                            <span 
                              className="w-2 h-2 rounded-full inline-block" 
                              style={{ backgroundColor: `rgb(${getArtifactPalette(styleKey).edgeRgb.join(',')})` }} 
                            />
                            <span 
                              className="w-2 h-2 rounded-full inline-block" 
                              style={{ backgroundColor: `rgb(${getArtifactPalette(styleKey).ringingRgb.join(',')})` }} 
                            />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Computer Vision Sliders */}
                  <div className="space-y-2 pt-0.5">
                    {/* Edge Sensitivity */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-neutral-300">Edge Gradient Sensitivity</span>
                        <span className="font-mono text-neutral-400">
                          {Math.round(smartArtifacts.sensitivity * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.05"
                        value={smartArtifacts.sensitivity}
                        onChange={e => updateSmartArtifacts({ sensitivity: parseFloat(e.target.value) })}
                        className="w-full accent-cyan-400 h-1 bg-neutral-800 rounded appearance-none cursor-pointer"
                      />
                    </div>

                    {/* Ringing Radius */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-neutral-300">Ringing Perimeter Radius</span>
                        <span className="font-mono text-neutral-400">
                          {smartArtifacts.radius} px
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="6"
                        step="1"
                        value={smartArtifacts.radius}
                        onChange={e => updateSmartArtifacts({ radius: parseInt(e.target.value, 10) })}
                        className="w-full accent-cyan-400 h-1 bg-neutral-800 rounded appearance-none cursor-pointer"
                      />
                    </div>

                    {/* Overlay Highlight Strength */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-neutral-300">Highlight Overlay Strength</span>
                        <span className="font-mono text-neutral-400">
                          {Math.round(smartArtifacts.overlayIntensity * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.2"
                        max="1.0"
                        step="0.05"
                        value={smartArtifacts.overlayIntensity}
                        onChange={e => updateSmartArtifacts({ overlayIntensity: parseFloat(e.target.value) })}
                        className="w-full accent-cyan-400 h-1 bg-neutral-800 rounded appearance-none cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Real-Time CV Telemetry Stats Box */}
                  {artifactTelemetry ? (
                    <div className="bg-neutral-900/90 rounded border border-neutral-800 p-2.5 space-y-1.5 text-[10px]">
                      <div className="flex items-center justify-between font-semibold text-neutral-300">
                        <span className="flex items-center gap-1 text-cyan-400">
                          <Zap className="w-3 h-3" />
                          Live CV Telemetry
                        </span>
                        <span className="font-mono text-neutral-500 text-[9px]">
                          {artifactTelemetry.totalEdgePixels.toLocaleString()} edge px
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-800/80">
                        <div className="bg-neutral-950 p-1.5 rounded">
                          <div className="text-neutral-400 text-[9px]">Edge Degradation</div>
                          <div className="font-mono font-bold text-cyan-300 text-xs mt-0.5">
                            {artifactTelemetry.edgeDegradationPct}%
                          </div>
                          <div className="text-neutral-500 text-[8px]">
                            {artifactTelemetry.degradedEdgePixels.toLocaleString()} softened edges
                          </div>
                        </div>

                        <div className="bg-neutral-950 p-1.5 rounded">
                          <div className="text-neutral-400 text-[9px]">Ringing / Gibbs Halo</div>
                          <div className="font-mono font-bold text-rose-400 text-xs mt-0.5">
                            {artifactTelemetry.ringingSeverityPct}%
                          </div>
                          <div className="text-neutral-500 text-[8px]">
                            {artifactTelemetry.ringingPixels.toLocaleString()} ripple pixels
                          </div>
                        </div>
                      </div>

                      <p className="text-[9px] text-neutral-400 pt-1 leading-tight">
                        Ringing appears around sharp contours (text, logos, hard silhouettes) due to 8×8 DCT high-frequency coefficient quantization.
                      </p>
                    </div>
                  ) : (
                    <div className="text-[10px] text-neutral-500 text-center py-1">
                      Load an original and target image to compute edge & ringing telemetry
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Export PNG button */}
            <button
              onClick={onExportPng}
              disabled={!stats}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Heat Map as PNG</span>
            </button>
          </div>
        )}

        {/* ================= RGB / LUMA HISTOGRAM TAB ================= */}
        {activeTab === 'histogram' && (
          <RgbHistogramPanel
            activeSite={activeSite}
            original={original}
            tonalFilter={config.tonalFilter}
            onChangeTonalFilter={tf => onChangeConfig({ tonalFilter: tf })}
            stats={stats}
          />
        )}

        {/* ================= STATISTICS TAB ================= */}
        {activeTab === 'stats' && (
          <div className="space-y-4">
            {/* Report, Batch & Crop Actions Banner */}
            <div className="flex items-center gap-1.5 p-1 bg-neutral-950 rounded-lg border border-neutral-800 shadow-xs">
              {onExportReport && (
                <button
                  onClick={onExportReport}
                  disabled={!stats}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-semibold transition-all ${
                    stats
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xs'
                      : 'bg-neutral-900 text-neutral-600 border border-neutral-800 cursor-not-allowed'
                  }`}
                  title="Export Professional PDF/CSV Report with thumbnails and comparison metrics"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Export Report</span>
                </button>
              )}
              {onOpenBatchProcessing && (
                <button
                  onClick={onOpenBatchProcessing}
                  className="flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-md text-xs font-medium bg-neutral-900 hover:bg-neutral-850 text-neutral-200 border border-neutral-800 transition-colors"
                  title="Open Batch Image Processing and Platform Benchmark"
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Batch</span>
                </button>
              )}
              {onActivateCropTool && !stats?.roi && (
                <button
                  onClick={onActivateCropTool}
                  disabled={!stats}
                  className="flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-md text-xs font-medium bg-neutral-900 hover:bg-cyan-950/60 text-cyan-300 hover:text-cyan-200 border border-neutral-800 hover:border-cyan-700/60 transition-colors cursor-pointer"
                  title="Crop Region of Interest to recalculate PSNR/SSIM on a specific area"
                >
                  <Crop className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Crop ROI</span>
                </button>
              )}
            </div>

            {/* Active Region of Interest (ROI) Alert Card */}
            {stats?.roi && (
              <div className="bg-cyan-950/40 border border-cyan-500/50 rounded-lg p-3 space-y-2 text-xs text-cyan-200 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-cyan-300">
                    <Focus className="w-4 h-4 text-cyan-400 animate-pulse" />
                    <span>Region of Interest (ROI) Active</span>
                  </div>
                  {onClearCrop && (
                    <button
                      onClick={onClearCrop}
                      className="px-2 py-0.5 rounded bg-cyan-900/70 hover:bg-cyan-800 text-cyan-100 border border-cyan-600/80 text-[10px] font-medium transition-colors cursor-pointer"
                    >
                      Reset to Full Image
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-cyan-200/90 leading-snug">
                  Metrics (PSNR, SSIM, ΔE) are computed exclusively on this cropped sub-region.
                </p>
                <div className="grid grid-cols-2 gap-1.5 bg-neutral-950/70 p-2 rounded border border-cyan-900/60 font-mono text-[10px]">
                  <div>
                    <span className="text-neutral-500 block text-[9px] uppercase">ROI Size</span>
                    <strong className="text-cyan-300">{stats.roi.width} × {stats.roi.height} px</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[9px] uppercase">Area Share</span>
                    <strong className="text-cyan-300">
                      {Math.max(1, Math.round(((stats.roi.width * stats.roi.height) / (stats.roi.fullWidth * stats.roi.fullHeight)) * 100))}% of total
                    </strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[9px] uppercase">Top-Left Offset</span>
                    <span className="text-neutral-300">({stats.roi.x}, {stats.roi.y})</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[9px] uppercase">Full Resolution</span>
                    <span className="text-neutral-300">{stats.roi.fullWidth} × {stats.roi.fullHeight}</span>
                  </div>
                </div>
              </div>
            )}

            {stats ? (
              simpleMode ? (
                /* Simple Mode: Plain-English Quality & Size Overview */
                <div className="space-y-3">
                  {(() => {
                    const score = getSimpleQualityScore(stats.ssimMean, stats.psnrDb);
                    const similarityPct = (stats.ssimMean * 100).toFixed(1);
                    const origSize = original?.fileSize || 0;
                    const siteSize = activeSite?.fileSize || 0;
                    const savedBytes = origSize > 0 && siteSize > 0 ? origSize - siteSize : 0;
                    const savedPct = origSize > 0 && siteSize > 0 ? Math.round((savedBytes / origSize) * 100) : null;

                    return (
                      <>
                        {/* Overall Quality Match Card */}
                        <div className={`p-3 rounded-lg border flex flex-col gap-1.5 ${score.bg}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">
                              Visual Fidelity
                            </span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-900/90 border border-neutral-700/60 ${score.color}`}>
                              {score.label}
                            </span>
                          </div>

                          <div className="flex items-baseline gap-2 my-1">
                            <span className={`text-3xl font-extrabold font-mono tracking-tight ${score.color}`}>
                              {similarityPct}%
                            </span>
                            <span className="text-xs text-neutral-300 font-medium">similarity to original</span>
                          </div>

                          <p className="text-[11px] text-neutral-300 leading-relaxed">
                            {score.description}
                          </p>
                        </div>

                        {/* File Size & Bandwidth Savings */}
                        <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800 space-y-2">
                          <div className="flex items-center gap-1.5 text-neutral-300 font-semibold text-[11px]">
                            <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                            <span>Storage & Bandwidth</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-center">
                            <div className="bg-neutral-900/80 p-2 rounded border border-neutral-800">
                              <div className="text-[10px] text-neutral-400">Original</div>
                              <div className="font-mono text-sm text-neutral-200 font-bold mt-0.5">
                                {origSize > 0 ? (origSize / 1024).toFixed(0) + ' KB' : '—'}
                              </div>
                            </div>
                            <div className="bg-neutral-900/80 p-2 rounded border border-neutral-800">
                              <div className="text-[10px] text-neutral-400">{activeSite?.siteName || 'Platform'}</div>
                              <div className="font-mono text-sm text-blue-400 font-bold mt-0.5">
                                {siteSize > 0 ? (siteSize / 1024).toFixed(0) + ' KB' : '—'}
                              </div>
                            </div>
                          </div>

                          {savedPct !== null && (
                            <div className="text-[11px] flex items-center justify-between px-1 text-neutral-300 pt-0.5">
                              <span>File size reduction:</span>
                              <span className={`font-semibold ${savedPct > 0 ? 'text-emerald-400' : 'text-neutral-400'}`}>
                                {savedPct > 0 ? `${savedPct}% space saved` : savedPct === 0 ? 'Same size' : `${Math.abs(savedPct)}% larger`}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Everyday Visual Breakdown */}
                        <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800 space-y-2 text-[11px]">
                          <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold block">
                            Human Perception Details
                          </span>

                          <div className="space-y-2 divide-y divide-neutral-800/80 text-neutral-300">
                            <div className="flex justify-between items-center pt-1">
                              <span className="text-neutral-400">Identical untouched pixels:</span>
                              <span className="font-semibold text-emerald-400 font-mono">{stats.untouchedPixelsPct}%</span>
                            </div>

                            <div className="flex justify-between items-center pt-1.5">
                              <span className="text-neutral-400">Noticeable color alterations:</span>
                              <span className={`font-semibold font-mono ${stats.visibleChangesPct < 10 ? 'text-blue-300' : 'text-amber-400'}`}>
                                {stats.visibleChangesPct}% of pixels
                              </span>
                            </div>

                            <div className="flex justify-between items-center pt-1.5">
                              <span className="text-neutral-400">Resolution / Dimensions:</span>
                              <span className="text-neutral-200 font-mono text-[10px]">
                                {original?.width === activeSite?.width && original?.height === activeSite?.height
                                  ? `Original kept (${original?.width}×${original?.height})`
                                  : `${original?.width}×${original?.height} → ${activeSite?.width}×${activeSite?.height}`}
                              </span>
                            </div>

                            <div className="flex justify-between items-center pt-1.5">
                              <span className="text-neutral-400">Camera & GPS privacy:</span>
                              <span className="text-neutral-300">
                                {activeSite?.jpegInfo?.hasExif ? (
                                  <span className="text-blue-300">Preserved</span>
                                ) : (
                                  <span className="text-emerald-400 flex items-center gap-1">
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    Safely removed
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Accordion toggle to show raw math if curious */}
                        <div className="pt-1">
                          <button
                            onClick={() => setShowAdvancedMath(!showAdvancedMath)}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-neutral-200 text-[11px] transition-colors"
                          >
                            <span>{showAdvancedMath ? 'Hide' : 'Show'} raw mathematical metrics (PSNR, ΔE)</span>
                            {showAdvancedMath ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </>
                    );
                  })()}

                  {/* Render technical cards when accordion is open */}
                  {showAdvancedMath && (
                    <div className="space-y-4 pt-2 border-t border-neutral-800">
                      {/* Headline Quality Numbers */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-neutral-950 p-2.5 rounded border border-neutral-800 flex flex-col">
                          <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">
                            PSNR
                          </span>
                          <span className="text-xl font-bold font-mono text-blue-400 my-0.5">
                            {stats.psnrDb} dB
                          </span>
                          <span className="text-[10px] text-neutral-500">
                            {getPsnrInterpretation(stats.psnrDb)}
                          </span>
                        </div>

                        <div className="bg-neutral-950 p-2.5 rounded border border-neutral-800 flex flex-col">
                          <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">
                            SSIM
                          </span>
                          <span className="text-xl font-bold font-mono text-emerald-400 my-0.5">
                            {stats.ssimMean.toFixed(3)}
                          </span>
                          <span className="text-[10px] text-neutral-500">
                            {getSsimInterpretation(stats.ssimMean)}
                          </span>
                        </div>
                      </div>

                      {/* Perceptual & Change Metrics */}
                      <div className="bg-neutral-950/70 rounded border border-neutral-800 divide-y divide-neutral-800/80 text-[11px]">
                        <div className="p-2 flex justify-between items-center">
                          <span className="text-neutral-400">ΔE2000 Mean / Max:</span>
                          <span className="font-mono text-neutral-200">
                            {stats.deltaE2000Mean} / {stats.deltaE2000Max}
                          </span>
                        </div>
                        <div className="p-2 flex justify-between items-center">
                          <span className="text-neutral-400">Visible Changes (ΔE &gt; 2.3):</span>
                          <span className="font-mono text-amber-300">
                            {stats.visibleChangesPct}% of pixels
                          </span>
                        </div>
                        <div className="p-2 flex justify-between items-center">
                          <span className="text-neutral-400">Untouched Pixels:</span>
                          <span className="font-mono text-emerald-400">
                            {stats.untouchedPixelsPct}%
                          </span>
                        </div>
                        <div className="p-2 flex justify-between items-center">
                          <span className="text-neutral-400">Mean Abs Difference:</span>
                          <span className="font-mono text-neutral-200">
                            {stats.meanAbsDiff} levels
                          </span>
                        </div>
                      </div>

                      {/* Percentiles & Min/Max */}
                      <div className="bg-neutral-950/70 p-2.5 rounded border border-neutral-800 space-y-1.5 text-[11px]">
                        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
                          Heat Map Distribution
                        </span>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-neutral-900 p-1.5 rounded">
                            <div className="text-[9px] text-neutral-500">Min</div>
                            <div className="font-mono text-neutral-300">{stats.minVal}</div>
                          </div>
                          <div className="bg-neutral-900 p-1.5 rounded">
                            <div className="text-[9px] text-neutral-500">Median (p50)</div>
                            <div className="font-mono text-neutral-300">{stats.medianVal}</div>
                          </div>
                          <div className="bg-neutral-900 p-1.5 rounded">
                            <div className="text-[9px] text-neutral-500">Max</div>
                            <div className="font-mono text-neutral-300">{stats.maxVal}</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-center pt-1">
                          <div className="bg-neutral-900 p-1.5 rounded">
                            <div className="text-[9px] text-neutral-500">95th %ile</div>
                            <div className="font-mono text-neutral-300">{stats.p95Val}</div>
                          </div>
                          <div className="bg-neutral-900 p-1.5 rounded">
                            <div className="text-[9px] text-neutral-500">99th %ile (Auto)</div>
                            <div className="font-mono text-blue-400 font-semibold">{stats.p99Val}</div>
                          </div>
                        </div>
                      </div>

                      {/* 64-bin Histogram */}
                      <div className="bg-neutral-950/70 p-2.5 rounded border border-neutral-800 space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                            Error Histogram
                          </span>
                          <button
                            onClick={() => setLogHistogram(!logHistogram)}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 hover:text-neutral-200"
                          >
                            {logHistogram ? 'Log scale' : 'Linear scale'}
                          </button>
                        </div>
                        <div className="h-16 w-full flex items-end gap-[1px] bg-neutral-900/80 p-1 rounded">
                          {(() => {
                            const maxCount = Math.max(...stats.histogram, 1);
                            return stats.histogram.map((count, i) => {
                              let hPct = 0;
                              if (count > 0) {
                                if (logHistogram) {
                                  hPct = (Math.log(count + 1) / Math.log(maxCount + 1)) * 100;
                                } else {
                                  hPct = (count / maxCount) * 100;
                                }
                              }
                              return (
                                <div
                                  key={i}
                                  className="flex-1 bg-blue-500/80 hover:bg-blue-400 transition-colors rounded-t-sm"
                                  style={{ height: `${Math.max(2, hPct)}%` }}
                                  title={`Bin ${i}: ${count} pixels`}
                                />
                              );
                            });
                          })()}
                        </div>
                      </div>

                      {/* Forensics comparison */}
                      <div className="bg-neutral-950/70 p-2.5 rounded border border-neutral-800 space-y-2 text-[11px]">
                        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                          Format & Compression Forensics
                        </span>

                        <div className="space-y-1.5 divide-y divide-neutral-800/80">
                          <div className="flex justify-between pt-1">
                            <span className="text-neutral-400">Dimensions:</span>
                            <span className="font-mono text-neutral-300">
                              {original?.width}×{original?.height} → {activeSite?.width}×{activeSite?.height}
                            </span>
                          </div>

                          <div className="flex justify-between pt-1">
                            <span className="text-neutral-400">Bytes:</span>
                            <span className="font-mono text-neutral-300">
                              {((original?.fileSize || 0) / 1024).toFixed(0)} KB → {((activeSite?.fileSize || 0) / 1024).toFixed(0)} KB
                            </span>
                          </div>

                          {activeSite?.jpegInfo && (
                            <>
                              <div className="flex justify-between pt-1">
                                <span className="text-neutral-400">Site JPEG Quality:</span>
                                <span className="font-mono text-blue-300">
                                  q{activeSite.jpegInfo.estimatedLumaQuality}
                                  {activeSite.jpegInfo.isCustomTable ? ' (custom table)' : ' (IJG table)'}
                                </span>
                              </div>

                              <div className="flex justify-between pt-1">
                                <span className="text-neutral-400">Subsampling:</span>
                                <span className="font-mono text-neutral-300">
                                  {activeSite.jpegInfo.subsampling} · {activeSite.jpegInfo.progressive ? 'Progressive' : 'Baseline'}
                                </span>
                              </div>

                              <div className="flex justify-between pt-1">
                                <span className="text-neutral-400">Metadata Survival:</span>
                                <span className="font-mono text-neutral-400">
                                  {activeSite.jpegInfo.hasExif || activeSite.jpegInfo.hasIcc ? (
                                    'Preserved'
                                  ) : (
                                    <span className="text-amber-400">none (stripped)</span>
                                  )}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Technical Mode: Full scientific metrics */
                <>
                  {/* Headline Quality Numbers */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-neutral-950 p-2.5 rounded border border-neutral-800 flex flex-col">
                      <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">
                        PSNR
                      </span>
                      <span className="text-xl font-bold font-mono text-blue-400 my-0.5">
                        {stats.psnrDb} dB
                      </span>
                      <span className="text-[10px] text-neutral-500">
                        {getPsnrInterpretation(stats.psnrDb)}
                      </span>
                    </div>

                    <div className="bg-neutral-950 p-2.5 rounded border border-neutral-800 flex flex-col">
                      <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">
                        SSIM
                      </span>
                      <span className="text-xl font-bold font-mono text-emerald-400 my-0.5">
                        {stats.ssimMean.toFixed(3)}
                      </span>
                      <span className="text-[10px] text-neutral-500">
                        {getSsimInterpretation(stats.ssimMean)}
                      </span>
                    </div>
                  </div>

                  {/* Perceptual & Change Metrics */}
                  <div className="bg-neutral-950/70 rounded border border-neutral-800 divide-y divide-neutral-800/80 text-[11px]">
                    <div className="p-2 flex justify-between items-center">
                      <span className="text-neutral-400">ΔE2000 Mean / Max:</span>
                      <span className="font-mono text-neutral-200">
                        {stats.deltaE2000Mean} / {stats.deltaE2000Max}
                      </span>
                    </div>
                    <div className="p-2 flex justify-between items-center">
                      <span className="text-neutral-400">Visible Changes (ΔE &gt; 2.3):</span>
                      <span className="font-mono text-amber-300">
                        {stats.visibleChangesPct}% of pixels
                      </span>
                    </div>
                    <div className="p-2 flex justify-between items-center">
                      <span className="text-neutral-400">Untouched Pixels:</span>
                      <span className="font-mono text-emerald-400">
                        {stats.untouchedPixelsPct}%
                      </span>
                    </div>
                    <div className="p-2 flex justify-between items-center">
                      <span className="text-neutral-400">Mean Abs Difference:</span>
                      <span className="font-mono text-neutral-200">
                        {stats.meanAbsDiff} levels
                      </span>
                    </div>
                  </div>

                  {/* Percentiles & Min/Max */}
                  <div className="bg-neutral-950/70 p-2.5 rounded border border-neutral-800 space-y-1.5 text-[11px]">
                    <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
                      Heat Map Distribution
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-neutral-900 p-1.5 rounded">
                        <div className="text-[9px] text-neutral-500">Min</div>
                        <div className="font-mono text-neutral-300">{stats.minVal}</div>
                      </div>
                      <div className="bg-neutral-900 p-1.5 rounded">
                        <div className="text-[9px] text-neutral-500">Median (p50)</div>
                        <div className="font-mono text-neutral-300">{stats.medianVal}</div>
                      </div>
                      <div className="bg-neutral-900 p-1.5 rounded">
                        <div className="text-[9px] text-neutral-500">Max</div>
                        <div className="font-mono text-neutral-300">{stats.maxVal}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center pt-1">
                      <div className="bg-neutral-900 p-1.5 rounded">
                        <div className="text-[9px] text-neutral-500">95th %ile</div>
                        <div className="font-mono text-neutral-300">{stats.p95Val}</div>
                      </div>
                      <div className="bg-neutral-900 p-1.5 rounded">
                        <div className="text-[9px] text-neutral-500">99th %ile (Auto)</div>
                        <div className="font-mono text-blue-400 font-semibold">{stats.p99Val}</div>
                      </div>
                    </div>
                  </div>

                  {/* 64-bin Histogram */}
                  <div className="bg-neutral-950/70 p-2.5 rounded border border-neutral-800 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                        Error Histogram
                      </span>
                      <button
                        onClick={() => setLogHistogram(!logHistogram)}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 hover:text-neutral-200"
                      >
                        {logHistogram ? 'Log scale' : 'Linear scale'}
                      </button>
                    </div>
                    <div className="h-16 w-full flex items-end gap-[1px] bg-neutral-900/80 p-1 rounded">
                      {(() => {
                        const maxCount = Math.max(...stats.histogram, 1);
                        return stats.histogram.map((count, i) => {
                          let hPct = 0;
                          if (count > 0) {
                            if (logHistogram) {
                              hPct = (Math.log(count + 1) / Math.log(maxCount + 1)) * 100;
                            } else {
                              hPct = (count / maxCount) * 100;
                            }
                          }
                          return (
                            <div
                              key={i}
                              className="flex-1 bg-blue-500/80 hover:bg-blue-400 transition-colors rounded-t-sm"
                              style={{ height: `${Math.max(2, hPct)}%` }}
                              title={`Bin ${i}: ${count} pixels`}
                            />
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* Forensics comparison */}
                  <div className="bg-neutral-950/70 p-2.5 rounded border border-neutral-800 space-y-2 text-[11px]">
                    <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                      Format & Compression Forensics
                    </span>

                    <div className="space-y-1.5 divide-y divide-neutral-800/80">
                      <div className="flex justify-between pt-1">
                        <span className="text-neutral-400">Dimensions:</span>
                        <span className="font-mono text-neutral-300">
                              {original?.width}×{original?.height} → {activeSite?.width}×{activeSite?.height}
                        </span>
                      </div>

                      <div className="flex justify-between pt-1">
                        <span className="text-neutral-400">Bytes:</span>
                        <span className="font-mono text-neutral-300">
                          {((original?.fileSize || 0) / 1024).toFixed(0)} KB → {((activeSite?.fileSize || 0) / 1024).toFixed(0)} KB
                        </span>
                      </div>

                      {activeSite?.jpegInfo && (
                        <>
                          <div className="flex justify-between pt-1">
                            <span className="text-neutral-400">Site JPEG Quality:</span>
                            <span className="font-mono text-blue-300">
                              q{activeSite.jpegInfo.estimatedLumaQuality}
                              {activeSite.jpegInfo.isCustomTable ? ' (custom table)' : ' (IJG table)'}
                            </span>
                          </div>

                          <div className="flex justify-between pt-1">
                            <span className="text-neutral-400">Subsampling:</span>
                            <span className="font-mono text-neutral-300">
                              {activeSite.jpegInfo.subsampling} · {activeSite.jpegInfo.progressive ? 'Progressive' : 'Baseline'}
                            </span>
                          </div>

                          <div className="flex justify-between pt-1">
                            <span className="text-neutral-400">Metadata Survival:</span>
                            <span className="font-mono text-neutral-400">
                              {activeSite.jpegInfo.hasExif || activeSite.jpegInfo.hasIcc ? (
                                'Preserved'
                              ) : (
                                <span className="text-amber-400">none (stripped)</span>
                              )}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )
            ) : (
              <div className="text-center py-12 text-neutral-500 space-y-2">
                <BarChart3 className="w-8 h-8 mx-auto text-neutral-600" />
                <p>Run comparison to generate statistics</p>
              </div>
            )}
          </div>
        )}

        {/* ================= VIDEO TAB ================= */}
        {activeTab === 'video' && isVideo && (
          <div className="space-y-4">
            {/* Timeline scrubber */}
            <div className="space-y-2 bg-neutral-950 p-2.5 rounded border border-neutral-800">
              <div className="flex justify-between text-[11px]">
                <span className="text-neutral-300 font-medium">Timeline</span>
                <span className="font-mono text-blue-400">
                  {videoCurrentTime.toFixed(2)}s / {videoDuration.toFixed(2)}s
                </span>
              </div>
              <input
                type="range"
                min="0"
                max={videoDuration || 1}
                step="0.04"
                value={videoCurrentTime}
                onChange={e => onVideoSeek(parseFloat(e.target.value))}
                className="w-full accent-blue-500 h-1.5 bg-neutral-800 rounded appearance-none cursor-pointer"
              />

              {/* Step buttons */}
              <div className="grid grid-cols-4 gap-1 pt-1">
                <button
                  onClick={() => onVideoStep(-1.0)}
                  className="py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px]"
                >
                  &lt;&lt; 1s
                </button>
                <button
                  onClick={() => onVideoStep(-0.04)}
                  className="py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px]"
                >
                  &lt; frame
                </button>
                <button
                  onClick={() => onVideoStep(0.04)}
                  className="py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px]"
                >
                  frame &gt;
                </button>
                <button
                  onClick={() => onVideoStep(1.0)}
                  className="py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px]"
                >
                  1s &gt;&gt;
                </button>
              </div>
            </div>

            {/* Sample Quality Over Time */}
            <div className="space-y-2 bg-neutral-950 p-2.5 rounded border border-neutral-800">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider">
                  Quality Over Time
                </span>
              </div>

              <button
                onClick={onSampleVideoQuality}
                disabled={isSamplingVideo}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-40"
              >
                <Sparkles className="w-3 h-3" />
                <span>{isSamplingVideo ? 'Sampling 8 frames...' : 'Sample Quality Over Time'}</span>
              </button>

              {/* Plots for PSNR and SSIM over time */}
              {videoSamples.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-neutral-400">
                      <span>PSNR over timeline (dB)</span>
                      <span className="font-mono text-blue-400">
                        avg: {(videoSamples.reduce((acc, s) => acc + s.psnr, 0) / videoSamples.length).toFixed(1)} dB
                      </span>
                    </div>
                    <div className="h-14 w-full bg-neutral-900 rounded p-1 flex items-end gap-1.5 relative border border-neutral-800">
                      {videoSamples.map((s, idx) => (
                        <div
                          key={idx}
                          className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                          onClick={() => onVideoSeek(s.timeSec)}
                        >
                          <div
                            className="w-full bg-blue-500 rounded-t-sm group-hover:bg-blue-400 transition-colors"
                            style={{ height: `${Math.min(100, Math.max(10, (s.psnr / 60) * 100))}%` }}
                          />
                          <div className="opacity-0 group-hover:opacity-100 absolute -top-6 bg-neutral-800 px-1 py-0.5 rounded text-[8px] text-white pointer-events-none z-20">
                            {s.psnr}dB
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-neutral-400">
                      <span>SSIM over timeline</span>
                      <span className="font-mono text-emerald-400">
                        avg: {(videoSamples.reduce((acc, s) => acc + s.ssim, 0) / videoSamples.length).toFixed(3)}
                      </span>
                    </div>
                    <div className="h-14 w-full bg-neutral-900 rounded p-1 flex items-end gap-1.5 relative border border-neutral-800">
                      {videoSamples.map((s, idx) => (
                        <div
                          key={idx}
                          className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                          onClick={() => onVideoSeek(s.timeSec)}
                        >
                          <div
                            className="w-full bg-emerald-500 rounded-t-sm group-hover:bg-emerald-400 transition-colors"
                            style={{ height: `${Math.min(100, Math.max(10, s.ssim * 100))}%` }}
                          />
                          <div className="opacity-0 group-hover:opacity-100 absolute -top-6 bg-neutral-800 px-1 py-0.5 rounded text-[8px] text-white pointer-events-none z-20">
                            {s.ssim.toFixed(3)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
