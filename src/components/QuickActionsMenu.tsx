import React, { useState, useRef, useEffect } from 'react';
import { 
  Crop, 
  Maximize, 
  RotateCw, 
  Zap, 
  Sparkles, 
  FileText, 
  Layers, 
  ZoomIn, 
  X, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Scissors, 
  SlidersHorizontal,
  Focus,
  Maximize2,
  RefreshCw
} from 'lucide-react';
import { CropRegion } from '../types';

interface QuickActionsMenuProps {
  isCropToolActive: boolean;
  onToggleCropTool: () => void;
  cropRegion: CropRegion | null;
  onClearCrop: () => void;
  onApplyPresetCrop: (preset: 'center50' | 'center25' | 'top50') => void;
  onFitToScreen: () => void;
  onResetZoom100: () => void;
  onSwapSides: () => void;
  onRunSlam: () => void;
  hasOriginal: boolean;
  smartArtifactsEnabled: boolean;
  onToggleSmartArtifacts: () => void;
  onOpenExportReport: () => void;
  onOpenBatchProcessing: () => void;
  zoomPct: number;
}

export const QuickActionsMenu: React.FC<QuickActionsMenuProps> = ({
  isCropToolActive,
  onToggleCropTool,
  cropRegion,
  onClearCrop,
  onApplyPresetCrop,
  onFitToScreen,
  onResetZoom100,
  onSwapSides,
  onRunSlam,
  hasOriginal,
  smartArtifactsEnabled,
  onToggleSmartArtifacts,
  onOpenExportReport,
  onOpenBatchProcessing,
  zoomPct
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showPresetsMenu, setShowPresetsMenu] = useState(false);
  const presetsMenuRef = useRef<HTMLDivElement>(null);

  // Close presets menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (presetsMenuRef.current && !presetsMenuRef.current.contains(e.target as Node)) {
        setShowPresetsMenu(false);
      }
    };
    if (showPresetsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPresetsMenu]);

  const hasActiveCrop = Boolean(cropRegion && cropRegion.active);

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 select-none flex flex-col items-center pointer-events-none">
      {/* Floating Pill Toolbar */}
      <div className="pointer-events-auto flex items-center bg-neutral-900/90 backdrop-blur-md border border-neutral-700/80 rounded-full shadow-2xl p-1 gap-1 text-xs text-neutral-200">
        
        {/* Quick Actions Lead Icon */}
        <div className="flex items-center gap-1.5 pl-2.5 pr-1.5 text-neutral-300 font-medium border-r border-neutral-750">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[11px] font-semibold tracking-wide text-neutral-100 hidden sm:inline">
            Quick Actions
          </span>
        </div>

        {/* 1. Crop Region of Interest Tool */}
        <div className="relative" ref={presetsMenuRef}>
          <div className="flex items-center rounded-full overflow-hidden border border-transparent transition-all">
            <button
              onClick={onToggleCropTool}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                isCropToolActive
                  ? 'bg-cyan-500 text-neutral-950 shadow-md shadow-cyan-500/30'
                  : hasActiveCrop
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/60'
                  : 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-200'
              }`}
              title="Select Region of Interest on canvas to recalculate PSNR/SSIM exclusively for that area (Key: C)"
            >
              <Crop className="w-3.5 h-3.5" />
              <span>{isCropToolActive ? 'Selecting ROI...' : hasActiveCrop ? 'ROI Active' : 'Crop ROI'}</span>
            </button>

            {/* Presets dropdown toggle */}
            <button
              onClick={() => setShowPresetsMenu(prev => !prev)}
              className={`p-1 pl-0.5 pr-1.5 hover:text-white transition-colors ${
                hasActiveCrop ? 'text-cyan-400' : 'text-neutral-400'
              }`}
              title="Crop Presets: Center 50%, Center 25%, Top Half"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {/* Presets Dropdown Menu */}
          {showPresetsMenu && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl p-1.5 z-40 text-xs space-y-1 animate-in fade-in zoom-in-95 duration-150">
              <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-2 py-1 border-b border-neutral-800">
                Region of Interest Presets
              </div>
              <button
                onClick={() => {
                  onApplyPresetCrop('center50');
                  setShowPresetsMenu(false);
                }}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-neutral-800 text-neutral-200 flex items-center justify-between transition-colors"
              >
                <span>Center 50% Area</span>
                <span className="text-[10px] font-mono text-neutral-400">½ size</span>
              </button>
              <button
                onClick={() => {
                  onApplyPresetCrop('center25');
                  setShowPresetsMenu(false);
                }}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-neutral-800 text-neutral-200 flex items-center justify-between transition-colors"
              >
                <span>Center 25% Macro</span>
                <span className="text-[10px] font-mono text-neutral-400">¼ size</span>
              </button>
              <button
                onClick={() => {
                  onApplyPresetCrop('top50');
                  setShowPresetsMenu(false);
                }}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-neutral-800 text-neutral-200 flex items-center justify-between transition-colors"
              >
                <span>Top Half (Portrait Focus)</span>
                <span className="text-[10px] font-mono text-neutral-400">top</span>
              </button>

              {hasActiveCrop && (
                <button
                  onClick={() => {
                    onClearCrop();
                    setShowPresetsMenu(false);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-red-950/60 text-red-300 flex items-center gap-1.5 border-t border-neutral-800 pt-1.5 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reset to Full Image</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* If Crop is active, show quick Reset button */}
        {hasActiveCrop && (
          <button
            onClick={onClearCrop}
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-neutral-800 hover:bg-red-900/60 hover:text-red-200 text-neutral-300 border border-neutral-700/60 text-[11px] transition-colors"
            title="Clear Region of Interest and recalculate metrics for full image"
          >
            <X className="w-3 h-3 text-red-400" />
            <span>Reset Full</span>
          </button>
        )}

        {/* Divider */}
        <div className="w-[1px] h-4 bg-neutral-750 mx-0.5" />

        {/* 2. Fit to Screen */}
        <button
          onClick={onFitToScreen}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-800/80 hover:bg-neutral-700 text-neutral-200 transition-colors"
          title="Fit image completely inside screen viewport (Key: F)"
        >
          <Maximize className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden sm:inline">Fit</span>
        </button>

        {/* 3. 100% 1:1 Zoom */}
        <button
          onClick={onResetZoom100}
          className="flex items-center gap-1 px-2 py-1 rounded-full bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 font-mono text-[11px] transition-colors"
          title="Zoom to 100% (1:1 actual pixels)"
        >
          <span>{Math.round(zoomPct)}%</span>
        </button>

        {/* 4. Swap Sides */}
        <button
          onClick={onSwapSides}
          className="p-1.5 rounded-full bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
          title="Swap Before and After image sides (Key: \)"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        {/* 5. 1-Click SLAM Simulation */}
        <button
          onClick={onRunSlam}
          disabled={!hasOriginal}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition-all ${
            hasOriginal
              ? 'bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-500/40'
              : 'bg-neutral-850 text-neutral-600 cursor-not-allowed'
          }`}
          title="SLAM Engine: Simulate authentic social media compressed version"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          <span className="font-medium hidden md:inline">SLAM</span>
        </button>

        {/* 6. Smart Artifacts CV Toggle */}
        <button
          onClick={onToggleSmartArtifacts}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition-all ${
            smartArtifactsEnabled
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-xs'
              : 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300'
          }`}
          title="Smart Artifact Detection: Computer vision high-contrast edge & ringing overlay"
        >
          <Sparkles className={`w-3.5 h-3.5 ${smartArtifactsEnabled ? 'text-cyan-400' : 'text-neutral-400'}`} />
          <span className="hidden lg:inline">Artifacts</span>
        </button>

        {/* Divider */}
        <div className="w-[1px] h-4 bg-neutral-750 mx-0.5" />

        {/* 7. Export Report (PDF/CSV) */}
        <button
          onClick={onOpenExportReport}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-600/25 hover:bg-blue-600/40 text-blue-200 border border-blue-500/40 transition-colors"
          title="Export Analysis Report with side-by-side thumbnails and comparison metrics (PDF/CSV)"
        >
          <FileText className="w-3.5 h-3.5 text-blue-300" />
          <span className="font-medium hidden md:inline">Report</span>
        </button>

        {/* 8. Batch Processing */}
        <button
          onClick={onOpenBatchProcessing}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-200 border border-indigo-500/40 transition-colors"
          title="Batch Processing: Run comparisons across multiple platforms or multiple files at once"
        >
          <Layers className="w-3.5 h-3.5 text-indigo-300" />
          <span className="font-medium hidden lg:inline">Batch</span>
        </button>
      </div>

      {/* Persistent ROI Status Pill if active */}
      {hasActiveCrop && cropRegion && (
        <div className="pointer-events-auto mt-1.5 flex items-center gap-2 px-3 py-1 bg-cyan-950/90 border border-cyan-500/60 text-cyan-200 rounded-full shadow-lg text-[11px] font-mono animate-in fade-in slide-in-from-top-1">
          <Focus className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
          <span>
            ROI Recalculation Active: {cropRegion.width}×{cropRegion.height} px at ({cropRegion.x}, {cropRegion.y})
          </span>
          <button
            onClick={onClearCrop}
            className="ml-1 px-1.5 py-0.2 rounded bg-cyan-900/80 hover:bg-cyan-800 text-white font-sans text-[10px] transition-colors"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
};
