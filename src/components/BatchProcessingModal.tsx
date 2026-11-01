import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Layers, 
  Play, 
  Download, 
  Table, 
  FileText, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  Sparkles, 
  RefreshCw,
  FolderOpen,
  ArrowRight,
  Zap,
  Filter
} from 'lucide-react';
import { SlotMedia, ComparisonStats } from '../types';
import { SLAM_PRESETS, SlamPreset, runSlamCompression } from '../services/slamEngine';
import { computeComparison } from '../services/metrics';
import { 
  BatchItemResult, 
  createThumbnailDataUrl, 
  formatBytes, 
  getFidelityGrade, 
  exportBatchToCSV, 
  exportBatchToPDF 
} from '../services/exportService';

interface BatchProcessingModalProps {
  isOpen: boolean;
  onClose: () => void;
  original: SlotMedia;
  onLoadBatchItemToSlot: (item: BatchItemResult) => void;
}

export const BatchProcessingModal: React.FC<BatchProcessingModalProps> = ({
  isOpen,
  onClose,
  original,
  onLoadBatchItemToSlot
}) => {
  // Mode: 'multi_platform' (benchmark current original against selected platforms)
  // or 'multi_file' (queue multiple files against a platform)
  const [mode, setMode] = useState<'multi_platform' | 'multi_file'>('multi_platform');

  // Platform selection for multi_platform mode
  const [selectedPresetIds, setSelectedPresetIds] = useState<string[]>(
    SLAM_PRESETS.map(p => p.id)
  );

  // Target platform for multi_file mode
  const [multiFilePresetId, setMultiFilePresetId] = useState<string>(SLAM_PRESETS[0].id);

  // Uploaded files for multi_file mode
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  // Batch execution state
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0); // 0..100
  const [currentStepText, setCurrentStepText] = useState('');
  const [results, setResults] = useState<BatchItemResult[]>([]);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  const abortControllerRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset or initialize state
  useEffect(() => {
    if (!isOpen) {
      abortControllerRef.current = true;
      setIsRunning(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const togglePreset = (id: string) => {
    setSelectedPresetIds(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const selectAllPresets = () => {
    setSelectedPresetIds(SLAM_PRESETS.map(p => p.id));
  };

  const deselectAllPresets = () => {
    setSelectedPresetIds([]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setUploadedFiles(prev => [...prev, ...filesArray]);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Run the batch execution
  const runBatchProcessing = async () => {
    setIsRunning(true);
    setProgress(0);
    setResults([]);
    abortControllerRef.current = false;

    const accumulatedResults: BatchItemResult[] = [];

    try {
      if (mode === 'multi_platform') {
        // Benchmark current original against selected platforms
        if (!original.canvas) {
          alert('Please load an Original image into the application first, or switch to Multi-File mode.');
          setIsRunning(false);
          return;
        }

        const presetsToRun = SLAM_PRESETS.filter(p => selectedPresetIds.includes(p.id));
        if (presetsToRun.length === 0) {
          alert('Please select at least one social platform preset.');
          setIsRunning(false);
          return;
        }

        const total = presetsToRun.length;
        const origThumb = original.thumbnailUrl || createThumbnailDataUrl(original.canvas, 240, 180);

        for (let i = 0; i < total; i++) {
          if (abortControllerRef.current) break;

          const preset = presetsToRun[i];
          setCurrentStepText(`Simulating ${preset.name} (${i + 1}/${total})...`);

          // 1. Run SLAM compression
          const slamRes = await runSlamCompression(
            original.canvas,
            preset,
            original.name || 'original'
          );

          // 2. Compute metrics at target resolution
          const targetW = slamRes.width;
          const targetH = slamRes.height;

          const offOrig = document.createElement('canvas');
          offOrig.width = targetW;
          offOrig.height = targetH;
          const oCtx = offOrig.getContext('2d');
          if (oCtx) {
            oCtx.drawImage(original.canvas, 0, 0, targetW, targetH);
          }
          const origData = oCtx?.getImageData(0, 0, targetW, targetH).data || new Uint8ClampedArray(targetW * targetH * 4);
          const siteData = slamRes.imageData.data;

          const comp = computeComparison(origData, siteData, targetW, targetH, 'delta_e2000');
          const gradeInfo = getFidelityGrade(comp.stats.psnrDb, comp.stats.ssimMean, comp.stats.deltaE2000Mean);

          const sizeDiff = original.fileSize - slamRes.fileSize;
          const pctSaved = original.fileSize > 0 
            ? Math.max(0, (sizeDiff / original.fileSize) * 100) 
            : 0;

          const batchItem: BatchItemResult = {
            id: `batch-${preset.id}-${Date.now()}`,
            filename: original.name || 'Original Image',
            platform: preset.name,
            originalWidth: original.width,
            originalHeight: original.height,
            originalSize: original.fileSize,
            processedWidth: slamRes.width,
            processedHeight: slamRes.height,
            processedSize: slamRes.fileSize,
            processedFormat: slamRes.format,
            compressionRatio: pctSaved,
            psnrDb: comp.stats.psnrDb,
            ssimMean: comp.stats.ssimMean,
            deltaE2000Mean: comp.stats.deltaE2000Mean,
            deltaE2000Max: comp.stats.deltaE2000Max,
            visibleChangesPct: comp.stats.visibleChangesPct,
            grade: gradeInfo.grade,
            thumbnailUrl: slamRes.thumbnailUrl,
            originalThumbnailUrl: origThumb,
            canvas: slamRes.canvas,
            imageData: slamRes.imageData,
            jpegInfo: slamRes.jpegInfo
          };

          accumulatedResults.push(batchItem);
          setResults([...accumulatedResults]);
          setProgress(Math.round(((i + 1) / total) * 100));
        }

      } else {
        // Multi-File Queue Mode
        if (uploadedFiles.length === 0) {
          alert('Please upload or drag-and-drop at least one image file.');
          setIsRunning(false);
          return;
        }

        const preset = SLAM_PRESETS.find(p => p.id === multiFilePresetId) || SLAM_PRESETS[0];
        const total = uploadedFiles.length;

        for (let i = 0; i < total; i++) {
          if (abortControllerRef.current) break;

          const file = uploadedFiles[i];
          setCurrentStepText(`Processing "${file.name}" against ${preset.name} (${i + 1}/${total})...`);

          // Read image file into canvas
          const imgBitmap = await createImageBitmap(file);
          const origCanvas = document.createElement('canvas');
          origCanvas.width = imgBitmap.width;
          origCanvas.height = imgBitmap.height;
          const oCtx = origCanvas.getContext('2d');
          if (oCtx) {
            oCtx.drawImage(imgBitmap, 0, 0);
          }

          const origThumb = createThumbnailDataUrl(origCanvas, 240, 180);

          // Run SLAM
          const slamRes = await runSlamCompression(origCanvas, preset, file.name);

          // Compare
          const targetW = slamRes.width;
          const targetH = slamRes.height;
          const offOrig = document.createElement('canvas');
          offOrig.width = targetW;
          offOrig.height = targetH;
          const offCtx = offOrig.getContext('2d');
          if (offCtx) {
            offCtx.drawImage(origCanvas, 0, 0, targetW, targetH);
          }
          const origData = offCtx?.getImageData(0, 0, targetW, targetH).data || new Uint8ClampedArray(targetW * targetH * 4);
          const siteData = slamRes.imageData.data;

          const comp = computeComparison(origData, siteData, targetW, targetH, 'delta_e2000');
          const gradeInfo = getFidelityGrade(comp.stats.psnrDb, comp.stats.ssimMean, comp.stats.deltaE2000Mean);

          const sizeDiff = file.size - slamRes.fileSize;
          const pctSaved = file.size > 0 ? Math.max(0, (sizeDiff / file.size) * 100) : 0;

          const batchItem: BatchItemResult = {
            id: `batch-file-${i}-${Date.now()}`,
            filename: file.name,
            platform: preset.name,
            originalWidth: imgBitmap.width,
            originalHeight: imgBitmap.height,
            originalSize: file.size,
            processedWidth: slamRes.width,
            processedHeight: slamRes.height,
            processedSize: slamRes.fileSize,
            processedFormat: slamRes.format,
            compressionRatio: pctSaved,
            psnrDb: comp.stats.psnrDb,
            ssimMean: comp.stats.ssimMean,
            deltaE2000Mean: comp.stats.deltaE2000Mean,
            deltaE2000Max: comp.stats.deltaE2000Max,
            visibleChangesPct: comp.stats.visibleChangesPct,
            grade: gradeInfo.grade,
            thumbnailUrl: slamRes.thumbnailUrl,
            originalThumbnailUrl: origThumb,
            canvas: slamRes.canvas,
            imageData: slamRes.imageData,
            jpegInfo: slamRes.jpegInfo
          };

          accumulatedResults.push(batchItem);
          setResults([...accumulatedResults]);
          setProgress(Math.round(((i + 1) / total) * 100));
        }
      }

      setCurrentStepText('Batch processing completed successfully!');
    } catch (err) {
      console.error('Batch error:', err);
      setCurrentStepText('An error occurred during batch processing.');
    } finally {
      setIsRunning(false);
    }
  };

  const handleCancel = () => {
    abortControllerRef.current = true;
    setIsRunning(false);
    setCurrentStepText('Cancelled.');
  };

  const handleExportCSV = () => {
    if (results.length === 0) return;
    setIsExportingCsv(true);
    try {
      exportBatchToCSV(results);
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleExportPDF = async () => {
    if (results.length === 0) return;
    setIsExportingPdf(true);
    try {
      await exportBatchToPDF(results);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Calculate aggregates
  let totalOrigBytes = 0;
  let totalProcBytes = 0;
  let sumPsnr = 0;
  let sumSsim = 0;
  let sumDe = 0;

  results.forEach(r => {
    totalOrigBytes += r.originalSize;
    totalProcBytes += r.processedSize;
    sumPsnr += r.psnrDb;
    sumSsim += r.ssimMean;
    sumDe += r.deltaE2000Mean;
  });

  const count = results.length || 1;
  const avgPsnr = (sumPsnr / count).toFixed(1);
  const avgSsim = (sumSsim / count).toFixed(3);
  const avgDe = (sumDe / count).toFixed(2);
  const totalSavedBytes = Math.max(0, totalOrigBytes - totalProcBytes);
  const totalSavedPct = totalOrigBytes > 0 
    ? ((totalSavedBytes / totalOrigBytes) * 100).toFixed(1) 
    : '0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[92vh] overflow-hidden text-neutral-200">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
                Batch Image Compression & Platform Benchmark
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  SLAM Batch Pipeline
                </span>
              </h2>
              <p className="text-[11px] text-neutral-400">
                Process multiple images or benchmark across all major social media codecs simultaneously
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center justify-between px-5 pt-3 pb-1 border-b border-neutral-800/80 bg-neutral-900/50">
          <div className="flex items-center gap-1">
            <button
              onClick={() => { if (!isRunning) setMode('multi_platform'); }}
              disabled={isRunning}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                mode === 'multi_platform'
                  ? 'bg-neutral-800 text-white border border-neutral-700'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Multi-Platform Benchmark (Current Original)</span>
            </button>

            <button
              onClick={() => { if (!isRunning) setMode('multi_file'); }}
              disabled={isRunning}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                mode === 'multi_file'
                  ? 'bg-neutral-800 text-white border border-neutral-700'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
              <span>Multi-File Queue ({uploadedFiles.length} files)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isRunning ? (
              <button
                onClick={handleCancel}
                className="px-3 py-1 rounded bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-700/60 text-xs font-medium transition-colors"
              >
                Cancel Run
              </button>
            ) : (
              <button
                onClick={runBatchProcessing}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Batch Execution</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Mode Configuration Block */}
          {mode === 'multi_platform' ? (
            <div className="bg-neutral-950/40 border border-neutral-800 rounded-lg p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                    Select Target Platforms to Benchmark
                    <span className="text-[10px] text-neutral-400">
                      ({selectedPresetIds.length} of {SLAM_PRESETS.length} selected)
                    </span>
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Source: <strong className="text-neutral-300">{original.name || 'Original Image'}</strong> ({original.width > 0 ? `${original.width}×${original.height} px · ${formatBytes(original.fileSize)}` : 'Not loaded'})
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <button 
                    onClick={selectAllPresets}
                    className="text-blue-400 hover:text-blue-300 hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-neutral-600">·</span>
                  <button 
                    onClick={deselectAllPresets}
                    className="text-neutral-400 hover:text-neutral-300 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Grid of Platform Preset Checkboxes */}
              <div className="grid grid-cols-3 gap-2">
                {SLAM_PRESETS.map(preset => {
                  const isChecked = selectedPresetIds.includes(preset.id);
                  return (
                    <label
                      key={preset.id}
                      className={`flex items-start gap-2.5 p-2 rounded-md border text-xs cursor-pointer select-none transition-all ${
                        isChecked
                          ? 'bg-neutral-850 border-neutral-600 text-neutral-100 shadow-xs'
                          : 'bg-neutral-900/60 border-neutral-800/80 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => togglePreset(preset.id)}
                        className="mt-0.5 rounded border-neutral-700 bg-neutral-900 text-blue-600 focus:ring-0 focus:ring-offset-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-neutral-200 truncate flex items-center justify-between">
                          <span>{preset.name}</span>
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-neutral-800 text-neutral-400">
                            {preset.maxDimension}px
                          </span>
                        </div>
                        <div className="text-[10px] text-neutral-400 truncate mt-0.5">
                          {preset.format.toUpperCase()} · Q{Math.round(preset.quality * 100)} · 4:2:0
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-neutral-950/40 border border-neutral-800 rounded-lg p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-neutral-200">
                    Queue Multiple Images for Compression Audit
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Target Platform:
                  </p>
                </div>

                <div className="w-56">
                  <select
                    value={multiFilePresetId}
                    onChange={e => setMultiFilePresetId(e.target.value)}
                    className="w-full px-2.5 py-1 bg-neutral-900 border border-neutral-700 rounded-md text-xs text-neutral-200 focus:outline-none focus:border-blue-500 font-medium"
                  >
                    {SLAM_PRESETS.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.maxDimension}px {p.format.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-neutral-700 hover:border-blue-500/60 bg-neutral-900/50 hover:bg-neutral-900 rounded-lg p-5 text-center cursor-pointer transition-all"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Upload className="w-6 h-6 text-neutral-400 mx-auto mb-1.5" />
                <div className="text-xs font-medium text-neutral-200">
                  Click to select multiple images or drag & drop files here
                </div>
                <div className="text-[10px] text-neutral-500 mt-1">
                  Supports JPEG, PNG, and WebP (up to 50MB per file)
                </div>
              </div>

              {/* Uploaded File List */}
              {uploadedFiles.length > 0 && (
                <div className="max-h-32 overflow-y-auto border border-neutral-800 rounded-md divide-y divide-neutral-850">
                  {uploadedFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs bg-neutral-900/40">
                      <span className="truncate max-w-sm text-neutral-300">{f.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[10px] text-neutral-400">{formatBytes(f.size)}</span>
                        <button
                          onClick={() => removeFile(i)}
                          className="text-neutral-500 hover:text-red-400 p-0.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Execution Progress Bar */}
          {isRunning && (
            <div className="bg-neutral-950/70 border border-indigo-900/60 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-200 font-medium flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  {currentStepText}
                </span>
                <span className="font-mono font-semibold text-indigo-300">{progress}%</span>
              </div>
              <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-indigo-500 to-blue-500 h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Results Aggregate KPI Cards */}
          {results.length > 0 && (
            <div className="grid grid-cols-4 gap-2.5">
              <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-2.5">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-medium">Batch Processed</span>
                <div className="text-base font-bold text-neutral-100 mt-0.5">{results.length} Comparisons</div>
                <span className="text-[10px] text-neutral-500">100% evaluated</span>
              </div>

              <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-2.5">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-medium">Average PSNR</span>
                <div className="text-base font-bold text-emerald-400 mt-0.5">{avgPsnr} dB</div>
                <span className="text-[10px] text-neutral-500">
                  {parseFloat(avgPsnr) >= 38 ? 'High fidelity overall' : 'Moderate compression'}
                </span>
              </div>

              <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-2.5">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-medium">Average SSIM</span>
                <div className="text-base font-bold text-emerald-400 mt-0.5">{avgSsim}</div>
                <span className="text-[10px] text-neutral-500">Structural integrity index</span>
              </div>

              <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-2.5">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-medium">Bandwidth Saved</span>
                <div className="text-base font-bold text-blue-400 mt-0.5">-{totalSavedPct}%</div>
                <span className="text-[10px] text-neutral-500">{formatBytes(totalSavedBytes)} freed</span>
              </div>
            </div>
          )}

          {/* Results Table */}
          {results.length > 0 && (
            <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-neutral-850 flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-200">
                  Batch Evaluation Results ({results.length})
                </span>
                <span className="text-[10px] text-neutral-400">
                  Click &ldquo;Inspect&rdquo; to load into main loupe comparison
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-neutral-900/80 text-[10px] uppercase text-neutral-400 font-semibold border-b border-neutral-800">
                      <th className="py-2 px-3">Preview</th>
                      <th className="py-2 px-3">Item / Target</th>
                      <th className="py-2 px-3">Resolution</th>
                      <th className="py-2 px-3">Size (Saved)</th>
                      <th className="py-2 px-3 font-mono">PSNR</th>
                      <th className="py-2 px-3 font-mono">SSIM</th>
                      <th className="py-2 px-3 font-mono">Mean ΔE</th>
                      <th className="py-2 px-3 text-center">Grade</th>
                      <th className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-850">
                    {results.map((item, idx) => (
                      <tr 
                        key={item.id || idx}
                        className="hover:bg-neutral-850/60 transition-colors"
                      >
                        {/* Thumbnail */}
                        <td className="py-2 px-3">
                          <div className="w-10 h-7 bg-neutral-900 rounded overflow-hidden flex items-center justify-center border border-neutral-800">
                            {item.thumbnailUrl ? (
                              <img 
                                src={item.thumbnailUrl} 
                                alt={item.platform} 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-[9px] text-neutral-600">N/A</span>
                            )}
                          </div>
                        </td>

                        {/* Name & Platform */}
                        <td className="py-2 px-3">
                          <div className="font-medium text-neutral-200 truncate max-w-[150px]" title={item.filename}>
                            {item.filename}
                          </div>
                          <div className="text-[10px] text-indigo-400 font-medium">
                            {item.platform}
                          </div>
                        </td>

                        {/* Resolution */}
                        <td className="py-2 px-3 text-[11px] font-mono text-neutral-300">
                          <div>{item.originalWidth}×{item.originalHeight}</div>
                          <div className="text-[10px] text-neutral-500">→ {item.processedWidth}×{item.processedHeight}</div>
                        </td>

                        {/* Size & Saved */}
                        <td className="py-2 px-3 text-[11px]">
                          <div className="font-mono text-neutral-300">{formatBytes(item.processedSize)}</div>
                          <div className="text-[10px] font-semibold text-emerald-400">
                            -{item.compressionRatio.toFixed(1)}%
                          </div>
                        </td>

                        {/* PSNR */}
                        <td className="py-2 px-3 font-mono font-medium text-neutral-200">
                          <span className={item.psnrDb >= 38 ? 'text-emerald-400' : 'text-amber-400'}>
                            {item.psnrDb.toFixed(1)} dB
                          </span>
                        </td>

                        {/* SSIM */}
                        <td className="py-2 px-3 font-mono font-medium text-neutral-200">
                          <span className={item.ssimMean >= 0.92 ? 'text-emerald-400' : 'text-amber-400'}>
                            {item.ssimMean.toFixed(3)}
                          </span>
                        </td>

                        {/* Mean DeltaE */}
                        <td className="py-2 px-3 font-mono font-medium text-neutral-200">
                          <span className={item.deltaE2000Mean < 2.3 ? 'text-emerald-400' : 'text-amber-400'}>
                            {item.deltaE2000Mean.toFixed(2)}
                          </span>
                        </td>

                        {/* Grade */}
                        <td className="py-2 px-3 text-center">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item.grade === 'A+' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                            item.grade === 'A' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                            item.grade === 'B' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                            item.grade === 'C' ? 'bg-orange-950 text-orange-300 border border-orange-800' :
                            'bg-red-950 text-red-300 border border-red-800'
                          }`}>
                            {item.grade}
                          </span>
                        </td>

                        {/* Inspect Action */}
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => onLoadBatchItemToSlot(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-medium border border-neutral-700 transition-colors"
                            title="Load this compressed media into active site slot for loupe / split viewing"
                          >
                            <span>Inspect</span>
                            <ArrowRight className="w-3 h-3 text-blue-400" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer with Batch Export Triggers */}
        <div className="px-5 py-3.5 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-between">
          <div className="text-[11px] text-neutral-400">
            {results.length > 0 
              ? `${results.length} evaluations ready for report export`
              : 'Configure settings and run batch to generate comparative data'}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-neutral-700 hover:bg-neutral-800 text-xs text-neutral-300 transition-colors"
            >
              Close
            </button>

            <button
              onClick={handleExportCSV}
              disabled={results.length === 0 || isExportingCsv}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                results.length > 0 && !isExportingCsv
                  ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-600'
                  : 'bg-neutral-900 text-neutral-600 border-neutral-800 cursor-not-allowed'
              }`}
              title="Export all batch comparison records to CSV"
            >
              <Table className="w-3.5 h-3.5 text-blue-400" />
              <span>{isExportingCsv ? 'Exporting...' : 'Export Batch CSV'}</span>
            </button>

            <button
              onClick={handleExportPDF}
              disabled={results.length === 0 || isExportingPdf}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm transition-all ${
                results.length > 0 && !isExportingPdf
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 shadow-indigo-500/20'
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
              }`}
              title="Generate comprehensive batch PDF report with embedded thumbnails and summary cards"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{isExportingPdf ? 'Compiling PDF...' : 'Download Batch PDF Report'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
