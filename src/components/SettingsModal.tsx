import React from 'react';
import { X, Sliders } from 'lucide-react';
import { HeatmapConfig, ViewConfig } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: HeatmapConfig;
  onChangeConfig: (updates: Partial<HeatmapConfig>) => void;
  view: ViewConfig;
  onChangeView: (updates: Partial<ViewConfig>) => void;
  autoVisualize: boolean;
  setAutoVisualize: (v: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onChangeConfig,
  view,
  onChangeView,
  autoVisualize,
  setAutoVisualize
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl w-full max-w-md overflow-hidden text-xs">
        {/* Header */}
        <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-400" />
            <h2 className="font-semibold text-neutral-200 text-sm">Settings (config.yaml)</h2>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* General App Settings */}
          <div className="space-y-2">
            <h3 className="font-semibold text-neutral-300 uppercase tracking-wider text-[10px]">
              Application Behavior
            </h3>
            <label className="flex items-center justify-between p-2 rounded bg-neutral-950/60 border border-neutral-800 cursor-pointer">
              <span className="text-neutral-300">Auto-visualize changes immediately</span>
              <input
                type="checkbox"
                checked={autoVisualize}
                onChange={e => setAutoVisualize(e.target.checked)}
                className="accent-blue-500 w-4 h-4 rounded cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between p-2 rounded bg-neutral-950/60 border border-neutral-800 cursor-pointer">
              <span className="text-neutral-300">Linked zoom & pan across all views</span>
              <input
                type="checkbox"
                checked={view.linkedFocus}
                onChange={e => onChangeView({ linkedFocus: e.target.checked })}
                className="accent-blue-500 w-4 h-4 rounded cursor-pointer"
              />
            </label>
          </div>

          {/* Corner Loupe Magnifier */}
          <div className="space-y-2">
            <h3 className="font-semibold text-neutral-300 uppercase tracking-wider text-[10px]">
              Corner Loupe Magnifier
            </h3>
            <div className="p-2.5 rounded bg-neutral-950/60 border border-neutral-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-neutral-300">Loupe Magnification</span>
                <span className="font-mono text-blue-400">{view.loupeZoom}×</span>
              </div>
              <input
                type="range"
                min="2"
                max="32"
                step="2"
                value={view.loupeZoom}
                onChange={e => onChangeView({ loupeZoom: parseInt(e.target.value) })}
                className="w-full accent-blue-500 h-1 bg-neutral-800 rounded appearance-none cursor-pointer"
              />
              <span className="text-[10px] text-neutral-500">
                Range: 2× to 32× with pixel grid rendered at ≥ 8×
              </span>
            </div>
          </div>

          {/* Heat Map Tuning */}
          <div className="space-y-2">
            <h3 className="font-semibold text-neutral-300 uppercase tracking-wider text-[10px]">
              Heat Map Default Scales
            </h3>
            <div className="p-2.5 rounded bg-neutral-950/60 border border-neutral-800 space-y-2">
              <label className="flex items-center justify-between">
                <span className="text-neutral-300">Base image under overlay</span>
                <select
                  value={config.overlayBase}
                  onChange={e => onChangeConfig({ overlayBase: e.target.value as any })}
                  className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-neutral-200 outline-none"
                >
                  <option value="site">Site copy (After)</option>
                  <option value="original">Original image (Before)</option>
                </select>
              </label>

              <div className="flex justify-between items-center pt-1">
                <span className="text-neutral-300">Auto-scale Percentile</span>
                <span className="font-mono text-neutral-300">p99 (99%)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-300">JPEG Block Size</span>
                <span className="font-mono text-neutral-300">8 × 8 pixels</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-300">SSIM Gaussian Window</span>
                <span className="font-mono text-neutral-300">11 × 11 (σ = 1.5)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-neutral-800 bg-neutral-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
