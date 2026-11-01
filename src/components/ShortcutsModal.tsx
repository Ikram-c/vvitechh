import React from 'react';
import { X, Keyboard, Info } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const viewShortcuts = [
    { key: 'E', action: 'Loupe (single image)' },
    { key: 'C', action: 'Before / After Left-Right' },
    { key: 'Y', action: 'Toggle Loupe ↔ Left/Right' },
    { key: 'Alt+Y', action: 'Toggle Loupe ↔ Top/Bottom' },
    { key: 'Shift+Y', action: 'Toggle Split variant (Left/Right ↔ Split)' },
    { key: 'N', action: 'Survey view (all site slots)' },
    { key: '\\', action: 'Flip Before ↔ After / Swap sides' },
    { key: 'Space (hold)', action: 'Peek Before while held (Lightroom peek)' },
    { key: 'Tab', action: 'Hide / show both side panels' },
    { key: 'L', action: 'Toggle Corner loupe magnifier' },
    { key: 'R / C', action: 'Toggle Crop Region of Interest (ROI) tool' },
    { key: 'Esc', action: 'Cancel crop selection marquee' }
  ];

  const zoomShortcuts = [
    { key: 'Mouse Wheel', action: 'Zoom centered about cursor' },
    { key: 'Z / Double-click', action: 'Cycle fit → 100% → 200% → fit' },
    { key: 'F', action: 'Fit to screen (optimal zoom)' },
    { key: 'Ctrl + / -', action: 'Zoom in / out one step' },
    { key: 'Left-drag', action: 'Pan image across canvas' },
    { key: 'Drag divider', action: 'Move split position (in Split view)' }
  ];

  const heatmapShortcuts = [
    { key: 'H', action: 'Toggle Overlay on / off' },
    { key: 'Shift+H', action: 'Toggle Heat map only on / off' },
    { key: '[ / ]', action: 'Overlay intensity down / up' },
    { key: 'M / Shift+M', action: 'Next / previous metric' },
    { key: 'B', action: 'Toggle 8×8 JPEG block view' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-blue-400" />
            <h2 className="font-semibold text-neutral-200 text-sm">
              Shortcuts & About CompressCompare
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* About section */}
          <div className="p-3 bg-neutral-950/60 rounded border border-neutral-800 space-y-1.5">
            <div className="flex items-center gap-1.5 text-blue-300 font-semibold text-[11px]">
              <Info className="w-3.5 h-3.5" />
              <span>CompressCompare v0.4 · Social SLAM Edition</span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              A high-precision perceptual quality comparison and JPEG forensics tool for measuring
              how social media platforms (Instagram, Discord, Facebook, X/Twitter, TikTok, YouTube, Reddit, WhatsApp)
              compress and alter images and videos. Features CIEDE2000, SSIM (Wang et al. 2004), PSNR, and 6 color ramps.
            </p>
            <p className="text-[11px] text-amber-300/90 leading-relaxed pt-1 border-t border-neutral-800/80">
              ⚡ <strong>Lightweight SLAM (Social-media Loss Approximation Model):</strong> Upload an original image and click SLAM to automatically simulate platform-specific Lanczos resizing, pre-sharpening, and 4:2:0 MozJPEG re-encoding. Connect your social media accounts in the Social Media panel to browse and compare your live photo feeds.
            </p>
          </div>

          {/* Shortcuts Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* View shortcuts */}
            <div className="space-y-2">
              <h3 className="font-semibold text-neutral-300 uppercase tracking-wider text-[10px]">
                Views & Navigation
              </h3>
              <div className="space-y-1 bg-neutral-950/40 p-2 rounded border border-neutral-800">
                {viewShortcuts.map((s, idx) => (
                  <div key={idx} className="flex justify-between items-center py-0.5">
                    <kbd className="px-1.5 py-0.5 bg-neutral-800 text-neutral-200 rounded border border-neutral-700 font-mono text-[10px]">
                      {s.key}
                    </kbd>
                    <span className="text-neutral-400 text-[11px] text-right">{s.action}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Heat map & Zoom shortcuts */}
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-neutral-300 uppercase tracking-wider text-[10px]">
                  Heat Map
                </h3>
                <div className="space-y-1 bg-neutral-950/40 p-2 rounded border border-neutral-800">
                  {heatmapShortcuts.map((s, idx) => (
                    <div key={idx} className="flex justify-between items-center py-0.5">
                      <kbd className="px-1.5 py-0.5 bg-neutral-800 text-neutral-200 rounded border border-neutral-700 font-mono text-[10px]">
                        {s.key}
                      </kbd>
                      <span className="text-neutral-400 text-[11px] text-right">{s.action}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-neutral-300 uppercase tracking-wider text-[10px]">
                  Zoom & Pan
                </h3>
                <div className="space-y-1 bg-neutral-950/40 p-2 rounded border border-neutral-800">
                  {zoomShortcuts.map((s, idx) => (
                    <div key={idx} className="flex justify-between items-center py-0.5">
                      <kbd className="px-1.5 py-0.5 bg-neutral-800 text-neutral-200 rounded border border-neutral-700 font-mono text-[10px]">
                        {s.key}
                      </kbd>
                      <span className="text-neutral-400 text-[11px] text-right">{s.action}</span>
                    </div>
                  ))}
                </div>
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
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
