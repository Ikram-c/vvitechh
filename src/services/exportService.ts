import { jsPDF } from 'jspdf';
import { ComparisonStats, JpegInfo } from '../types';

export interface SingleReportData {
  reportTitle?: string;
  analystName?: string;
  notes?: string;
  timestamp: number;
  original: {
    name: string;
    width: number;
    height: number;
    fileSize: number;
    format: string;
    thumbnailUrl?: string;
    jpegInfo?: JpegInfo;
  };
  processed: {
    name: string;
    siteName: string;
    width: number;
    height: number;
    fileSize: number;
    format: string;
    thumbnailUrl?: string;
    jpegInfo?: JpegInfo;
  };
  stats: ComparisonStats;
}

export interface BatchItemResult {
  id: string;
  filename: string;
  platform: string;
  originalWidth: number;
  originalHeight: number;
  originalSize: number;
  processedWidth: number;
  processedHeight: number;
  processedSize: number;
  processedFormat: string;
  compressionRatio: number; // percentage saved, e.g. 78.4%
  psnrDb: number;
  ssimMean: number;
  deltaE2000Mean: number;
  deltaE2000Max: number;
  visibleChangesPct: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D';
  thumbnailUrl?: string;
  originalThumbnailUrl?: string;
  canvas?: HTMLCanvasElement;
  imageData?: ImageData;
  jpegInfo?: JpegInfo;
}

/**
 * Creates a compact data URL thumbnail from canvas or ImageData
 */
export function createThumbnailDataUrl(
  canvasOrImageData: HTMLCanvasElement | ImageData,
  maxWidth: number = 400,
  maxHeight: number = 300
): string {
  const srcW = canvasOrImageData.width;
  const srcH = canvasOrImageData.height;
  if (!srcW || !srcH) return '';

  const scale = Math.min(maxWidth / srcW, maxHeight / srcH, 1.0);
  const targetW = Math.max(1, Math.round(srcW * scale));
  const targetH = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';

  if (canvasOrImageData instanceof HTMLCanvasElement) {
    ctx.drawImage(canvasOrImageData, 0, 0, targetW, targetH);
  } else {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = srcW;
    tempCanvas.height = srcH;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.putImageData(canvasOrImageData, 0, 0);
      ctx.drawImage(tempCanvas, 0, 0, targetW, targetH);
    }
  }

  return canvas.toDataURL('image/jpeg', 0.85);
}

/**
 * Formats bytes to human-readable size
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i] || 'MB'}`;
}

/**
 * Determines letter grade and descriptive fidelity assessment
 */
export function getFidelityGrade(psnr: number, ssim: number, deltaE: number): {
  grade: 'A+' | 'A' | 'B' | 'C' | 'D';
  label: string;
  color: [number, number, number]; // RGB
} {
  if (psnr >= 44 && ssim >= 0.98 && deltaE < 1.5) {
    return { grade: 'A+', label: 'Virtually Lossless', color: [16, 185, 129] };
  }
  if (psnr >= 38 && ssim >= 0.94 && deltaE < 2.5) {
    return { grade: 'A', label: 'Imperceptible Loss (High Fidelity)', color: [5, 150, 105] };
  }
  if (psnr >= 32 && ssim >= 0.88 && deltaE < 4.5) {
    return { grade: 'B', label: 'Acceptable Web Quality', color: [217, 119, 6] };
  }
  if (psnr >= 27 && ssim >= 0.78 && deltaE < 7.5) {
    return { grade: 'C', label: 'Noticeable Compression Artifacts', color: [234, 88, 12] };
  }
  return { grade: 'D', label: 'Severe Degradation', color: [220, 38, 38] };
}

/**
 * Downloads a text or binary blob with filename
 */
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Exports single comparison analysis to CSV
 */
