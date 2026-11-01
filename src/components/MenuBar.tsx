import React from 'react';
import { 
  FolderOpen, 
  Download, 
  Settings, 
  HelpCircle, 
  Layers, 
  Maximize, 
  Maximize2, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Eye, 
  Grid, 
  SplitSquareVertical, 
  SplitSquareHorizontal, 
  Sparkles,
  Link,
  Unlink,
  Share2,
  Zap,
  FileText
} from 'lucide-react';
import { LayoutMode, LoupeSubMode } from '../types';

interface MenuBarProps {
  layout: LayoutMode;
  setLayout: (l: LayoutMode) => void;
  loupeSubMode: LoupeSubMode;
  setLoupeSubMode: (m: LoupeSubMode) => void;
  showLeftPanel: boolean;
  setShowLeftPanel: (v: boolean | ((prev: boolean) => boolean)) => void;
  showRightPanel: boolean;
  setShowRightPanel: (v: boolean | ((prev: boolean) => boolean)) => void;
  showLoupe: boolean;
  setShowLoupe: (v: boolean | ((prev: boolean) => boolean)) => void;
  linkedFocus: boolean;
  setLinkedFocus: (v: boolean | ((prev: boolean) => boolean)) => void;
  swapped: boolean;
  setSwapped: (v: boolean | ((prev: boolean) => boolean)) => void;
  zoomPct: number;
  onFit: () => void;
  onFitToScreen: () => void;
  onResetZoom100?: () => void;
  onZoomStep: (inOut: number) => void;
  onExportHeatmap: () => void;
  onOpenExportReport?: () => void;
  onOpenBatchProcessing?: () => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  onLoadSamples: () => void;
  onOpenFile: () => void;
  onOpenSocialModal?: () => void;
  onRunSlamActiveSlot?: () => void;
  hasOriginalImage?: boolean;
  hasHeatmap: boolean;
}

