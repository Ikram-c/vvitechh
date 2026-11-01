import React, { useState } from 'react';
import {
  Columns2,
  ArrowRight,
  Upload,
  Sparkles,
  Check,
  ShieldCheck,
  Sliders,
  Compass,
  Layers,
  FileText,
  Zap,
  Image as ImageIcon,
  ArrowLeftRight
} from 'lucide-react';
import { SlotMedia, ComparisonStats } from '../types';

interface LandingPageProps {
  original: SlotMedia;
  activeSite: SlotMedia;
  stats: ComparisonStats | null;
  expertMode: boolean;
  setExpertMode: React.Dispatch<React.SetStateAction<boolean>>;
  darkMode: boolean;
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
  onStartGuided: () => void;
  onUploadOwnPhoto: () => void;
  onOpenSocialModal: () => void;
  onJumpToWorkflow: (workflow: 'media' | 'compare' | 'analysis' | 'batch' | 'report') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  original,
  activeSite,
  stats,
  expertMode,
  setExpertMode,
  darkMode,
  setDarkMode,
  onStartGuided,
  onUploadOwnPhoto,
  onOpenSocialModal,
  onJumpToWorkflow
}) => {
  const [previewSplit, setPreviewSplit] = useState<number>(52);
  const [showHeatmapTint, setShowHeatmapTint] = useState<boolean>(true);

  const bgMain = darkMode ? 'bg-[#091526] text-slate-100' : 'bg-[#F4F7FB] text-[#0F2942]';
  const bgCard = darkMode ? 'bg-[#112440] border-slate-800 text-slate-100' : 'bg-white border-[#E2E8F0] text-[#0F2942]';
  const bgSubtle = darkMode ? 'bg-[#0D1E36] border-slate-800' : 'bg-[#EEF3F9] border-[#DDE6F0]';
  const textMuted = darkMode ? 'text-slate-400' : 'text-[#5A7184]';
  const borderSubtle = darkMode ? 'border-slate-800' : 'border-[#E2E8F0]';
  const btnOutline = darkMode
    ? 'bg-[#162C4E] hover:bg-[#1E3A63] text-slate-100 border border-slate-700'
    : 'bg-white hover:bg-[#F8FAFC] text-[#0F2942] border border-[#CBD5E1]';

  const ssimPct = stats ? (stats.ssimMean * 100).toFixed(1) : '99.7';
  const psnrVal = stats ? stats.psnrDb.toFixed(1) : '24.6';
  const deltaEVal = stats ? stats.deltaE2000Mean.toFixed(2) : '3.46';

  return (
    <div className={`min-h-screen w-full flex flex-col font-sans selection:bg-sky-500 selection:text-white ${bgMain}`}>
      {/* Top Navigation Bar */}
      <header className={`w-full border-b px-4 sm:px-8 py-3.5 sticky top-0 z-30 backdrop-blur-md ${
        darkMode ? 'bg-[#091526]/90 border-slate-800' : 'bg-[#F4F7FB]/90 border-[#DDE6F0]'
      }`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FFDD33] flex items-center justify-center text-[#0F2942] shadow-xs">
              <Columns2 className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight">VMIT</span>
              <span className={`hidden sm:inline-block ml-2 text-xs ${textMuted}`}>
                Visual Media Integrity Checker
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Guided vs Expert Mode Toggle Pill */}
            <div className={`flex items-center rounded-xl p-0.5 border text-xs ${bgCard}`}>
              <button
                type="button"
                onClick={() => setExpertMode(false)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  !expertMode
                    ? 'bg-[#1B4D7E] text-white shadow-2xs'
                    : `${textMuted} hover:text-[#0F2942] dark:hover:text-white`
                }`}
                title="Step-by-step guidance with plain-English explanations"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Guided</span>
              </button>
              <button
                type="button"
                onClick={() => setExpertMode(true)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  expertMode
                    ? 'bg-[#1B4D7E] text-white shadow-2xs'
                    : `${textMuted} hover:text-[#0F2942] dark:hover:text-white`
                }`}
                title="Unlock full perceptual math, advanced heatmap tuning, and JPEG forensics"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Expert</span>
              </button>
            </div>

            {/* Dark Mode Switch */}
            <button
              type="button"
              onClick={() => setDarkMode(prev => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer hidden sm:inline-flex items-center gap-1.5 ${btnOutline}`}
            >
              <span>{darkMode ? 'Light' : 'Dark'}</span>
            </button>

            <button
              type="button"
              onClick={onStartGuided}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#1B4D7E] hover:bg-[#153E66] text-white shadow-xs transition-colors cursor-pointer"
            >
              <span>Open Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-12">
        {/* Hero Split Section */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left Column: Clear Value Proposition + Entry Actions + Mode Selector */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#E2ECF7] dark:bg-[#1B4D7E]/40 text-[#1B4D7E] dark:text-sky-300 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Step-by-step visual compression checker</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-[1.15]">
                See what social media compression does to your photos.
              </h1>
              <p className={`text-sm sm:text-base leading-relaxed ${textMuted}`}>
                Platforms like Instagram, Discord, and Facebook resize and recompress every upload. VMIT guides you through comparing your original against the compressed version so you can spot hidden blur, colour shifts, and artifacts in seconds.
              </p>
            </div>

            {/* Primary CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onStartGuided}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-xs sm:text-sm font-semibold bg-[#1B4D7E] hover:bg-[#153E66] text-white shadow-sm transition-all cursor-pointer"
              >
                <span>Start Guided Walkthrough</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onUploadOwnPhoto}
                className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${btnOutline}`}
              >
                <Upload className="w-4 h-4 text-[#1B4D7E] dark:text-sky-400" />
                <span>Upload Your Photo</span>
              </button>

              <button
                type="button"
                onClick={onOpenSocialModal}
                className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${btnOutline}`}
              >
                <ImageIcon className="w-4 h-4 text-[#1B4D7E] dark:text-sky-400" />
                <span>My Social Photos</span>
              </button>
            </div>

            {/* Experience Mode Selector Card */}
            <div className={`rounded-2xl border p-4 space-y-3 shadow-2xs ${bgCard}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">Choose your experience level</span>
                <span className={`text-[11px] ${textMuted}`}>
                  You can switch anytime in the sidebar
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setExpertMode(false)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    !expertMode
                      ? 'bg-[#E2ECF7]/70 dark:bg-[#1B4D7E]/30 border-[#1B4D7E]'
                      : `${bgSubtle} opacity-80 hover:opacity-100`
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-[#1B4D7E] dark:text-sky-400" />
                      <span>Guided Mode</span>
                    </span>
                    {!expertMode && <Check className="w-3.5 h-3.5 text-[#1B4D7E] dark:text-sky-400 stroke-[2.5]" />}
                  </div>
                  <p className={`text-[11px] mt-1 leading-snug ${textMuted}`}>
                    Step-by-step prompts, plain-English quality verdicts, and clutter-free controls.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setExpertMode(true)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    expertMode
                      ? 'bg-[#E2ECF7]/70 dark:bg-[#1B4D7E]/30 border-[#1B4D7E]'
                      : `${bgSubtle} opacity-80 hover:opacity-100`
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-[#1B4D7E] dark:text-sky-400" />
                      <span>Expert Mode</span>
                    </span>
                    {expertMode && <Check className="w-3.5 h-3.5 text-[#1B4D7E] dark:text-sky-400 stroke-[2.5]" />}
                  </div>
                  <p className={`text-[11px] mt-1 leading-snug ${textMuted}`}>
                    Full PSNR/SSIM/ΔE2000 telemetry, contrast-stretched histograms, ROI cropping & CV overlays.
                  </p>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Sample Pair Preview Card */}
          <div className="lg:col-span-6">
            <div className={`rounded-2xl border p-4 sm:p-5 space-y-4 shadow-sm ${bgCard}`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold block">Interactive Sample Preview</span>
                  <span className={`text-[11px] ${textMuted}`}>
                    Drag the slider below to compare Original vs. Instagram
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#5CE1A6] text-[#064E3B] text-[11px] font-semibold">
                  <Check className="w-3 h-3 stroke-[2.5]" />
                  <span>Sample Ready</span>
                </span>
              </div>

              {/* Dark Navy Interactive Split Frame */}
              <div className="rounded-xl bg-[#0B2545] p-3 text-white space-y-2.5 border border-[#1B3B64]">
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="font-medium text-slate-200">Original (1600 × 1200)</span>
                  <button
                    type="button"
                    onClick={() => setShowHeatmapTint(prev => !prev)}
                    className="font-semibold text-[#FFDD33] hover:underline cursor-pointer"
                  >
                    Instagram (1080 × 810) {showHeatmapTint ? '· heatmap' : '· photo'}
                  </button>
                </div>

                <div className="relative h-60 sm:h-68 w-full rounded-lg overflow-hidden select-none bg-slate-950 border border-white/10">
                  {original.thumbnailUrl ? (
                    <img
                      src={original.thumbnailUrl}
                      alt="Original preview"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-emerald-400 to-amber-300" />
                  )}

                  <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ clipPath: `inset(0 0 0 ${previewSplit}%)` }}
                  >
                    {activeSite?.thumbnailUrl ? (
                      <img
                        src={activeSite.thumbnailUrl}
                        alt="Instagram preview"
                        className={`w-full h-full object-cover transition-all ${
                          showHeatmapTint ? 'brightness-75 contrast-125 hue-rotate-15 saturate-150' : ''
                        }`}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-indigo-600 via-amber-500 to-rose-500" />
                    )}
                  </div>

                  {/* Divider Line & Handle */}
                  <div
                    className="absolute inset-y-0 w-0.5 bg-white/90 shadow"
                    style={{ left: `${previewSplit}%` }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-[#38BDF8] border-2 border-white flex items-center justify-center text-white shadow-md pointer-events-none"
                    style={{ left: `${previewSplit}%` }}
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Interactive Split Slider */}
                <div className="flex items-center gap-3 px-1 pt-0.5">
                  <span className="text-[11px] text-slate-300 font-medium">Split</span>
                  <input
                    type="range"
                    min={5}
                    max={95}
                    value={previewSplit}
                    onChange={e => setPreviewSplit(parseInt(e.target.value, 10))}
                    className="flex-1 accent-[#38BDF8] h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                  />
                  <span className="text-[11px] font-mono text-slate-300 w-9 text-right tabular-nums">
                    {previewSplit}%
                  </span>
                </div>
              </div>

              {/* Plain-English vs Expert Snapshot Cards */}
              <div className="grid grid-cols-3 gap-2.5 tabular-nums">
                <div className={`p-3 rounded-xl border ${bgSubtle}`}>
                  <div className={`text-[11px] font-medium ${textMuted}`}>
                    {expertMode ? 'SSIM Index' : 'Structure Kept'}
                  </div>
                  <div className="text-base sm:text-lg font-bold mt-0.5">
                    {expertMode ? (stats?.ssimMean ?? '0.997') : `${ssimPct}%`}
                  </div>
                  <div className={`text-[10px] mt-0.5 ${textMuted}`}>
                    Sharpness preserved
                  </div>
                </div>

                <div className={`p-3 rounded-xl border ${bgSubtle}`}>
                  <div className={`text-[11px] font-medium ${textMuted}`}>
                    {expertMode ? 'Mean ΔE2000' : 'Colour Shift'}
                  </div>
                  <div className="text-base sm:text-lg font-bold mt-0.5">
                    {expertMode ? `${deltaEVal} ΔE` : 'Mild'}
                  </div>
                  <div className={`text-[10px] mt-0.5 ${textMuted}`}>
                    {expertMode ? 'CIEDE2000 perceptual' : `ΔE ${deltaEVal} (visible on edges)`}
                  </div>
                </div>

                <div className={`p-3 rounded-xl border ${bgSubtle}`}>
                  <div className={`text-[11px] font-medium ${textMuted}`}>
                    {expertMode ? 'PSNR Fidelity' : 'Signal Clarity'}
                  </div>
                  <div className="text-base sm:text-lg font-bold mt-0.5">
                    {psnrVal} dB
                  </div>
                  <div className={`text-[10px] mt-0.5 ${textMuted}`}>
                    Typical web compression
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => onJumpToWorkflow('compare')}
                  className="text-xs font-semibold text-[#1B4D7E] dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Inspect this pair in full Compare view</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Guided 4-Stage Overview Cards */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold">How the guided workflow works</h2>
              <p className={`text-xs mt-0.5 ${textMuted}`}>
                Click any step below to jump straight there, or start from Step 1.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                step: 'Step 1',
                id: 'media' as const,
                title: 'Load or Simulate Media',
                desc: 'Keep your Original on the left and use SLAM to simulate Instagram, Discord, or Facebook compression in one click.',
                icon: <Zap className="w-4 h-4 text-[#1B4D7E] dark:text-sky-400" />
              },
              {
                step: 'Step 2',
                id: 'compare' as const,
                title: 'Compare Side-by-Side',
                desc: 'Slide the split divider or use the magnifying Loupe to see where fine textures or sharp edges changed.',
                icon: <Columns2 className="w-4 h-4 text-[#1B4D7E] dark:text-sky-400" />
              },
              {
                step: 'Step 3',
                id: 'analysis' as const,
                title: 'Understand the Heatmap',
                desc: 'Read a plain-English explanation of the differences, or toggle Expert Mode for histograms and perceptual math.',
                icon: <Sparkles className="w-4 h-4 text-[#1B4D7E] dark:text-sky-400" />
              },
              {
                step: 'Step 4',
                id: 'report' as const,
                title: 'Batch & Export Report',
                desc: 'Run a queue of originals with the same settings or export a clean PDF/CSV report with thumbnails and metrics.',
                icon: <FileText className="w-4 h-4 text-[#1B4D7E] dark:text-sky-400" />
              }
            ].map(card => (
              <div
                key={card.id}
                onClick={() => onJumpToWorkflow(card.id)}
                className={`rounded-2xl border p-4 space-y-2.5 transition-all hover:border-[#1B4D7E] cursor-pointer shadow-2xs ${bgCard}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#1B4D7E] dark:text-sky-400">
                    {card.step}
                  </span>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${bgSubtle}`}>
                    {card.icon}
                  </div>
                </div>
                <h3 className="text-sm font-bold">{card.title}</h3>
                <p className={`text-xs leading-relaxed ${textMuted}`}>
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};
