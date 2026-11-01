import React, { useRef, useEffect, useState, useCallback, useImperativeHandle } from 'react';
import { 
  LayoutMode, 
  LoupeSubMode, 
  HeatmapConfig, 
  ComparisonStats, 
  SlotMedia, 
  ViewConfig,
  CropRegion
} from '../types';
import { getColormapLUT } from '../services/colormap';
import { rgbToLab, deltaE2000 } from '../services/metrics';
import { detectArtifacts, overlayArtifactsOnHeatmap } from '../services/artifactDetection';
import { Crop, Focus, Check, X } from 'lucide-react';

export interface CompareCanvasHandle {
  fitToScreen: () => void;
}

export interface CompareCanvasProps {
  original: SlotMedia;
  activeSite: SlotMedia;
  allSites: SlotMedia[];
  diffBuffer: Float32Array | null;
  stats: ComparisonStats | null;
  layout: LayoutMode;
  config: HeatmapConfig;
  view: ViewConfig;
  setView: React.Dispatch<React.SetStateAction<ViewConfig>>;
  spacePeek: boolean;
  onSelectSiteSlot?: (idx: number) => void;
  // Cropping Tool Props
  isCropToolActive: boolean;
  setIsCropToolActive: (active: boolean) => void;
  cropRegion: CropRegion | null;
  onApplyCrop: (region: CropRegion) => void;
  onClearCrop: () => void;
  onClearTonalFilter?: () => void;
}

