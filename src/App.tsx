import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  SlotMedia, 
  HeatmapConfig, 
  ViewConfig, 
  LayoutMode, 
  ComparisonStats, 
  MetricType,
  ColorMapType,
  VideoSamplePoint,
  CropRegion,
  SmartArtifactsConfig,
  ArtifactTelemetry
} from './types';
import { 
  Image as ImageIcon,
  Columns2,
  TrendingUp,
  Layers,
  FileText,
  Check,
  Plus,
  Upload,
  Link2,
  Zap,
  ArrowRight,
  ArrowLeft,
  ArrowLeftRight,
  Maximize,
  Minus,
  Crop,
  Sparkles,
  Sliders,
  Play,
  Download,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  RotateCcw,
  Focus,
  AlertTriangle,
  CheckCircle2,
  GitBranch
} from 'lucide-react';
import { parseJpegInfo } from './services/jpegInfo';
import { computeComparison } from './services/metrics';
import { SITES_DATABASE } from './services/sitesDatabase';
import { getColormapLUT, COLORMAP_LABELS, getColormapCssGradient } from './services/colormap';
import { CompareCanvas, CompareCanvasHandle } from './components/CompareCanvas';
import { RgbHistogramPanel } from './components/RgbHistogramPanel';
import { LandingPage } from './components/LandingPage';
import { StepGuideBanner } from './components/StepGuideBanner';
import { SettingsModal } from './components/SettingsModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { SocialLoginModal } from './components/SocialLoginModal';
import { ExportModal } from './components/ExportModal';
import { BatchProcessingModal } from './components/BatchProcessingModal';
import { CausalAnalysisPanel } from './components/CausalAnalysisPanel';
import { 
  BatchItemResult, 
  getFidelityGrade,
  exportComparisonToPDF, 
  exportComparisonToCSV, 
  exportBatchToPDF, 
  exportBatchToCSV 
} from './services/exportService';
import { runSlamCompression, getPresetForSite } from './services/slamEngine';
import { detectArtifacts } from './services/artifactDetection';
import { PWAInstallButton, OfflineIndicator } from './components/PWAInstallButton';
import {
  SupportedLocale,
  LOCALE_LABELS,
  TRANSLATIONS,
  validateAndSanitizeImageUrl,
  sanitizeReportName,
  validateMediaFile,
  loadPersistedPrefs,
  savePersistedPrefs
} from './services/i18n';

type WorkflowTab = 'media' | 'compare' | 'analysis' | 'batch' | 'report';
type AnalysisSubTab = 'heatmap' | 'histogram' | 'stats' | 'causal';

interface BatchQueueFile {
  id: string;
  name: string;
  width: number;
  height: number;
  fileSize: number;
  format: string;
  thumbnailUrl?: string;
  canvas?: HTMLCanvasElement;
  status: 'waiting' | 'running' | 'completed' | 'error';
  result?: BatchItemResult;
}

const DEFAULT_HEATMAP_CONFIG: HeatmapConfig = {
  metric: 'delta_e2000',
  colormap: 'inferno',
  intensity: 0.65,
  proportional: true,
  autoScale: true,
  manualMax: 6.0,
  gamma: 1.0,
  threshold: 0.0,
  blockView: false,
  overlayBase: 'site',
  smartArtifacts: {
    enabled: false,
    mode: 'both',
    sensitivity: 0.5,
    radius: 3,
    highlightStyle: 'neon',
    overlayIntensity: 0.85
  }
};

const DEFAULT_VIEW_CONFIG: ViewConfig = {
  zoom: 1.0,
  panX: 0,
  panY: 0,
  fitZoom: 1.0,
  linkedFocus: true,
  showLoupe: false,
  loupeZoom: 6,
  splitPos: 0.5,
  splitAngle: 0,
  swapped: false,
  loupeSubMode: 'overlay'
};

const METRIC_OPTIONS: { id: MetricType; label: string; shortLabel: string }[] = [
  { id: 'delta_e2000', label: 'Colour diff ΔE2000 (ΔE)', shortLabel: 'ΔE2000' },
  { id: 'ssim', label: 'Structural loss (1 - SSIM)', shortLabel: '1 - SSIM' },
  { id: 'abs_diff', label: 'Absolute difference (0–255)', shortLabel: 'Abs diff' },
  { id: 'luma_diff', label: 'Luma difference (Y\')', shortLabel: 'Luma diff' },
  { id: 'delta_e76', label: 'Colour diff ΔE76', shortLabel: 'ΔE76' },
  { id: 'squared_error', label: 'Squared error (MSE)', shortLabel: 'MSE' }
];

const COLORMAP_OPTIONS: ColorMapType[] = ['inferno', 'viridis', 'heat', 'ice', 'alert', 'gray'];