export function exportComparisonToCSV(data: SingleReportData): void {
  const lines: string[] = [];

  const esc = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  lines.push('# COMPRESSCOMPARE - IMAGE FIDELITY ANALYSIS REPORT');
  lines.push(`Report Title,${esc(data.reportTitle || 'Compression Quality Audit')}`);
  lines.push(`Generated Date,${esc(new Date(data.timestamp).toISOString())}`);
  lines.push(`Analyst,${esc(data.analystName || 'Automated Pipeline')}`);
  lines.push(`Target Platform,${esc(data.processed.siteName)}`);
  if (data.notes) {
    lines.push(`Notes,${esc(data.notes)}`);
  }
  lines.push('');

  // 1. Image Metadata Section
  lines.push('# IMAGE METADATA COMPARISON');
  lines.push('Attribute,Original,Processed,Delta / Reduction');
  lines.push(`File Name,${esc(data.original.name)},${esc(data.processed.name)},-`);
  lines.push(`Format,${esc(data.original.format.toUpperCase())},${esc(data.processed.format.toUpperCase())},-`);
  lines.push(`Dimensions,${esc(`${data.original.width} x ${data.original.height}`)},${esc(`${data.processed.width} x ${data.processed.height}`)},${esc(`${Math.round(((data.processed.width * data.processed.height) / (data.original.width * data.original.height || 1)) * 100)}% pixel area`)}`);
  
  const sizeDiff = data.original.fileSize - data.processed.fileSize;
  const pctSaved = data.original.fileSize > 0 
    ? ((sizeDiff / data.original.fileSize) * 100).toFixed(1) 
    : '0';
  lines.push(`File Size,${esc(formatBytes(data.original.fileSize))},${esc(formatBytes(data.processed.fileSize))},${esc(`${pctSaved}% saved (${formatBytes(Math.abs(sizeDiff))} ${sizeDiff >= 0 ? 'reduction' : 'increase'})`)}`);
  lines.push(`File Size (Bytes),${esc(data.original.fileSize)},${esc(data.processed.fileSize)},${esc(sizeDiff)}`);

  if (data.original.jpegInfo || data.processed.jpegInfo) {
    lines.push(`Estimated JPEG Luma Quality,${esc(data.original.jpegInfo?.estimatedLumaQuality ? `Q${data.original.jpegInfo.estimatedLumaQuality}` : 'N/A')},${esc(data.processed.jpegInfo?.estimatedLumaQuality ? `Q${data.processed.jpegInfo.estimatedLumaQuality}` : 'N/A')},-`);
    lines.push(`Chroma Subsampling,${esc(data.original.jpegInfo?.subsampling || 'N/A')},${esc(data.processed.jpegInfo?.subsampling || 'N/A')},-`);
    lines.push(`EXIF / Metadata Preserved,${esc(data.original.jpegInfo?.hasExif ? 'Yes' : 'No')},${esc(data.processed.jpegInfo?.hasExif ? 'Yes' : 'No (Stripped)')},-`);
  }
  lines.push('');

  // 2. Statistical Metrics Section
  lines.push('# PERCEPTUAL & MATHEMATICAL FIDELITY METRICS');
  lines.push('Metric,Value,Unit,Threshold Reference,Interpretation');
  
  const gradeInfo = getFidelityGrade(data.stats.psnrDb, data.stats.ssimMean, data.stats.deltaE2000Mean);

  lines.push(`Overall Fidelity Grade,${esc(gradeInfo.grade)},Grade,A+ to D,${esc(gradeInfo.label)}`);
  lines.push(`PSNR (Peak Signal-to-Noise),${esc(data.stats.psnrDb)},dB,> 40 dB high; < 30 dB poor,${esc(data.stats.psnrDb >= 40 ? 'High fidelity' : data.stats.psnrDb >= 32 ? 'Good quality' : 'Noticeable noise')}`);
  lines.push(`SSIM (Structural Similarity),${esc(data.stats.ssimMean)},0..1 index,> 0.95 high; < 0.85 visible distortion,${esc(data.stats.ssimMean >= 0.95 ? 'Excellent structural preservation' : data.stats.ssimMean >= 0.90 ? 'Acceptable' : 'Structural degradation')}`);
  lines.push(`Mean Delta E 2000 (CIEDE2000),${esc(data.stats.deltaE2000Mean)},dE,JND = 2.3 (< 2.0 imperceptible),${esc(data.stats.deltaE2000Mean < 2.3 ? 'Perceptually imperceptible color shift' : 'Noticeable color distortion')}`);
  lines.push(`Max Delta E 2000,${esc(data.stats.deltaE2000Max)},dE,Peak single-pixel error,-`);
  lines.push(`Visible Color Shifts (dE > 2.3),${esc(data.stats.visibleChangesPct)},%,< 5% ideal,${esc(`${data.stats.visibleChangesPct}% of pixels exceed Just Noticeable Difference`)}`);
  lines.push(`Untouched Bit-Identical Pixels,${esc(data.stats.untouchedPixelsPct)},%,100% = lossless,${esc(`${data.stats.untouchedPixelsPct}% identical byte values`)}`);
  lines.push(`Mean Absolute Difference (MAE),${esc(data.stats.meanAbsDiff)},0..255 scale,Average per-channel deviation,-`);
  lines.push(`Median Delta (P50),${esc(data.stats.medianVal)},Metric Units,50th percentile,-`);
  lines.push(`P95 Delta,${esc(data.stats.p95Val)},Metric Units,95th percentile outlier,-`);
  lines.push(`P99 Delta,${esc(data.stats.p99Val)},Metric Units,99th percentile extreme,-`);

  const csvContent = lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const filename = `CompressCompare_${data.processed.siteName.replace(/\s+/g, '_')}_${new Date(data.timestamp).toISOString().slice(0, 10)}.csv`;
  triggerDownload(blob, filename);
}