export const CompareCanvas = React.forwardRef<CompareCanvasHandle, CompareCanvasProps>(({
  original,
  activeSite,
  allSites,
  diffBuffer,
  stats,
  layout,
  config,
  view,
  setView,
  spacePeek,
  onSelectSiteSlot,
  isCropToolActive,
  setIsCropToolActive,
  cropRegion,
  onApplyCrop,
  onClearCrop,
  onClearTonalFilter
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);

  // Heat map texture cache & Tonal Range Filter mask cache
  const heatCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const tonalMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mouse & interaction state
  const isDraggingRef = useRef(false);
  const isDraggingSplitRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Cropping Tool State
  const [cropDraft, setCropDraft] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const [pendingCrop, setPendingCrop] = useState<CropRegion | null>(null);
  const isDraggingCropRef = useRef(false);
  const cropStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Cursor inspector
  const [cursorPos, setCursorPos] = useState<{
    screenX: number;
    screenY: number;
    imgX: number;
    imgY: number;
    origRgb: [number, number, number] | null;
    siteRgb: [number, number, number] | null;
    diffVal: number | null;
    inBounds: boolean;
  }>({
    screenX: 0,
    screenY: 0,
    imgX: 0,
    imgY: 0,
    origRgb: null,
    siteRgb: null,
    diffVal: null,
    inBounds: false
  });

  const compareWidth = activeSite.width || original.width || 100;
  const compareHeight = activeSite.height || original.height || 100;

  // Re-generate heat canvas texture when diffBuffer or heat configs change
  useEffect(() => {
    if (!diffBuffer || compareWidth <= 0 || compareHeight <= 0) {
      heatCanvasRef.current = null;
      return;
    }

    const c = document.createElement('canvas');
    c.width = compareWidth;
    c.height = compareHeight;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const imgData = ctx.createImageData(compareWidth, compareHeight);
    const data = imgData.data;
    const lut = getColormapLUT(config.colormap);

    const scaleMax = config.autoScale
      ? (stats?.p99Val && stats.p99Val > 0 ? stats.p99Val : 1.0)
      : Math.max(0.001, config.manualMax);

    const gamma = Math.max(0.05, config.gamma);
    const threshold = config.threshold;
    const pixelCount = compareWidth * compareHeight;

    for (let i = 0; i < pixelCount; i++) {
      const v = diffBuffer[i];
      const norm = Math.min(1.0, Math.max(0.0, v / scaleMax));

      if (norm < threshold) {
        // Below threshold: transparent
        data[i * 4 + 3] = 0;
        continue;
      }

      // Apply gamma
      const t = Math.pow(norm, gamma);
      const lutIdx = Math.min(255, Math.max(0, Math.round(t * 255))) * 3;

      data[i * 4] = lut[lutIdx];
      data[i * 4 + 1] = lut[lutIdx + 1];
      data[i * 4 + 2] = lut[lutIdx + 2];
      data[i * 4 + 3] = 255;
    }

    // Smart Artifact Detection: highlight high-contrast edges and ringing artifacts specifically
    if (config.smartArtifacts?.enabled && original.canvas && activeSite.canvas) {
      try {
        const oCanvas = document.createElement('canvas');
        oCanvas.width = compareWidth;
        oCanvas.height = compareHeight;
        const oCtx = oCanvas.getContext('2d');

        const sCanvas = document.createElement('canvas');
        sCanvas.width = compareWidth;
        sCanvas.height = compareHeight;
        const sCtx = sCanvas.getContext('2d');

        if (oCtx && sCtx) {
          oCtx.drawImage(original.canvas, 0, 0, compareWidth, compareHeight);
          const origPixels = oCtx.getImageData(0, 0, compareWidth, compareHeight).data;

          sCtx.drawImage(activeSite.canvas, 0, 0, compareWidth, compareHeight);
          const sitePixels = sCtx.getImageData(0, 0, compareWidth, compareHeight).data;

          const artifactResult = detectArtifacts(
            origPixels,
            sitePixels,
            compareWidth,
            compareHeight,
            config.smartArtifacts
          );

          overlayArtifactsOnHeatmap(
            data,
            artifactResult.edgeMask,
            artifactResult.ringingMask,
            compareWidth,
            compareHeight,
            config.smartArtifacts
          );
        }
      } catch (err) {
        console.warn('Artifact detection overlay error:', err);
      }
    }

    ctx.putImageData(imgData, 0, 0);
    heatCanvasRef.current = c;
  }, [diffBuffer, stats, config, compareWidth, compareHeight, original.canvas, activeSite.canvas]);

  // Generate tonal range filter mask texture when config.tonalFilter is active
  useEffect(() => {
    const tf = config.tonalFilter;
    const isFilterActive = Boolean(tf && tf.active && (tf.min > 0 || tf.max < 255));
    const sourceCanvas = activeSite.canvas || original.canvas;
    if (!isFilterActive || !tf || !sourceCanvas || compareWidth <= 0 || compareHeight <= 0) {
      tonalMaskCanvasRef.current = null;
      return;
    }

    const c = document.createElement('canvas');
    c.width = compareWidth;
    c.height = compareHeight;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(sourceCanvas, 0, 0, compareWidth, compareHeight);
    const srcData = ctx.getImageData(0, 0, compareWidth, compareHeight).data;
    const maskImg = ctx.createImageData(compareWidth, compareHeight);
    const dst = maskImg.data;

    const minLvl = Math.min(tf.min, tf.max);
    const maxLvl = Math.max(tf.min, tf.max);
    const ch = tf.channel || 'luma';
    const pixelCount = compareWidth * compareHeight;

    for (let i = 0; i < pixelCount; i++) {
      const idx = i * 4;
      const r = srcData[idx];
      const g = srcData[idx + 1];
      const b = srcData[idx + 2];
      const lvl =
        ch === 'r'
          ? r
          : ch === 'g'
          ? g
          : ch === 'b'
          ? b
          : Math.round(0.299 * r + 0.587 * g + 0.114 * b);

      if (lvl < minLvl || lvl > maxLvl) {
        // Dim out-of-range tonal values so in-range pixels pop clearly
        dst[idx] = 4;
        dst[idx + 1] = 12;
        dst[idx + 2] = 28;
        dst[idx + 3] = 195;
      } else {
        dst[idx + 3] = 0;
      }
    }

    ctx.putImageData(maskImg, 0, 0);
    tonalMaskCanvasRef.current = c;
  }, [config.tonalFilter, activeSite.canvas, original.canvas, compareWidth, compareHeight]);

  // Calculate the optimal zoom level to display the entire image within the current viewport,
  // ensuring it is never larger than the container.
  const fitToScreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const imgW = compareWidth;
    const imgH = compareHeight;

    if (cw <= 0 || ch <= 0 || imgW <= 0 || imgH <= 0) return;

    // Safety margins (padding) so the image comfortably fits with padding
    // and never overflows the container edges.
    const paddingX = 32;
    const paddingY = 32;

    let availableW = Math.max(10, cw - paddingX);
    let availableH = Math.max(10, ch - paddingY);

    if (layout === 'left_right') {
      availableW = Math.max(10, (cw / 2) - paddingX);
    } else if (layout === 'top_bottom') {
      availableH = Math.max(10, (ch / 2) - paddingY);
    } else if (layout === 'survey') {
      const slotCount = allSites.length + 1;
      const cols = slotCount <= 2 ? slotCount : Math.min(3, Math.ceil(Math.sqrt(slotCount)));
      const rows = Math.ceil(slotCount / cols);
      availableW = Math.max(10, (cw / cols) - paddingX);
      availableH = Math.max(10, (ch / rows) - paddingY);
    }

    // Determine zoom scale needed for full width and full height
    const zoomW = availableW / imgW;
    const zoomH = availableH / imgH;

    // Taking Math.min guarantees the entire image fits within the current viewport
    // and is NEVER larger than the container.
    const optimalZoom = Math.min(zoomW, zoomH);

    setView(prev => ({
      ...prev,
      zoom: Math.max(0.01, optimalZoom),
      panX: 0,
      panY: 0
    }));
  }, [compareWidth, compareHeight, layout, allSites.length, setView]);

  useImperativeHandle(ref, () => ({
    fitToScreen
  }), [fitToScreen]);

  // Automatically fit to screen when images first load or when container becomes visible / resizes
  const hasAutoFittedRef = useRef(false);
  useEffect(() => {
    if (!hasAutoFittedRef.current && (original.canvas || activeSite.canvas) && compareWidth > 100) {
      hasAutoFittedRef.current = true;
      const timer = setTimeout(() => {
        fitToScreen();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [original.canvas, activeSite.canvas, compareWidth, fitToScreen]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let prevW = el.clientWidth;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 50 && Math.abs(w - prevW) > 20) {
          prevW = w;
          fitToScreen();
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitToScreen]);

  // Main Render Loop
  const renderCanvas = useCallback(() => {
    const canvas = mainCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, cw, ch);
    // Background deep navy matching VMIT comparison card
    ctx.fillStyle = '#0B2545';
    ctx.fillRect(0, 0, cw, ch);

    if (!original.imageData && !activeSite.imageData) {
      // Empty state
      ctx.fillStyle = '#4a5568';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Drop original & site images or click "Load Samples" to compare', cw / 2, ch / 2);
      return;
    }

    const origCanvas = original.canvas;
    const siteCanvas = activeSite.canvas;
    const heatCanvas = heatCanvasRef.current;

    // Helper to draw an image/canvas with pan and zoom
    const drawSlotLayer = (
      source: HTMLCanvasElement | null | undefined,
      dx: number,
      dy: number,
      dw: number,
      dh: number,
      alpha = 1.0,
      clipRect?: { x: number; y: number; w: number; h: number }
    ) => {
      if (!source) return;
      ctx.save();
      if (clipRect) {
        ctx.beginPath();
        ctx.rect(clipRect.x, clipRect.y, clipRect.w, clipRect.h);
        ctx.clip();
      }
      ctx.globalAlpha = alpha;
      // Use pixelated (nearest-neighbor) interpolation at zoom >= 100%
      ctx.imageSmoothingEnabled = view.zoom < 1.0;
      ctx.drawImage(source, dx, dy, dw, dh);
      ctx.restore();
    };

    // Calculate base fit transform
    const zoom = view.zoom;
    const panX = view.panX;
    const panY = view.panY;

    // Determine layout rendering
    if (layout === 'survey') {
      // Survey grid of original + all site slots
      const allSlots = [original, ...allSites];
      const slotCount = allSlots.length;
      const cols = slotCount <= 2 ? slotCount : Math.min(3, Math.ceil(Math.sqrt(slotCount)));
      const rows = Math.ceil(slotCount / cols);

      const cellW = cw / cols;
      const cellH = ch / rows;

      allSlots.forEach((slot, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const cx = col * cellW;
        const cy = row * cellH;

        ctx.save();
        ctx.beginPath();
        ctx.rect(cx, cy, cellW, cellH);
        ctx.clip();

        // Draw background & border
        ctx.fillStyle = '#14171d';
        ctx.fillRect(cx, cy, cellW, cellH);

        if (slot.canvas) {
          const aspect = slot.width / slot.height;
          let drawW = (cellW - 16) * zoom;
          let drawH = drawW / aspect;
          if (drawH > (cellH - 32) * zoom) {
            drawH = (cellH - 32) * zoom;
            drawW = drawH * aspect;
          }
          const dx = cx + (cellW - drawW) / 2 + panX;
          const dy = cy + (cellH - drawH) / 2 + panY;

          ctx.imageSmoothingEnabled = zoom < 1.0;
          ctx.drawImage(slot.canvas, dx, dy, drawW, drawH);
        }

        // Draw slot badge
        ctx.fillStyle = idx === 0 ? 'rgba(16, 185, 129, 0.85)' : 'rgba(37, 99, 235, 0.85)';
        ctx.fillRect(cx + 8, cy + 8, 120, 22);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(idx === 0 ? 'Original' : slot.siteName, cx + 14, cy + 23);

        ctx.strokeStyle = '#232834';
        ctx.strokeRect(cx, cy, cellW, cellH);
        ctx.restore();
      });
      return;
    }

    // Single or Split comparison layouts
    const imgW = compareWidth * zoom;
    const imgH = compareHeight * zoom;
    const imgX = (cw - imgW) / 2 + panX;
    const imgY = (ch - imgH) / 2 + panY;

    // Swap sides if requested
    const beforeCanvas = view.swapped ? siteCanvas : origCanvas;
    const afterCanvas = view.swapped ? origCanvas : siteCanvas;

    if (layout === 'loupe') {
      const showBefore = spacePeek || view.loupeSubMode === 'before';

      if (showBefore) {
        drawSlotLayer(beforeCanvas, imgX, imgY, imgW, imgH);
      } else if (view.loupeSubMode === 'after') {
        drawSlotLayer(afterCanvas, imgX, imgY, imgW, imgH);
      } else if (view.loupeSubMode === 'heat') {
        drawSlotLayer(heatCanvas, imgX, imgY, imgW, imgH);
      } else {
        // Overlay mode: base image + blended heat map
        const baseCanvas = config.overlayBase === 'original' ? origCanvas : siteCanvas;
        drawSlotLayer(baseCanvas, imgX, imgY, imgW, imgH);

        if (heatCanvas) {
          drawSlotLayer(heatCanvas, imgX, imgY, imgW, imgH, config.intensity);
        }
      }

      // Loupe Mode Indicator
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(12, 12, 110, 24);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(
        showBefore ? 'Loupe: Before' : `Loupe: ${view.loupeSubMode}`,
        20,
        28
      );
    } else if (layout === 'left_right') {
      const halfW = cw / 2;
      const leftImgX = (halfW - imgW) / 2 + panX;
      const rightImgX = halfW + (halfW - imgW) / 2 + panX;

      // Left pane: Before
      drawSlotLayer(beforeCanvas, leftImgX, imgY, imgW, imgH, 1.0, { x: 0, y: 0, w: halfW, h: ch });
      // Right pane: After + Heat
      drawSlotLayer(afterCanvas, rightImgX, imgY, imgW, imgH, 1.0, { x: halfW, y: 0, w: halfW, h: ch });
      if (heatCanvas && config.intensity > 0) {
        drawSlotLayer(heatCanvas, rightImgX, imgY, imgW, imgH, config.intensity, { x: halfW, y: 0, w: halfW, h: ch });
      }

      // Divider line
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(halfW, 0);
      ctx.lineTo(halfW, ch);
      ctx.stroke();

      // Labels
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(12, 12, 90, 22);
      ctx.fillRect(halfW + 12, 12, 110, 22);
      ctx.fillStyle = '#ffffff';
      ctx.font = '11px sans-serif';
      ctx.fillText('Before (Original)', 18, 27);
      ctx.fillText(`After (${activeSite.siteName})`, halfW + 18, 27);
    } else if (layout === 'top_bottom') {
      const halfH = ch / 2;
      const topImgY = (halfH - imgH) / 2 + panY;
      const bottomImgY = halfH + (halfH - imgH) / 2 + panY;

      // Top pane: Before
      drawSlotLayer(beforeCanvas, imgX, topImgY, imgW, imgH, 1.0, { x: 0, y: 0, w: cw, h: halfH });
      // Bottom pane: After + Heat
      drawSlotLayer(afterCanvas, imgX, bottomImgY, imgW, imgH, 1.0, { x: 0, y: halfH, w: cw, h: halfH });
      if (heatCanvas && config.intensity > 0) {
        drawSlotLayer(heatCanvas, imgX, bottomImgY, imgW, imgH, config.intensity, { x: 0, y: halfH, w: cw, h: halfH });
      }

      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, halfH);
      ctx.lineTo(cw, halfH);
      ctx.stroke();

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(12, 12, 90, 22);
      ctx.fillRect(12, halfH + 12, 110, 22);
      ctx.fillStyle = '#ffffff';
      ctx.font = '11px sans-serif';
      ctx.fillText('Before (Original)', 18, 27);
      ctx.fillText(`After (${activeSite.siteName})`, 18, halfH + 27);
    } else if (layout === 'split_lr') {
      // Split Left/Right with draggable divider
      const splitX = cw * view.splitPos;

      // Left of divider: Before
      drawSlotLayer(beforeCanvas, imgX, imgY, imgW, imgH, 1.0, { x: 0, y: 0, w: splitX, h: ch });

      // Right of divider: After + Heat
      drawSlotLayer(afterCanvas, imgX, imgY, imgW, imgH, 1.0, { x: splitX, y: 0, w: cw - splitX, h: ch });
      if (heatCanvas && config.intensity > 0) {
        drawSlotLayer(heatCanvas, imgX, imgY, imgW, imgH, config.intensity, { x: splitX, y: 0, w: cw - splitX, h: ch });
      }

      // Interactive Divider Line
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, ch);
      ctx.stroke();

      // Circular Center Handle
      const handleY = ch / 2;
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(splitX, handleY, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Handle arrow icons
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(splitX - 6, handleY);
      ctx.lineTo(splitX - 2, handleY - 4);
      ctx.lineTo(splitX - 2, handleY + 4);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(splitX + 6, handleY);
      ctx.lineTo(splitX + 2, handleY - 4);
      ctx.lineTo(splitX + 2, handleY + 4);
      ctx.closePath();
      ctx.fill();
    } else if (layout === 'split_tb') {
      // Split Top/Bottom with draggable divider
      const splitY = ch * view.splitPos;

      drawSlotLayer(beforeCanvas, imgX, imgY, imgW, imgH, 1.0, { x: 0, y: 0, w: cw, h: splitY });
      drawSlotLayer(afterCanvas, imgX, imgY, imgW, imgH, 1.0, { x: 0, y: splitY, w: cw, h: ch - splitY });
      if (heatCanvas && config.intensity > 0) {
        drawSlotLayer(heatCanvas, imgX, imgY, imgW, imgH, config.intensity, { x: 0, y: splitY, w: cw, h: ch - splitY });
      }

      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, splitY);
      ctx.lineTo(cw, splitY);
      ctx.stroke();

      const handleX = cw / 2;
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(handleX, splitY, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Apply Tonal Range Filter mask on top of the comparison viewport when active
    const tonalMask = tonalMaskCanvasRef.current;
    if (tonalMask) {
      if (layout === 'left_right') {
        const halfW = cw / 2;
        const leftImgX = (halfW - imgW) / 2 + panX;
        const rightImgX = halfW + (halfW - imgW) / 2 + panX;
        drawSlotLayer(tonalMask, leftImgX, imgY, imgW, imgH, 1.0, { x: 0, y: 0, w: halfW, h: ch });
        drawSlotLayer(tonalMask, rightImgX, imgY, imgW, imgH, 1.0, { x: halfW, y: 0, w: halfW, h: ch });
      } else if (layout === 'top_bottom') {
        const halfH = ch / 2;
        const topImgY = (halfH - imgH) / 2 + panY;
        const bottomImgY = halfH + (halfH - imgH) / 2 + panY;
        drawSlotLayer(tonalMask, imgX, topImgY, imgW, imgH, 1.0, { x: 0, y: 0, w: cw, h: halfH });
        drawSlotLayer(tonalMask, imgX, bottomImgY, imgW, imgH, 1.0, { x: 0, y: halfH, w: cw, h: halfH });
      } else {
        drawSlotLayer(tonalMask, imgX, imgY, imgW, imgH, 1.0);
      }
    }

    // Render Region of Interest (ROI) selection or active crop outline
    const cBox = cropDraft ? {
      x: Math.min(cropDraft.startX, cropDraft.currentX),
      y: Math.min(cropDraft.startY, cropDraft.currentY),
      w: Math.abs(cropDraft.currentX - cropDraft.startX),
      h: Math.abs(cropDraft.currentY - cropDraft.startY)
    } : pendingCrop ? {
      x: pendingCrop.x,
      y: pendingCrop.y,
      w: pendingCrop.width,
      h: pendingCrop.height
    } : null;

    if (cBox && cBox.w > 4 && cBox.h > 4) {
      const sx = imgX + cBox.x * zoom;
      const sy = imgY + cBox.y * zoom;
      const sw = cBox.w * zoom;
      const sh = cBox.h * zoom;

      ctx.save();
      // Semi-transparent dark mask outside ROI selection
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, cw, Math.max(0, sy));
      ctx.fillRect(0, sy + sh, cw, Math.max(0, ch - (sy + sh)));
      ctx.fillRect(0, sy, Math.max(0, sx), sh);
      ctx.fillRect(sx + sw, sy, Math.max(0, cw - (sx + sw)), sh);

      // Dashed ROI border
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(sx, sy, sw, sh);

      // Corner anchor handles
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      const hs = 7;
      [[sx, sy], [sx + sw, sy], [sx, sy + sh], [sx + sw, sy + sh]].forEach(([hx, hy]) => {
        ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
        ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
      });

      // Floating dimensions tag
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(sx, Math.max(0, sy - 20), 140, 18);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`ROI: ${Math.round(cBox.w)}×${Math.round(cBox.h)} px`, sx + 5, Math.max(12, sy - 7));
      ctx.restore();
    } else if (cropRegion && cropRegion.active && !cropDraft && !pendingCrop) {
      // Active applied crop region
      const sx = imgX + cropRegion.x * zoom;
      const sy = imgY + cropRegion.y * zoom;
      const sw = cropRegion.width * zoom;
      const sh = cropRegion.height * zoom;

      ctx.save();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(sx, sy, sw, sh);

      ctx.fillStyle = 'rgba(6, 182, 212, 0.9)';
      ctx.fillRect(sx, Math.max(0, sy - 18), 105, 16);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9.5px sans-serif';
      ctx.fillText('ROI Focus Area', sx + 5, Math.max(12, sy - 6));
      ctx.restore();
    }

    // Render Corner Loupe if enabled and pointer is over image
    if (view.showLoupe && cursorPos.inBounds && loupeCanvasRef.current) {
      const loupeCanvas = loupeCanvasRef.current;
      const lctx = loupeCanvas.getContext('2d');
      if (lctx) {
        const lsize = loupeCanvas.width;
        lctx.clearRect(0, 0, lsize, lsize);
        lctx.fillStyle = '#0f1115';
        lctx.fillRect(0, 0, lsize, lsize);

        const lzoom = view.loupeZoom;
        const srcX = cursorPos.imgX;
        const srcY = cursorPos.imgY;

        // Draw magnified target under cursor
        const targetCanvas = view.loupeSubMode === 'heat' && heatCanvas ? heatCanvas : siteCanvas || origCanvas;
        if (targetCanvas) {
          lctx.imageSmoothingEnabled = false;
          const patchSize = Math.floor(lsize / lzoom);
          lctx.drawImage(
            targetCanvas,
            srcX - patchSize / 2,
            srcY - patchSize / 2,
            patchSize,
            patchSize,
            0,
            0,
            lsize,
            lsize
          );
        }

        // Draw pixel grid lines if zoom >= 8
        if (lzoom >= 8) {
          lctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          lctx.lineWidth = 1;
          const step = lzoom;
          for (let x = 0; x < lsize; x += step) {
            lctx.beginPath();
            lctx.moveTo(x, 0);
            lctx.lineTo(x, lsize);
            lctx.stroke();
          }
          for (let y = 0; y < lsize; y += step) {
            lctx.beginPath();
            lctx.moveTo(0, y);
            lctx.lineTo(lsize, y);
            lctx.stroke();
          }
        }

        // Crosshair
        lctx.strokeStyle = '#3b82f6';
        lctx.lineWidth = 1.5;
        const center = lsize / 2;
        lctx.beginPath();
        lctx.moveTo(center - 10, center);
        lctx.lineTo(center + 10, center);
        lctx.moveTo(center, center - 10);
        lctx.lineTo(center, center + 10);
        lctx.stroke();
      }
    }
  }, [
    original,
    activeSite,
    allSites,
    diffBuffer,
    stats,
    layout,
    config,
    view,
    spacePeek,
    cursorPos,
    compareWidth,
    compareHeight,
    cropDraft,
    pendingCrop,
    cropRegion
  ]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Window resize observer
  useEffect(() => {
    const handleResize = () => renderCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderCanvas]);

  // Mouse wheel zoom centered on cursor
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const zoomStep = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.min(16.0, Math.max(0.2, view.zoom * zoomStep));

    // Keep point under cursor stationary
    const newPanX = mx - (mx - view.panX) * (newZoom / view.zoom);
    const newPanY = my - (my - view.panY) * (newZoom / view.zoom);

    setView(prev => ({
      ...prev,
      zoom: newZoom,
      panX: newPanX,
      panY: newPanY
    }));
  };

  // Keyboard listener for Crop Tool shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'c' || e.key === 'C') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          setIsCropToolActive(!isCropToolActive);
          setPendingCrop(null);
        }
      } else if (e.key === 'Escape') {
        if (isCropToolActive || pendingCrop || cropDraft) {
          setIsCropToolActive(false);
          setPendingCrop(null);
          setCropDraft(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCropToolActive, pendingCrop, cropDraft, setIsCropToolActive]);

  // Mouse down: start pan, split divider drag, or ROI crop drag
  const handleMouseDown = (e: React.MouseEvent) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // 1. If Crop Tool is active, click-and-drag creates an ROI marquee
    if (isCropToolActive) {
      isDraggingCropRef.current = true;
      setPendingCrop(null);

      const imgW = compareWidth * view.zoom;
      const imgH = compareHeight * view.zoom;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      let targetImgX = (cw - imgW) / 2 + view.panX;
      let targetImgY = (ch - imgH) / 2 + view.panY;

      if (layout === 'left_right') {
        const halfW = cw / 2;
        targetImgX = mx < halfW ? (halfW - imgW) / 2 + view.panX : halfW + (halfW - imgW) / 2 + view.panX;
      } else if (layout === 'top_bottom') {
        const halfH = ch / 2;
        targetImgY = my < halfH ? (halfH - imgH) / 2 + view.panY : halfH + (halfH - imgH) / 2 + view.panY;
      }

      const relX = Math.max(0, Math.min(compareWidth, Math.floor((mx - targetImgX) / view.zoom)));
      const relY = Math.max(0, Math.min(compareHeight, Math.floor((my - targetImgY) / view.zoom)));

      cropStartRef.current = { x: relX, y: relY };
      setCropDraft({ startX: relX, startY: relY, currentX: relX, currentY: relY });
      return;
    }

    // Check if clicking near split divider
    if (layout === 'split_lr') {
      const splitX = container.clientWidth * view.splitPos;
      if (Math.abs(mx - splitX) < 14) {
        isDraggingSplitRef.current = true;
        return;
      }
    } else if (layout === 'split_tb') {
      const splitY = container.clientHeight * view.splitPos;
      if (Math.abs(my - splitY) < 14) {
        isDraggingSplitRef.current = true;
        return;
      }
    }

    // Otherwise pan
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: view.panX,
      panY: view.panY
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Handle ROI crop marquee drag
    if (isDraggingCropRef.current) {
      const imgW = compareWidth * view.zoom;
      const imgH = compareHeight * view.zoom;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      let targetImgX = (cw - imgW) / 2 + view.panX;
      let targetImgY = (ch - imgH) / 2 + view.panY;

      if (layout === 'left_right') {
        const halfW = cw / 2;
        targetImgX = mx < halfW ? (halfW - imgW) / 2 + view.panX : halfW + (halfW - imgW) / 2 + view.panX;
      } else if (layout === 'top_bottom') {
        const halfH = ch / 2;
        targetImgY = my < halfH ? (halfH - imgH) / 2 + view.panY : halfH + (halfH - imgH) / 2 + view.panY;
      }

      const relX = Math.max(0, Math.min(compareWidth, Math.floor((mx - targetImgX) / view.zoom)));
      const relY = Math.max(0, Math.min(compareHeight, Math.floor((my - targetImgY) / view.zoom)));

      setCropDraft(prev => prev ? { ...prev, currentX: relX, currentY: relY } : null);
      return;
    }

    // Handle split drag
    if (isDraggingSplitRef.current) {
      if (layout === 'split_lr') {
        const newPos = Math.max(0.05, Math.min(0.95, mx / container.clientWidth));
        setView(prev => ({ ...prev, splitPos: newPos }));
      } else if (layout === 'split_tb') {
        const newPos = Math.max(0.05, Math.min(0.95, my / container.clientHeight));
        setView(prev => ({ ...prev, splitPos: newPos }));
      }
      return;
    }

    // Handle pan
    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setView(prev => ({
        ...prev,
        panX: dragStartRef.current.panX + dx,
        panY: dragStartRef.current.panY + dy
      }));
    }

    // Calculate cursor image coordinates
    const imgW = compareWidth * view.zoom;
    const imgH = compareHeight * view.zoom;
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    let targetImgX = (cw - imgW) / 2 + view.panX;
    let targetImgY = (ch - imgH) / 2 + view.panY;

    if (layout === 'left_right') {
      const halfW = cw / 2;
      targetImgX = mx < halfW ? (halfW - imgW) / 2 + view.panX : halfW + (halfW - imgW) / 2 + view.panX;
    } else if (layout === 'top_bottom') {
      const halfH = ch / 2;
      targetImgY = my < halfH ? (halfH - imgH) / 2 + view.panY : halfH + (halfH - imgH) / 2 + view.panY;
    }

    const relX = Math.floor((mx - targetImgX) / view.zoom);
    const relY = Math.floor((my - targetImgY) / view.zoom);

    const inBounds = relX >= 0 && relX < compareWidth && relY >= 0 && relY < compareHeight;

    let origRgb: [number, number, number] | null = null;
    let siteRgb: [number, number, number] | null = null;
    let diffVal: number | null = null;

    if (inBounds) {
      const pixelIdx = relY * compareWidth + relX;
      if (original.imageData) {
        const d = original.imageData.data;
        const i4 = pixelIdx * 4;
        origRgb = [d[i4], d[i4 + 1], d[i4 + 2]];
      }
      if (activeSite.imageData) {
        const d = activeSite.imageData.data;
        const i4 = pixelIdx * 4;
        siteRgb = [d[i4], d[i4 + 1], d[i4 + 2]];
      }
      if (diffBuffer) {
        diffVal = diffBuffer[pixelIdx];
      }
    }

    setCursorPos({
      screenX: mx,
      screenY: my,
      imgX: relX,
      imgY: relY,
      origRgb,
      siteRgb,
      diffVal,
      inBounds
    });
  };

  const handleMouseUp = () => {
    if (isDraggingCropRef.current) {
      isDraggingCropRef.current = false;
      if (cropDraft) {
        const x0 = Math.min(cropDraft.startX, cropDraft.currentX);
        const y0 = Math.min(cropDraft.startY, cropDraft.currentY);
        const w = Math.abs(cropDraft.currentX - cropDraft.startX);
        const h = Math.abs(cropDraft.currentY - cropDraft.startY);
        if (w >= 16 && h >= 16) {
          const clampedX = Math.max(0, Math.min(compareWidth - 16, Math.round(x0)));
          const clampedY = Math.max(0, Math.min(compareHeight - 16, Math.round(y0)));
          const clampedW = Math.max(16, Math.min(compareWidth - clampedX, Math.round(w)));
          const clampedH = Math.max(16, Math.min(compareHeight - clampedY, Math.round(h)));
          setPendingCrop({
            x: clampedX,
            y: clampedY,
            width: clampedW,
            height: clampedH,
            active: true
          });
        }
        setCropDraft(null);
      }
      return;
    }

    isDraggingRef.current = false;
    isDraggingSplitRef.current = false;
  };

  // Double click: center divider or toggle fit to screen / 100% / 200%
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (layout === 'split_lr' || layout === 'split_tb') {
      setView(prev => ({ ...prev, splitPos: 0.5 }));
      return;
    }

    // Cycle fit -> 100% -> 200% -> fit
    if (Math.abs(view.zoom - 1.0) < 0.1) {
      setView(prev => ({ ...prev, zoom: 2.0 }));
    } else if (Math.abs(view.zoom - 2.0) < 0.1) {
      fitToScreen();
    } else {
      setView(prev => ({ ...prev, zoom: 1.0, panX: 0, panY: 0 }));
    }
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      className="relative flex-1 h-full w-full bg-[#0B2545] overflow-hidden select-none cursor-crosshair"
    >
      <canvas ref={mainCanvasRef} className="absolute inset-0 w-full h-full block" />

      {/* Active Tonal Range Filter Badge */}
      {config.tonalFilter?.active && (config.tonalFilter.min > 0 || config.tonalFilter.max < 255) && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-sky-400/70 text-sky-100 px-3.5 py-1.5 rounded-full shadow-xl text-[11px] flex items-center gap-2.5 z-20 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
          <span className="font-semibold">
            Tonal Filter ({config.tonalFilter.channel.toUpperCase()}):
          </span>
          <span className="font-mono font-bold text-sky-300">
            {config.tonalFilter.min}–{config.tonalFilter.max}
          </span>
          {stats?.tonalFilter && (
            <span className="text-slate-300 font-mono">
              ({stats.tonalFilter.matchingPixelsPct}% of pixels)
            </span>
          )}
          {onClearTonalFilter && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onClearTonalFilter();
              }}
              className="ml-1 px-2 py-0.5 rounded-full bg-sky-500/20 hover:bg-sky-500/40 text-sky-200 border border-sky-400/40 text-[10px] font-semibold transition-colors cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      )}

      {/* Crop Tool Helper Banner */}
      {isCropToolActive && !pendingCrop && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-cyan-950/95 border border-cyan-500/80 text-cyan-200 px-4 py-1.5 rounded-full shadow-2xl text-xs flex items-center gap-2.5 z-30 animate-in fade-in duration-150">
          <Crop className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="font-medium">Click and drag on the image to select a Region of Interest (ROI)</span>
          <span className="text-[10px] text-cyan-400 font-mono">(Esc to cancel)</span>
          <button
            onClick={() => setIsCropToolActive(false)}
            className="ml-2 p-0.5 text-cyan-400 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Confirmation Widget for ROI Recalculation */}
      {pendingCrop && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-neutral-900/95 border border-cyan-500/90 rounded-xl shadow-2xl p-3 z-30 flex items-center gap-4 text-xs animate-in zoom-in-95 backdrop-blur-md">
          <div className="flex flex-col">
            <span className="font-semibold text-neutral-100 flex items-center gap-1.5">
              <Focus className="w-4 h-4 text-cyan-400" />
              Apply Region of Interest Crop?
            </span>
            <span className="text-[11px] text-neutral-400 font-mono mt-0.5">
              Area: <strong className="text-cyan-300">{pendingCrop.width} × {pendingCrop.height} px</strong> at (x: {pendingCrop.x}, y: {pendingCrop.y})
            </span>
          </div>
          <div className="flex items-center gap-2 border-l border-neutral-750 pl-3">
            <button
              onClick={() => {
                onApplyCrop(pendingCrop);
                setPendingCrop(null);
                setIsCropToolActive(false);
              }}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-neutral-950 font-bold flex items-center gap-1.5 shadow-md shadow-cyan-600/30 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Recalculate PSNR/SSIM</span>
            </button>
            <button
              onClick={() => {
                setPendingCrop(null);
                setIsCropToolActive(false);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Corner Loupe Magnifier */}
      {view.showLoupe && cursorPos.inBounds && (
        <div
          className={`absolute top-3 ${
            cursorPos.screenX > (containerRef.current?.clientWidth || 800) - 220
              ? 'left-3'
              : 'right-3'
          } bg-neutral-900/90 border border-neutral-700 rounded-lg p-2 shadow-2xl backdrop-blur-sm z-20 pointer-events-none`}
        >
          <div className="flex justify-between items-center mb-1 text-[10px] text-neutral-400">
            <span className="font-semibold text-neutral-200">
              Loupe ({view.loupeZoom}×)
            </span>
            <span className="font-mono">
              {cursorPos.imgX}, {cursorPos.imgY}
            </span>
          </div>
          <canvas
            ref={loupeCanvasRef}
            width={160}
            height={160}
            className="rounded border border-neutral-800 bg-neutral-950 block"
          />
        </div>
      )}

      {/* Floating Cursor Pixel Inspector */}
      {cursorPos.inBounds && (
        <div className="absolute bottom-3 left-3 bg-neutral-900/95 border border-neutral-700/80 rounded-md px-3 py-1.5 shadow-xl backdrop-blur-sm text-[11px] font-mono text-neutral-300 z-20 flex items-center gap-3 pointer-events-none">
          <div className="text-neutral-400">
            X:<span className="text-white">{cursorPos.imgX}</span> Y:
            <span className="text-white">{cursorPos.imgY}</span>
          </div>

          {cursorPos.origRgb && (
            <div className="flex items-center gap-1.5 border-l border-neutral-800 pl-3">
              <span className="text-emerald-400 text-[10px]">Orig:</span>
              <span className="text-neutral-200">
                [{cursorPos.origRgb.join(', ')}]
              </span>
              <div
                className="w-3 h-3 rounded-xs border border-neutral-600 inline-block"
                style={{ backgroundColor: `rgb(${cursorPos.origRgb.join(',')})` }}
              />
            </div>
          )}

          {cursorPos.siteRgb && (
            <div className="flex items-center gap-1.5 border-l border-neutral-800 pl-3">
              <span className="text-blue-400 text-[10px]">Site:</span>
              <span className="text-neutral-200">
                [{cursorPos.siteRgb.join(', ')}]
              </span>
              <div
                className="w-3 h-3 rounded-xs border border-neutral-600 inline-block"
                style={{ backgroundColor: `rgb(${cursorPos.siteRgb.join(',')})` }}
              />
            </div>
          )}

          {cursorPos.diffVal !== null && (
            <div className="flex items-center gap-1.5 border-l border-neutral-800 pl-3">
              <span className="text-amber-400 text-[10px]">Diff:</span>
              <span className="text-amber-300 font-bold">
                {cursorPos.diffVal.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

CompareCanvas.displayName = 'CompareCanvas';

