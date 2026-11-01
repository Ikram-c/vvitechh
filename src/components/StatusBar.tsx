import React from 'react';
import { LayoutMode, MetricType, ComparisonStats, SlotMedia, CropRegion } from '../types';

interface StatusBarProps {
  toast: string | null;
  activeSite: SlotMedia;
  original: SlotMedia;
  stats: ComparisonStats | null;
  cropRegion?: CropRegion | null;
  zoomPct: number;
  layout: LayoutMode;
  metric: MetricType;
  simpleMode?: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  toast,
  activeSite,
  original,
  stats,
  cropRegion,
  zoomPct,
  layout,
  metric,
  simpleMode = false
}) => {
  return (
    <footer className="h-6 bg-neutral-950 border-t border-neutral-800 px-3 flex items-center justify-between text-[11px] text-neutral-400 select-none">
      {/* Left info */}
      <div className="flex items-center gap-3">
        {toast ? (
          <span className="text-blue-400 font-medium animate-pulse">
            {toast}
          </span>
        ) : (
          <>
            <span className="text-neutral-500">
              {simpleMode ? 'Active comparison: ' : 'Comparing: '}
              <strong className="text-neutral-300 font-semibold">{original.name || 'Original'}</strong> vs{' '}
              <strong className="text-blue-400 font-semibold">{activeSite.siteName}</strong>
            </span>

            {original.width > 0 && (
              <span className="text-neutral-500 font-mono text-[10px]">
                {original.width}×{original.height} → {activeSite.width || original.width}×{activeSite.height || original.height}
              </span>
            )}
          </>
        )}
      </div>

      {/* Right status metrics */}
      <div className="flex items-center gap-4">
        {stats && (
          simpleMode ? (
            <div className="flex items-center gap-2 text-[10px]">
              {stats.roi && (
                <span className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-medium text-[9px]">
                  ROI {stats.roi.width}×{stats.roi.height}
                </span>
              )}
              <span className="text-neutral-500">Visual Similarity: <strong className="text-emerald-400 font-bold font-mono">{(stats.ssimMean * 100).toFixed(1)}%</strong></span>
              <span className="text-neutral-600">·</span>
              <span className="text-neutral-500">Untouched Pixels: <strong className="text-blue-400 font-mono">{stats.untouchedPixelsPct}%</strong></span>
            </div>
          ) : (
            <div className="flex items-center gap-2 font-mono text-[10px]">
              {stats.roi && (
                <span className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-semibold font-sans flex items-center gap-1 text-[9.5px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  ROI {stats.roi.width}×{stats.roi.height}
                </span>
              )}
              <span className="text-neutral-500">PSNR: <strong className="text-blue-400">{stats.psnrDb}dB</strong></span>
              <span className="text-neutral-500">SSIM: <strong className="text-emerald-400">{stats.ssimMean}</strong></span>
              <span className="text-neutral-500">ΔE2000: <strong className="text-amber-400">{stats.deltaE2000Mean}</strong></span>
            </div>
          )
        )}

        <div className="flex items-center gap-2 text-neutral-500 border-l border-neutral-800 pl-3">
          <span>{simpleMode ? 'View: ' : 'Layout: '}<strong className="text-neutral-300 uppercase">{layout.replace('_', ' ')}</strong></span>
          <span>Zoom: <strong className="text-neutral-300 font-mono">{Math.round(zoomPct)}%</strong></span>
          <span className="text-[10px] text-neutral-600">F1: help</span>
        </div>
      </div>
    </footer>
  );
};