export const MenuBar: React.FC<MenuBarProps> = ({
  layout,
  setLayout,
  loupeSubMode,
  setLoupeSubMode,
  showLeftPanel,
  setShowLeftPanel,
  showRightPanel,
  setShowRightPanel,
  showLoupe,
  setShowLoupe,
  linkedFocus,
  setLinkedFocus,
  swapped,
  setSwapped,
  zoomPct,
  onFit,
  onFitToScreen,
  onResetZoom100,
  onZoomStep,
  onExportHeatmap,
  onOpenExportReport,
  onOpenBatchProcessing,
  onOpenSettings,
  onOpenShortcuts,
  onLoadSamples,
  onOpenFile,
  onOpenSocialModal,
  onRunSlamActiveSlot,
  hasOriginalImage,
  hasHeatmap
}) => {
  return (
    <header className="h-10 bg-neutral-900 border-b border-neutral-800 px-3 flex items-center justify-between text-xs select-none">
      {/* Left: Branding & Main Actions */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 pr-2 border-r border-neutral-800">
          <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center font-bold text-white text-[11px] tracking-tight shadow-sm">
            CC
          </div>
          <span className="font-semibold text-neutral-200 tracking-wide text-sm">
            CompressCompare
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono">
            v0.3
          </span>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenFile}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
            title="Open an image or video file (Ctrl+O / Cmd+O)"
          >
            <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
            <span>Open...</span>
          </button>

          {/* Social Media Login & Media Browser button */}
          {onOpenSocialModal && (
            <button
              onClick={onOpenSocialModal}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-gradient-to-r from-pink-600/25 to-purple-600/25 hover:from-pink-600/40 hover:to-purple-600/40 text-pink-200 border border-pink-500/35 transition-all shadow-xs"
              title="Social Media Accounts & Cloud Photo Library: connect Instagram, Twitter, Facebook, and Reddit"
            >
              <Share2 className="w-3.5 h-3.5 text-pink-400" />
              <span className="font-medium">My Social Photos</span>
            </button>
          )}

          {/* SLAM 1-Click Simulation Button */}
          {onRunSlamActiveSlot && (
            <button
              onClick={onRunSlamActiveSlot}
              disabled={!hasOriginalImage}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-medium transition-all shadow-xs ${
                hasOriginalImage
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                  : 'bg-neutral-900 text-neutral-600 border border-neutral-800 cursor-not-allowed'
              }`}
              title={
                hasOriginalImage
                  ? 'SLAM Engine: Automatically generate simulated social media compressed version for active slot'
                  : 'Upload an Original image first to simulate social media compression'
              }
            >
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>⚡ SLAM Simulate</span>
            </button>
          )}

          {/* Batch Processing */}
          {onOpenBatchProcessing && (
            <button
              onClick={onOpenBatchProcessing}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-900/35 hover:bg-indigo-800/50 text-indigo-200 border border-indigo-700/50 transition-colors shadow-xs"
              title="Batch Processing: Run multi-platform benchmark or queue multiple image files"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-300" />
              <span>Batch</span>
            </button>
          )}

          {/* Export Report (PDF / CSV) */}
          {onOpenExportReport && (
            <button
              onClick={onOpenExportReport}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-gradient-to-r from-blue-900/40 to-indigo-900/40 hover:from-blue-800/60 hover:to-indigo-800/60 text-blue-200 border border-blue-600/50 transition-all shadow-xs"
              title="Export Professional PDF / CSV Analysis Report with embedded thumbnails and perceptual statistics"
            >
              <FileText className="w-3.5 h-3.5 text-blue-300" />
              <span className="font-medium">Export Report</span>
            </button>
          )}

          <button
            onClick={onLoadSamples}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-900/40 hover:bg-blue-800/60 text-blue-300 border border-blue-700/50 transition-colors"
            title="Load synthetic tutorial media: Original, Instagram, Discord, Facebook, and TikTok samples"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-300" />
            <span>Samples</span>
          </button>

          <button
            onClick={onExportHeatmap}
            disabled={!hasHeatmap}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
              hasHeatmap
                ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                : 'bg-neutral-900 text-neutral-600 cursor-not-allowed'
            }`}
            title="Export heat map as PNG"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Heatmap</span>
          </button>
        </div>
      </div>

      {/* Center: View Layout Modes */}
      <div className="flex items-center gap-1 bg-neutral-950 p-0.5 rounded-md border border-neutral-800">
        <button
          onClick={() => setLayout('loupe')}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
            layout === 'loupe'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
          }`}
          title="Loupe mode: Single image view with Before/After/Heat/Overlay toggles (Key: E)"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Loupe</span>
        </button>

        <button
          onClick={() => setLayout('left_right')}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
            layout === 'left_right'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
          }`}
          title="Before / After Left-Right side-by-side (Key: C / Y)"
        >
          <SplitSquareVertical className="w-3.5 h-3.5" />
          <span>Left/Right</span>
        </button>

        <button
          onClick={() => setLayout('top_bottom')}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
            layout === 'top_bottom'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
          }`}
          title="Before / After Top-Bottom stacked (Key: Alt+Y)"
        >
          <SplitSquareHorizontal className="w-3.5 h-3.5" />
          <span>Top/Bottom</span>
        </button>

        <button
          onClick={() => setLayout('split_lr')}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
            layout === 'split_lr'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
          }`}
          title="Interactive Split divider Left/Right (Key: Shift+Y)"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Split L/R</span>
        </button>

        <button
          onClick={() => setLayout('split_tb')}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
            layout === 'split_tb'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
          }`}
          title="Interactive Split divider Top/Bottom"
        >
          <Layers className="w-3.5 h-3.5 rotate-90" />
          <span>Split T/B</span>
        </button>

        <button
          onClick={() => setLayout('survey')}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
            layout === 'survey'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
          }`}
          title="Survey grid of every site slot (Key: N)"
        >
          <Grid className="w-3.5 h-3.5" />
          <span>Survey</span>
        </button>
      </div>

      {/* Right: Viewport Controls, Panels & Help */}
      <div className="flex items-center gap-2">
        {/* Loupe submode switch if in loupe mode */}
        {layout === 'loupe' && (
          <div className="flex items-center bg-neutral-950 rounded border border-neutral-800 p-0.5 mr-1">
            {(['overlay', 'heat', 'after', 'before'] as LoupeSubMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setLoupeSubMode(mode)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize transition-all ${
                  loupeSubMode === mode
                    ? 'bg-neutral-700 text-white'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        )}

        {/* Swap sides button */}
        {(layout === 'left_right' || layout === 'top_bottom' || layout === 'split_lr' || layout === 'split_tb') && (
          <button
            onClick={() => setSwapped(prev => !prev)}
            className={`flex items-center gap-1 px-2 py-1 rounded border transition-colors ${
              swapped
                ? 'bg-blue-900/50 border-blue-600 text-blue-200'
                : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700'
            }`}
            title="Swap Before and After sides (Key: \)"
          >
            <RotateCw className="w-3 h-3" />
            <span>Swap</span>
          </button>
        )}

        {/* Linked focus */}
        <button
          onClick={() => setLinkedFocus(prev => !prev)}
          className={`p-1.5 rounded transition-colors ${
            linkedFocus
              ? 'bg-blue-900/50 text-blue-300 border border-blue-700/60'
              : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
          }`}
          title={linkedFocus ? 'Linked Pan/Zoom: All panes share zoom & pan' : 'Unlinked Pan/Zoom'}
        >
          {linkedFocus ? <Link className="w-3.5 h-3.5" /> : <Unlink className="w-3.5 h-3.5" />}
        </button>

        {/* Corner Loupe Toggle */}
        <button
          onClick={() => setShowLoupe(prev => !prev)}
          className={`px-2 py-1 rounded transition-colors flex items-center gap-1 ${
            showLoupe
              ? 'bg-blue-900/50 text-blue-300 border border-blue-700/60'
              : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
          }`}
          title="Toggle corner loupe magnifier (Key: L)"
        >
          <Maximize2 className="w-3 h-3" />
          <span>Loupe</span>
        </button>

        {/* Fit to Screen Button */}
        <button
          onClick={onFitToScreen}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 hover:border-neutral-600 font-medium transition-colors shadow-xs"
          title="Fit to Screen: Calculate optimal zoom to display entire image within current viewport (Key: F)"
        >
          <Maximize className="w-3.5 h-3.5 text-blue-400" />
          <span>Fit to Screen</span>
        </button>

        {/* Zoom Stepper & 1:1 indicator */}
        <div className="flex items-center bg-neutral-800 rounded border border-neutral-700/60 px-1 py-0.5 gap-1">
          <button
            onClick={() => onZoomStep(-1)}
            className="p-1 rounded hover:bg-neutral-700 text-neutral-300"
            title="Zoom out (Ctrl -)"
          >
            <ZoomOut className="w-3 h-3" />
          </button>
          <button
            onClick={onResetZoom100}
            className="text-[11px] text-neutral-300 hover:text-white font-mono px-1 rounded hover:bg-neutral-700 text-center font-medium"
            title="Click for 100% (1:1 actual pixels)"
          >
            {Math.round(zoomPct)}%
          </button>
          <button
            onClick={() => onZoomStep(1)}
            className="p-1 rounded hover:bg-neutral-700 text-neutral-300"
            title="Zoom in (Ctrl +)"
          >
            <ZoomIn className="w-3 h-3" />
          </button>
        </div>

        {/* Panels Toggle */}
        <button
          onClick={() => {
            const bothOpen = showLeftPanel && showRightPanel;
            setShowLeftPanel(!bothOpen);
            setShowRightPanel(!bothOpen);
          }}
          className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700/60"
          title="Toggle side panels (Key: Tab)"
        >
          Panels
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700/60"
          title="Settings (Ctrl+P / Cmd+P)"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        {/* Shortcuts / About */}
        <button
          onClick={onOpenShortcuts}
          className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700/60"
          title="Keyboard Shortcuts & About (Key: F1)"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
