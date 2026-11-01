import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { 
  BarChart2, 
  AlertTriangle, 
  CheckCircle2, 
  Maximize2,
  Sliders,
  RotateCcw,
  Sparkles,
  Filter
} from 'lucide-react';
import { SlotMedia, TonalRangeFilter, ComparisonStats } from '../types';

interface RgbHistogramPanelProps {
  activeSite: SlotMedia | null;
  original: SlotMedia | null;
  lightMode?: boolean;
  tonalFilter?: TonalRangeFilter;
  onChangeTonalFilter?: (filter: TonalRangeFilter) => void;
  stats?: ComparisonStats | null;
}

export interface HistogramChannelData {
  r: Uint32Array;
  g: Uint32Array;
  b: Uint32Array;
  luma: Uint32Array;
  totalPixels: number;
  rMean: number;
  gMean: number;
  bMean: number;
  lumaMean: number;
  minOccupied: number;
  maxOccupied: number;
  p1Level: number;
  p99Level: number;
  dynamicRange: number;
  shadowClipping: { r: number; g: number; b: number; luma: number };
  highlightClipping: { r: number; g: number; b: number; luma: number };
  posterizationGaps: { r: number; g: number; b: number; luma: number };
}

function computeChannelHistogram(imageData: ImageData | undefined): HistogramChannelData | null {
  if (!imageData || !imageData.data || imageData.width <= 0 || imageData.height <= 0) {
    return null;
  }

  const data = imageData.data;
  const totalPixels = imageData.width * imageData.height;

  const r = new Uint32Array(256);
  const g = new Uint32Array(256);
  const b = new Uint32Array(256);
  const luma = new Uint32Array(256);

  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let lumaSum = 0;

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const rVal = data[idx];
    const gVal = data[idx + 1];
    const bVal = data[idx + 2];

    r[rVal]++;
    g[gVal]++;
    b[bVal]++;

    // Rec. 601 luma standard
    const lumaVal = Math.min(255, Math.max(0, Math.round(0.299 * rVal + 0.587 * gVal + 0.114 * bVal)));
    luma[lumaVal]++;

    rSum += rVal;
    gSum += gVal;
    bSum += bVal;
    lumaSum += lumaVal;
  }

  // Min & Max occupied luma levels
  let minOccupied = 0;
  while (minOccupied < 255 && luma[minOccupied] === 0 && r[minOccupied] === 0 && g[minOccupied] === 0 && b[minOccupied] === 0) {
    minOccupied++;
  }
  let maxOccupied = 255;
  while (maxOccupied > minOccupied && luma[maxOccupied] === 0 && r[maxOccupied] === 0 && g[maxOccupied] === 0 && b[maxOccupied] === 0) {
    maxOccupied--;
  }

  // 1st and 99th percentile levels for robust auto-contrast stretch
  let cumulative = 0;
  let p1Level = minOccupied;
  let p99Level = maxOccupied;
  const p1Target = totalPixels * 0.01;
  const p99Target = totalPixels * 0.99;

  for (let k = 0; k < 256; k++) {
    cumulative += luma[k];
    if (cumulative >= p1Target && p1Level === minOccupied) {
      p1Level = k;
    }
    if (cumulative >= p99Target) {
      p99Level = k;
      break;
    }
  }
  if (p99Level <= p1Level) {
    p1Level = minOccupied;
    p99Level = Math.max(minOccupied + 1, maxOccupied);
  }

  // Calculate gaps (unoccupied levels between min and max non-zero bins)
  const countGaps = (arr: Uint32Array) => {
    let minBin = 0;
    while (minBin < 256 && arr[minBin] === 0) minBin++;
    let maxBin = 255;
    while (maxBin >= 0 && arr[maxBin] === 0) maxBin--;
    if (minBin >= maxBin) return 0;

    let gaps = 0;
    for (let k = minBin; k <= maxBin; k++) {
      if (arr[k] === 0) gaps++;
    }
    return gaps;
  };

  return {
    r,
    g,
    b,
    luma,
    totalPixels,
    rMean: Math.round((rSum / totalPixels) * 10) / 10,
    gMean: Math.round((gSum / totalPixels) * 10) / 10,
    bMean: Math.round((bSum / totalPixels) * 10) / 10,
    lumaMean: Math.round((lumaSum / totalPixels) * 10) / 10,
    minOccupied,
    maxOccupied,
    p1Level,
    p99Level,
    dynamicRange: Math.max(1, maxOccupied - minOccupied),
    shadowClipping: {
      r: Math.round((r[0] / totalPixels) * 1000) / 10,
      g: Math.round((g[0] / totalPixels) * 1000) / 10,
      b: Math.round((b[0] / totalPixels) * 1000) / 10,
      luma: Math.round((luma[0] / totalPixels) * 1000) / 10
    },
    highlightClipping: {
      r: Math.round((r[255] / totalPixels) * 1000) / 10,
      g: Math.round((g[255] / totalPixels) * 1000) / 10,
      b: Math.round((b[255] / totalPixels) * 1000) / 10,
      luma: Math.round((luma[255] / totalPixels) * 1000) / 10
    },
    posterizationGaps: {
      r: countGaps(r),
      g: countGaps(g),
      b: countGaps(b),
      luma: countGaps(luma)
    }
  };
}

/**
 * Normalizes / stretches a 256-bin histogram array from [lowBin..highBin] across the full [0..255] domain,
 * redistributing bin counts with linear interpolation so low-contrast tonal structures become visible.
 */
function stretchHistogramBins(arr: Uint32Array, lowBin: number, highBin: number): Float64Array {
  const out = new Float64Array(256);
  const span = Math.max(1, highBin - lowBin);
  for (let srcBin = lowBin; srcBin <= highBin; srcBin++) {
    const count = arr[srcBin];
    if (count === 0) continue;
    const mappedPos = ((srcBin - lowBin) / span) * 255;
    const targetBin = Math.min(255, Math.max(0, Math.round(mappedPos)));
    out[targetBin] += count;
  }
  return out;
}