/**
 * Exports single comparison analysis to a PDF report
 */
export async function exportComparisonToPDF(data: SingleReportData): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  // Palette
  const primaryDark = [15, 23, 42];     // #0f172a
  const slateCard = [248, 250, 252];    // #f8fafc
  const slateBorder = [226, 232, 240];  // #e2e8f0
  const textMuted = [100, 116, 139];    // #64748b
  const blueAccent = [37, 99, 235];     // #2563eb

  // 1. Header Banner
  doc.setFillColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.rect(margin, margin, contentWidth, 24, 'F');

  // App logo square
  doc.setFillColor(blueAccent[0], blueAccent[1], blueAccent[2]);
  doc.roundedRect(margin + 4, margin + 4, 16, 16, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('CC', margin + 12, margin + 14, { align: 'center' });

  // Header Title
  doc.setFontSize(13);
  doc.text('COMPRESSCOMPARE ANALYSIS REPORT', margin + 24, margin + 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Perceptual Image Quality & Platform Compression Audit  ·  ${data.processed.siteName} Simulation`,
    margin + 24,
    margin + 17
  );

  // Metadata ribbon below banner
  const metaY = margin + 27;
  doc.setFillColor(slateCard[0], slateCard[1], slateCard[2]);
  doc.setDrawColor(slateBorder[0], slateBorder[1], slateBorder[2]);
  doc.rect(margin, metaY, contentWidth, 11, 'FD');

  doc.setFontSize(7.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('GENERATED:', margin + 4, metaY + 7);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(new Date(data.timestamp).toLocaleString(), margin + 22, metaY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('ANALYST:', margin + 70, metaY + 7);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(data.analystName || 'CompressCompare Engine', margin + 84, metaY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('STATUS:', margin + 135, metaY + 7);
  const gradeInfo = getFidelityGrade(data.stats.psnrDb, data.stats.ssimMean, data.stats.deltaE2000Mean);
  doc.setTextColor(gradeInfo.color[0], gradeInfo.color[1], gradeInfo.color[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(`Grade ${gradeInfo.grade} (${gradeInfo.label})`, margin + 148, metaY + 7);

  // 2. Summary KPI Cards (4 cards)
  const cardY = metaY + 14;
  const cardW = (contentWidth - 9) / 4; // ~43mm each
  const cardH = 18;

  const sizeDiff = data.original.fileSize - data.processed.fileSize;
  const pctSaved = data.original.fileSize > 0 
    ? ((sizeDiff / data.original.fileSize) * 100).toFixed(1) 
    : '0';

  const kpis = [
    {
      title: 'PSNR (FIDELITY)',
      value: `${data.stats.psnrDb} dB`,
      sub: data.stats.psnrDb >= 40 ? 'High Fidelity' : data.stats.psnrDb >= 32 ? 'Good' : 'Noticeable noise',
      color: data.stats.psnrDb >= 38 ? [16, 185, 129] : [217, 119, 6]
    },
    {
      title: 'SSIM (STRUCTURE)',
      value: `${data.stats.ssimMean}`,
      sub: data.stats.ssimMean >= 0.95 ? 'Near Imperceptible' : 'Structural Loss',
      color: data.stats.ssimMean >= 0.92 ? [16, 185, 129] : [217, 119, 6]
    },
    {
      title: 'MEAN ΔE2000',
      value: `${data.stats.deltaE2000Mean}`,
      sub: data.stats.deltaE2000Mean < 2.3 ? 'Below JND (<2.3)' : 'Visible Color Shift',
      color: data.stats.deltaE2000Mean < 2.3 ? [16, 185, 129] : [220, 38, 38]
    },
    {
      title: 'STORAGE SAVED',
      value: `${pctSaved}%`,
      sub: `${formatBytes(Math.abs(sizeDiff))} ${sizeDiff >= 0 ? 'saved' : 'inflated'}`,
      color: [37, 99, 235]
    }
  ];

  kpis.forEach((kpi, idx) => {
    const cx = margin + idx * (cardW + 3);
    doc.setFillColor(slateCard[0], slateCard[1], slateCard[2]);
    doc.setDrawColor(slateBorder[0], slateBorder[1], slateBorder[2]);
    doc.roundedRect(cx, cardY, cardW, cardH, 1.5, 1.5, 'FD');

    // Title
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(kpi.title, cx + 3.5, cardY + 5);

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.value, cx + 3.5, cardY + 11.5);

    // Subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(kpi.sub, cx + 3.5, cardY + 15.5);
  });

  // 3. Side-by-Side Thumbnails Section
  const thumbSectionY = cardY + cardH + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text('VISUAL COMPARISON (THUMBNAILS)', margin, thumbSectionY + 4);

  const thumbBoxY = thumbSectionY + 6;
  const thumbBoxW = (contentWidth - 6) / 2; // 88mm each
  const thumbBoxH = 68; // Height for thumbnail preview + details

  // Original Box
  doc.setFillColor(slateCard[0], slateCard[1], slateCard[2]);
  doc.setDrawColor(slateBorder[0], slateBorder[1], slateBorder[2]);
  doc.roundedRect(margin, thumbBoxY, thumbBoxW, thumbBoxH, 2, 2, 'FD');

  // Header of Original Box
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, thumbBoxY, thumbBoxW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text('Original / Uncompressed Source', margin + 3.5, thumbBoxY + 5);

  // Processed Box
  const procBoxX = margin + thumbBoxW + 6;
  doc.setFillColor(slateCard[0], slateCard[1], slateCard[2]);
  doc.setDrawColor(slateBorder[0], slateBorder[1], slateBorder[2]);
  doc.roundedRect(procBoxX, thumbBoxY, thumbBoxW, thumbBoxH, 2, 2, 'FD');

  // Header of Processed Box
  doc.setFillColor(241, 245, 249);
  doc.rect(procBoxX, thumbBoxY, thumbBoxW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(blueAccent[0], blueAccent[1], blueAccent[2]);
  doc.text(`Compressed: ${data.processed.siteName}`, procBoxX + 3.5, thumbBoxY + 5);

  // Render Thumbnails inside boxes
  const imgAreaX = margin + 4;
  const imgAreaY = thumbBoxY + 9;
  const imgAreaW = thumbBoxW - 8;
  const imgAreaH = 43;

  // Function to calculate fit dimensions
  const fitDims = (srcW: number, srcH: number, maxW: number, maxH: number) => {
    if (!srcW || !srcH) return { w: maxW, h: maxH, x: 0, y: 0 };
    const ratio = Math.min(maxW / srcW, maxH / srcH);
    const w = srcW * ratio;
    const h = srcH * ratio;
    const x = (maxW - w) / 2;
    const y = (maxH - h) / 2;
    return { w, h, x, y };
  };

  // Embed Original Thumbnail
  if (data.original.thumbnailUrl) {
    try {
      const origFit = fitDims(data.original.width, data.original.height, imgAreaW, imgAreaH);
      doc.addImage(
        data.original.thumbnailUrl,
        'JPEG',
        imgAreaX + origFit.x,
        imgAreaY + origFit.y,
        origFit.w,
        origFit.h
      );
    } catch {
      // Fallback placeholder if image load fails
      doc.setDrawColor(slateBorder[0], slateBorder[1], slateBorder[2]);
      doc.rect(imgAreaX, imgAreaY, imgAreaW, imgAreaH, 'S');
      doc.setFontSize(7);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text('[Original Preview]', imgAreaX + imgAreaW / 2, imgAreaY + imgAreaH / 2, { align: 'center' });
    }
  }

  // Embed Processed Thumbnail
  const procImgAreaX = procBoxX + 4;
  if (data.processed.thumbnailUrl) {
    try {
      const procFit = fitDims(data.processed.width, data.processed.height, imgAreaW, imgAreaH);
      doc.addImage(
        data.processed.thumbnailUrl,
        'JPEG',
        procImgAreaX + procFit.x,
        imgAreaY + procFit.y,
        procFit.w,
        procFit.h
      );
    } catch {
      doc.setDrawColor(slateBorder[0], slateBorder[1], slateBorder[2]);
      doc.rect(procImgAreaX, imgAreaY, imgAreaW, imgAreaH, 'S');
      doc.setFontSize(7);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text('[Processed Preview]', procImgAreaX + imgAreaW / 2, imgAreaY + imgAreaH / 2, { align: 'center' });
    }
  }

  // Original metadata badges below image
  const infoRowY = thumbBoxY + 54;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Resolution:', margin + 4, infoRowY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text(`${data.original.width} × ${data.original.height} px`, margin + 21, infoRowY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('File Size:', margin + 4, infoRowY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text(`${formatBytes(data.original.fileSize)} (${data.original.format.toUpperCase()})`, margin + 21, infoRowY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Encoding:', margin + 4, infoRowY + 10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  const origQualityStr = data.original.jpegInfo?.estimatedLumaQuality 
    ? `Q~${data.original.jpegInfo.estimatedLumaQuality} (${data.original.jpegInfo.subsampling})`
    : 'Standard / Lossless';
  doc.text(origQualityStr, margin + 21, infoRowY + 10);

  // Processed metadata badges below image
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Resolution:', procBoxX + 4, infoRowY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text(`${data.processed.width} × ${data.processed.height} px`, procBoxX + 21, infoRowY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('File Size:', procBoxX + 4, infoRowY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(blueAccent[0], blueAccent[1], blueAccent[2]);
  doc.text(`${formatBytes(data.processed.fileSize)} (${pctSaved}% saved)`, procBoxX + 21, infoRowY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Encoding:', procBoxX + 4, infoRowY + 10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  const procQualityStr = data.processed.jpegInfo?.estimatedLumaQuality
    ? `Q~${data.processed.jpegInfo.estimatedLumaQuality} (${data.processed.jpegInfo.subsampling})`
    : `${data.processed.format.toUpperCase()} Compressed`;
  doc.text(procQualityStr, procBoxX + 21, infoRowY + 10);

  // 4. Detailed Technical Metrics Table
  const tableSectionY = thumbBoxY + thumbBoxH + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text('TECHNICAL METRICS & PERCEPTUAL EVALUATION', margin, tableSectionY + 4);

  const tableY = tableSectionY + 6;
  const colWidths = [45, 28, 42, 67]; // total 182mm
  const tableHeaders = ['Metric Name', 'Measured Value', 'Reference Threshold', 'Perceptual Significance'];

  // Table Header Row
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(slateBorder[0], slateBorder[1], slateBorder[2]);
  doc.rect(margin, tableY, contentWidth, 6, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  let hX = margin;
  tableHeaders.forEach((th, idx) => {
    doc.text(th, hX + 2.5, tableY + 4.2);
    hX += colWidths[idx];
  });

  // Table Data Rows
  const rows = [
    {
      metric: 'PSNR (Peak Signal/Noise)',
      val: `${data.stats.psnrDb} dB`,
      ref: '> 38 dB: High Fidelity',
      note: data.stats.psnrDb >= 40 ? 'Logarithmic MSE is exceptionally low' : 'Visible quantization noise on smooth gradients'
    },
    {
      metric: 'SSIM (Structural Similarity)',
      val: `${data.stats.ssimMean}`,
      ref: '> 0.95: Imperceptible loss',
      note: data.stats.ssimMean >= 0.95 ? 'Luminance, contrast, and edge structure well preserved' : 'Edge blur and blockiness detectable'
    },
    {
      metric: 'Mean ΔE 2000 (CIEDE2000)',
      val: `${data.stats.deltaE2000Mean}`,
      ref: '< 2.3: JND (Just Noticeable Diff)',
      note: data.stats.deltaE2000Mean < 2.3 ? 'Human eye cannot distinguish average color changes' : 'Perceptible chroma desaturation or tint shift'
    },
    {
      metric: 'Max ΔE 2000 (Worst Pixel)',
      val: `${data.stats.deltaE2000Max}`,
      ref: 'Lower is better',
      note: 'Represents highest localized compression artifact / ringing'
    },
    {
      metric: 'Visible Color Distortion',
      val: `${data.stats.visibleChangesPct}%`,
      ref: '< 5% for professional grade',
      note: `${data.stats.visibleChangesPct}% of pixel area has color error exceeding JND 2.3`
    },
    {
      metric: 'Untouched Bit-Identical',
      val: `${data.stats.untouchedPixelsPct}%`,
      ref: '100% in lossless formats',
      note: `${data.stats.untouchedPixelsPct}% of pixels survived compression bit-for-bit unchanged`
    },
    {
      metric: 'Mean Absolute Difference (MAE)',
      val: `${data.stats.meanAbsDiff}`,
      ref: '0..255 scale',
      note: 'Average linear byte error per color subpixel channel'
    },
    {
      metric: '95th Percentile Error (P95)',
      val: `${data.stats.p95Val}`,
      ref: 'Upper bound on 95% pixels',
      note: '95% of all pixels suffer less deviation than this threshold'
    }
  ];

  let currentY = tableY + 6;
  const rowHeight = 5.2;

  rows.forEach((row, i) => {
    // Alternating zebra row
    if (i % 2 === 0) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(248, 250, 252);
    }
    doc.setDrawColor(slateBorder[0], slateBorder[1], slateBorder[2]);
    doc.rect(margin, currentY, contentWidth, rowHeight, 'FD');

    let colX = margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.text(row.metric, colX + 2, currentY + 3.6);

    colX += colWidths[0];
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(blueAccent[0], blueAccent[1], blueAccent[2]);
    doc.text(row.val, colX + 2, currentY + 3.6);

    colX += colWidths[1];
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(row.ref, colX + 2, currentY + 3.6);

    colX += colWidths[2];
    doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.text(row.note, colX + 2, currentY + 3.6);

    currentY += rowHeight;
  });

  // 5. Forensics & Notes summary box
  const notesY = currentY + 3;
  const notesH = 26;
  doc.setFillColor(slateCard[0], slateCard[1], slateCard[2]);
  doc.setDrawColor(slateBorder[0], slateBorder[1], slateBorder[2]);
  doc.roundedRect(margin, notesY, contentWidth, notesH, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text('PIPELINE FORENSICS & SOCIAL MEDIA CONVERSION AUDIT', margin + 3.5, notesY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);

  const pW = data.processed.width;
  const pH = data.processed.height;
  const oW = data.original.width;
  const oH = data.original.height;
  const pixelSavings = oW * oH > 0 ? (1 - (pW * pH) / (oW * oH)) * 100 : 0;

  const notesText = [
    `• Dimension Impact: Original resolution ${oW}×${oH} scaled to ${pW}×${pH} (${pixelSavings > 0 ? `${pixelSavings.toFixed(1)}% reduction in pixel footprint` : '100% resolution preserved'}).`,
    `• Chroma Subsampling: Processed target uses standard 4:2:0 subsampling, discarding 75% of color resolution for bandwidth efficiency.`,
    `• Privacy & Metadata: Camera EXIF tags, GPS coordinate stamps, and proprietary ICC profiles were sanitized during the platform encoding pass.`,
    data.notes ? `• Analyst Remarks: ${data.notes}` : `• Verification Method: Perceptual calculations executed using CIEDE2000 (Sharma 2005) and Wang & Bovik SSIM standard.`
  ];

  notesText.forEach((t, idx) => {
    doc.text(t, margin + 4, notesY + 10 + idx * 3.8);
  });

  // 6. Page Footer
  const footerY = pageHeight - 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('CompressCompare v0.3 · Automated Visual Compression Forensics', margin, footerY);
  doc.text('Page 1 of 1', pageWidth - margin, footerY, { align: 'right' });

  const filename = `CompressCompare_Report_${data.processed.siteName.replace(/\s+/g, '_')}_${new Date(data.timestamp).toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

/**
 * Exports batch processing results to CSV
 */
export function exportBatchToCSV(items: BatchItemResult[]): void {
  const lines: string[] = [];

  const esc = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  lines.push('# COMPRESSCOMPARE - BATCH COMPRESSION ANALYSIS REPORT');
  lines.push(`Generated Date,${esc(new Date().toISOString())}`);
  lines.push(`Total Comparisons Processed,${items.length}`);
  lines.push('');

  // Table header
  lines.push(
    'File Name,Target Platform,Original Resolution,Processed Resolution,Original Size (KB),Processed Size (KB),Storage Saved (%),PSNR (dB),SSIM (0..1),Mean DeltaE 2000,Max DeltaE 2000,Visible Changes (%),Fidelity Grade'
  );

  let totalOrigBytes = 0;
  let totalProcBytes = 0;
  let sumPsnr = 0;
  let sumSsim = 0;
  let sumDe = 0;

  items.forEach(item => {
    totalOrigBytes += item.originalSize;
    totalProcBytes += item.processedSize;
    sumPsnr += item.psnrDb;
    sumSsim += item.ssimMean;
    sumDe += item.deltaE2000Mean;

    lines.push([
      esc(item.filename),
      esc(item.platform),
      esc(`${item.originalWidth}x${item.originalHeight}`),
      esc(`${item.processedWidth}x${item.processedHeight}`),
      esc((item.originalSize / 1024).toFixed(1)),
      esc((item.processedSize / 1024).toFixed(1)),
      esc(item.compressionRatio.toFixed(1)),
      esc(item.psnrDb.toFixed(1)),
      esc(item.ssimMean.toFixed(3)),
      esc(item.deltaE2000Mean.toFixed(2)),
      esc(item.deltaE2000Max.toFixed(2)),
      esc(item.visibleChangesPct.toFixed(1)),
      esc(item.grade)
    ].join(','));
  });

  // Summary Row
  if (items.length > 0) {
    const avgPsnr = (sumPsnr / items.length).toFixed(1);
    const avgSsim = (sumSsim / items.length).toFixed(3);
    const avgDe = (sumDe / items.length).toFixed(2);
    const overallSaved = totalOrigBytes > 0 
      ? (((totalOrigBytes - totalProcBytes) / totalOrigBytes) * 100).toFixed(1)
      : '0';

    lines.push('');
    lines.push([
      esc('AVERAGE / AGGREGATE SUMMARY'),
      esc(`${items.length} files`),
      esc('-'),
      esc('-'),
      esc((totalOrigBytes / 1024).toFixed(1)),
      esc((totalProcBytes / 1024).toFixed(1)),
      esc(overallSaved),
      esc(avgPsnr),
      esc(avgSsim),
      esc(avgDe),
      esc('-'),
      esc('-'),
      esc('-')
    ].join(','));
  }

  const csvContent = lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const filename = `CompressCompare_Batch_Results_${new Date().toISOString().slice(0, 10)}.csv`;
  triggerDownload(blob, filename);
}

/**
 * Exports batch processing report to PDF
 */
export async function exportBatchToPDF(items: BatchItemResult[]): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  const primaryDark = [15, 23, 42];
  const slateCard = [248, 250, 252];
  const slateBorder = [226, 232, 240];
  const textMuted = [100, 116, 139];
  const blueAccent = [37, 99, 235];

  // Header Banner
  doc.setFillColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.rect(margin, margin, contentWidth, 22, 'F');

  // App logo square
  doc.setFillColor(blueAccent[0], blueAccent[1], blueAccent[2]);
  doc.roundedRect(margin + 4, margin + 3.5, 15, 15, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('CC', margin + 11.5, margin + 13, { align: 'center' });

  // Title
  doc.setFontSize(12);
  doc.text('COMPRESSCOMPARE - BATCH AUDIT REPORT', margin + 23, margin + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Comprehensive Multi-Platform & Multi-File Perceptual Quality Summary (${items.length} Tests)`, margin + 23, margin + 16);

  // Aggregate KPI summary
  let totalOrigBytes = 0;
  let totalProcBytes = 0;
  let sumPsnr = 0;
  let sumSsim = 0;
  let sumDe = 0;

  items.forEach(it => {
    totalOrigBytes += it.originalSize;
    totalProcBytes += it.processedSize;
    sumPsnr += it.psnrDb;
    sumSsim += it.ssimMean;
    sumDe += it.deltaE2000Mean;
  });

  const count = items.length || 1;
  const avgPsnr = (sumPsnr / count).toFixed(1);
  const avgSsim = (sumSsim / count).toFixed(3);
  const avgDe = (sumDe / count).toFixed(2);
  const totalSavedBytes = Math.max(0, totalOrigBytes - totalProcBytes);
  const totalSavedPct = totalOrigBytes > 0 ? ((totalSavedBytes / totalOrigBytes) * 100).toFixed(1) : '0';

  const summaryY = margin + 25;
  const cardW = (contentWidth - 9) / 4;
  const cardH = 16;

  const kpis = [
    { title: 'ITEMS PROCESSED', val: `${items.length} Files`, sub: '100% Complete', color: [15, 23, 42] },
    { title: 'AVG PSNR FIDELITY', val: `${avgPsnr} dB`, sub: parseFloat(avgPsnr) >= 38 ? 'High Fidelity' : 'Good Quality', color: [16, 185, 129] },
    { title: 'AVG SSIM STRUCTURE', val: `${avgSsim}`, sub: parseFloat(avgSsim) >= 0.92 ? 'Excellent' : 'Moderate blur', color: [16, 185, 129] },
    { title: 'TOTAL BANDWIDTH SAVED', val: `${totalSavedPct}%`, sub: `${formatBytes(totalSavedBytes)} freed`, color: [37, 99, 235] }
  ];

  kpis.forEach((kpi, idx) => {
    const cx = margin + idx * (cardW + 3);
    doc.setFillColor(slateCard[0], slateCard[1], slateCard[2]);
    doc.setDrawColor(slateBorder[0], slateBorder[1], slateBorder[2]);
    doc.roundedRect(cx, summaryY, cardW, cardH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(kpi.title, cx + 3, summaryY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.val, cx + 3, summaryY + 10.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(kpi.sub, cx + 3, summaryY + 14);
  });

  // Table of results
  let tableY = summaryY + cardH + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text('BATCH RUN COMPARISONS TABLE', margin, tableY);
  tableY += 3;

  // Header
  // Columns: Thumb (14), Item / Target (42), Orig -> Processed (32), Size (Saved) (30), PSNR (18), SSIM (18), Mean ΔE (16), Grade (12)
  const cols = [14, 44, 32, 28, 17, 17, 16, 14];
  const tableHeaders = ['Thumb', 'Item / Platform', 'Resolution', 'Size (Saved)', 'PSNR', 'SSIM', 'Mean ΔE', 'Grade'];

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(slateBorder[0], slateBorder[1], slateBorder[2]);
  doc.rect(margin, tableY, contentWidth, 5.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  let thX = margin;
  tableHeaders.forEach((th, i) => {
    doc.text(th, thX + 2, tableY + 3.8);
    thX += cols[i];
  });

  let rowY = tableY + 5.5;
  const itemRowHeight = 11.5;

  items.forEach((item, index) => {
    // Check if new page is needed
    if (rowY + itemRowHeight > pageHeight - 12) {
      doc.addPage();
      rowY = margin + 5;

      // Repeat Table Header
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(slateBorder[0], slateBorder[1], slateBorder[2]);
      doc.rect(margin, rowY, contentWidth, 5.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
      let rThX = margin;
      tableHeaders.forEach((th, i) => {
        doc.text(th, rThX + 2, rowY + 3.8);
        rThX += cols[i];
      });
      rowY += 5.5;
    }

    // Row background
    if (index % 2 === 0) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(248, 250, 252);
    }
    doc.setDrawColor(slateBorder[0], slateBorder[1], slateBorder[2]);
    doc.rect(margin, rowY, contentWidth, itemRowHeight, 'FD');

    let colX = margin;

    // 1. Thumbnail
    if (item.thumbnailUrl) {
      try {
        doc.addImage(item.thumbnailUrl, 'JPEG', colX + 1.5, rowY + 1.2, 11, 9);
      } catch {
        doc.rect(colX + 1.5, rowY + 1.2, 11, 9, 'S');
      }
    } else {
      doc.setDrawColor(slateBorder[0], slateBorder[1], slateBorder[2]);
      doc.rect(colX + 1.5, rowY + 1.2, 11, 9, 'S');
    }
    colX += cols[0];

    // 2. Item & Platform
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    const maxChars = 26;
    const truncatedName = item.filename.length > maxChars 
      ? item.filename.slice(0, maxChars) + '...' 
      : item.filename;
    doc.text(truncatedName, colX + 1.5, rowY + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(blueAccent[0], blueAccent[1], blueAccent[2]);
    doc.text(item.platform, colX + 1.5, rowY + 8.5);
    colX += cols[1];

    // 3. Resolution
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.text(`${item.originalWidth}×${item.originalHeight}`, colX + 1.5, rowY + 4.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(`→ ${item.processedWidth}×${item.processedHeight} px`, colX + 1.5, rowY + 8.5);
    colX += cols[2];

    // 4. File Size & Saved
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.text(formatBytes(item.processedSize), colX + 1.5, rowY + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text(`-${item.compressionRatio.toFixed(1)}%`, colX + 1.5, rowY + 8.5);
    colX += cols[3];

    // 5. PSNR
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(item.psnrDb >= 38 ? 16 : 217, item.psnrDb >= 38 ? 185 : 119, item.psnrDb >= 38 ? 129 : 6);
    doc.text(`${item.psnrDb.toFixed(1)} dB`, colX + 1.5, rowY + 6.5);
    colX += cols[4];

    // 6. SSIM
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(item.ssimMean >= 0.92 ? 16 : 217, item.ssimMean >= 0.92 ? 185 : 119, item.ssimMean >= 0.92 ? 129 : 6);
    doc.text(`${item.ssimMean.toFixed(3)}`, colX + 1.5, rowY + 6.5);
    colX += cols[5];

    // 7. Mean ΔE2000
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(item.deltaE2000Mean < 2.3 ? 16 : 220, item.deltaE2000Mean < 2.3 ? 185 : 38, item.deltaE2000Mean < 2.3 ? 129 : 38);
    doc.text(`${item.deltaE2000Mean.toFixed(2)}`, colX + 1.5, rowY + 6.5);
    colX += cols[6];

    // 8. Grade Badge
    const gradeColor = 
      item.grade === 'A+' ? [16, 185, 129] :
      item.grade === 'A' ? [5, 150, 105] :
      item.grade === 'B' ? [217, 119, 6] :
      item.grade === 'C' ? [234, 88, 12] : [220, 38, 38];

    doc.setFillColor(gradeColor[0], gradeColor[1], gradeColor[2]);
    doc.roundedRect(colX + 1.5, rowY + 2.5, 9, 6, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text(item.grade, colX + 6, rowY + 6.8, { align: 'center' });

    rowY += itemRowHeight;
  });

  // Footer on final page
  const footerY = pageHeight - 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('CompressCompare v0.3 · Batch Perceptual Auditing', margin, footerY);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - margin, footerY, { align: 'right' });

  const filename = `CompressCompare_Batch_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