const METRIC_CYCLE: MetricType[] = [
  'delta_e2000',
  'ssim',
  'abs_diff',
  'luma_diff',
  'delta_e76',
  'squared_error'
];

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export const App: React.FC = () => {
  // Load versioned & migrated preferences from localStorage
  const initialPrefs = useRef(loadPersistedPrefs());

  // Landing page & Guided vs Expert Mode
  const [showLandingPage, setShowLandingPage] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const h = window.location.hash.replace('#', '');
      if (['media', 'compare', 'analysis', 'batch', 'report'].includes(h)) {
        return false;
      }
    }
    return true;
  });
  const [expertMode, setExpertMode] = useState<boolean>(initialPrefs.current.expertMode);
  const [showUrlImportInGuided, setShowUrlImportInGuided] = useState<boolean>(false);
  const [locale, setLocale] = useState<SupportedLocale>(initialPrefs.current.locale);
  const t = TRANSLATIONS[locale];

  // Active VMIT Workflow & Sub-tabs
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowTab>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const h = window.location.hash.replace('#', '') as WorkflowTab;
      if (['media', 'compare', 'analysis', 'batch', 'report'].includes(h)) {
        return h;
      }
    }
    return 'media';
  });
  const [analysisSubTab, setAnalysisSubTab] = useState<AnalysisSubTab>('heatmap');
  const [darkMode, setDarkMode] = useState<boolean>(initialPrefs.current.darkMode);

  // Original reference image slot
  const [original, setOriginal] = useState<SlotMedia>({
    id: 'original',
    name: 'original.png',
    type: 'original',
    siteName: 'Original',
    isVideo: false,
    width: 0,
    height: 0,
    fileSize: 0,
    format: 'PNG',
    loading: false
  });

  // 3 Comparison Slots (Slot 1, Slot 2, Slot 3)
  const [sites, setSites] = useState<SlotMedia[]>([
    {
      id: 'site-0',
      name: 'instagram.png',
      type: 'site',
      siteName: 'Instagram',
      siteNotes: SITES_DATABASE[0].notes,
      isVideo: false,
      width: 0,
      height: 0,
      fileSize: 0,
      format: 'JPG',
      loading: false
    },
    {
      id: 'site-1',
      name: 'discord.webp',
      type: 'site',
      siteName: 'Discord',
      siteNotes: SITES_DATABASE[1]?.notes,
      isVideo: false,
      width: 0,
      height: 0,
      fileSize: 0,
      format: 'WEBP',
      loading: false
    },
    {
      id: 'site-2',
      name: 'facebook.jpg',
      type: 'site',
      siteName: 'Facebook',
      siteNotes: SITES_DATABASE[2]?.notes,
      isVideo: false,
      width: 0,
      height: 0,
      fileSize: 0,
      format: 'JPG',
      loading: false
    }
  ]);

  const [activeSiteIndex, setActiveSiteIndex] = useState(0);

  // Media workflow controls
  const [importDest, setImportDest] = useState<'original' | 0 | 1 | 2>(0);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [autoSlam, setAutoSlam] = useState(true);
  const [autoVisualize, setAutoVisualize] = useState(true);

  // Compare & Analysis layout & config
  const [layout, setLayout] = useState<LayoutMode>('split_lr');
  const [compareModeButton, setCompareModeButton] = useState<'heatmap' | 'loupe' | 'left_right' | 'top_bottom' | 'split_lr' | 'split_tb' | 'survey'>('split_lr');
  const [heatmapConfig, setHeatmapConfig] = useState<HeatmapConfig>(DEFAULT_HEATMAP_CONFIG);
  const [viewConfig, setViewConfig] = useState<ViewConfig>(DEFAULT_VIEW_CONFIG);
  const [showAdvancedHeatmap, setShowAdvancedHeatmap] = useState(false);

  // Automatically expand advanced heatmap settings when user enables Expert Mode
  useEffect(() => {
    setShowAdvancedHeatmap(expertMode);
  }, [expertMode]);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isSocialModalOpen, setIsSocialModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  // Interactive runtime flags
  const [spacePeek, setSpacePeek] = useState(false);
  const [isComputing, setIsComputing] = useState(false);
  const [isSlamRunning, setIsSlamRunning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Comparison Results
  const [diffBuffer, setDiffBuffer] = useState<Float32Array | null>(null);
  const [stats, setStats] = useState<ComparisonStats | null>(null);

  // Region of Interest (ROI) Cropping Tool state
  const [cropRegion, setCropRegion] = useState<CropRegion | null>(null);
  const [isCropToolActive, setIsCropToolActive] = useState(false);

  // Smart Artifact CV Telemetry
  const [artifactTelemetry, setArtifactTelemetry] = useState<ArtifactTelemetry | null>(null);

  // Batch Workflow State
  const [batchQueue, setBatchQueue] = useState<BatchQueueFile[]>([]);
  const [batchPlatform, setBatchPlatform] = useState<string>('Instagram');
  const [batchSlamEnabled, setBatchSlamEnabled] = useState<boolean>(true);
  const [batchAnalyzeAfter, setBatchAnalyzeAfter] = useState<boolean>(true);
  const [batchMetric, setBatchMetric] = useState<MetricType>('delta_e2000');
  const [batchPreset, setBatchPreset] = useState<'Current' | 'High Contrast' | 'Block Forensics'>('Current');
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);

  // Report Workflow State
  const [reportName, setReportName] = useState<string>('Instagram comparison');
  const [reportFormat, setReportFormat] = useState<'PDF' | 'CSV' | 'PNG'>(initialPrefs.current.reportFormat);

  // Persist preferences, sync <html lang="...">, and sync across tabs
  useEffect(() => {
    savePersistedPrefs({ darkMode, expertMode, locale, reportFormat });
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [darkMode, expertMode, locale, reportFormat]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'vmit_workspace_prefs') {
        const updated = loadPersistedPrefs();
        setDarkMode(updated.darkMode);
        setExpertMode(updated.expertMode);
        setLocale(updated.locale);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Browser History / URL Hash Navigation Synchronization
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const targetHash = showLandingPage ? '#overview' : `#${activeWorkflow}`;
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, '', targetHash);
    }
  }, [showLandingPage, activeWorkflow]);

  useEffect(() => {
    const onPopState = () => {
      const h = window.location.hash.replace('#', '');
      if (!h || h === 'overview') {
        setShowLandingPage(true);
      } else if (['media', 'compare', 'analysis', 'batch', 'report'].includes(h)) {
        setShowLandingPage(false);
        setActiveWorkflow(h as WorkflowTab);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const [reportIncludePair, setReportIncludePair] = useState<boolean>(true);
  const [reportIncludeMetrics, setReportIncludeMetrics] = useState<boolean>(true);
  const [reportIncludeHeatmap, setReportIncludeHeatmap] = useState<boolean>(true);
  const [reportIncludeSettings, setReportIncludeSettings] = useState<boolean>(true);
  const [isExportingReport, setIsExportingReport] = useState<boolean>(false);

  // Video timeline state (retained for video support)
  const [videoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoSamples] = useState<VideoSamplePoint[]>([]);

  // Hidden file inputs
  const origFileInputRef = useRef<HTMLInputElement>(null);
  const slotFileInputRef = useRef<HTMLInputElement>(null);
  const batchFileInputRef = useRef<HTMLInputElement>(null);
  const compareCanvasRef = useRef<CompareCanvasHandle>(null);

  const activeSite = sites[activeSiteIndex] || sites[0];
  const pairLoaded = Boolean(original.canvas && activeSite?.canvas);
  const readySlotsCount = sites.filter(s => Boolean(s.canvas)).length;

  // Keep reportName synced when activeSite changes if still default-like
  useEffect(() => {
    if (activeSite?.siteName) {
      setReportName(prev => {
        if (prev.endsWith(' comparison')) {
          return `${activeSite.siteName} comparison`;
        }
        return prev;
      });
    }
  }, [activeSite?.siteName]);

  // Sync Original into Batch Queue if queue is empty
  useEffect(() => {
    if (original.canvas && batchQueue.length === 0) {
      setBatchQueue([
        {
          id: 'batch-orig-default',
          name: original.name || 'original.png',
          width: original.width,
          height: original.height,
          fileSize: original.fileSize || 3795845,
          format: (original.format || 'PNG').toUpperCase(),
          thumbnailUrl: original.thumbnailUrl,
          canvas: original.canvas,
          status: 'waiting'
        }
      ]);
    }
  }, [original.canvas, original.name, original.width, original.height, original.fileSize, original.format, original.thumbnailUrl, batchQueue.length]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast(prev => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  const handleFitToScreen = useCallback(() => {
    if (compareCanvasRef.current) {
      compareCanvasRef.current.fitToScreen();
      showToast('Fit to screen');
    }
  }, [showToast]);

  const handleResetZoom100 = useCallback(() => {
    setViewConfig(prev => ({ ...prev, zoom: 1.0, panX: 0, panY: 0, splitPos: 0.5 }));
    showToast('Reset zoom to 100%');
  }, [showToast]);

  // Crop Region of Interest Handlers
  const handleApplyCrop = useCallback((region: CropRegion) => {
    setCropRegion(region);
    setIsCropToolActive(false);
    showToast(`ROI applied (${region.width}×${region.height} px). Metrics recalculated.`);
  }, [showToast]);

  const handleClearCrop = useCallback(() => {
    setCropRegion(null);
    setIsCropToolActive(false);
    showToast('Crop reset to full image');
  }, [showToast]);

  const handleApplyPresetCrop = useCallback((preset: 'center50' | 'center25' | 'top50') => {
    const targetW = activeSite.width || original.width;
    const targetH = activeSite.height || original.height;
    if (!targetW || !targetH) {
      showToast('Load an image pair first to apply ROI');
      return;
    }

    let rx = 0;
    let ry = 0;
    let rw = targetW;
    let rh = targetH;

    if (preset === 'center50') {
      rw = Math.round(targetW * 0.5);
      rh = Math.round(targetH * 0.5);
      rx = Math.round((targetW - rw) / 2);
      ry = Math.round((targetH - rh) / 2);
    } else if (preset === 'center25') {
      rw = Math.round(targetW * 0.25);
      rh = Math.round(targetH * 0.25);
      rx = Math.round((targetW - rw) / 2);
      ry = Math.round((targetH - rh) / 2);
    } else if (preset === 'top50') {
      rw = targetW;
      rh = Math.round(targetH * 0.5);
      rx = 0;
      ry = 0;
    }

    setCropRegion({
      x: rx,
      y: ry,
      width: rw,
      height: rh,
      active: true
    });
    setIsCropToolActive(false);
    showToast(`Applied ROI preset: ${rw}×${rh} px`);
  }, [activeSite.width, activeSite.height, original.width, original.height, showToast]);

  // Compute live Smart Artifact CV telemetry when enabled
  const smartArtifacts: SmartArtifactsConfig = heatmapConfig.smartArtifacts || DEFAULT_HEATMAP_CONFIG.smartArtifacts!;
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
    setHeatmapConfig(prev => ({
      ...prev,
      smartArtifacts: {
        ...(prev.smartArtifacts || DEFAULT_HEATMAP_CONFIG.smartArtifacts!),
        ...updates
      }
    }));
  };

  // Load a batch item into the active site slot for deep inspection
  const handleLoadBatchItemToSlot = useCallback((batchItem: BatchItemResult) => {
    if (!batchItem.canvas) return;

    setSites(prev => {
      const next = [...prev];
      next[activeSiteIndex] = {
        id: `site-${activeSiteIndex}`,
        name: `${batchItem.filename}`,
        type: 'site',
        siteName: batchItem.platform,
        isVideo: false,
        width: batchItem.processedWidth,
        height: batchItem.processedHeight,
        fileSize: batchItem.processedSize,
        format: batchItem.processedFormat,
        canvas: batchItem.canvas,
        imageData: batchItem.imageData,
        thumbnailUrl: batchItem.thumbnailUrl,
        jpegInfo: batchItem.jpegInfo,
        loading: false
      };
      return next;
    });

    setIsBatchModalOpen(false);
    setActiveWorkflow('compare');
    showToast(`Loaded "${batchItem.platform}" simulation into Slot ${activeSiteIndex + 1}`);
  }, [activeSiteIndex, showToast]);

  // Compute Perceptual Comparison between Original and Active Site
  const runComparison = useCallback(() => {
    if (!original.canvas || !activeSite.canvas) {
      setDiffBuffer(null);
      setStats(null);
      return;
    }

    setIsComputing(true);

    try {
      const targetW = activeSite.width || original.width;
      const targetH = activeSite.height || original.height;

      const offOrig = document.createElement('canvas');
      offOrig.width = targetW;
      offOrig.height = targetH;
      const oCtx = offOrig.getContext('2d');
      if (!oCtx) return;
      oCtx.drawImage(original.canvas, 0, 0, targetW, targetH);

      const offSite = document.createElement('canvas');
      offSite.width = targetW;
      offSite.height = targetH;
      const sCtx = offSite.getContext('2d');
      if (!sCtx) return;
      sCtx.drawImage(activeSite.canvas, 0, 0, targetW, targetH);

      const hasRoi = Boolean(cropRegion && cropRegion.active && cropRegion.width > 2 && cropRegion.height > 2);

      let origData: Uint8ClampedArray;
      let siteData: Uint8ClampedArray;
      let compW: number;
      let compH: number;
      let rx = 0;
      let ry = 0;

      if (hasRoi && cropRegion) {
        rx = Math.max(0, Math.min(cropRegion.x, targetW - 2));
        ry = Math.max(0, Math.min(cropRegion.y, targetH - 2));
        compW = Math.max(2, Math.min(cropRegion.width, targetW - rx));
        compH = Math.max(2, Math.min(cropRegion.height, targetH - ry));

        origData = oCtx.getImageData(rx, ry, compW, compH).data;
        siteData = sCtx.getImageData(rx, ry, compW, compH).data;
      } else {
        compW = targetW;
        compH = targetH;
        origData = oCtx.getImageData(0, 0, targetW, targetH).data;
        siteData = sCtx.getImageData(0, 0, targetW, targetH).data;
      }

      const result = computeComparison(
        origData,
        siteData,
        compW,
        compH,
        heatmapConfig.metric,
        heatmapConfig.blockView,
        heatmapConfig.tonalFilter
      );

      if (hasRoi) {
        const fullBuffer = new Float32Array(targetW * targetH);
        for (let row = 0; row < compH; row++) {
          const srcOffset = row * compW;
          const dstOffset = (ry + row) * targetW + rx;
          for (let col = 0; col < compW; col++) {
            fullBuffer[dstOffset + col] = result.diffBuffer[srcOffset + col];
          }
        }
        setDiffBuffer(fullBuffer);

        const roiStats: ComparisonStats = {
          ...result.stats,
          roi: {
            x: rx,
            y: ry,
            width: compW,
            height: compH,
            fullWidth: targetW,
            fullHeight: targetH
          }
        };
        setStats(roiStats);
      } else {
        setDiffBuffer(result.diffBuffer);
        setStats(result.stats);
      }
    } catch (err) {
      console.error('Computation error:', err);
      showToast('Error calculating difference metrics');
    } finally {
      setIsComputing(false);
    }
  }, [original, activeSite, heatmapConfig.metric, heatmapConfig.blockView, heatmapConfig.tonalFilter, cropRegion, showToast]);

  // Auto-visualize effect
  useEffect(() => {
    if (autoVisualize && original.canvas && activeSite.canvas) {
      runComparison();
    }
  }, [
    autoVisualize,
    original.canvas,
    activeSite.canvas,
    activeSiteIndex,
    heatmapConfig.metric,
    heatmapConfig.blockView,
    heatmapConfig.tonalFilter,
    cropRegion,
    runComparison
  ]);

  const handleClearTonalFilter = useCallback(() => {
    setHeatmapConfig(prev => ({
      ...prev,
      tonalFilter: { min: 0, max: 255, active: false, channel: 'luma' }
    }));
    showToast('Reset tonal range filter to full 0–255');
  }, [showToast]);

  // Load an image/video from File with validation
  const handleFileLoad = useCallback(async (slotTarget: number | 'original', file: File) => {
    const fileCheck = validateMediaFile(file);
    if (!fileCheck.valid) {
      showToast(fileCheck.error || 'Invalid media file');
      return;
    }
    const isVid = file.type.startsWith('video/') || file.name.endsWith('.mp4') || file.name.endsWith('.mov');
    const isJpeg = file.type === 'image/jpeg' || file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg');

    let jpegInfo = undefined;
    if (isJpeg) {
      try {
        const buffer = await file.arrayBuffer();
        jpegInfo = parseJpegInfo(buffer) || undefined;
      } catch (e) {
        console.warn('Failed to parse JPEG info:', e);
      }
    }

    if (isVid) {
      const vid = document.createElement('video');
      vid.src = URL.createObjectURL(file);
      vid.crossOrigin = 'anonymous';
      vid.muted = true;
      vid.playsInline = true;

      vid.onloadedmetadata = () => {
        vid.currentTime = 0;
      };

      vid.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = vid.videoWidth;
        canvas.height = vid.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(vid, 0, 0);
          const thumb = canvas.toDataURL('image/jpeg', 0.8);
          const media: SlotMedia = {
            id: slotTarget === 'original' ? 'original' : `site-${slotTarget}`,
            name: file.name,
            type: slotTarget === 'original' ? 'original' : 'site',
            siteName: slotTarget === 'original' ? 'Original' : sites[slotTarget as number]?.siteName || 'Instagram',
            file,
            isVideo: true,
            videoDuration: vid.duration,
            width: vid.videoWidth,
            height: vid.videoHeight,
            fileSize: file.size,
            format: 'MP4',
            canvas,
            thumbnailUrl: thumb,
            loading: false,
            videoElement: vid
          };

          if (slotTarget === 'original') {
            setOriginal(media);
          } else {
            setSites(prev => {
              const next = [...prev];
              next[slotTarget as number] = media;
              return next;
            });
          }
          setVideoDuration(vid.duration);
          showToast(`Loaded video: ${file.name}`);
        }
      };
      return;
    }

    // Still image
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        const thumb = canvas.toDataURL('image/jpeg', 0.82);

        const ext = (file.name.split('.').pop() || 'PNG').toUpperCase();
        const media: SlotMedia = {
          id: slotTarget === 'original' ? 'original' : `site-${slotTarget}`,
          name: file.name,
          type: slotTarget === 'original' ? 'original' : 'site',
          siteName: slotTarget === 'original' ? 'Original' : sites[slotTarget as number]?.siteName || 'Instagram',
          file,
          isVideo: false,
          width: img.width,
          height: img.height,
          fileSize: file.size,
          format: ext,
          canvas,
          imageData: imgData,
          thumbnailUrl: thumb,
          jpegInfo,
          loading: false
        };

        if (slotTarget === 'original') {
          setOriginal(media);
          // Also update default batch queue item if waiting
          setBatchQueue(prev => {
            if (prev.length === 0 || (prev.length === 1 && prev[0].id === 'batch-orig-default')) {
              return [{
                id: 'batch-orig-default',
                name: file.name,
                width: img.width,
                height: img.height,
                fileSize: file.size,
                format: ext,
                thumbnailUrl: thumb,
                canvas,
                status: 'waiting'
              }];
            }
            return prev;
          });
        } else {
          setSites(prev => {
            const next = [...prev];
            next[slotTarget as number] = media;
            return next;
          });
        }
        showToast(`Loaded ${file.name} (${img.width}×${img.height})`);
      }
      URL.revokeObjectURL(objectUrl);
    };
  }, [sites, showToast]);

  // Load media from URL / path with input validation & sanitization
  const handleUrlLoad = useCallback(async (slotTarget: number | 'original', url: string) => {
    const check = validateAndSanitizeImageUrl(url);
    if (!check.valid) {
      showToast(check.error || 'Enter a valid image URL first');
      return;
    }
    try {
      const res = await fetch(check.url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const fileName = check.url.split('/').pop()?.split('?')[0] || 'remote_image.png';
      const file = new File([blob], fileName, { type: blob.type || 'image/png' });
      await handleFileLoad(slotTarget, file);
    } catch (err) {
      console.error('Fetch error:', err);
      showToast(`Failed to retrieve URL: ${check.url}`);
    }
  }, [handleFileLoad, showToast]);

  // ⚡ Run Lightweight SLAM (Social-media Loss Approximation Model)
  const handleRunSlamForSlot = useCallback(async (slotIndex: number, specificSiteName?: string) => {
    if (!original.canvas && !original.imageData) {
      showToast('Please load an Original image first');
      return;
    }

    const targetSiteName = specificSiteName || sites[slotIndex]?.siteName || 'Instagram';
    setIsSlamRunning(true);
    showToast(`⚡ SLAM: Simulating ${targetSiteName} compression...`);

    try {
      const preset = getPresetForSite(targetSiteName);
      const sourceCanvas = original.canvas!;
      const slamResult = await runSlamCompression(sourceCanvas, preset, original.name || 'original');

      const media: SlotMedia = {
        id: `site-${slotIndex}`,
        name: `${targetSiteName.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`,
        type: 'site',
        siteName: targetSiteName,
        siteNotes: SITES_DATABASE.find(s => s.name === targetSiteName)?.notes || preset.description,
        file: slamResult.file,
        isVideo: false,
        width: slamResult.width,
        height: slamResult.height,
        fileSize: slamResult.fileSize,
        format: slamResult.format.toUpperCase(),
        canvas: slamResult.canvas,
        imageData: slamResult.imageData,
        thumbnailUrl: slamResult.thumbnailUrl,
        jpegInfo: slamResult.jpegInfo,
        loading: false
      };

      setSites(prev => {
        const next = [...prev];
        next[slotIndex] = media;
        return next;
      });
      setActiveSiteIndex(slotIndex);

      showToast(`⚡ Simulated ${targetSiteName} (${slamResult.width}×${slamResult.height})`);
    } catch (err) {
      console.error('SLAM execution failed:', err);
      showToast('Failed to simulate platform compression');
    } finally {
      setIsSlamRunning(false);
    }
  }, [original, sites, showToast]);

  // ⚡ Instant compare with SLAM from SocialLoginModal
  const handleCompareWithSlam = useCallback(async (url: string, platformName: string, title: string) => {
    showToast(`Loading original and simulating ${platformName}...`);
    setIsSlamRunning(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const ext = blob.type.includes('png') ? 'png' : 'jpg';
      const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const originalFile = new File([blob], `${cleanTitle}.${ext}`, { type: blob.type });

      await handleFileLoad('original', originalFile);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      const objectUrl = URL.createObjectURL(blob);
      img.src = objectUrl;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
      });
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(img, 0, 0);

      const preset = getPresetForSite(platformName);
      const slamResult = await runSlamCompression(canvas, preset, cleanTitle);

      const targetIdx = activeSiteIndex >= 0 ? activeSiteIndex : 0;
      const media: SlotMedia = {
        id: `site-${targetIdx}`,
        name: `${preset.platform.toLowerCase()}.jpg`,
        type: 'site',
        siteName: preset.platform,
        siteNotes: SITES_DATABASE.find(s => s.name === preset.platform)?.notes || preset.description,
        file: slamResult.file,
        isVideo: false,
        width: slamResult.width,
        height: slamResult.height,
        fileSize: slamResult.fileSize,
        format: slamResult.format.toUpperCase(),
        canvas: slamResult.canvas,
        imageData: slamResult.imageData,
        thumbnailUrl: slamResult.thumbnailUrl,
        jpegInfo: slamResult.jpegInfo,
        loading: false
      };

      setSites(prev => {
        const next = [...prev];
        next[targetIdx] = media;
        return next;
      });
      setActiveSiteIndex(targetIdx);
      showToast(`Ready: Original → ${preset.platform}`);
    } catch (err) {
      console.error('SLAM compare error:', err);
      showToast('Failed to load social photo');
    } finally {
      setIsSlamRunning(false);
    }
  }, [activeSiteIndex, handleFileLoad, showToast]);

  // Load built-in tutorial samples
  const loadTutorialSamples = useCallback(async () => {
    try {
      await handleUrlLoad('original', '/samples/original.png');

      // Load Slot 1 (Instagram) by default, and keep Slots 2 & 3 available as shown in the VMIT design
      await handleUrlLoad(0, '/samples/instagram.jpg');
      setSites(prev => {
        const next = [...prev];
        if (next[0]) {
          next[0] = {
            ...next[0],
            name: 'instagram.png',
            siteName: 'Instagram'
          };
        }
        return next;
      });
    } catch (err) {
      console.error('Failed loading samples:', err);
    }
  }, [handleUrlLoad]);

  // Load initial samples on startup
  const initialLoadRef = useRef(false);
  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      loadTutorialSamples();
    }
  }, [loadTutorialSamples]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setSpacePeek(true);
        return;
      }
      if (e.key === 'F1') {
        e.preventDefault();
        setIsShortcutsOpen(true);
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        handleFitToScreen();
        return;
      }
      if (e.key === 'm' || e.key === 'M') {
        const curIdx = METRIC_CYCLE.indexOf(heatmapConfig.metric);
        const delta = e.shiftKey ? -1 : 1;
        const nextIdx = (curIdx + delta + METRIC_CYCLE.length) % METRIC_CYCLE.length;
        setHeatmapConfig(prev => ({ ...prev, metric: METRIC_CYCLE[nextIdx] }));
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        setIsCropToolActive(prev => !prev);
        return;
      }
      if (e.key === 'Escape' && isCropToolActive) {
        setIsCropToolActive(false);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePeek(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [heatmapConfig.metric, isCropToolActive, handleFitToScreen]);

  // Export Heatmap PNG
  const exportHeatmapPng = useCallback(() => {
    if (!diffBuffer || !activeSite.canvas) {
      showToast('No active heat map to export');
      return;
    }

    const w = activeSite.width;
    const h = activeSite.height;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = w;
    exportCanvas.height = h;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(activeSite.canvas, 0, 0);

    const heatCanvas = document.createElement('canvas');
    heatCanvas.width = w;
    heatCanvas.height = h;
    const hctx = heatCanvas.getContext('2d');
    if (hctx) {
      const imgData = hctx.createImageData(w, h);
      const data = imgData.data;
      const lut = getColormapLUT(heatmapConfig.colormap);
      const scaleMax = heatmapConfig.autoScale ? (stats?.p99Val || 1.0) : heatmapConfig.manualMax;
      const gamma = heatmapConfig.gamma;

      for (let i = 0; i < w * h; i++) {
        const v = diffBuffer[i];
        const norm = Math.min(1.0, Math.max(0.0, v / scaleMax));
        const t = Math.pow(norm, gamma);
        const lutIdx = Math.min(255, Math.max(0, Math.round(t * 255))) * 3;
        data[i * 4] = lut[lutIdx];
        data[i * 4 + 1] = lut[lutIdx + 1];
        data[i * 4 + 2] = lut[lutIdx + 2];
        data[i * 4 + 3] = Math.round(255 * heatmapConfig.intensity);
      }
      hctx.putImageData(imgData, 0, 0);
      ctx.drawImage(heatCanvas, 0, 0);
    }

    const a = document.createElement('a');
    a.download = `${reportName.toLowerCase().replace(/\s+/g, '_')}_heatmap.png`;
    a.href = exportCanvas.toDataURL('image/png');
    a.click();
    showToast('Exported heatmap PNG');
  }, [diffBuffer, activeSite, heatmapConfig, stats, reportName, showToast]);

  // Run In-Page Batch Queue Processing
  const handleRunInPageBatch = useCallback(async () => {
    if (batchQueue.length === 0) {
      showToast('Add at least one image to the batch queue');
      return;
    }

    setIsBatchRunning(true);
    showToast(`Running batch on ${batchQueue.length} image(s) for ${batchPlatform}...`);

    const preset = getPresetForSite(batchPlatform);
    const updatedQueue: BatchQueueFile[] = [...batchQueue];

    for (let i = 0; i < updatedQueue.length; i++) {
      const item = updatedQueue[i];
      if (!item.canvas) continue;

      updatedQueue[i] = { ...item, status: 'running' };
      setBatchQueue([...updatedQueue]);

      try {
        const slamRes = await runSlamCompression(item.canvas, preset, item.name);
        const targetW = slamRes.width;
        const targetH = slamRes.height;

        const offOrig = document.createElement('canvas');
        offOrig.width = targetW;
        offOrig.height = targetH;
        const oCtx = offOrig.getContext('2d');
        oCtx?.drawImage(item.canvas, 0, 0, targetW, targetH);

        const origPixels = oCtx!.getImageData(0, 0, targetW, targetH).data;
        const procPixels = slamRes.imageData.data;

        const comp = computeComparison(origPixels, procPixels, targetW, targetH, batchMetric, batchPreset === 'Block Forensics');

        // Build heatmap data URL for report
        const heatCanvas = document.createElement('canvas');
        heatCanvas.width = targetW;
        heatCanvas.height = targetH;
        const hctx = heatCanvas.getContext('2d');
        if (hctx) {
          hctx.drawImage(slamRes.canvas, 0, 0);
          const imgData = hctx.createImageData(targetW, targetH);
          const d = imgData.data;
          const lut = getColormapLUT(heatmapConfig.colormap);
          const scaleMax = comp.stats.p99Val || 1.0;
          for (let p = 0; p < targetW * targetH; p++) {
            const norm = Math.min(1, Math.max(0, comp.diffBuffer[p] / scaleMax));
            const lutIdx = Math.min(255, Math.max(0, Math.round(norm * 255))) * 3;
            d[p * 4] = lut[lutIdx];
            d[p * 4 + 1] = lut[lutIdx + 1];
            d[p * 4 + 2] = lut[lutIdx + 2];
            d[p * 4 + 3] = 165;
          }
          const overlayC = document.createElement('canvas');
          overlayC.width = targetW;
          overlayC.height = targetH;
          overlayC.getContext('2d')?.putImageData(imgData, 0, 0);
          hctx.drawImage(overlayC, 0, 0);
        }

        const compRatio = item.fileSize > 0
          ? Math.max(0, ((item.fileSize - slamRes.fileSize) / item.fileSize) * 100)
          : 0;
        const gradeInfo = getFidelityGrade(comp.stats.psnrDb, comp.stats.ssimMean, comp.stats.deltaE2000Mean);

        const batchResult: BatchItemResult = {
          id: item.id,
          filename: item.name,
          platform: batchPlatform,
          originalWidth: item.width,
          originalHeight: item.height,
          originalSize: item.fileSize,
          processedWidth: slamRes.width,
          processedHeight: slamRes.height,
          processedSize: slamRes.fileSize,
          processedFormat: slamRes.format,
          compressionRatio: compRatio,
          psnrDb: comp.stats.psnrDb,
          ssimMean: comp.stats.ssimMean,
          deltaE2000Mean: comp.stats.deltaE2000Mean,
          deltaE2000Max: comp.stats.deltaE2000Max,
          visibleChangesPct: comp.stats.visibleChangesPct,
          grade: gradeInfo.grade,
          jpegInfo: slamRes.jpegInfo,
          originalThumbnailUrl: item.thumbnailUrl || item.canvas.toDataURL('image/jpeg', 0.7),
          thumbnailUrl: slamRes.thumbnailUrl,
          canvas: slamRes.canvas,
          imageData: slamRes.imageData
        };

        updatedQueue[i] = {
          ...item,
          status: 'completed',
          result: batchResult
        };
        setBatchQueue([...updatedQueue]);
      } catch (err) {
        console.error('Batch item failed:', err);
        updatedQueue[i] = { ...item, status: 'error' };
        setBatchQueue([...updatedQueue]);
      }
    }

    setIsBatchRunning(false);
    showToast(`Batch complete: ${updatedQueue.filter(q => q.status === 'completed').length} image(s) processed`);
  }, [batchQueue, batchPlatform, batchMetric, batchPreset, heatmapConfig.colormap, showToast]);

  // Add files to Batch Queue
  const handleAddBatchFiles = useCallback((fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    Array.from(fileList).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.src = url;
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        c.getContext('2d')?.drawImage(img, 0, 0);
        const thumb = c.toDataURL('image/jpeg', 0.75);
        const ext = (file.name.split('.').pop() || 'PNG').toUpperCase();

        setBatchQueue(prev => [
          ...prev,
          {
            id: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: file.name,
            width: img.width,
            height: img.height,
            fileSize: file.size,
            format: ext,
            thumbnailUrl: thumb,
            canvas: c,
            status: 'waiting'
          }
        ]);
        URL.revokeObjectURL(url);
      };
    });
    showToast(`Added ${fileList.length} file(s) to batch queue`);
  }, [showToast]);

  // Handle Report Export in Report Workflow
  const handleExportReportAction = useCallback(async () => {
    if (!stats || !original.canvas || !activeSite.canvas) {
      showToast('Load an image pair first to export a report');
      return;
    }

    setIsExportingReport(true);
    try {
      if (reportFormat === 'PNG') {
        exportHeatmapPng();
      } else {
        const safeTitle = sanitizeReportName(reportName);
        const reportData = {
          reportTitle: safeTitle,
          notes: `${safeTitle} — Generated via VMIT (${reportIncludePair ? 'Pair included' : 'Metrics only'})`,
          timestamp: Date.now(),
          original: {
            name: original.name || 'original.png',
            width: original.width,
            height: original.height,
            fileSize: original.fileSize,
            format: original.format,
            thumbnailUrl: reportIncludePair ? original.thumbnailUrl : undefined,
            jpegInfo: original.jpegInfo
          },
          processed: {
            name: activeSite.name || 'processed.jpg',
            siteName: activeSite.siteName || 'Instagram',
            width: activeSite.width,
            height: activeSite.height,
            fileSize: activeSite.fileSize,
            format: activeSite.format,
            thumbnailUrl: reportIncludePair ? activeSite.thumbnailUrl : undefined,
            jpegInfo: activeSite.jpegInfo
          },
          stats
        };
        if (reportFormat === 'CSV') {
          exportComparisonToCSV(reportData);
          showToast('Exported comparison CSV report');
        } else {
          await exportComparisonToPDF(reportData);
          showToast('Exported professional PDF report');
        }
      }
    } catch (e) {
      console.error('Export failed:', e);
      showToast('Failed to generate report');
    } finally {
      setIsExportingReport(false);
    }
  }, [stats, original, activeSite, reportFormat, reportName, reportIncludePair, exportHeatmapPng, showToast]);

  // Select comparison mode from the Compare right-hand mode card
  const handleSelectCompareMode = (mode: typeof compareModeButton) => {
    setCompareModeButton(mode);
    if (mode === 'heatmap') {
      setLayout('loupe');
      setViewConfig(prev => ({ ...prev, loupeSubMode: 'overlay', showLoupe: false }));
    } else if (mode === 'loupe') {
      setLayout('loupe');
      setViewConfig(prev => ({ ...prev, loupeSubMode: 'after', showLoupe: true }));
    } else {
      setLayout(mode);
    }
  };

  // Plain-English diagnostic summary helper
  const getDiagnosticSummary = () => {
    if (!stats) {
      return 'Load or simulate a comparison image to evaluate structural and perceptual colour fidelity.';
    }
    if (stats.ssimMean >= 0.99 && stats.deltaE2000Mean <= 2.3) {
      return 'Structure and colour are closely preserved with nearly imperceptible compression loss.';
    }
    if (stats.ssimMean >= 0.97) {
      return 'Structure is closely preserved. Colour differences remain visible. Inspect the heatmap to locate them.';
    }
    if (stats.ssimMean >= 0.92) {
      return 'Moderate structural softening and chroma quantization detected along high-contrast edges.';
    }
    return 'Significant compression degradation detected across textures, edges, and colour blocks.';
  };

  const completedBatchResults = batchQueue
    .filter(q => q.status === 'completed' && q.result)
    .map(q => q.result!);

  // Theme classes matching the VMIT screenshots
  const bgMain = darkMode ? 'bg-[#091526] text-slate-100' : 'bg-[#F4F7FB] text-[#0F2942]';
  const bgSidebar = darkMode ? 'bg-[#0D1E36] border-slate-800' : 'bg-[#EEF3F9] border-[#DDE6F0]';
  const bgCard = darkMode ? 'bg-[#112440] border-slate-800 text-slate-100' : 'bg-white border-[#E2E8F0] text-[#0F2942]';
  const bgSubtle = darkMode ? 'bg-[#0B192E] border-slate-800' : 'bg-[#F8FAFC] border-[#E2E8F0]';
  const textMuted = darkMode ? 'text-slate-400' : 'text-[#5A7184]';
  const borderSubtle = darkMode ? 'border-slate-800' : 'border-[#E2E8F0]';
  const btnOutline = darkMode
    ? 'bg-[#162C4E] hover:bg-[#1E3A63] text-slate-100 border border-slate-700'
    : 'bg-white hover:bg-[#F8FAFC] text-[#0F2942] border border-[#CBD5E1]';
  const btnPrimary = 'bg-[#1B4D7E] hover:bg-[#153E66] text-white shadow-xs';

  const workflowItems: { id: WorkflowTab; label: string; icon: React.ReactNode }[] = [
    { id: 'media', label: t.media, icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'compare', label: t.compare, icon: <Columns2 className="w-4 h-4" /> },
    { id: 'analysis', label: t.analysis, icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'batch', label: t.batch, icon: <Layers className="w-4 h-4" /> },
    { id: 'report', label: t.report, icon: <FileText className="w-4 h-4" /> }
  ];

  const currentWorkflowLabel = workflowItems.find(w => w.id === activeWorkflow)?.label || t.media;

  return (
    <div className={`min-h-screen w-full flex flex-col lg:flex-row font-sans selection:bg-sky-500 selection:text-white ${bgMain}`}>
      {/* Accessibility Skip-to-Content Link */}
      <a
        href="#main-workspace"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-xl focus:bg-[#1B4D7E] focus:text-white focus:text-xs focus:font-bold"
      >
        Skip to main workspace
      </a>

      {/* Offline Mode Connectivity Indicator */}
      <OfflineIndicator />

      {/* Hidden File Inputs */}
      <input
        ref={origFileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleFileLoad('original', f);
          e.target.value = '';
        }}
      />
      <input
        ref={slotFileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleFileLoad(activeSiteIndex, f);
          e.target.value = '';
        }}
      />
      <input
        ref={batchFileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => {
          handleAddBatchFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {/* ================= MOBILE TOP HEADER (< lg) ================= */}
      {!showLandingPage && (
      <header className={`lg:hidden flex items-center justify-between px-4 py-3 border-b sticky top-0 z-30 ${bgSidebar}`}>
        <button
          type="button"
          onClick={() => setShowLandingPage(true)}
          className="flex items-center gap-2.5 cursor-pointer"
          title="Return to Landing Page"
        >
          <div className="w-8 h-8 rounded-lg bg-[#FFDD33] flex items-center justify-center text-[#0F2942] font-bold shadow-xs">
            <Columns2 className="w-4 h-4 stroke-[2.2]" />
          </div>
          <span className="font-bold text-base tracking-tight">VMIT</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpertMode(prev => !prev)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
              expertMode ? 'bg-[#1B4D7E] border-[#1B4D7E] text-white' : btnOutline
            }`}
          >
            {expertMode ? 'Expert' : 'Guided'}
          </button>
          {pairLoaded ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#5CE1A6] text-[#064E3B] text-xs font-semibold">
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Pair loaded</span>
            </span>
          ) : (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium ${bgSubtle}`}>
              Loading...
            </span>
          )}
        </div>
      </header>
      )}

      {/* ================= DESKTOP LEFT SIDEBAR (lg+) ================= */}
      {!showLandingPage && (
      <aside className={`hidden lg:flex w-60 shrink-0 flex-col justify-between border-r p-5 select-none ${bgSidebar}`}>
        <div className="space-y-6">
          {/* Brand Logo (clicks back to Landing Page) */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowLandingPage(true)}
              className="flex items-center gap-2.5 cursor-pointer group text-left"
              title="Back to Welcome / Landing Page"
            >
              <div className="w-8 h-8 rounded-lg bg-[#FFDD33] flex items-center justify-center text-[#0F2942] shadow-xs group-hover:scale-105 transition-transform">
                <Columns2 className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div>
                <span className="font-bold text-base tracking-tight block leading-none">VMIT</span>
                <span className={`text-[10px] ${textMuted} group-hover:underline`}>Home guide</span>
              </div>
            </button>
          </div>

          {/* Workspace Title */}
          <div>
            <div className={`text-[11px] font-semibold uppercase tracking-wider ${textMuted}`}>
              WORKSPACE
            </div>
            <div className="font-bold text-[15px] mt-0.5 truncate">
              Untitled comparison
            </div>
          </div>

          {/* 5-Stage Navigation List */}
          <nav className="space-y-1">
            {workflowItems.map(item => {
              const isActive = activeWorkflow === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveWorkflow(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#1B4D7E] text-white shadow-xs'
                      : darkMode
                      ? 'text-slate-300 hover:bg-slate-800/60'
                      : 'text-[#1E3A5F] hover:bg-[#E2ECF7]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {isActive && <Check className="w-4 h-4 stroke-[2.2]" />}
                </button>
              );
            })}
          </nav>

          {/* CURRENT PAIR Preview Widget */}
          <div className="pt-2 space-y-2.5">
            <div className={`text-[11px] font-semibold uppercase tracking-wider ${textMuted}`}>
              CURRENT PAIR
            </div>

            <div 
              onClick={() => setActiveWorkflow('compare')}
              className="relative h-28 w-full rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-[#0B2545] cursor-pointer group shadow-xs"
            >
              {original.thumbnailUrl && (
                <img
                  src={original.thumbnailUrl}
                  alt="Original"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              {activeSite?.thumbnailUrl && (
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ clipPath: 'inset(0 0 0 50%)' }}
                >
                  <img
                    src={activeSite.thumbnailUrl}
                    alt={activeSite.siteName}
                    className="w-full h-full object-cover brightness-75 contrast-125 hue-rotate-15"
                  />
                </div>
              )}
              {/* Center split line & handle */}
              <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white/80 -translate-x-1/2" />
              <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#38BDF8] border border-white flex items-center justify-center text-[8px] text-white shadow">
                ↔
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold">
                Original → {activeSite?.siteName || 'Instagram'}
              </div>
              <div className={`text-xs mt-0.5 ${textMuted}`}>
                Slot {activeSiteIndex + 1} of 3 selected
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveWorkflow('analysis');
                setAnalysisSubTab('causal');
              }}
              className={`w-full mt-1.5 px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                activeWorkflow === 'analysis' && analysisSubTab === 'causal'
                  ? 'bg-[#1B4D7E] text-white border-[#1B4D7E]'
                  : darkMode
                  ? 'border-slate-700 bg-slate-800/40 text-sky-300 hover:bg-slate-800'
                  : 'border-[#CBD5E1] bg-white text-[#1B4D7E] hover:bg-[#E2ECF7]'
              }`}
            >
              <span className="flex items-center gap-2">
                <GitBranch className="w-3.5 h-3.5 shrink-0" />
                <span>Causal Impact (Causica)</span>
              </span>
              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
        </div>

        {/* Bottom Sidebar Controls: PWA Install, Language (i18n), Expert Mode Switch & Dark Mode Switch */}
        <div className="pt-6 space-y-3">
          <div className="flex items-center justify-between">
            <PWAInstallButton />
            <div className="flex items-center gap-1.5 ml-auto">
              <label htmlFor="sidebar-locale-select" className={`text-[11px] font-medium ${textMuted}`}>
                Lang
              </label>
              <select
                id="sidebar-locale-select"
                aria-label="Interface language"
                value={locale}
                onChange={e => setLocale(e.target.value as SupportedLocale)}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer outline-none ${bgSubtle}`}
              >
                {(Object.keys(LOCALE_LABELS) as SupportedLocale[]).map(loc => (
                  <option key={loc} value={loc} className="text-slate-900">
                    {LOCALE_LABELS[loc]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={`flex items-center justify-between pt-3 border-t ${borderSubtle}`}>
            <div>
              <span className="text-xs font-semibold block">{t.expertMode}</span>
              <span className={`text-[10px] ${textMuted}`}>
                {expertMode ? 'All math & tools shown' : 'Guided essentials'}
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={expertMode}
              aria-label="Toggle Expert Mode"
              onClick={() => setExpertMode(prev => !prev)}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                expertMode ? 'bg-[#1B4D7E]' : 'bg-slate-300 dark:bg-slate-700'
              }`}
              title="Toggle Expert Mode"
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  expertMode ? 'translate-x-4.5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className={`flex items-center justify-between pt-3 border-t ${borderSubtle}`}>
            <span className="text-xs font-medium">{t.darkMode}</span>
            <button
              type="button"
              role="switch"
              aria-checked={darkMode}
              aria-label="Toggle Dark Mode"
              onClick={() => setDarkMode(prev => !prev)}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                darkMode ? 'bg-[#10B981]' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  darkMode ? 'translate-x-4.5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </aside>
      )}

      {/* ================= LANDING PAGE VIEW ================= */}
      {showLandingPage ? (
        <LandingPage
          original={original}
          activeSite={activeSite}
          stats={stats}
          expertMode={expertMode}
          setExpertMode={setExpertMode}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          onStartGuided={() => {
            setShowLandingPage(false);
            setActiveWorkflow('media');
          }}
          onUploadOwnPhoto={() => {
            setShowLandingPage(false);
            setActiveWorkflow('media');
            setTimeout(() => origFileInputRef.current?.click(), 80);
          }}
          onOpenSocialModal={() => {
            setShowLandingPage(false);
            setIsSocialModalOpen(true);
          }}
          onJumpToWorkflow={wf => {
            setShowLandingPage(false);
            setActiveWorkflow(wf);
          }}
        />
      ) : (
      /* ================= MAIN WORKSPACE AREA ================= */
      <main id="main-workspace" className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-0 overflow-y-auto">
        <div className="max-w-6xl w-full mx-auto px-4 sm:px-8 py-5 sm:py-7 space-y-5">
          {/* Desktop Top Breadcrumb & Status Pill */}
          <div className="hidden lg:flex items-center justify-between">
            <div className={`text-xs font-medium flex items-center gap-2 ${textMuted}`}>
              <button
                type="button"
                onClick={() => setShowLandingPage(true)}
                className="hover:underline cursor-pointer"
              >
                {t.overview}
              </button>
              <span>/</span>
              <span>Untitled comparison</span>
              <span>/</span>
              <span className={darkMode ? 'text-slate-200 font-semibold' : 'text-[#0F2942] font-semibold'}>{currentWorkflowLabel}</span>
            </div>

            <div className="flex items-center gap-3" aria-live="polite">
              <PWAInstallButton />
              {toast && (
                <span role="status" className={`text-xs px-3 py-1 rounded-lg border animate-in fade-in ${bgSubtle}`}>
                  {toast}
                </span>
              )}
              {pairLoaded && (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#5CE1A6] text-[#064E3B] text-xs font-semibold shadow-2xs">
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{t.pairLoaded}</span>
                </span>
              )}
            </div>
          </div>

          {/* Step-by-Step Contextual Guide Banner */}
          <StepGuideBanner
            activeWorkflow={activeWorkflow}
            onSelectWorkflow={setActiveWorkflow}
            expertMode={expertMode}
            setExpertMode={setExpertMode}
            darkMode={darkMode}
            pairLoaded={pairLoaded}
          />

          {/* =====================================================================
              WORKFLOW 1: MEDIA ("Prepare your original and comparison images.")
             ===================================================================== */}
          {activeWorkflow === 'media' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Media</h1>
                <p className={`text-sm mt-1 ${textMuted}`}>
                  Prepare your original and comparison images.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Original Card + Start with a source Card */}
                <div className="lg:col-span-5 space-y-6">
                  {/* Original Card */}
                  <div className={`rounded-2xl border p-5 space-y-4 shadow-2xs ${bgCard}`}>
                    <h2 className="text-base font-bold">Original</h2>

                    <div className="flex items-center gap-3.5">
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700">
                        {original.thumbnailUrl ? (
                          <img src={original.thumbnailUrl} alt="Original thumb" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm truncate">{original.name || 'original.png'}</div>
                        <div className={`text-xs mt-0.5 tabular-nums ${textMuted}`}>
                          {original.width || 1600} × {original.height || 1200} · {(original.format || 'PNG').toUpperCase()}
                        </div>
                        <div className={`text-xs tabular-nums ${textMuted}`}>
                          {original.fileSize ? formatBytes(original.fileSize) : '3.62 MB'}
                        </div>
                      </div>
                    </div>

                    {/* Large Preview */}
                    <div 
                      onClick={() => origFileInputRef.current?.click()}
                      className="rounded-xl overflow-hidden bg-[#0B2545] aspect-[4/3] w-full border border-slate-200 dark:border-slate-700 cursor-pointer relative group"
                    >
                      {original.thumbnailUrl ? (
                        <img
                          src={original.thumbnailUrl}
                          alt="Original reference"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                          <Upload className="w-7 h-7 mb-2 opacity-70" />
                          <span className="text-xs font-medium">Click to upload Original reference image</span>
                        </div>
                      )}
                    </div>

                    <p className={`text-xs leading-relaxed ${textMuted}`}>
                      Your reference image stays the same across all three comparisons.
                    </p>

                    <div className="flex items-center gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => origFileInputRef.current?.click()}
                        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${btnOutline}`}
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Replace</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOriginal(prev => ({
                            ...prev,
                            canvas: undefined,
                            imageData: undefined,
                            thumbnailUrl: undefined,
                            width: 0,
                            height: 0,
                            fileSize: 0
                          }));
                          showToast('Cleared Original slot');
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${btnOutline}`}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Start with a source Card */}
                  <div className={`rounded-2xl border p-5 space-y-3.5 shadow-2xs ${bgCard}`}>
                    <h2 className="text-base font-bold">Start with a source</h2>
                    <div className="space-y-2.5">
                      <button
                        type="button"
                        onClick={loadTutorialSamples}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${btnOutline}`}
                      >
                        <ImageIcon className="w-4 h-4" />
                        <span>Samples</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsSocialModalOpen(true)}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${btnOutline}`}
                      >
                        <ImageIcon className="w-4 h-4" />
                        <span>My social photos</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column: Comparison images Card */}
                <div className="lg:col-span-7">
                  <div className={`rounded-2xl border p-5 sm:p-6 space-y-5 shadow-2xs ${bgCard}`}>
                    <h2 className="text-base font-bold">Comparison images</h2>

                    {/* 3-Slot Selector Pills */}
                    <div className="grid grid-cols-3 gap-2.5">
                      {[0, 1, 2].map(slotIdx => {
                        const slot = sites[slotIdx];
                        const isSelected = activeSiteIndex === slotIdx;
                        const hasImg = Boolean(slot?.canvas);
                        return (
                          <button
                            key={slotIdx}
                            type="button"
                            onClick={() => setActiveSiteIndex(slotIdx)}
                            className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                              isSelected
                                ? 'bg-[#E2ECF7] dark:bg-[#1B4D7E] border-[#1B4D7E] text-[#0F2942] dark:text-white shadow-2xs'
                                : `${bgSubtle} ${textMuted} hover:border-slate-400`
                            }`}
                          >
                            <span>Slot {slotIdx + 1}</span>
                            {hasImg ? (
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            ) : (
                              <Plus className="w-3.5 h-3.5" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Active Slot Details */}
                    <div className="flex items-center gap-3.5 pt-1">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700">
                        {activeSite?.thumbnailUrl ? (
                          <img src={activeSite.thumbnailUrl} alt={activeSite.siteName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm">
                          {activeSite?.siteName || 'Instagram'} · Current slot
                        </div>
                        <div className={`text-xs mt-0.5 tabular-nums ${textMuted}`}>
                          {activeSite?.canvas
                            ? `${activeSite.name} · ${activeSite.width} × ${activeSite.height}`
                            : 'Empty slot · Upload or simulate with SLAM'}
                        </div>
                      </div>
                    </div>

                    {/* Upload / Clear slot buttons */}
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => slotFileInputRef.current?.click()}
                        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${btnOutline}`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload image</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSites(prev => {
                            const next = [...prev];
                            next[activeSiteIndex] = {
                              ...next[activeSiteIndex],
                              canvas: undefined,
                              imageData: undefined,
                              thumbnailUrl: undefined,
                              width: 0,
                              height: 0,
                              fileSize: 0
                            };
                            return next;
                          });
                          showToast(`Cleared Slot ${activeSiteIndex + 1}`);
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${btnOutline}`}
                      >
                        Clear slot
                      </button>
                    </div>

                    {/* Import destination & Remote image URL (Always visible in Expert Mode, or expandable in Guided Mode) */}
                    {(expertMode || showUrlImportInGuided) ? (
                      <>
                        <div className={`flex items-center justify-between py-3 border-y text-xs ${borderSubtle}`}>
                          <span className="font-medium">Import destination</span>
                          <div className="flex items-center gap-1 font-semibold text-[#1B4D7E] dark:text-sky-400">
                            <select
                              value={String(importDest)}
                              onChange={e => {
                                const val = e.target.value;
                                setImportDest(val === 'original' ? 'original' : (parseInt(val, 10) as 0 | 1 | 2));
                              }}
                              className="bg-transparent outline-none cursor-pointer pr-1 text-right font-semibold"
                            >
                              <option value="0">Slot 1</option>
                              <option value="1">Slot 2</option>
                              <option value="2">Slot 3</option>
                              <option value="original">Original</option>
                            </select>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-xs font-bold">Remote image URL</label>
                          <input
                            type="url"
                            value={remoteUrl}
                            onChange={e => setRemoteUrl(e.target.value)}
                            placeholder="https://example.com/image.png"
                            className={`w-full px-3.5 py-2.5 rounded-xl text-xs border-2 border-[#1B4D7E] bg-transparent outline-none`}
                          />
                          <p className={`text-xs ${textMuted}`}>
                            Choose Original or a comparison slot as the import destination.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleUrlLoad(importDest, remoteUrl)}
                            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${btnOutline}`}
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            <span>Retrieve image</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className={`py-2 border-t text-xs flex items-center justify-between ${borderSubtle}`}>
                        <span className={textMuted}>Need to fetch an image from a web link?</span>
                        <button
                          type="button"
                          onClick={() => setShowUrlImportInGuided(true)}
                          className="font-semibold text-[#1B4D7E] dark:text-sky-400 hover:underline cursor-pointer"
                        >
                          Show URL import
                        </button>
                      </div>
                    )}

                    {/* Platform selector */}
                    <div className={`flex items-center justify-between py-3 border-y text-xs ${borderSubtle}`}>
                      <span className="font-medium">Platform</span>
                      <div className="flex items-center gap-1 font-semibold text-[#1B4D7E] dark:text-sky-400">
                        <select
                          value={activeSite?.siteName || 'Instagram'}
                          onChange={e => {
                            const newPlatform = e.target.value;
                            const def = SITES_DATABASE.find(s => s.name === newPlatform);
                            setSites(prev => {
                              const next = [...prev];
                              next[activeSiteIndex] = {
                                ...next[activeSiteIndex],
                                siteName: newPlatform,
                                siteNotes: def?.notes
                              };
                              return next;
                            });
                            if (autoSlam && original.canvas) {
                              handleRunSlamForSlot(activeSiteIndex, newPlatform);
                            }
                          }}
                          className="bg-transparent outline-none cursor-pointer pr-1 text-right font-semibold"
                        >
                          {SITES_DATABASE.map(s => (
                            <option key={s.name} value={s.name} className="text-slate-900">
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    {/* Auto-simulate (SLAM) & Auto-visualize Toggles */}
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">Auto-simulate (SLAM)</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setAutoSlam(prev => !prev)}
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                              autoSlam ? 'bg-[#34D399]' : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-[#0F2942] transition-transform ${
                                autoSlam ? 'translate-x-4.5' : 'translate-x-1'
                              }`}
                            />
                          </button>
                          <span className="font-medium w-5">{autoSlam ? 'On' : 'Off'}</span>
                        </div>
                      </div>

                      {expertMode && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">Auto-visualize</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setAutoVisualize(prev => !prev)}
                              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                                autoVisualize ? 'bg-[#34D399]' : 'bg-slate-300 dark:bg-slate-700'
                              }`}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-[#0F2942] transition-transform ${
                                  autoVisualize ? 'translate-x-4.5' : 'translate-x-1'
                                }`}
                              />
                            </button>
                            <span className="font-medium w-5">{autoVisualize ? 'On' : 'Off'}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Simulate (SLAM) Button */}
                    <div className="space-y-2 pt-1">
                      <button
                        type="button"
                        disabled={isSlamRunning || !original.canvas}
                        onClick={() => handleRunSlamForSlot(activeSiteIndex)}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${btnOutline}`}
                      >
                        <Zap className="w-3.5 h-3.5 text-[#1B4D7E] dark:text-sky-400" />
                        <span>{isSlamRunning ? 'Simulating...' : 'Simulate (SLAM)'}</span>
                      </button>
                      <p className={`text-xs ${textMuted}`}>
                        SLAM simulates {activeSite?.siteName || 'Instagram'} compression for the selected comparison slot.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Workflow Bar */}
              <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t ${borderSubtle}`}>
                <span className={`text-xs ${textMuted}`}>
                  {readySlotsCount} comparison{readySlotsCount === 1 ? '' : 's'} ready · {Math.max(0, 3 - readySlotsCount)} more slot{3 - readySlotsCount === 1 ? '' : 's'} available
                </span>
                <button
                  type="button"
                  onClick={() => setActiveWorkflow('compare')}
                  className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${btnPrimary}`}
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>Compare images</span>
                </button>
              </div>
            </div>
          )}

          {/* =====================================================================
              WORKFLOW 2: COMPARE ("See what compression changes.")
             ===================================================================== */}
          {activeWorkflow === 'compare' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Compare</h1>
                <p className={`text-sm mt-1 ${textMuted}`}>
                  See what compression changes.
                </p>
              </div>

              {/* Top Slot Pill & Swap Button */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {[0, 1, 2].map(idx => {
                    const s = sites[idx];
                    const isSelected = idx === activeSiteIndex;
                    if (!isSelected && !s?.canvas && idx > 0) return null;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveSiteIndex(idx)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#E2ECF7] dark:bg-[#1B4D7E] border-[#1B4D7E] text-[#0F2942] dark:text-white'
                            : `${btnOutline}`
                        }`}
                      >
                        Slot {idx + 1} · {s?.siteName || 'Slot'}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setViewConfig(prev => ({ ...prev, swapped: !prev.swapped }))}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${btnOutline}`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>Swap</span>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Dark Navy Canvas Card + Split Slider + Zoom + Metrics */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Dark Navy Canvas Card */}
                  <div className="rounded-2xl bg-[#0B2545] p-3.5 text-white shadow-md space-y-2.5 border border-[#1B3B64]">
                    <div className="flex items-center justify-between text-xs px-1">
                      <span className="font-medium text-slate-200">
                        {viewConfig.swapped ? `${activeSite?.siteName || 'Instagram'} · heatmap` : 'Original'}
                      </span>
                      <span className="font-semibold text-[#FFDD33]">
                        {viewConfig.swapped ? 'Original' : `${activeSite?.siteName || 'Instagram'} · heatmap`}
                      </span>
                    </div>

                    <div className="h-[290px] sm:h-[360px] w-full rounded-xl overflow-hidden relative border border-white/10">
                      <CompareCanvas
                        ref={compareCanvasRef}
                        original={original}
                        activeSite={activeSite}
                        allSites={sites.filter(s => Boolean(s.canvas))}
                        diffBuffer={diffBuffer}
                        stats={stats}
                        layout={layout}
                        config={heatmapConfig}
                        view={viewConfig}
                        setView={setViewConfig}
                        spacePeek={spacePeek}
                        onSelectSiteSlot={idx => setActiveSiteIndex(idx)}
                        isCropToolActive={isCropToolActive}
                        setIsCropToolActive={setIsCropToolActive}
                        cropRegion={cropRegion}
                        onApplyCrop={handleApplyCrop}
                        onClearCrop={handleClearCrop}
                        onClearTonalFilter={handleClearTonalFilter}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-300 px-1 tabular-nums">
                      <span>
                        {original.width || 1600} × {original.height || 1200} → {activeSite?.width || 1080} × {activeSite?.height || 810} px
                      </span>
                      {stats?.roi && (
                        <span className="inline-flex items-center gap-1.5 text-sky-300 font-mono">
                          <span>ROI: {stats.roi.width}×{stats.roi.height} px</span>
                          <button
                            type="button"
                            onClick={handleClearCrop}
                            className="underline hover:text-white cursor-pointer"
                          >
                            Reset
                          </button>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Split Position Slider Card */}
                  <div className={`rounded-2xl border p-4 space-y-2.5 shadow-2xs ${bgCard}`}>
                    <div className="flex items-center justify-between text-xs font-semibold tabular-nums">
                      <span>Split position</span>
                      <span>{Math.round(viewConfig.splitPos * 100)}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setViewConfig(prev => ({ ...prev, splitPos: Math.max(0, Math.round((prev.splitPos - 0.05) * 100) / 100) }))}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer ${btnOutline}`}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={viewConfig.splitPos}
                        onChange={e => setViewConfig(prev => ({ ...prev, splitPos: parseFloat(e.target.value) }))}
                        className="flex-1 accent-[#1B4D7E] h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => setViewConfig(prev => ({ ...prev, splitPos: Math.min(1, Math.round((prev.splitPos + 0.05) * 100) / 100) }))}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer ${btnOutline}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Zoom Controls Row */}
                  <div className="flex flex-wrap items-center gap-2 tabular-nums">
                    <button
                      type="button"
                      onClick={handleFitToScreen}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${btnOutline}`}
                    >
                      <Maximize className="w-3.5 h-3.5" />
                      <span>Fit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewConfig(prev => ({ ...prev, zoom: Math.max(0.2, Math.round(prev.zoom * 0.8 * 100) / 100) }))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${btnOutline}`}
                    >
                      −
                    </button>
                    <span className="px-2 text-xs font-bold">
                      {Math.round(viewConfig.zoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setViewConfig(prev => ({ ...prev, zoom: Math.min(16, Math.round(prev.zoom * 1.25 * 100) / 100) }))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${btnOutline}`}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={handleResetZoom100}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${btnOutline}`}
                    >
                      Reset
                    </button>
                  </div>

                  {/* 3 Metric KPI Cards (with plain-English subtitles in Guided Mode) */}
                  <div className="grid grid-cols-3 gap-3 tabular-nums">
                    <div className={`rounded-2xl border p-3.5 shadow-2xs ${bgCard}`}>
                      <div className={`text-xs font-medium ${textMuted}`}>PSNR</div>
                      <div className="text-lg sm:text-xl font-bold mt-1">
                        {stats ? `${stats.psnrDb} dB` : '24.6 dB'}
                      </div>
                      {!expertMode && (
                        <div className={`text-[10px] mt-0.5 ${textMuted}`}>
                          Signal clarity
                        </div>
                      )}
                    </div>
                    <div className={`rounded-2xl border p-3.5 shadow-2xs ${bgCard}`}>
                      <div className={`text-xs font-medium ${textMuted}`}>SSIM</div>
                      <div className="text-lg sm:text-xl font-bold mt-1">
                        {stats ? stats.ssimMean : '0.997'}
                      </div>
                      {!expertMode && (
                        <div className={`text-[10px] mt-0.5 ${textMuted}`}>
                          {stats ? `${(stats.ssimMean * 100).toFixed(1)}% structure kept` : '99.7% structure kept'}
                        </div>
                      )}
                    </div>
                    <div className={`rounded-2xl border p-3.5 shadow-2xs ${bgCard}`}>
                      <div className={`text-xs font-medium ${textMuted}`}>Mean ΔE2000</div>
                      <div className="text-lg sm:text-xl font-bold mt-1">
                        {stats ? stats.deltaE2000Mean : '3.46'}
                      </div>
                      {!expertMode && (
                        <div className={`text-[10px] mt-0.5 ${textMuted}`}>
                          Colour difference
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Summary Text + Open Analysis CTA */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <p className={`text-xs leading-relaxed max-w-md ${textMuted}`}>
                      {getDiagnosticSummary()}
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveWorkflow('analysis')}
                      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer ${btnPrimary}`}
                    >
                      <ArrowRight className="w-4 h-4" />
                      <span>Open Analysis</span>
                    </button>
                  </div>
                </div>

                {/* Right Column: Comparison mode Card + Inspect details Card */}
                <div className="lg:col-span-5 space-y-5">
                  {/* Comparison mode Card */}
                  <div className={`rounded-2xl border p-5 space-y-3 shadow-2xs ${bgCard}`}>
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-bold">Comparison mode</h2>
                      {!expertMode && (
                        <span className={`text-[11px] ${textMuted}`}>4 essential views</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-1 gap-2">
                      {(expertMode
                        ? [
                            { id: 'heatmap', label: 'Heatmap' },
                            { id: 'loupe', label: 'Loupe' },
                            { id: 'left_right', label: 'Left / right' },
                            { id: 'top_bottom', label: 'Top / bottom' },
                            { id: 'split_lr', label: 'Split L/R' },
                            { id: 'split_tb', label: 'Split T/B' },
                            { id: 'survey', label: 'Survey' }
                          ]
                        : [
                            { id: 'split_lr', label: 'Split L/R (Recommended)' },
                            { id: 'heatmap', label: 'Heatmap (Show differences)' },
                            { id: 'loupe', label: 'Loupe (Magnifier)' },
                            { id: 'left_right', label: 'Left / right (Side by side)' }
                          ]
                      ).map(m => {
                        const active = compareModeButton === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleSelectCompareMode(m.id as typeof compareModeButton)}
                            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                              active
                                ? 'bg-[#1B4D7E] border-[#1B4D7E] text-white shadow-2xs'
                                : `${btnOutline}`
                            }`}
                          >
                            <span>{m.label}</span>
                            {active && <Check className="w-4 h-4 stroke-[2.5]" />}
                          </button>
                        );
                      })}
                    </div>
                    {!expertMode && (
                      <button
                        type="button"
                        onClick={() => setExpertMode(true)}
                        className="text-[11px] font-semibold text-[#1B4D7E] dark:text-sky-400 hover:underline cursor-pointer pt-1"
                      >
                        + Unlock Survey, Top/Bottom & Split T/B in Expert Mode
                      </button>
                    )}
                  </div>

                  {/* Inspect details Card */}
                  <div className={`rounded-2xl border p-5 space-y-4 shadow-2xs ${bgCard}`}>
                    <h2 className="text-base font-bold">Inspect details</h2>

                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">Linked views</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setViewConfig(prev => ({ ...prev, linkedFocus: !prev.linkedFocus }))}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                            viewConfig.linkedFocus ? 'bg-[#34D399]' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-[#0F2942] transition-transform ${
                              viewConfig.linkedFocus ? 'translate-x-4.5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <span className="font-medium">{viewConfig.linkedFocus ? 'On' : 'Off'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setIsCropToolActive(prev => !prev)}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                          isCropToolActive || cropRegion?.active
                            ? 'bg-[#1B4D7E] border-[#1B4D7E] text-white'
                            : btnOutline
                        }`}
                      >
                        <Crop className="w-3.5 h-3.5" />
                        <span>Crop ROI</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => updateSmartArtifacts({ enabled: !smartArtifacts.enabled })}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                          smartArtifacts.enabled
                            ? 'bg-[#1B4D7E] border-[#1B4D7E] text-white'
                            : btnOutline
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Artifacts</span>
                      </button>
                    </div>

                    {/* Interactive Crop ROI Quick Controls when active */}
                    {(isCropToolActive || cropRegion?.active) && (
                      <div className={`p-3 rounded-xl border space-y-2 text-xs ${bgSubtle}`}>
                        <div className="flex items-center justify-between font-semibold">
                          <span className="flex items-center gap-1.5">
                            <Focus className="w-3.5 h-3.5 text-sky-500" />
                            <span>Region of Interest (ROI)</span>
                          </span>
                          {cropRegion?.active && (
                            <button
                              type="button"
                              onClick={handleClearCrop}
                              className="text-sky-600 dark:text-sky-400 hover:underline text-[11px] cursor-pointer"
                            >
                              Reset Full
                            </button>
                          )}
                        </div>
                        <p className={`text-[11px] ${textMuted}`}>
                          Drag a box directly on the comparison canvas or pick a quick region preset:
                        </p>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleApplyPresetCrop('center50')}
                            className={`py-1 px-2 rounded-lg text-[11px] font-medium cursor-pointer ${btnOutline}`}
                          >
                            Center 50%
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyPresetCrop('center25')}
                            className={`py-1 px-2 rounded-lg text-[11px] font-medium cursor-pointer ${btnOutline}`}
                          >
                            Center 25%
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyPresetCrop('top50')}
                            className={`py-1 px-2 rounded-lg text-[11px] font-medium cursor-pointer ${btnOutline}`}
                          >
                            Top Half
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Smart Artifact Detection Controls when active */}
                    {smartArtifacts.enabled && (
                      <div className={`p-3 rounded-xl border space-y-2.5 text-xs ${bgSubtle}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                            <span>Smart Artifact CV Overlay</span>
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-600 dark:text-sky-300">
                            Active
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {(['both', 'ringing', 'edges'] as const).map(m => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => updateSmartArtifacts({ mode: m })}
                              className={`py-1 px-2 rounded-lg text-[11px] font-medium capitalize border cursor-pointer ${
                                smartArtifacts.mode === m
                                  ? 'bg-[#1B4D7E] border-[#1B4D7E] text-white'
                                  : btnOutline
                              }`}
                            >
                              {m === 'both' ? 'All' : m}
                            </button>
                          ))}
                        </div>
                        {artifactTelemetry && (
                          <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] tabular-nums">
                            <div>
                              <span className={textMuted}>Edge Loss: </span>
                              <strong className="font-mono">{artifactTelemetry.edgeDegradationPct}%</strong>
                            </div>
                            <div>
                              <span className={textMuted}>Ringing Halo: </span>
                              <strong className="font-mono">{artifactTelemetry.ringingSeverityPct}%</strong>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              WORKFLOW 3: ANALYSIS ("Understand the differences in this pair.")
             ===================================================================== */}
          {activeWorkflow === 'analysis' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Analysis</h1>
                <p className={`text-sm mt-1 ${textMuted}`}>
                  Understand the differences in this pair.
                </p>
              </div>

              {/* 4-Tab Segmented Bar: Heatmap | Histogram | Stats | Causal Impact (Causica) */}
              <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 rounded-2xl border ${bgCard}`}>
                {(['heatmap', 'histogram', 'stats', 'causal'] as const).map(tab => {
                  const active = analysisSubTab === tab;
                  const label =
                    tab === 'heatmap'
                      ? 'Heatmap'
                      : tab === 'histogram'
                      ? 'Histogram'
                      : tab === 'stats'
                      ? 'Stats'
                      : 'Causal Impact (Causica)';
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setAnalysisSubTab(tab)}
                      className={`py-2.5 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        active
                          ? 'bg-[#1B4D7E] text-white shadow-2xs'
                          : `${textMuted} hover:text-[#0F2942] dark:hover:text-white`
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* SUB-TAB 1: HEATMAP */}
              {analysisSubTab === 'heatmap' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Dark Navy Heatmap Canvas + KPIs + What the numbers mean */}
                  <div className="lg:col-span-6 space-y-4">
                    <div className="rounded-2xl bg-[#0B2545] p-3.5 text-white shadow-md space-y-2.5 border border-[#1B3B64]">
                      <div className="flex items-center justify-between text-xs px-1">
                        <span className="font-medium text-slate-200">Original</span>
                        <span className="font-semibold text-[#FFDD33]">
                          {activeSite?.siteName || 'Instagram'} · {COLORMAP_LABELS[heatmapConfig.colormap]}
                        </span>
                      </div>

                      <div className="h-[250px] sm:h-[300px] w-full rounded-xl overflow-hidden relative border border-white/10">
                        <CompareCanvas
                          ref={compareCanvasRef}
                          original={original}
                          activeSite={activeSite}
                          allSites={sites.filter(s => Boolean(s.canvas))}
                          diffBuffer={diffBuffer}
                          stats={stats}
                          layout={layout}
                          config={heatmapConfig}
                          view={viewConfig}
                          setView={setViewConfig}
                          spacePeek={spacePeek}
                          onSelectSiteSlot={idx => setActiveSiteIndex(idx)}
                          isCropToolActive={isCropToolActive}
                          setIsCropToolActive={setIsCropToolActive}
                          cropRegion={cropRegion}
                          onApplyCrop={handleApplyCrop}
                          onClearCrop={handleClearCrop}
                          onClearTonalFilter={handleClearTonalFilter}
                        />
                      </div>

                      <div className="text-[11px] text-slate-300 px-1 tabular-nums">
                        {original.width || 1600} × {original.height || 1200} → {activeSite?.width || 1080} × {activeSite?.height || 810} px
                      </div>
                    </div>

                    {/* 3 Metric KPI Cards */}
                    <div className="grid grid-cols-3 gap-3 tabular-nums">
                      <div className={`rounded-2xl border p-3.5 shadow-2xs ${bgCard}`}>
                        <div className={`text-xs font-medium ${textMuted}`}>PSNR</div>
                        <div className="text-lg sm:text-xl font-bold mt-1">
                          {stats ? `${stats.psnrDb} dB` : '24.6 dB'}
                        </div>
                      </div>
                      <div className={`rounded-2xl border p-3.5 shadow-2xs ${bgCard}`}>
                        <div className={`text-xs font-medium ${textMuted}`}>SSIM</div>
                        <div className="text-lg sm:text-xl font-bold mt-1">
                          {stats ? stats.ssimMean : '0.997'}
                        </div>
                      </div>
                      <div className={`rounded-2xl border p-3.5 shadow-2xs ${bgCard}`}>
                        <div className={`text-xs font-medium ${textMuted}`}>Mean ΔE2000</div>
                        <div className="text-lg sm:text-xl font-bold mt-1">
                          {stats ? stats.deltaE2000Mean : '3.46'}
                        </div>
                      </div>
                    </div>

                    {/* What the numbers mean Card */}
                    <div className={`rounded-2xl border p-5 space-y-3 shadow-2xs ${bgCard}`}>
                      <h3 className="text-sm font-bold">What the numbers mean</h3>
                      <p className={`text-xs leading-relaxed ${textMuted}`}>
                        {getDiagnosticSummary()}
                      </p>
                      <div className={`pt-2 border-t space-y-2 text-xs tabular-nums ${borderSubtle}`}>
                        <div className="flex items-center justify-between">
                          <span className={textMuted}>95th percentile (p95)</span>
                          <span className="font-bold">{stats ? stats.p95Val : '12.07'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={textMuted}>p99 / maximum</span>
                          <span className="font-bold">{stats ? stats.p99Val : '29.98'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Heatmap settings Card */}
                  <div className="lg:col-span-6">
                    <div className={`rounded-2xl border p-5 sm:p-6 space-y-5 shadow-2xs ${bgCard}`}>
                      <h2 className="text-base font-bold">Heatmap settings</h2>

                      {/* Difference metric selector */}
                      <div className={`flex items-center justify-between pb-3 border-b text-xs ${borderSubtle}`}>
                        <span className="font-medium">Difference metric</span>
                        <div className="flex items-center gap-1 font-semibold text-[#1B4D7E] dark:text-sky-400">
                          <select
                            value={heatmapConfig.metric}
                            onChange={e => setHeatmapConfig(prev => ({ ...prev, metric: e.target.value as MetricType }))}
                            className="bg-transparent outline-none cursor-pointer text-right font-semibold"
                          >
                            {METRIC_OPTIONS.map(m => (
                              <option key={m.id} value={m.id} className="text-slate-900">
                                {m.label}
                              </option>
                            ))}
                          </select>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </div>

                      {/* Colour ramp 2x3 Grid */}
                      <div className="space-y-2.5">
                        <label className="block text-xs font-bold">Colour ramp</label>
                        <div className="grid grid-cols-2 gap-2.5">
                          {COLORMAP_OPTIONS.map(cmap => {
                            const isSelected = heatmapConfig.colormap === cmap;
                            return (
                              <button
                                key={cmap}
                                type="button"
                                onClick={() => setHeatmapConfig(prev => ({ ...prev, colormap: cmap }))}
                                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-[#E2ECF7] dark:bg-[#1B4D7E]/40 border-[#1B4D7E] shadow-2xs'
                                    : `${bgSubtle} hover:border-slate-400`
                                }`}
                              >
                                <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                                  <span>{COLORMAP_LABELS[cmap]}</span>
                                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                                </div>
                                <div
                                  className="h-2.5 w-full rounded-full"
                                  style={{ background: getColormapCssGradient(cmap) }}
                                />
                              </button>
                            );
                          })}
                        </div>

                        {/* Scale Legend Bar */}
                        <div className="pt-2 space-y-1">
                          <div
                            className="h-2.5 w-full rounded-full"
                            style={{ background: getColormapCssGradient(heatmapConfig.colormap) }}
                          />
                          <div className={`flex items-center justify-between text-[11px] tabular-nums ${textMuted}`}>
                            <span>0 · Less error</span>
                            <span>{stats ? stats.p99Val : '29.98'} · More error</span>
                          </div>
                        </div>
                      </div>

                      {/* Overlay intensity */}
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between text-xs font-semibold tabular-nums">
                          <span>Overlay intensity</span>
                          <span>{Math.round(heatmapConfig.intensity * 100)}%</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setHeatmapConfig(prev => ({ ...prev, intensity: Math.max(0, Math.round((prev.intensity - 0.05) * 100) / 100) }))}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer ${btnOutline}`}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={heatmapConfig.intensity}
                            onChange={e => setHeatmapConfig(prev => ({ ...prev, intensity: parseFloat(e.target.value) }))}
                            className="flex-1 accent-[#1B4D7E] h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => setHeatmapConfig(prev => ({ ...prev, intensity: Math.min(1, Math.round((prev.intensity + 0.05) * 100) / 100) }))}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer ${btnOutline}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Advanced settings collapsible */}
                      <div className={`pt-3 border-t space-y-4 ${borderSubtle}`}>
                        <button
                          type="button"
                          onClick={() => setShowAdvancedHeatmap(prev => !prev)}
                          className="w-full flex items-center justify-between text-xs font-bold cursor-pointer"
                        >
                          <span>Advanced settings</span>
                          {showAdvancedHeatmap ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>

                        {showAdvancedHeatmap && (
                          <div className="space-y-4 pt-1">
                            {/* Opacity follows error */}
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium">Opacity follows error</span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setHeatmapConfig(prev => ({ ...prev, proportional: !prev.proportional }))}
                                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                                    heatmapConfig.proportional ? 'bg-[#34D399]' : 'bg-slate-300 dark:bg-slate-700'
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-[#0F2942] transition-transform ${
                                      heatmapConfig.proportional ? 'translate-x-4.5' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                                <span className="font-medium w-5">{heatmapConfig.proportional ? 'On' : 'Off'}</span>
                              </div>
                            </div>

                            {/* Auto scale (99th percentile) */}
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium">Auto scale (99th percentile)</span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setHeatmapConfig(prev => ({ ...prev, autoScale: !prev.autoScale }))}
                                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                                    heatmapConfig.autoScale ? 'bg-[#34D399]' : 'bg-slate-300 dark:bg-slate-700'
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-[#0F2942] transition-transform ${
                                      heatmapConfig.autoScale ? 'translate-x-4.5' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                                <span className="font-medium w-5">{heatmapConfig.autoScale ? 'On' : 'Off'}</span>
                              </div>
                            </div>

                            {/* Gamma curve */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs font-semibold tabular-nums">
                                <span>Gamma curve</span>
                                <span>{heatmapConfig.gamma.toFixed(1)}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => setHeatmapConfig(prev => ({ ...prev, gamma: Math.max(0.2, Math.round((prev.gamma - 0.1) * 10) / 10) }))}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer ${btnOutline}`}
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <input
                                  type="range"
                                  min={0.25}
                                  max={3.0}
                                  step={0.05}
                                  value={heatmapConfig.gamma}
                                  onChange={e => setHeatmapConfig(prev => ({ ...prev, gamma: parseFloat(e.target.value) }))}
                                  className="flex-1 accent-[#1B4D7E] h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                                />
                                <button
                                  type="button"
                                  onClick={() => setHeatmapConfig(prev => ({ ...prev, gamma: Math.min(3.0, Math.round((prev.gamma + 0.1) * 10) / 10) }))}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer ${btnOutline}`}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Smart Artifact Detection toggle */}
                            <div className="flex items-center justify-between text-xs pt-1">
                              <span className="font-medium">Smart Artifact Detection (Edge & Ringing)</span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => updateSmartArtifacts({ enabled: !smartArtifacts.enabled })}
                                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                                    smartArtifacts.enabled ? 'bg-[#34D399]' : 'bg-slate-300 dark:bg-slate-700'
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-[#0F2942] transition-transform ${
                                      smartArtifacts.enabled ? 'translate-x-4.5' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                                <span className="font-medium w-5">{smartArtifacts.enabled ? 'On' : 'Off'}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB 2: HISTOGRAM (Includes Contrast Stretch & Interactive Range Selection) */}
              {analysisSubTab === 'histogram' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-5 space-y-4">
                    <div className="rounded-2xl bg-[#0B2545] p-3.5 text-white shadow-md space-y-2.5 border border-[#1B3B64]">
                      <div className="flex items-center justify-between text-xs px-1">
                        <span className="font-medium text-slate-200">Original</span>
                        <span className="font-semibold text-[#FFDD33]">
                          {activeSite?.siteName || 'Instagram'} · Tonal Inspection
                        </span>
                      </div>
                      <div className="h-[250px] w-full rounded-xl overflow-hidden relative border border-white/10">
                        <CompareCanvas
                          ref={compareCanvasRef}
                          original={original}
                          activeSite={activeSite}
                          allSites={sites.filter(s => Boolean(s.canvas))}
                          diffBuffer={diffBuffer}
                          stats={stats}
                          layout={layout}
                          config={heatmapConfig}
                          view={viewConfig}
                          setView={setViewConfig}
                          spacePeek={spacePeek}
                          isCropToolActive={isCropToolActive}
                          setIsCropToolActive={setIsCropToolActive}
                          cropRegion={cropRegion}
                          onApplyCrop={handleApplyCrop}
                          onClearCrop={handleClearCrop}
                          onClearTonalFilter={handleClearTonalFilter}
                        />
                      </div>
                      <div className="text-[11px] text-slate-300 px-1 tabular-nums flex items-center justify-between">
                        <span>
                          {original.width || 1600} × {original.height || 1200} → {activeSite?.width || 1080} × {activeSite?.height || 810} px
                        </span>
                        {heatmapConfig.tonalFilter?.active && (heatmapConfig.tonalFilter.min > 0 || heatmapConfig.tonalFilter.max < 255) && (
                          <span className="text-sky-300 font-mono">
                            Filtered: {heatmapConfig.tonalFilter.min}–{heatmapConfig.tonalFilter.max}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={`rounded-2xl border p-5 space-y-2.5 shadow-2xs ${bgCard}`}>
                      <h3 className="text-sm font-bold">Histogram & Contrast Stretch Guide</h3>
                      <p className={`text-xs leading-relaxed ${textMuted}`}>
                        Toggle <strong>Contrast Stretch</strong> to normalize histogram bin values (0–100%) across the full 0–255 scale, making low-contrast posterization and comb gaps easy to spot. Click and drag directly across the histogram chart to filter the tonal range of the current comparison in real time.
                      </p>
                    </div>
                  </div>

                  <div className="lg:col-span-7">
                    <div className={`rounded-2xl border p-5 shadow-2xs ${bgCard}`}>
                      <RgbHistogramPanel
                        activeSite={activeSite}
                        original={original}
                        lightMode={!darkMode}
                        tonalFilter={heatmapConfig.tonalFilter}
                        onChangeTonalFilter={tf => setHeatmapConfig(prev => ({ ...prev, tonalFilter: tf }))}
                        stats={stats}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB 3: STATS */}
              {analysisSubTab === 'stats' && (
                <div className="space-y-5">
                  {/* Guided Everyday Summary Card (always shown first so users aren't overwhelmed) */}
                  <div className={`rounded-2xl border p-5 space-y-4 shadow-2xs ${bgCard}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold">Plain-English Quality Summary</h3>
                        <p className={`text-xs mt-0.5 ${textMuted}`}>
                          What compression changed between your Original and {activeSite?.siteName || 'Instagram'} version
                        </p>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#5CE1A6] text-[#064E3B] tabular-nums">
                        {stats ? `${(stats.ssimMean * 100).toFixed(1)}% Visual Match` : '99.7% Visual Match'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 tabular-nums">
                      <div className={`p-3.5 rounded-xl border ${bgSubtle}`}>
                        <div className="text-xs font-bold">Sharpness & Structure</div>
                        <div className="text-base font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                          {stats && stats.ssimMean < 0.95 ? 'Softened' : 'Closely Preserved'}
                        </div>
                        <p className={`text-[11px] mt-1 leading-snug ${textMuted}`}>
                          Edges and overall shapes match the original at {stats ? `${(stats.ssimMean * 100).toFixed(1)}%` : '99.7%'}.
                        </p>
                      </div>

                      <div className={`p-3.5 rounded-xl border ${bgSubtle}`}>
                        <div className="text-xs font-bold">Colour Accuracy</div>
                        <div className="text-base font-bold mt-1 text-amber-600 dark:text-amber-400">
                          {stats && stats.deltaE2000Mean <= 2.3 ? 'Virtually Identical' : 'Mild Colour Shift'}
                        </div>
                        <p className={`text-[11px] mt-1 leading-snug ${textMuted}`}>
                          Average colour shift is ΔE {stats ? stats.deltaE2000Mean : '3.46'} (values above 2.3 are noticeable on close inspection).
                        </p>
                      </div>

                      <div className={`p-3.5 rounded-xl border ${bgSubtle}`}>
                        <div className="text-xs font-bold">Resolution & Storage</div>
                        <div className="text-base font-bold mt-1">
                          {original.width || 1600}×{original.height || 1200} → {activeSite?.width || 1080}×{activeSite?.height || 810}
                        </div>
                        <p className={`text-[11px] mt-1 leading-snug ${textMuted}`}>
                          Original ({original.fileSize ? formatBytes(original.fileSize) : '3.62 MB'}) resized for {activeSite?.siteName || 'Instagram'}.
                        </p>
                      </div>
                    </div>

                    {!expertMode && (
                      <div className={`pt-3 border-t flex items-center justify-between text-xs ${borderSubtle}`}>
                        <span className={textMuted}>
                          Want raw mathematical percentiles (p95, p99) and JPEG quantization forensics?
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpertMode(true)}
                          className="font-semibold text-[#1B4D7E] dark:text-sky-400 hover:underline cursor-pointer"
                        >
                          Turn on Expert Mode
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Full Expert Mathematical & Forensic Tables (Shown when Expert Mode is ON) */}
                  {expertMode && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      <div className="lg:col-span-6 space-y-4">
                        <div className={`rounded-2xl border p-5 space-y-4 shadow-2xs tabular-nums ${bgCard}`}>
                          <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold">Perceptual & Mathematical Metrics</h3>
                            {stats?.roi && (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/15 text-sky-600 dark:text-sky-300">
                                ROI ({stats.roi.width}×{stats.roi.height})
                              </span>
                            )}
                          </div>

                          <div className={`divide-y text-xs ${borderSubtle}`}>
                            <div className="py-2.5 flex justify-between">
                              <span className={textMuted}>PSNR (Peak Signal-to-Noise Ratio)</span>
                              <span className="font-bold">{stats ? `${stats.psnrDb} dB` : '24.6 dB'}</span>
                            </div>
                            <div className="py-2.5 flex justify-between">
                              <span className={textMuted}>SSIM (Structural Similarity Index)</span>
                              <span className="font-bold">{stats ? stats.ssimMean : '0.997'}</span>
                            </div>
                            <div className="py-2.5 flex justify-between">
                              <span className={textMuted}>Mean ΔE2000 (Perceptual Colour Error)</span>
                              <span className="font-bold">{stats ? stats.deltaE2000Mean : '3.46'}</span>
                            </div>
                            <div className="py-2.5 flex justify-between">
                              <span className={textMuted}>Maximum ΔE2000 Peak</span>
                              <span className="font-bold">{stats ? stats.deltaE2000Max : '29.98'}</span>
                            </div>
                            <div className="py-2.5 flex justify-between">
                              <span className={textMuted}>95th Percentile (p95)</span>
                              <span className="font-bold">{stats ? stats.p95Val : '12.07'}</span>
                            </div>
                            <div className="py-2.5 flex justify-between">
                              <span className={textMuted}>99th Percentile (p99)</span>
                              <span className="font-bold">{stats ? stats.p99Val : '29.98'}</span>
                            </div>
                            <div className="py-2.5 flex justify-between">
                              <span className={textMuted}>Noticeably Changed Pixels (ΔE &gt; 2.3)</span>
                              <span className="font-bold">{stats ? `${stats.visibleChangesPct}%` : '48.2%'}</span>
                            </div>
                            <div className="py-2.5 flex justify-between">
                              <span className={textMuted}>Bit-Identical Pixels</span>
                              <span className="font-bold">{stats ? `${stats.untouchedPixelsPct}%` : '4.1%'}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="lg:col-span-6 space-y-4">
                        <div className={`rounded-2xl border p-5 space-y-4 shadow-2xs tabular-nums ${bgCard}`}>
                          <h3 className="text-base font-bold">Compression & Format Forensics</h3>
                          <div className={`divide-y text-xs ${borderSubtle}`}>
                            <div className="py-2.5 flex justify-between">
                              <span className={textMuted}>Original Dimensions & Format</span>
                              <span className="font-bold">{original.width} × {original.height} · {original.format}</span>
                            </div>
                            <div className="py-2.5 flex justify-between">
                              <span className={textMuted}>Comparison Dimensions & Format</span>
                              <span className="font-bold">{activeSite?.width} × {activeSite?.height} · {activeSite?.format}</span>
                            </div>
                            <div className="py-2.5 flex justify-between">
                              <span className={textMuted}>Estimated JPEG Luma Quality</span>
                              <span className="font-bold">
                                {activeSite?.jpegInfo?.ok ? `q${activeSite.jpegInfo.estimatedLumaQuality}` : 'q78 (SLAM Standard)'}
                              </span>
                            </div>
                            <div className="py-2.5 flex justify-between">
                              <span className={textMuted}>Chroma Subsampling</span>
                              <span className="font-bold">
                                {activeSite?.jpegInfo?.subsampling || '4:2:0'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SUB-TAB 4: MICROSOFT CAUSICA CROSS-PROFILE ENGAGEMENT ATTRIBUTION */}
              {analysisSubTab === 'causal' && (
                <CausalAnalysisPanel
                  original={original}
                  sites={sites}
                  activeSite={activeSiteIndex}
                  stats={stats}
                  darkMode={darkMode}
                  onOpenSocialModal={() => setIsSocialModalOpen(true)}
                />
              )}

              {/* Bottom Navigation Row */}
              <div className={`flex items-center justify-between pt-4 border-t ${borderSubtle}`}>
                <button
                  type="button"
                  onClick={() => setActiveWorkflow('compare')}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer ${btnOutline}`}
                >
                  Compare
                </button>
                <button
                  type="button"
                  onClick={() => setActiveWorkflow('report')}
                  className={`px-5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer ${btnPrimary}`}
                >
                  Create report
                </button>
              </div>
            </div>
          )}

          {/* =====================================================================
              WORKFLOW 4: BATCH ("One setup. A queue of originals.")
             ===================================================================== */}
          {activeWorkflow === 'batch' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Batch</h1>
                <p className={`text-sm mt-1 ${textMuted}`}>
                  One setup. A queue of originals.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Queue Card + Run status Card */}
                <div className="lg:col-span-6 space-y-5">
                  <div className={`rounded-2xl border p-5 space-y-4 shadow-2xs ${bgCard}`}>
                    <h2 className="text-base font-bold">
                      Queue · {batchQueue.length} {batchQueue.length === 1 ? 'image' : 'images'}
                    </h2>

                    {/* Queued Items List */}
                    <div className="space-y-3">
                      {batchQueue.map(item => (
                        <div
                          key={item.id}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${bgSubtle}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0 border border-slate-300 dark:border-slate-700">
                              {item.thumbnailUrl ? (
                                <img src={item.thumbnailUrl} alt={item.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400">
                                  <ImageIcon className="w-5 h-5" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-xs truncate">{item.name}</div>
                              <div className={`text-[11px] tabular-nums ${textMuted}`}>
                                {item.width} × {item.height} · {item.format} · {formatBytes(item.fileSize)}
                              </div>
                              <div className="mt-0.5 text-[11px] font-medium">
                                {item.status === 'waiting' && (
                                  <span className={textMuted}>Waiting to run</span>
                                )}
                                {item.status === 'running' && (
                                  <span className="text-sky-500 font-semibold">Running SLAM & metrics...</span>
                                )}
                                {item.status === 'completed' && item.result && (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                                    Done · PSNR {item.result.psnrDb} dB · SSIM {item.result.ssimMean}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {item.status === 'completed' && item.result && (
                              <button
                                type="button"
                                onClick={() => handleLoadBatchItemToSlot(item.result!)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${btnPrimary}`}
                              >
                                Inspect
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setBatchQueue(prev => prev.filter(q => q.id !== item.id))}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${btnOutline}`}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Dropzone Box */}
                    <div
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault();
                        handleAddBatchFiles(e.dataTransfer.files);
                      }}
                      className={`rounded-xl border border-dashed p-5 text-center space-y-2.5 ${bgSubtle}`}
                    >
                      <div className="text-xs font-bold">Drop originals here to build your queue</div>
                      <div className={`text-xs ${textMuted}`}>
                        Each file will run with the shared settings
                      </div>
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => batchFileInputRef.current?.click()}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${btnOutline}`}
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Add files...</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Run status Card */}
                  <div className={`rounded-2xl border p-5 space-y-3 shadow-2xs tabular-nums ${bgCard}`}>
                    <h2 className="text-base font-bold">Run status</h2>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className={textMuted}>Waiting</span>
                        <span className="font-bold">{batchQueue.filter(q => q.status === 'waiting').length}</span>
                      </div>
                      <div className={`flex items-center justify-between pt-2 border-t ${borderSubtle}`}>
                        <span className={textMuted}>Completed</span>
                        <span className="font-bold">
                          {completedBatchResults.length === 0 ? 'Not run' : `${completedBatchResults.length} image(s)`}
                        </span>
                      </div>
                    </div>

                    {completedBatchResults.length > 0 && (
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => exportBatchToPDF(completedBatchResults)}
                          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${btnPrimary}`}
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Export Batch PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => exportBatchToCSV(completedBatchResults)}
                          className={`py-2 px-3 rounded-xl text-xs font-semibold cursor-pointer ${btnOutline}`}
                        >
                          Export CSV
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Shared settings Card */}
                <div className="lg:col-span-6">
                  <div className={`rounded-2xl border p-5 sm:p-6 space-y-4 shadow-2xs ${bgCard}`}>
                    <h2 className="text-base font-bold">Shared settings</h2>

                    {/* Platform */}
                    <div className={`flex items-center justify-between py-2.5 border-b text-xs ${borderSubtle}`}>
                      <span className="font-medium">Platform</span>
                      <div className="flex items-center gap-1 font-semibold text-[#1B4D7E] dark:text-sky-400">
                        <select
                          value={batchPlatform}
                          onChange={e => setBatchPlatform(e.target.value)}
                          className="bg-transparent outline-none cursor-pointer text-right font-semibold"
                        >
                          {SITES_DATABASE.map(s => (
                            <option key={s.name} value={s.name} className="text-slate-900">
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    {/* Simulate with SLAM */}
                    <div className="flex items-center justify-between text-xs py-1">
                      <span className="font-medium">Simulate with SLAM</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setBatchSlamEnabled(prev => !prev)}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                            batchSlamEnabled ? 'bg-[#34D399]' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-[#0F2942] transition-transform ${
                              batchSlamEnabled ? 'translate-x-4.5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <span className="font-medium w-5">{batchSlamEnabled ? 'On' : 'Off'}</span>
                      </div>
                    </div>

                    {/* Analyze after simulation */}
                    <div className="flex items-center justify-between text-xs py-1">
                      <span className="font-medium">Analyze after simulation</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setBatchAnalyzeAfter(prev => !prev)}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                            batchAnalyzeAfter ? 'bg-[#34D399]' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-[#0F2942] transition-transform ${
                              batchAnalyzeAfter ? 'translate-x-4.5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <span className="font-medium w-5">{batchAnalyzeAfter ? 'On' : 'Off'}</span>
                      </div>
                    </div>

                    {/* Difference metric */}
                    <div className={`flex items-center justify-between py-2.5 border-t text-xs ${borderSubtle}`}>
                      <span className="font-medium">Difference metric</span>
                      <select
                        value={batchMetric}
                        onChange={e => setBatchMetric(e.target.value as MetricType)}
                        className="bg-transparent outline-none cursor-pointer text-right font-bold"
                      >
                        {METRIC_OPTIONS.map(m => (
                          <option key={m.id} value={m.id} className="text-slate-900">
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Heatmap preset */}
                    <div className={`flex items-center justify-between py-2.5 border-t text-xs ${borderSubtle}`}>
                      <span className="font-medium">Heatmap preset</span>
                      <div className="flex items-center gap-1 font-semibold text-[#1B4D7E] dark:text-sky-400">
                        <select
                          value={batchPreset}
                          onChange={e => setBatchPreset(e.target.value as typeof batchPreset)}
                          className="bg-transparent outline-none cursor-pointer text-right font-semibold"
                        >
                          <option value="Current" className="text-slate-900">Current</option>
                          <option value="High Contrast" className="text-slate-900">High Contrast</option>
                          <option value="Block Forensics" className="text-slate-900">Block Forensics</option>
                        </select>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveWorkflow('analysis')}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer ${btnOutline}`}
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Review analysis settings</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Batch Action Bar */}
              <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t ${borderSubtle}`}>
                <span className={`text-xs ${textMuted}`}>
                  {completedBatchResults.length === 0
                    ? 'Ready to start · No batch results yet'
                    : `Completed · ${completedBatchResults.length} of ${batchQueue.length} image(s) processed`}
                </span>
                <button
                  type="button"
                  disabled={isBatchRunning || batchQueue.length === 0}
                  onClick={handleRunInPageBatch}
                  className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50 ${btnPrimary}`}
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>
                    {isBatchRunning
                      ? 'Running batch...'
                      : `Run batch · ${batchQueue.length} ${batchQueue.length === 1 ? 'image' : 'images'}`}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* =====================================================================
              WORKFLOW 5: REPORT ("Review this pair and choose what to export.")
             ===================================================================== */}
          {activeWorkflow === 'report' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Report</h1>
                <p className={`text-sm mt-1 ${textMuted}`}>
                  Review this pair and choose what to export.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Pair Preview Card + 3 Status Dot Metric Cards + ΔE2000 Breakdown */}
                <div className="lg:col-span-6 space-y-4">
                  {/* Original → Platform Preview Card */}
                  <div className={`rounded-2xl border p-5 space-y-4 shadow-2xs ${bgCard}`}>
                    <h2 className="text-base font-bold">
                      Original → {activeSite?.siteName || 'Instagram'}
                    </h2>

                    <div className="relative h-56 sm:h-64 w-full rounded-xl overflow-hidden bg-[#0B2545] border border-slate-200 dark:border-slate-700">
                      {original.thumbnailUrl && (
                        <img
                          src={original.thumbnailUrl}
                          alt="Original"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      )}
                      {activeSite?.thumbnailUrl && (
                        <div
                          className="absolute inset-0 overflow-hidden"
                          style={{ clipPath: 'inset(0 0 0 50%)' }}
                        >
                          <img
                            src={activeSite.thumbnailUrl}
                            alt={activeSite.siteName}
                            className="w-full h-full object-cover brightness-75 contrast-125"
                          />
                        </div>
                      )}
                      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-[#0F2942]/85 text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-xs">
                        PAIR PREVIEW
                      </span>
                      <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white/80 -translate-x-1/2" />
                      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#38BDF8] border border-white flex items-center justify-center text-[9px] text-white shadow">
                        ↔
                      </div>
                    </div>

                    <div className={`space-y-2 text-xs tabular-nums pt-1`}>
                      <div className="flex items-center justify-between">
                        <span className={textMuted}>Original</span>
                        <span className="font-bold">
                          {original.name || 'original.png'} · {original.width || 1600} × {original.height || 1200} · {original.fileSize ? formatBytes(original.fileSize) : '3.62 MB'}
                        </span>
                      </div>
                      <div className={`flex items-center justify-between pt-2 border-t ${borderSubtle}`}>
                        <span className={textMuted}>Processed</span>
                        <span className="font-bold">
                          {activeSite?.name || 'instagram.png'} · {activeSite?.width || 1080} × {activeSite?.height || 810}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 3 Metric KPI Cards with Colored Status Dots */}
                  <div className="grid grid-cols-3 gap-3 tabular-nums">
                    <div className={`rounded-2xl border p-3.5 shadow-2xs ${bgCard}`}>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                        <span className={`text-xs font-medium ${textMuted}`}>PSNR</span>
                      </div>
                      <div className="text-lg sm:text-xl font-bold mt-1">
                        {stats ? stats.psnrDb : '24.6'}
                      </div>
                      <div className={`text-[11px] ${textMuted}`}>dB</div>
                    </div>

                    <div className={`rounded-2xl border p-3.5 shadow-2xs ${bgCard}`}>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                        <span className={`text-xs font-medium ${textMuted}`}>SSIM</span>
                      </div>
                      <div className="text-lg sm:text-xl font-bold mt-1">
                        {stats ? stats.ssimMean : '0.997'}
                      </div>
                      <div className={`text-[11px] ${textMuted}`}>index</div>
                    </div>

                    <div className={`rounded-2xl border p-3.5 shadow-2xs ${bgCard}`}>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                        <span className={`text-xs font-medium truncate ${textMuted}`}>Mean ΔE2000</span>
                      </div>
                      <div className="text-lg sm:text-xl font-bold mt-1">
                        {stats ? stats.deltaE2000Mean : '3.46'}
                      </div>
                      <div className={`text-[11px] ${textMuted}`}>perceptual</div>
                    </div>
                  </div>

                  {/* Colour difference · ΔE2000 Card */}
                  <div className={`rounded-2xl border p-5 space-y-3 shadow-2xs tabular-nums ${bgCard}`}>
                    <h3 className="text-sm font-bold">Colour difference · ΔE2000</h3>
                    <div className={`divide-y text-xs ${borderSubtle}`}>
                      <div className="py-2 flex items-center justify-between">
                        <span className={textMuted}>Mean</span>
                        <span className="font-bold">{stats ? stats.deltaE2000Mean : '3.46'}</span>
                      </div>
                      <div className="py-2 flex items-center justify-between">
                        <span className={textMuted}>95th percentile (p95)</span>
                        <span className="font-bold">{stats ? stats.p95Val : '12.07'}</span>
                      </div>
                      <div className="py-2 flex items-center justify-between">
                        <span className={textMuted}>p99 / maximum</span>
                        <span className="font-bold">
                          {stats ? `${stats.p99Val} / ${stats.maxVal}` : '29.98 / 38.42'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveWorkflow('compare')}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer ${btnOutline}`}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Compare</span>
                  </button>
                </div>

                {/* Right Column: Export configuration Card */}
                <div className="lg:col-span-6">
                  <div className={`rounded-2xl border p-5 sm:p-6 space-y-5 shadow-2xs ${bgCard}`}>
                    <h2 className="text-base font-bold">Export configuration</h2>

                    {/* Report name */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold">Report name</label>
                      <input
                        type="text"
                        value={reportName}
                        onChange={e => setReportName(e.target.value)}
                        className={`w-full px-3.5 py-2.5 rounded-xl text-xs border ${bgSubtle} outline-none focus:border-[#1B4D7E]`}
                      />
                    </div>

                    {/* Format */}
                    <div className={`flex items-center justify-between py-2.5 border-y text-xs ${borderSubtle}`}>
                      <span className="font-medium">Format</span>
                      <div className="flex items-center gap-1 font-semibold text-[#1B4D7E] dark:text-sky-400">
                        <select
                          value={reportFormat}
                          onChange={e => setReportFormat(e.target.value as 'PDF' | 'CSV' | 'PNG')}
                          className="bg-transparent outline-none cursor-pointer text-right font-semibold"
                        >
                          <option value="PDF" className="text-slate-900">PDF</option>
                          <option value="CSV" className="text-slate-900">CSV</option>
                          <option value="PNG" className="text-slate-900">PNG Heatmap</option>
                        </select>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    {/* Comparison slot */}
                    <div className={`flex items-center justify-between pb-2.5 border-b text-xs ${borderSubtle}`}>
                      <span className="font-medium">Comparison</span>
                      <div className="flex items-center gap-1 font-semibold text-[#1B4D7E] dark:text-sky-400">
                        <select
                          value={activeSiteIndex}
                          onChange={e => setActiveSiteIndex(parseInt(e.target.value, 10))}
                          className="bg-transparent outline-none cursor-pointer text-right font-semibold"
                        >
                          <option value={0} className="text-slate-900">Slot 1</option>
                          <option value={1} className="text-slate-900">Slot 2</option>
                          <option value={2} className="text-slate-900">Slot 3</option>
                        </select>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    {/* INCLUDE IN EXPORT */}
                    <div className="space-y-3.5">
                      <div className={`text-[11px] font-bold uppercase tracking-wider ${textMuted}`}>
                        INCLUDE IN EXPORT
                      </div>

                      {[
                        { label: 'Image pair', val: reportIncludePair, set: setReportIncludePair },
                        { label: 'Quality metrics', val: reportIncludeMetrics, set: setReportIncludeMetrics },
                        { label: 'Heatmap visualization', val: reportIncludeHeatmap, set: setReportIncludeHeatmap },
                        { label: 'Analysis settings', val: reportIncludeSettings, set: setReportIncludeSettings }
                      ].map(item => (
                        <div key={item.label} className="flex items-center justify-between text-xs">
                          <span className="font-medium">{item.label}</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => item.set(prev => !prev)}
                              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                                item.val ? 'bg-[#34D399]' : 'bg-slate-300 dark:bg-slate-700'
                              }`}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-[#0F2942] transition-transform ${
                                  item.val ? 'translate-x-4.5' : 'translate-x-1'
                                }`}
                              />
                            </button>
                            <span className="font-medium w-5">{item.val ? 'On' : 'Off'}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Export report... Button */}
                    <div className="pt-2">
                      <button
                        type="button"
                        disabled={isExportingReport || !pairLoaded}
                        onClick={handleExportReportAction}
                        className={`w-full py-3 px-5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${btnPrimary}`}
                      >
                        <Download className="w-4 h-4" />
                        <span>{isExportingReport ? 'Generating report...' : 'Export report...'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      )}

      {/* ================= MOBILE BOTTOM NAVIGATION BAR (< lg) ================= */}
      {!showLandingPage && (
      <nav className={`lg:hidden fixed bottom-0 inset-x-0 z-30 border-t px-2 py-1.5 grid grid-cols-5 gap-1 ${bgSidebar}`}>
        {workflowItems.map(item => {
          const isActive = activeWorkflow === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveWorkflow(item.id)}
              className={`flex flex-col items-center justify-center py-2 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#1B4D7E] text-white'
                  : darkMode
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-[#1E3A5F] hover:bg-[#E2ECF7]'
              }`}
            >
              {item.icon}
              <span className="mt-1">{item.label}</span>
            </button>
          );
        })}
      </nav>
      )}

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={heatmapConfig}
        onChangeConfig={updates => setHeatmapConfig(prev => ({ ...prev, ...updates }))}
        view={viewConfig}
        onChangeView={updates => setViewConfig(prev => ({ ...prev, ...updates }))}
        autoVisualize={autoVisualize}
        setAutoVisualize={setAutoVisualize}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <SocialLoginModal
        isOpen={isSocialModalOpen}
        onClose={() => setIsSocialModalOpen(false)}
        onLoadAsOriginal={(url: string) => handleUrlLoad('original', url)}
        onLoadToSlot={(slotTarget: number | 'original', url: string, name: string) => {
          if (slotTarget !== 'original') {
            const def = SITES_DATABASE.find(s => s.name === name);
            setSites(prev => {
              const next = [...prev];
              if (next[slotTarget]) {
                next[slotTarget] = {
                  ...next[slotTarget],
                  siteName: name,
                  siteNotes: def?.notes
                };
              }
              return next;
            });
            setActiveSiteIndex(slotTarget);
          }
          handleUrlLoad(slotTarget, url);
        }}
        onCompareWithSlam={handleCompareWithSlam}
        activeSlotName={activeSite?.siteName || 'Instagram'}
        activeSlotIndex={activeSiteIndex}
        onOpenCausalAnalysis={() => {
          setShowLandingPage(false);
          setActiveWorkflow('analysis');
          setAnalysisSubTab('causal');
        }}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        original={original}
        activeSite={activeSite}
        stats={stats}
      />

      <BatchProcessingModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        original={original}
        onLoadBatchItemToSlot={handleLoadBatchItemToSlot}
      />
    </div>
  );
};

export default App;