export const RgbHistogramPanel: React.FC<RgbHistogramPanelProps> = ({
  activeSite,
  original,
  lightMode = false,
  tonalFilter,
  onChangeTonalFilter,
  stats
}) => {
  const curvesGroupRef = useRef<SVGGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState<number>(360);

  // User interactive state
  const [source, setSource] = useState<'site' | 'original'>('site');
  const [channelMode, setChannelMode] = useState<'all' | 'rgb' | 'luma' | 'r' | 'g' | 'b'>('all');
  const [scaleMode, setScaleMode] = useState<'log' | 'linear'>('log');
  const [styleMode, setStyleMode] = useState<'smooth' | 'stepped'>('smooth');
  const [hoveredLevel, setHoveredLevel] = useState<number | null>(null);

  // Contrast Stretch state (normalizes histogram bin values)
  const [contrastStretch, setContrastStretch] = useState<boolean>(false);
  const [stretchMode, setStretchMode] = useState<'p1_p99' | 'minmax' | 'range'>('p1_p99');
  const [normalizePeaks, setNormalizePeaks] = useState<boolean>(true);

  // Tonal Range Selection state [0..255] synced with comparison tonalFilter
  const [rangeStart, setRangeStart] = useState<number>(tonalFilter?.min ?? 0);
  const [rangeEnd, setRangeEnd] = useState<number>(tonalFilter?.max ?? 255);
  const [filterComparison, setFilterComparison] = useState<boolean>(tonalFilter?.active ?? true);

  // Dragging state for click-and-drag range selection on the chart
  const dragModeRef = useRef<'new' | 'left' | 'right' | null>(null);
  const dragAnchorRef = useRef<number>(0);

  // Sync incoming tonalFilter changes (e.g. if Reset was clicked on CompareCanvas)
  useEffect(() => {
    if (tonalFilter) {
      setRangeStart(tonalFilter.min);
      setRangeEnd(tonalFilter.max);
      setFilterComparison(tonalFilter.active);
    }
  }, [tonalFilter?.min, tonalFilter?.max, tonalFilter?.active]);

  // Measure container width responsively
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateWidth = () => {
      if (el.clientWidth > 100) {
        setChartWidth(el.clientWidth - 20);
      }
    };
    updateWidth();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateWidth);
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, []);

  // Propagate tonal range selection to parent comparison filter
  const emitTonalFilter = useCallback(
    (minVal: number, maxVal: number, isFilterEnabled: boolean, chMode = channelMode) => {
      if (!onChangeTonalFilter) return;
      const low = Math.min(minVal, maxVal);
      const high = Math.max(minVal, maxVal);
      const isSubRange = low > 0 || high < 255;
      const filterChannel: 'luma' | 'r' | 'g' | 'b' =
        chMode === 'r' || chMode === 'g' || chMode === 'b' ? chMode : 'luma';

      onChangeTonalFilter({
        min: low,
        max: high,
        active: isFilterEnabled && isSubRange,
        channel: filterChannel
      });
    },
    [onChangeTonalFilter, channelMode]
  );

  const updateRange = useCallback(
    (start: number, end: number, shouldFilter = filterComparison) => {
      const low = Math.max(0, Math.min(255, Math.min(start, end)));
      const high = Math.max(0, Math.min(255, Math.max(start, end)));
      setRangeStart(low);
      setRangeEnd(high);
      emitTonalFilter(low, high, shouldFilter);
    },
    [filterComparison, emitTonalFilter]
  );

  // Compute histograms for both site and original
  const siteHist = useMemo(() => computeChannelHistogram(activeSite?.imageData), [activeSite?.imageData]);
  const origHist = useMemo(() => computeChannelHistogram(original?.imageData), [original?.imageData]);

  const currentHist = source === 'site' ? siteHist : origHist;

  // Determine effective stretch bounds when Contrast Stretch is enabled
  const stretchBounds = useMemo(() => {
    if (!currentHist) return { low: 0, high: 255 };
    if (!contrastStretch) return { low: 0, high: 255 };
    if (stretchMode === 'minmax') {
      return {
        low: currentHist.minOccupied,
        high: Math.max(currentHist.minOccupied + 1, currentHist.maxOccupied)
      };
    }
    if (stretchMode === 'range') {
      const low = Math.min(rangeStart, rangeEnd);
      const high = Math.max(low + 1, Math.max(rangeStart, rangeEnd));
      return { low, high };
    }
    // Default 'p1_p99'
    return {
      low: currentHist.p1Level,
      high: Math.max(currentHist.p1Level + 1, currentHist.p99Level)
    };
  }, [currentHist, contrastStretch, stretchMode, rangeStart, rangeEnd]);

  // Compute displayed bins (either raw counts or contrast-stretched & normalized 0..100%)
  const displayChannels = useMemo(() => {
    if (!currentHist) return null;
    if (!contrastStretch) {
      return {
        r: Float64Array.from(currentHist.r),
        g: Float64Array.from(currentHist.g),
        b: Float64Array.from(currentHist.b),
        luma: Float64Array.from(currentHist.luma)
      };
    }

    const rStretched = stretchHistogramBins(currentHist.r, stretchBounds.low, stretchBounds.high);
    const gStretched = stretchHistogramBins(currentHist.g, stretchBounds.low, stretchBounds.high);
    const bStretched = stretchHistogramBins(currentHist.b, stretchBounds.low, stretchBounds.high);
    const lumaStretched = stretchHistogramBins(currentHist.luma, stretchBounds.low, stretchBounds.high);

    if (normalizePeaks) {
      // Normalize each channel's bin values to [0..100] (% of channel peak)
      const normalizeArr = (arr: Float64Array) => {
        let max = 0;
        for (let i = 0; i < 256; i++) {
          if (arr[i] > max) max = arr[i];
        }
        if (max <= 0) return arr;
        const out = new Float64Array(256);
        for (let i = 0; i < 256; i++) {
          out[i] = (arr[i] / max) * 100;
        }
        return out;
      };
      return {
        r: normalizeArr(rStretched),
        g: normalizeArr(gStretched),
        b: normalizeArr(bStretched),
        luma: normalizeArr(lumaStretched)
      };
    } else {
      // Normalize globally across all channels to [0..100]
      let globalMax = 0;
      for (let i = 0; i < 256; i++) {
        globalMax = Math.max(globalMax, rStretched[i], gStretched[i], bStretched[i], lumaStretched[i]);
      }
      if (globalMax <= 0) globalMax = 1;
      const normGlobal = (arr: Float64Array) => {
        const out = new Float64Array(256);
        for (let i = 0; i < 256; i++) {
          out[i] = (arr[i] / globalMax) * 100;
        }
        return out;
      };
      return {
        r: normGlobal(rStretched),
        g: normGlobal(gStretched),
        b: normGlobal(bStretched),
        luma: normGlobal(lumaStretched)
      };
    }
  }, [currentHist, contrastStretch, stretchBounds, normalizePeaks]);

  // Compute statistics specifically inside the selected [rangeStart, rangeEnd] tonal window
  const rangeStats = useMemo(() => {
    if (!currentHist) return null;
    const low = Math.min(rangeStart, rangeEnd);
    const high = Math.max(rangeStart, rangeEnd);

    let lumaCount = 0;
    let rCount = 0;
    let gCount = 0;
    let bCount = 0;

    let lumaWeighted = 0;
    let rWeighted = 0;
    let gWeighted = 0;
    let bWeighted = 0;

    let emptyBinsInRange = 0;

    for (let lvl = low; lvl <= high; lvl++) {
      const lv = currentHist.luma[lvl];
      const rv = currentHist.r[lvl];
      const gv = currentHist.g[lvl];
      const bv = currentHist.b[lvl];

      lumaCount += lv;
      rCount += rv;
      gCount += gv;
      bCount += bv;

      lumaWeighted += lv * lvl;
      rWeighted += rv * lvl;
      gWeighted += gv * lvl;
      bWeighted += bv * lvl;

      if (lv === 0) emptyBinsInRange++;
    }

    const sharePct = ((lumaCount / currentHist.totalPixels) * 100).toFixed(1);
    const rSharePct = ((rCount / currentHist.totalPixels) * 100).toFixed(1);
    const gSharePct = ((gCount / currentHist.totalPixels) * 100).toFixed(1);
    const bSharePct = ((bCount / currentHist.totalPixels) * 100).toFixed(1);

    return {
      low,
      high,
      span: high - low + 1,
      lumaCount,
      sharePct,
      rSharePct,
      gSharePct,
      bSharePct,
      lumaMeanInRange: lumaCount > 0 ? (lumaWeighted / lumaCount).toFixed(1) : '—',
      rMeanInRange: rCount > 0 ? (rWeighted / rCount).toFixed(1) : '—',
      gMeanInRange: gCount > 0 ? (gWeighted / gCount).toFixed(1) : '—',
      bMeanInRange: bCount > 0 ? (bWeighted / bCount).toFixed(1) : '—',
      emptyBinsInRange,
      isSubRange: low > 0 || high < 255
    };
  }, [currentHist, rangeStart, rangeEnd]);

  // Chart geometry constants
  const height = 198;
  const margin = { top: 14, right: 14, bottom: 26, left: contrastStretch ? 32 : 14 };
  const innerWidth = Math.max(100, chartWidth - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;

  // Render D3 Histogram Curves (only re-runs when data, channel, scale, or contrastStretch changes — NOT on hover/drag!)
  useEffect(() => {
    const gEl = curvesGroupRef.current;
    if (!gEl || !currentHist || !displayChannels) return;

    const g = d3.select(gEl);
    g.selectAll('*').remove();

    const xScale = d3.scaleLinear()
      .domain([0, 255])
      .range([0, innerWidth]);

    // Find max value across full 0..255 so the curve height stays rock-solid while dragging a range
    let maxVal = contrastStretch ? 100 : 1;
    if (!contrastStretch) {
      for (let i = 0; i <= 255; i++) {
        if (channelMode === 'all' || channelMode === 'rgb') {
          maxVal = Math.max(maxVal, displayChannels.r[i], displayChannels.g[i], displayChannels.b[i], displayChannels.luma[i]);
        } else if (channelMode === 'luma') {
          maxVal = Math.max(maxVal, displayChannels.luma[i]);
        } else if (channelMode === 'r') {
          maxVal = Math.max(maxVal, displayChannels.r[i]);
        } else if (channelMode === 'g') {
          maxVal = Math.max(maxVal, displayChannels.g[i]);
        } else if (channelMode === 'b') {
          maxVal = Math.max(maxVal, displayChannels.b[i]);
        }
      }
    }

    const getY = (val: number) => {
      if (scaleMode === 'log' && !contrastStretch) {
        if (val <= 0) return innerHeight;
        const logVal = Math.log10(val + 1);
        const logMax = Math.log10(maxVal + 1);
        return Math.max(0, innerHeight - (logVal / logMax) * innerHeight);
      } else {
        return Math.max(0, innerHeight - (val / maxVal) * innerHeight);
      }
    };

    const drawChannel = (
      arr: Float64Array,
      strokeColor: string,
      fillColor: string,
      strokeWidth = 1.5,
      opacity = 0.9
    ) => {
      const dataPoints: [number, number][] = [];
      for (let i = 0; i < 256; i++) {
        dataPoints.push([i, arr[i]]);
      }

      const curveType = styleMode === 'smooth' ? d3.curveMonotoneX : d3.curveStepAfter;

      const areaGen = d3.area<[number, number]>()
        .x(d => xScale(d[0]))
        .y0(innerHeight)
        .y1(d => getY(d[1]))
        .curve(curveType);

      const lineGen = d3.line<[number, number]>()
        .x(d => xScale(d[0]))
        .y(d => getY(d[1]))
        .curve(curveType);

      g.append('path')
        .datum(dataPoints)
        .attr('fill', fillColor)
        .attr('d', areaGen)
        .attr('style', 'mix-blend-mode: screen');

      g.append('path')
        .datum(dataPoints)
        .attr('fill', 'none')
        .attr('stroke', strokeColor)
        .attr('stroke-width', strokeWidth)
        .attr('opacity', opacity)
        .attr('d', lineGen);
    };

    if (channelMode === 'all') {
      drawChannel(displayChannels.r, '#f87171', 'rgba(239, 68, 68, 0.24)', 1.25);
      drawChannel(displayChannels.g, '#4ade80', 'rgba(34, 197, 94, 0.24)', 1.25);
      drawChannel(displayChannels.b, '#60a5fa', 'rgba(59, 130, 246, 0.24)', 1.25);
      drawChannel(displayChannels.luma, '#f8fafc', 'none', 1.65, 0.96);
    } else if (channelMode === 'rgb') {
      drawChannel(displayChannels.r, '#f87171', 'rgba(239, 68, 68, 0.28)', 1.45);
      drawChannel(displayChannels.g, '#4ade80', 'rgba(34, 197, 94, 0.28)', 1.45);
      drawChannel(displayChannels.b, '#60a5fa', 'rgba(59, 130, 246, 0.28)', 1.45);
    } else if (channelMode === 'luma') {
      drawChannel(displayChannels.luma, '#ffffff', 'rgba(255, 255, 255, 0.28)', 1.8);
    } else if (channelMode === 'r') {
      drawChannel(displayChannels.r, '#f87171', 'rgba(239, 68, 68, 0.36)', 1.8);
    } else if (channelMode === 'g') {
      drawChannel(displayChannels.g, '#4ade80', 'rgba(34, 197, 94, 0.36)', 1.8);
    } else if (channelMode === 'b') {
      drawChannel(displayChannels.b, '#60a5fa', 'rgba(59, 130, 246, 0.36)', 1.8);
    }
  }, [currentHist, displayChannels, channelMode, scaleMode, styleMode, contrastStretch, innerWidth, innerHeight]);

  // Convert pointer clientX to histogram level [0..255]
  const clientXToLevel = useCallback(
    (clientX: number, svgElement: SVGSVGElement): number => {
      const rect = svgElement.getBoundingClientRect();
      const relX = clientX - rect.left - margin.left;
      const ratio = Math.max(0, Math.min(1, relX / Math.max(1, innerWidth)));
      return Math.round(ratio * 255);
    },
    [margin.left, innerWidth]
  );

  // Pointer handlers for click-and-drag tonal range selection on the chart
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const level = clientXToLevel(e.clientX, e.currentTarget);
    const selLow = Math.min(rangeStart, rangeEnd);
    const selHigh = Math.max(rangeStart, rangeEnd);
    const isSubRange = selLow > 0 || selHigh < 255;

    // Check if user grabbed near an existing left or right handle (within 6 levels)
    if (isSubRange && Math.abs(level - selLow) <= 6) {
      dragModeRef.current = 'left';
      dragAnchorRef.current = selHigh;
      updateRange(level, selHigh);
    } else if (isSubRange && Math.abs(level - selHigh) <= 6) {
      dragModeRef.current = 'right';
      dragAnchorRef.current = selLow;
      updateRange(selLow, level);
    } else {
      dragModeRef.current = 'new';
      dragAnchorRef.current = level;
      setRangeStart(level);
      setRangeEnd(level);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const level = clientXToLevel(e.clientX, e.currentTarget);
    setHoveredLevel(level);

    if (dragModeRef.current !== null) {
      const anchor = dragAnchorRef.current;
      const low = Math.min(anchor, level);
      const high = Math.max(anchor, level);
      setRangeStart(low);
      setRangeEnd(high);
      if (high - low >= 2) {
        emitTonalFilter(low, high, filterComparison);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (dragModeRef.current !== null) {
      const span = Math.abs(rangeEnd - rangeStart);
      if (dragModeRef.current === 'new' && span < 3) {
        // Single click without dragging resets to full 0..255 range
        updateRange(0, 255);
      } else {
        updateRange(Math.min(rangeStart, rangeEnd), Math.max(rangeStart, rangeEnd));
      }
      dragModeRef.current = null;
    }
  };

  const handlePointerLeave = () => {
    setHoveredLevel(null);
  };

  if (!currentHist) {
    return (
      <div className={`py-12 text-center space-y-2 ${lightMode ? 'text-slate-500' : 'text-neutral-500'}`}>
        <BarChart2 className="w-8 h-8 mx-auto opacity-60" />
        <p className="text-sm">No active image to analyze</p>
      </div>
    );
  }

  // Hover & selection coordinates
  const selLow = Math.min(rangeStart, rangeEnd);
  const selHigh = Math.max(rangeStart, rangeEnd);
  const isSubRange = selLow > 0 || selHigh < 255;
  const levelToX = (lvl: number) => (lvl / 255) * innerWidth;

  const hl = hoveredLevel ?? 128;
  const actualLevel = contrastStretch
    ? Math.min(255, Math.max(0, Math.round(stretchBounds.low + (hl / 255) * (stretchBounds.high - stretchBounds.low))))
    : hl;
  const hR = currentHist.r[actualLevel] || 0;
  const hG = currentHist.g[actualLevel] || 0;
  const hB = currentHist.b[actualLevel] || 0;
  const hLuma = currentHist.luma[actualLevel] || 0;
  const normLumaPct = displayChannels ? Math.round(displayChannels.luma[hl] || 0) : 0;

  // Clipping alerts
  const hasShadowClip = currentHist.shadowClipping.luma > 0.05;
  const hasHighlightClip = currentHist.highlightClipping.luma > 0.05;
  const hasPosterization = currentHist.posterizationGaps.luma > 10;

  const cardClass = lightMode
    ? 'bg-slate-50/90 border border-slate-200 text-slate-800 rounded-xl p-3.5'
    : 'bg-neutral-950/70 border border-neutral-800 text-neutral-200 rounded-lg p-2.5';

  const labelClass = lightMode
    ? 'text-[11px] font-semibold text-slate-500 uppercase tracking-wider'
    : 'text-[10px] font-semibold text-neutral-400 uppercase tracking-wider';

  return (
    <div className="space-y-3.5">
      {/* Header controls: Source Selector, Channel filter & Quick Contrast Stretch Toggle */}
      <div className={`${cardClass} space-y-2.5`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={labelClass}>Image Target</span>
          <div className="flex items-center gap-2">
            {/* Quick Contrast Stretch Toggle Pill */}
            <button
              type="button"
              onClick={() => setContrastStretch(prev => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                contrastStretch
                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-xs'
                  : lightMode
                  ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700'
              }`}
              title="Normalize histogram bin values across 0–255 to reveal low-contrast details"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Contrast Stretch: {contrastStretch ? 'On' : 'Off'}</span>
            </button>

            <div className={`flex rounded-lg border p-0.5 ${lightMode ? 'bg-white border-slate-200' : 'bg-neutral-900 border-neutral-800'}`}>
              <button
                type="button"
                onClick={() => setSource('site')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  source === 'site'
                    ? 'bg-[#1B4D7E] text-white'
                    : lightMode ? 'text-slate-600 hover:text-slate-900' : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {activeSite?.siteName || 'Comparison'}
              </button>
              <button
                type="button"
                onClick={() => setSource('original')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  source === 'original'
                    ? 'bg-emerald-600 text-white'
                    : lightMode ? 'text-slate-600 hover:text-slate-900' : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Original
              </button>
            </div>
          </div>
        </div>

        {/* Channel Selection Buttons */}
        <div className="flex items-center justify-between pt-1">
          <span className={lightMode ? 'text-xs font-medium text-slate-600' : 'text-[10px] text-neutral-400'}>Channels</span>
          <div className="flex items-center gap-1">
            {(['all', 'rgb', 'luma', 'r', 'g', 'b'] as const).map(ch => {
              const active = channelMode === ch;
              const label = ch === 'all' ? 'All' : ch === 'rgb' ? 'RGB' : ch === 'luma' ? 'Luma' : ch.toUpperCase();
              return (
                <button
                  key={ch}
                  type="button"
                  onClick={() => {
                    setChannelMode(ch);
                    emitTonalFilter(rangeStart, rangeEnd, filterComparison, ch);
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
                    active
                      ? ch === 'r'
                        ? 'bg-red-600 border-red-600 text-white'
                        : ch === 'g'
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : ch === 'b'
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-[#1B4D7E] border-[#1B4D7E] text-white'
                      : lightMode
                      ? 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Display options: Log vs Linear & Smooth vs Stepped */}
        <div className={`flex items-center justify-between pt-2 border-t text-[11px] ${lightMode ? 'border-slate-200' : 'border-neutral-800/80'}`}>
          <div className="flex items-center gap-1">
            <span className={lightMode ? 'text-slate-500' : 'text-neutral-500'}>Scale:</span>
            <button
              type="button"
              onClick={() => setScaleMode('log')}
              className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
                scaleMode === 'log'
                  ? 'bg-[#1B4D7E] text-white'
                  : lightMode ? 'text-slate-600 hover:bg-slate-200/60' : 'text-neutral-400'
              }`}
            >
              Log
            </button>
            <button
              type="button"
              onClick={() => setScaleMode('linear')}
              className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
                scaleMode === 'linear'
                  ? 'bg-[#1B4D7E] text-white'
                  : lightMode ? 'text-slate-600 hover:bg-slate-200/60' : 'text-neutral-400'
              }`}
            >
              Linear
            </button>
          </div>

          <div className="flex items-center gap-1">
            <span className={lightMode ? 'text-slate-500' : 'text-neutral-500'}>Curve:</span>
            <button
              type="button"
              onClick={() => setStyleMode('smooth')}
              className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
                styleMode === 'smooth'
                  ? 'bg-[#1B4D7E] text-white'
                  : lightMode ? 'text-slate-600 hover:bg-slate-200/60' : 'text-neutral-500'
              }`}
            >
              Smooth
            </button>
            <button
              type="button"
              onClick={() => setStyleMode('stepped')}
              className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
                styleMode === 'stepped'
                  ? 'bg-[#1B4D7E] text-white'
                  : lightMode ? 'text-slate-600 hover:bg-slate-200/60' : 'text-neutral-500'
              }`}
              title="Stepped mode reveals individual bin quantization comb gaps"
            >
              Stepped
            </button>
          </div>
        </div>
      </div>

      {/* ================= CONTRAST STRETCH & BIN NORMALIZATION ================= */}
      <div className={`${cardClass} space-y-2.5`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Maximize2 className={`w-3.5 h-3.5 ${contrastStretch ? 'text-emerald-500' : lightMode ? 'text-slate-500' : 'text-neutral-400'}`} />
            <div>
              <div className={`text-xs font-semibold flex items-center gap-1.5 ${lightMode ? 'text-slate-800' : 'text-neutral-200'}`}>
                <span>Contrast Stretch (Bin Normalization)</span>
                {contrastStretch && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    {stretchBounds.low}–{stretchBounds.high} → 0–100%
                  </span>
                )}
              </div>
              <div className={`text-[10px] ${lightMode ? 'text-slate-500' : 'text-neutral-400'}`}>
                Normalize histogram bin values (0–100%) and stretch dynamic range
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setContrastStretch(prev => !prev)}
            role="switch"
            aria-checked={contrastStretch}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
              contrastStretch ? 'bg-emerald-500' : lightMode ? 'bg-slate-300' : 'bg-neutral-700'
            }`}
            title="Toggle Histogram Contrast Stretch"
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                contrastStretch ? 'translate-x-4.5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {contrastStretch && (
          <div className={`pt-2 border-t space-y-2 ${lightMode ? 'border-slate-200' : 'border-neutral-800/80'}`}>
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => setStretchMode('p1_p99')}
                className={`py-1 px-1.5 rounded text-[10px] font-medium border transition-all cursor-pointer ${
                  stretchMode === 'p1_p99'
                    ? 'bg-[#1B4D7E] border-[#1B4D7E] text-white'
                    : lightMode ? 'bg-white border-slate-200 text-slate-600' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                }`}
                title="Stretch between 1st and 99th percentile levels (ignores outlier spikes)"
              >
                Auto p1–p99 ({currentHist.p1Level}–{currentHist.p99Level})
              </button>
              <button
                type="button"
                onClick={() => setStretchMode('minmax')}
                className={`py-1 px-1.5 rounded text-[10px] font-medium border transition-all cursor-pointer ${
                  stretchMode === 'minmax'
                    ? 'bg-[#1B4D7E] border-[#1B4D7E] text-white'
                    : lightMode ? 'bg-white border-slate-200 text-slate-600' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                }`}
                title="Stretch between minimum and maximum occupied bins"
              >
                Min–Max ({currentHist.minOccupied}–{currentHist.maxOccupied})
              </button>
              <button
                type="button"
                onClick={() => setStretchMode('range')}
                className={`py-1 px-1.5 rounded text-[10px] font-medium border transition-all cursor-pointer ${
                  stretchMode === 'range'
                    ? 'bg-[#1B4D7E] border-[#1B4D7E] text-white'
                    : lightMode ? 'bg-white border-slate-200 text-slate-600' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                }`}
                title="Stretch the currently selected tonal range across the full chart"
              >
                Selected ({selLow}–{selHigh})
              </button>
            </div>

            <label className="flex items-center justify-between text-[11px] cursor-pointer pt-0.5">
              <span className={lightMode ? 'text-slate-600' : 'text-neutral-300'}>
                Normalize each channel peak independently (0–100%)
              </span>
              <input
                type="checkbox"
                checked={normalizePeaks}
                onChange={e => setNormalizePeaks(e.target.checked)}
                className="accent-[#1B4D7E] w-3.5 h-3.5 rounded cursor-pointer"
              />
            </label>
          </div>
        )}
      </div>

      {/* ================= INTERACTIVE HISTOGRAM CHART (CLICK & DRAG RANGE SELECTION) ================= */}
      <div 
        ref={containerRef} 
        className="bg-[#0B2545] rounded-xl p-2.5 border border-slate-800 shadow-inner relative"
      >
        <div className="flex items-center justify-between px-1 pb-1.5 text-[10px] text-slate-300">
          <span className="font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" />
            {contrastStretch
              ? `Normalized Bins (0–100% · Domain ${stretchBounds.low}–${stretchBounds.high})`
              : 'Click and drag across chart to filter tonal range'}
          </span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sky-300 font-semibold">
              {isSubRange ? `Selected: ${selLow}–${selHigh}` : 'Full Range: 0–255'}
            </span>
            {isSubRange && (
              <button
                type="button"
                onClick={() => updateRange(0, 255)}
                className="px-1.5 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/40 text-sky-200 border border-sky-400/30 text-[9px] font-semibold cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Interactive SVG Chart */}
        <svg
          viewBox={`0 0 ${chartWidth} ${height}`}
          width="100%"
          height={height}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          className="block w-full overflow-visible select-none cursor-crosshair touch-none"
        >
          <g transform={`translate(${margin.left},${margin.top})`}>
            {/* Background chart box */}
            <rect
              width={innerWidth}
              height={innerHeight}
              fill="#0B2545"
              rx={6}
            />

            {/* Tonal zone background bands (Shadows 0-64, Midtones 64-192, Highlights 192-255) */}
            <rect
              x={0}
              width={levelToX(64)}
              height={innerHeight}
              fill="rgba(255, 255, 255, 0.02)"
            />
            <rect
              x={levelToX(192)}
              width={innerWidth - levelToX(192)}
              height={innerHeight}
              fill="rgba(255, 255, 255, 0.03)"
            />

            {/* Vertical quarter grid lines */}
            {[64, 128, 192].map(lvl => (
              <line
                key={lvl}
                x1={levelToX(lvl)}
                x2={levelToX(lvl)}
                y1={0}
                y2={innerHeight}
                stroke="rgba(148, 163, 184, 0.18)"
                strokeDasharray="2,2"
                strokeWidth={1}
              />
            ))}

            {/* Normalized Y-axis grid lines & labels when Contrast Stretch is active */}
            {contrastStretch &&
              [0, 50, 100].map(pct => {
                const yPos = innerHeight - (pct / 100) * innerHeight;
                return (
                  <g key={pct}>
                    <line
                      x1={0}
                      x2={innerWidth}
                      y1={yPos}
                      y2={yPos}
                      stroke="rgba(56, 189, 248, 0.14)"
                      strokeDasharray="2,2"
                      strokeWidth={1}
                    />
                    <text
                      x={-4}
                      y={yPos + 3}
                      textAnchor="end"
                      fill="#38bdf8"
                      fontSize="8px"
                      fontFamily="monospace"
                    >
                      {pct}%
                    </text>
                  </g>
                );
              })}

            {/* D3 Rendered Channel Curves */}
            <g ref={curvesGroupRef} />

            {/* Dimmed regions outside selected tonal range [selLow, selHigh] */}
            {selLow > 0 && (
              <rect
                x={0}
                y={0}
                width={levelToX(selLow)}
                height={innerHeight}
                fill="rgba(2, 6, 23, 0.72)"
              />
            )}
            {selHigh < 255 && (
              <rect
                x={levelToX(selHigh)}
                y={0}
                width={Math.max(0, innerWidth - levelToX(selHigh))}
                height={innerHeight}
                fill="rgba(2, 6, 23, 0.72)"
              />
            )}

            {/* Active Range Selection Highlight Box & Draggable Left/Right Handles */}
            {isSubRange && (
              <g>
                <rect
                  x={levelToX(selLow)}
                  y={0}
                  width={Math.max(2, levelToX(selHigh) - levelToX(selLow))}
                  height={innerHeight}
                  fill="rgba(56, 189, 248, 0.10)"
                  stroke="#38bdf8"
                  strokeWidth={1.5}
                />

                {/* Left Handle Bar & Grip Pill */}
                <line
                  x1={levelToX(selLow)}
                  x2={levelToX(selLow)}
                  y1={0}
                  y2={innerHeight}
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                />
                <rect
                  x={levelToX(selLow) - 4}
                  y={innerHeight / 2 - 12}
                  width={8}
                  height={24}
                  rx={3}
                  fill="#38bdf8"
                  stroke="#0B2545"
                  strokeWidth={1}
                />

                {/* Right Handle Bar & Grip Pill */}
                <line
                  x1={levelToX(selHigh)}
                  x2={levelToX(selHigh)}
                  y1={0}
                  y2={innerHeight}
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                />
                <rect
                  x={levelToX(selHigh) - 4}
                  y={innerHeight / 2 - 12}
                  width={8}
                  height={24}
                  rx={3}
                  fill="#38bdf8"
                  stroke="#0B2545"
                  strokeWidth={1}
                />

                {/* Floating Range Pill Tag at top of brush */}
                <rect
                  x={Math.min(
                    innerWidth - 68,
                    Math.max(0, (levelToX(selLow) + levelToX(selHigh)) / 2 - 34)
                  )}
                  y={4}
                  width={68}
                  height={16}
                  rx={4}
                  fill="rgba(15, 23, 42, 0.92)"
                  stroke="#38bdf8"
                  strokeWidth={0.8}
                />
                <text
                  x={Math.min(
                    innerWidth - 34,
                    Math.max(34, (levelToX(selLow) + levelToX(selHigh)) / 2)
                  )}
                  y={15}
                  textAnchor="middle"
                  fill="#38bdf8"
                  fontSize="9px"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {selLow}–{selHigh}
                </text>
              </g>
            )}

            {/* Shadow & Highlight clipping indicator bars */}
            {currentHist.luma[0] > 0 && (
              <line
                x1={0}
                x2={0}
                y1={0}
                y2={innerHeight}
                stroke="#38bdf8"
                strokeWidth={2.5}
              />
            )}
            {currentHist.luma[255] > 0 && (
              <line
                x1={innerWidth}
                x2={innerWidth}
                y1={0}
                y2={innerHeight}
                stroke="#f87171"
                strokeWidth={2.5}
              />
            )}

            {/* X Axis Ticks */}
            {[0, 64, 128, 192, 255].map(t => {
              const labelVal = contrastStretch
                ? Math.round(stretchBounds.low + (t / 255) * (stretchBounds.high - stretchBounds.low))
                : t;
              return (
                <text
                  key={t}
                  x={levelToX(t)}
                  y={innerHeight + 16}
                  textAnchor={t === 0 ? 'start' : t === 255 ? 'end' : 'middle'}
                  fill={contrastStretch ? '#34d399' : '#94a3b8'}
                  fontSize="9px"
                  fontFamily="monospace"
                >
                  {labelVal}
                </text>
              );
            })}

            {/* Hover Scrubbing Crosshair Line */}
            {hoveredLevel !== null && (
              <line
                x1={levelToX(hoveredLevel)}
                x2={levelToX(hoveredLevel)}
                y1={0}
                y2={innerHeight}
                stroke="#f8fafc"
                strokeWidth={1}
                strokeDasharray="2,2"
              />
            )}
          </g>
        </svg>

        {/* Level Readout Bar */}
        <div className="mt-1.5 px-2 py-1 bg-slate-950/80 rounded-lg border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono tabular-nums">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">
              Level: <strong className="text-white">{actualLevel}</strong>/255
            </span>
            {contrastStretch && (
              <span className="text-emerald-400">
                (Norm: {normLumaPct}%)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5 text-[10px]">
            <span className="text-red-400">R:{hR}</span>
            <span className="text-emerald-400">G:{hG}</span>
            <span className="text-blue-400">B:{hB}</span>
            <span className="text-slate-200">Y:{hLuma}</span>
          </div>
        </div>
      </div>

      {/* ================= INTERACTIVE TONAL RANGE SELECTION & COMPARISON FILTER ================= */}
      <div className={`${cardClass} space-y-2.5`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sliders className={`w-3.5 h-3.5 ${lightMode ? 'text-slate-600' : 'text-sky-400'}`} />
            <span className={labelClass}>Tonal Range Filter</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[11px] font-medium cursor-pointer">
              <Filter className="w-3 h-3 text-sky-500" />
              <span className={lightMode ? 'text-slate-700' : 'text-neutral-300'}>
                Filter comparison
              </span>
              <input
                type="checkbox"
                checked={filterComparison}
                onChange={e => {
                  const checked = e.target.checked;
                  setFilterComparison(checked);
                  emitTonalFilter(rangeStart, rangeEnd, checked);
                }}
                className="accent-[#1B4D7E] w-3.5 h-3.5 rounded cursor-pointer"
              />
            </label>

            {rangeStats?.isSubRange && (
              <button
                type="button"
                onClick={() => {
                  updateRange(0, 255);
                  if (stretchMode === 'range') setStretchMode('p1_p99');
                }}
                className="flex items-center gap-1 text-[10px] font-semibold text-sky-500 hover:text-sky-400 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset (0–255)</span>
              </button>
            )}
          </div>
        </div>

        {/* Preset Tonal Zone Pills */}
        <div className="grid grid-cols-4 gap-1">
          {[
            { label: 'Full (0–255)', min: 0, max: 255 },
            { label: 'Shadows (0–64)', min: 0, max: 64 },
            { label: 'Midtones (64–192)', min: 64, max: 192 },
            { label: 'Highlights (192–255)', min: 192, max: 255 }
          ].map(zone => {
            const isSelected = selLow === zone.min && selHigh === zone.max;
            return (
              <button
                key={zone.label}
                type="button"
                onClick={() => updateRange(zone.min, zone.max)}
                className={`py-1.5 px-1.5 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#1B4D7E] border-[#1B4D7E] text-white'
                    : lightMode
                    ? 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {zone.label}
              </button>
            );
          })}
        </div>

        {/* Dual Min / Max Level Sliders */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-mono tabular-nums">
              <span className={lightMode ? 'text-slate-500' : 'text-neutral-400'}>Min Tonal Level</span>
              <strong className={lightMode ? 'text-slate-800' : 'text-white'}>{selLow}</strong>
            </div>
            <input
              type="range"
              min={0}
              max={254}
              value={selLow}
              onChange={e => {
                const val = parseInt(e.target.value, 10);
                updateRange(Math.min(val, selHigh - 1), selHigh);
              }}
              className="w-full accent-[#1B4D7E] h-1.5 bg-slate-300 dark:bg-neutral-800 rounded appearance-none cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-mono tabular-nums">
              <span className={lightMode ? 'text-slate-500' : 'text-neutral-400'}>Max Tonal Level</span>
              <strong className={lightMode ? 'text-slate-800' : 'text-white'}>{selHigh}</strong>
            </div>
            <input
              type="range"
              min={1}
              max={255}
              value={selHigh}
              onChange={e => {
                const val = parseInt(e.target.value, 10);
                updateRange(selLow, Math.max(val, selLow + 1));
              }}
              className="w-full accent-[#1B4D7E] h-1.5 bg-slate-300 dark:bg-neutral-800 rounded appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Range Selection Telemetry & Filtered Comparison Metrics Box */}
        {rangeStats && (
          <div className={`p-2.5 rounded-lg border space-y-2.5 text-[11px] tabular-nums ${
            lightMode ? 'bg-white border-slate-200' : 'bg-neutral-900/80 border-neutral-800'
          }`}>
            <div className="flex items-center justify-between">
              <span className={lightMode ? 'text-slate-500 font-medium' : 'text-neutral-400'}>
                Pixels in Tonal Range [{rangeStats.low}–{rangeStats.high}]:
              </span>
              <span className="font-mono font-bold text-sky-500">
                {rangeStats.sharePct}% ({rangeStats.lumaCount.toLocaleString()} px)
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1 text-center font-mono text-[10px]">
              <div className={`p-1 rounded ${lightMode ? 'bg-slate-50 border border-slate-100' : 'bg-neutral-950'}`}>
                <span className="text-red-500 block text-[9px]">R Mean</span>
                <span className={lightMode ? 'text-slate-800 font-semibold' : 'text-neutral-200'}>{rangeStats.rMeanInRange}</span>
              </div>
              <div className={`p-1 rounded ${lightMode ? 'bg-slate-50 border border-slate-100' : 'bg-neutral-950'}`}>
                <span className="text-emerald-500 block text-[9px]">G Mean</span>
                <span className={lightMode ? 'text-slate-800 font-semibold' : 'text-neutral-200'}>{rangeStats.gMeanInRange}</span>
              </div>
              <div className={`p-1 rounded ${lightMode ? 'bg-slate-50 border border-slate-100' : 'bg-neutral-950'}`}>
                <span className="text-blue-500 block text-[9px]">B Mean</span>
                <span className={lightMode ? 'text-slate-800 font-semibold' : 'text-neutral-200'}>{rangeStats.bMeanInRange}</span>
              </div>
              <div className={`p-1 rounded ${lightMode ? 'bg-slate-50 border border-slate-100' : 'bg-neutral-950'}`}>
                <span className={lightMode ? 'text-slate-600 block text-[9px]' : 'text-white block text-[9px]'}>Y Mean</span>
                <span className={lightMode ? 'text-slate-800 font-semibold' : 'text-neutral-200'}>{rangeStats.lumaMeanInRange}</span>
              </div>
            </div>

            {/* Live Filtered Comparison Metrics when a tonal sub-range is selected */}
            {rangeStats.isSubRange && stats && filterComparison && (
              <div className={`pt-2 border-t space-y-1.5 ${lightMode ? 'border-slate-100' : 'border-neutral-800'}`}>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-sky-500 flex items-center gap-1">
                    <Filter className="w-3 h-3" />
                    Filtered Comparison Metrics (Levels {rangeStats.low}–{rangeStats.high})
                  </span>
                  <span className="font-mono text-[10px] opacity-75">Live on canvas</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[10px]">
                  <div className={`p-1.5 rounded border ${lightMode ? 'bg-sky-50/60 border-sky-200/70' : 'bg-sky-950/30 border-sky-800/50'}`}>
                    <span className="block text-[9px] opacity-75">PSNR in Range</span>
                    <strong className="text-xs text-sky-500">{stats.psnrDb} dB</strong>
                  </div>
                  <div className={`p-1.5 rounded border ${lightMode ? 'bg-sky-50/60 border-sky-200/70' : 'bg-sky-950/30 border-sky-800/50'}`}>
                    <span className="block text-[9px] opacity-75">SSIM in Range</span>
                    <strong className="text-xs text-emerald-500">{stats.ssimMean}</strong>
                  </div>
                  <div className={`p-1.5 rounded border ${lightMode ? 'bg-sky-50/60 border-sky-200/70' : 'bg-sky-950/30 border-sky-800/50'}`}>
                    <span className="block text-[9px] opacity-75">Mean ΔE2000</span>
                    <strong className="text-xs text-amber-500">{stats.deltaE2000Mean}</strong>
                  </div>
                </div>
              </div>
            )}

            {rangeStats.isSubRange && (
              <button
                type="button"
                onClick={() => {
                  setContrastStretch(true);
                  setStretchMode('range');
                }}
                className="w-full py-1.5 px-2.5 rounded-lg bg-[#1B4D7E] hover:bg-[#153e66] text-white text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Stretch Histogram to Selected Range ({rangeStats.low}–{rangeStats.high})</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Clipping & Tonal Artifact Diagnostics */}
      <div className={`${cardClass} space-y-2`}>
        <span className={`${labelClass} block`}>
          Clipping & Tonal Diagnostics
        </span>

        <div className="space-y-1.5">
          {/* Shadow Clipping */}
          <div className={`p-2 rounded-lg border flex items-center justify-between text-[11px] tabular-nums ${
            hasShadowClip
              ? lightMode ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-amber-950/30 border-amber-800/80 text-amber-200'
              : lightMode ? 'bg-white border-slate-200 text-slate-700' : 'bg-neutral-900/60 border-neutral-800 text-neutral-300'
          }`}>
            <div className="flex items-center gap-1.5">
              {hasShadowClip ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              )}
              <span>Shadow Clipping (Level 0):</span>
            </div>
            <span className="font-mono font-semibold">
              {currentHist.shadowClipping.luma}%
            </span>
          </div>

          {/* Highlight Clipping */}
          <div className={`p-2 rounded-lg border flex items-center justify-between text-[11px] tabular-nums ${
            hasHighlightClip
              ? lightMode ? 'bg-red-50 border-red-300 text-red-900' : 'bg-red-950/30 border-red-800/80 text-red-200'
              : lightMode ? 'bg-white border-slate-200 text-slate-700' : 'bg-neutral-900/60 border-neutral-800 text-neutral-300'
          }`}>
            <div className="flex items-center gap-1.5">
              {hasHighlightClip ? (
                <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              )}
              <span>Highlight Clipping (Level 255):</span>
            </div>
            <span className="font-mono font-semibold">
              {currentHist.highlightClipping.luma}%
            </span>
          </div>

          {/* Posterization Comb Gaps Alert */}
          <div className={`p-2 rounded-lg border flex items-center justify-between text-[11px] tabular-nums ${
            hasPosterization
              ? lightMode ? 'bg-purple-50 border-purple-300 text-purple-900' : 'bg-purple-950/30 border-purple-800/80 text-purple-200'
              : lightMode ? 'bg-white border-slate-200 text-slate-700' : 'bg-neutral-900/60 border-neutral-800 text-neutral-300'
          }`}>
            <div className="flex items-center gap-1.5">
              {hasPosterization ? (
                <AlertTriangle className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              )}
              <span>Empty Comb Gaps (Posterization):</span>
            </div>
            <span className="font-mono font-semibold">
              {currentHist.posterizationGaps.luma} bins
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
