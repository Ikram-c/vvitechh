import React, { useState } from 'react';
import { 
  X, 
  FileText, 
  Download, 
  Table, 
  CheckCircle, 
  Info, 
  Sparkles, 
  Layers, 
  ShieldCheck,
  Calendar,
  User,
  MessageSquare
} from 'lucide-react';
import { ComparisonStats, JpegInfo, SlotMedia } from '../types';
import { 
  exportComparisonToCSV, 
  exportComparisonToPDF, 
  formatBytes, 
  getFidelityGrade,
  SingleReportData
} from '../services/exportService';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  original: SlotMedia;
  activeSite: SlotMedia;
  stats: ComparisonStats | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  original,
  activeSite,
  stats
}) => {
  const [reportTitle, setReportTitle] = useState('Compression Quality & Fidelity Audit');
  const [analystName, setAnalystName] = useState('Quality Engineer');
  const [notes, setNotes] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'customize'>('preview');

  if (!isOpen) return null;

  const hasData = Boolean(original.canvas && activeSite.canvas && stats);

  const handleExportPDF = async () => {
    if (!stats) return;
    setIsExportingPdf(true);
    try {
      const reportData: SingleReportData = {
        reportTitle: reportTitle.trim() || 'Compression Quality & Fidelity Audit',
        analystName: analystName.trim() || 'Automated Pipeline',
        notes: notes.trim(),
        timestamp: Date.now(),
        original: {
          name: original.name,
          width: original.width,
          height: original.height,
          fileSize: original.fileSize,
          format: original.format,
          thumbnailUrl: original.thumbnailUrl,
          jpegInfo: original.jpegInfo
        },
        processed: {
          name: activeSite.name,
          siteName: activeSite.siteName,
          width: activeSite.width,
          height: activeSite.height,
          fileSize: activeSite.fileSize,
          format: activeSite.format,
          thumbnailUrl: activeSite.thumbnailUrl,
          jpegInfo: activeSite.jpegInfo
        },
        stats
      };

      await exportComparisonToPDF(reportData);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportCSV = () => {
    if (!stats) return;
    setIsExportingCsv(true);
    try {
      const reportData: SingleReportData = {
        reportTitle: reportTitle.trim() || 'Compression Quality & Fidelity Audit',
        analystName: analystName.trim() || 'Automated Pipeline',
        notes: notes.trim(),
        timestamp: Date.now(),
        original: {
          name: original.name,
          width: original.width,
          height: original.height,
          fileSize: original.fileSize,
          format: original.format,
          jpegInfo: original.jpegInfo
        },
        processed: {
          name: activeSite.name,
          siteName: activeSite.siteName,
          width: activeSite.width,
          height: activeSite.height,
          fileSize: activeSite.fileSize,
          format: activeSite.format,
          jpegInfo: activeSite.jpegInfo
        },
        stats
      };

      exportComparisonToCSV(reportData);
    } catch (err) {
      console.error('CSV export error:', err);
    } finally {
      setIsExportingCsv(false);
    }
  };

  const sizeDiff = original.fileSize - activeSite.fileSize;
  const pctSaved = original.fileSize > 0 
    ? ((sizeDiff / original.fileSize) * 100).toFixed(1) 
    : '0';

  const gradeInfo = stats 
    ? getFidelityGrade(stats.psnrDb, stats.ssimMean, stats.deltaE2000Mean)
    : { grade: 'B', label: 'Processing', color: [217, 119, 6] };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[92vh] overflow-hidden text-neutral-200">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
                Export Analysis Report
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  PDF & CSV
                </span>
              </h2>
              <p className="text-[11px] text-neutral-400">
                Compile side-by-side thumbnails, PSNR, SSIM, ΔE2000, and JPEG forensics for client or engineering handoff
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

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-5 pt-3 pb-1 border-b border-neutral-800/80 bg-neutral-900/50">
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'preview'
                ? 'bg-neutral-800 text-white border border-neutral-700'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Report Preview</span>
          </button>
          <button
            onClick={() => setActiveTab('customize')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'customize'
                ? 'bg-neutral-800 text-white border border-neutral-700'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Report Metadata & Notes</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!hasData ? (
            <div className="p-8 text-center bg-neutral-950/40 rounded-lg border border-neutral-800">
              <Info className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-neutral-200 mb-1">
                No active comparison data to export
              </h3>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                Please load both an Original image and a target platform comparison (or run SLAM simulation) first before generating the report.
              </p>
            </div>
          ) : (
            <>
              {activeTab === 'customize' ? (
                <div className="space-y-3.5 bg-neutral-950/40 p-4 rounded-lg border border-neutral-800">
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">
                      Report Title
                    </label>
                    <input
                      type="text"
                      value={reportTitle}
                      onChange={e => setReportTitle(e.target.value)}
                      className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-md text-xs text-neutral-100 focus:outline-none focus:border-blue-500 font-medium"
                      placeholder="e.g. Instagram Asset Compression Audit"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1">
                        Analyst / Engineer Name
                      </label>
                      <input
                        type="text"
                        value={analystName}
                        onChange={e => setAnalystName(e.target.value)}
                        className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-md text-xs text-neutral-100 focus:outline-none focus:border-blue-500"
                        placeholder="e.g. Media Quality Lab"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1">
                        Target Platform
                      </label>
                      <input
                        type="text"
                        value={activeSite.siteName}
                        disabled
                        className="w-full px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md text-xs text-neutral-300 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">
                      Analyst Notes & Context (included in PDF report)
                    </label>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-md text-xs text-neutral-100 focus:outline-none focus:border-blue-500 resize-none"
                      placeholder="Add observations about chromatic shifts, edge ringing, or recommendation for creative production..."
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Executive KPI summary */}
                  <div className="grid grid-cols-4 gap-2.5">
                    <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-2.5">
                      <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-medium">PSNR Fidelity</span>
                      <div className="text-base font-bold text-emerald-400 mt-0.5">{stats?.psnrDb} dB</div>
                      <span className="text-[10px] text-neutral-500">
                        {stats && stats.psnrDb >= 38 ? 'High fidelity' : 'Moderate noise'}
                      </span>
                    </div>

                    <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-2.5">
                      <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-medium">SSIM Structure</span>
                      <div className="text-base font-bold text-emerald-400 mt-0.5">{stats?.ssimMean}</div>
                      <span className="text-[10px] text-neutral-500">
                        {stats && stats.ssimMean >= 0.95 ? 'Imperceptible loss' : 'Loss detected'}
                      </span>
                    </div>

                    <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-2.5">
                      <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-medium">Mean ΔE2000</span>
                      <div className={`text-base font-bold mt-0.5 ${stats && stats.deltaE2000Mean < 2.3 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {stats?.deltaE2000Mean}
                      </div>
                      <span className="text-[10px] text-neutral-500">
                        {stats && stats.deltaE2000Mean < 2.3 ? 'Below JND (<2.3)' : 'Visible shift'}
                      </span>
                    </div>

                    <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-2.5">
                      <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-medium">Storage Reduction</span>
                      <div className="text-base font-bold text-blue-400 mt-0.5">-{pctSaved}%</div>
                      <span className="text-[10px] text-neutral-500">
                        {formatBytes(Math.abs(sizeDiff))} saved
                      </span>
                    </div>
                  </div>

                  {/* Side-by-Side Thumbnail Preview Card */}
                  <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-3">
                    <div className="text-[11px] font-semibold text-neutral-300 mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                        Report Visual Embeds (Original vs {activeSite.siteName})
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                        Grade {gradeInfo.grade}: {gradeInfo.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Original Thumbnail */}
                      <div className="bg-neutral-900 border border-neutral-800 rounded-md p-2 flex flex-col items-center">
                        <div className="w-full text-[10px] font-medium text-neutral-400 mb-1 flex justify-between">
                          <span>Original Uncompressed</span>
                          <span>{original.format.toUpperCase()}</span>
                        </div>
                        <div className="w-full h-32 bg-neutral-950 rounded flex items-center justify-center overflow-hidden border border-neutral-850">
                          {original.thumbnailUrl ? (
                            <img 
                              src={original.thumbnailUrl} 
                              alt="Original preview" 
                              className="max-h-full max-w-full object-contain"
                            />
                          ) : (
                            <span className="text-xs text-neutral-600">No preview</span>
                          )}
                        </div>
                        <div className="w-full text-[10px] text-neutral-400 mt-2 flex justify-between font-mono">
                          <span>{original.width} × {original.height} px</span>
                          <span>{formatBytes(original.fileSize)}</span>
                        </div>
                      </div>

                      {/* Processed Thumbnail */}
                      <div className="bg-neutral-900 border border-neutral-800 rounded-md p-2 flex flex-col items-center">
                        <div className="w-full text-[10px] font-medium text-blue-400 mb-1 flex justify-between">
                          <span>Simulated: {activeSite.siteName}</span>
                          <span>{activeSite.format.toUpperCase()}</span>
                        </div>
                        <div className="w-full h-32 bg-neutral-950 rounded flex items-center justify-center overflow-hidden border border-neutral-850">
                          {activeSite.thumbnailUrl ? (
                            <img 
                              src={activeSite.thumbnailUrl} 
                              alt="Processed preview" 
                              className="max-h-full max-w-full object-contain"
                            />
                          ) : (
                            <span className="text-xs text-neutral-600">No preview</span>
                          )}
                        </div>
                        <div className="w-full text-[10px] text-neutral-400 mt-2 flex justify-between font-mono">
                          <span>{activeSite.width} × {activeSite.height} px</span>
                          <span className="text-emerald-400">{formatBytes(activeSite.fileSize)} (-{pctSaved}%)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary Table Preview */}
                  <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-3">
                    <div className="text-[11px] font-semibold text-neutral-300 mb-2">
                      Report Key Data Points
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                      <div className="flex justify-between py-1 border-b border-neutral-850">
                        <span className="text-neutral-400">Peak Signal-to-Noise (PSNR):</span>
                        <span className="font-mono text-neutral-200">{stats?.psnrDb} dB</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-neutral-850">
                        <span className="text-neutral-400">Structural Similarity (SSIM):</span>
                        <span className="font-mono text-neutral-200">{stats?.ssimMean}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-neutral-850">
                        <span className="text-neutral-400">Mean CIEDE2000 Color Delta:</span>
                        <span className="font-mono text-neutral-200">{stats?.deltaE2000Mean}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-neutral-850">
                        <span className="text-neutral-400">Max Local Error (Max ΔE):</span>
                        <span className="font-mono text-neutral-200">{stats?.deltaE2000Max}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-neutral-850">
                        <span className="text-neutral-400">Visible Distortion (&gt; 2.3 ΔE):</span>
                        <span className="font-mono text-neutral-200">{stats?.visibleChangesPct}%</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-neutral-850">
                        <span className="text-neutral-400">Untouched Bit-Identical Pixels:</span>
                        <span className="font-mono text-neutral-200">{stats?.untouchedPixelsPct}%</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-neutral-850">
                        <span className="text-neutral-400">Luma JPEG Quality (Est.):</span>
                        <span className="font-mono text-neutral-200">
                          {activeSite.jpegInfo?.estimatedLumaQuality ? `Q~${activeSite.jpegInfo.estimatedLumaQuality}` : 'Standard'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-neutral-850">
                        <span className="text-neutral-400">Chroma Subsampling:</span>
                        <span className="font-mono text-neutral-200">
                          {activeSite.jpegInfo?.subsampling || '4:2:0'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer & Export Triggers */}
        <div className="px-5 py-3.5 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-between">
          <div className="text-[11px] text-neutral-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Includes embedded thumbnails & full CIEDE2000 metrics</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-neutral-700 hover:bg-neutral-800 text-xs text-neutral-300 transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleExportCSV}
              disabled={!hasData || isExportingCsv}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                hasData && !isExportingCsv
                  ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-600'
                  : 'bg-neutral-900 text-neutral-600 border-neutral-800 cursor-not-allowed'
              }`}
              title="Download machine-readable CSV table"
            >
              <Table className="w-3.5 h-3.5 text-blue-400" />
              <span>{isExportingCsv ? 'Generating...' : 'Export CSV'}</span>
            </button>

            <button
              onClick={handleExportPDF}
              disabled={!hasData || isExportingPdf}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm transition-all ${
                hasData && !isExportingPdf
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/20'
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
              }`}
              title="Generate printable PDF report with embedded thumbnails"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingPdf ? 'Compiling PDF...' : 'Download PDF Report'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
