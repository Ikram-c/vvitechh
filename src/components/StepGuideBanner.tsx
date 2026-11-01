import React, { useState } from 'react';
import {
  Compass,
  Sliders,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

export type WorkflowTab = 'media' | 'compare' | 'analysis' | 'batch' | 'report';

interface StepGuideBannerProps {
  activeWorkflow: WorkflowTab;
  onSelectWorkflow: (tab: WorkflowTab) => void;
  expertMode: boolean;
  setExpertMode: React.Dispatch<React.SetStateAction<boolean>>;
  darkMode: boolean;
  pairLoaded: boolean;
}

const STEP_DETAILS: Record<
  WorkflowTab,
  {
    stepNumber: number;
    title: string;
    instruction: string;
    expertNote: string;
    nextTab?: WorkflowTab;
    nextLabel?: string;
  }
> = {
  media: {
    stepNumber: 1,
    title: 'Step 1 of 5 · Choose your images',
    instruction:
      'A sample pair (Original vs. Instagram) is already loaded so you can start right away. Replace the Original on the left or pick a platform on the right to simulate compression.',
    expertNote:
      'Expert Mode unlocked: Remote URL import routing and manual auto-compute toggles are visible below.',
    nextTab: 'compare',
    nextLabel: 'Next: Compare visually'
  },
  compare: {
    stepNumber: 2,
    title: 'Step 2 of 5 · Compare side by side',
    instruction:
      'Drag the blue split handle across the canvas to compare Original vs. compressed. Switch to "Heatmap" on the right to highlight altered pixels.',
    expertNote:
      'Expert Mode unlocked: All 7 layout modes, Region of Interest (ROI) cropping, and Smart Artifact CV telemetry are active.',
    nextTab: 'analysis',
    nextLabel: 'Next: See what changed'
  },
  analysis: {
    stepNumber: 3,
    title: 'Step 3 of 5 · Understand the differences',
    instruction:
      'Bright warm areas on the heatmap show where compression shifted colours or softened edges. Read "What the numbers mean" below for a plain-English summary.',
    expertNote:
      'Expert Mode unlocked: Gamma curve, 99th-percentile scaling, contrast-stretched RGB histograms, and JPEG quantization forensics are visible.',
    nextTab: 'report',
    nextLabel: 'Next: Export report'
  },
  batch: {
    stepNumber: 4,
    title: 'Step 4 of 5 · Process multiple originals (Optional)',
    instruction:
      'Have a folder of photos? Drop them into the queue to simulate platform compression and score all of them with one click.',
    expertNote:
      'Expert Mode unlocked: Custom difference metrics and forensic block presets can be applied across the entire batch.',
    nextTab: 'report',
    nextLabel: 'Next: Go to Report'
  },
  report: {
    stepNumber: 5,
    title: 'Step 5 of 5 · Review & export your report',
    instruction:
      'Review the pair summary on the left, choose PDF or CSV on the right, and click "Export report..." to download a clean document.',
    expertNote:
      'Expert Mode unlocked: Full percentile distribution (p95/p99) and raw perceptual metrics are included.'
  }
};

const STEPS_ORDER: { id: WorkflowTab; label: string }[] = [
  { id: 'media', label: '1. Media' },
  { id: 'compare', label: '2. Compare' },
  { id: 'analysis', label: '3. Analysis' },
  { id: 'batch', label: '4. Batch' },
  { id: 'report', label: '5. Report' }
];

export const StepGuideBanner: React.FC<StepGuideBannerProps> = ({
  activeWorkflow,
  onSelectWorkflow,
  expertMode,
  setExpertMode,
  darkMode
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const current = STEP_DETAILS[activeWorkflow];

  const bgBanner = darkMode
    ? 'bg-[#112440] border-slate-800 text-slate-100'
    : 'bg-white border-[#DDE6F0] text-[#0F2942]';
  const textMuted = darkMode ? 'text-slate-400' : 'text-[#5A7184]';

  return (
    <div className={`rounded-2xl border p-3.5 sm:p-4 shadow-2xs transition-all ${bgBanner}`}>
      {/* Top Row: Step Progress Trail + Mode Badge + Collapse */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#E2ECF7] dark:bg-[#1B4D7E]/40 text-[#1B4D7E] dark:text-sky-300 text-xs font-bold shrink-0">
            <Compass className="w-3.5 h-3.5" />
            <span>{current.title}</span>
          </div>

          {/* Mini Step Dots on Desktop */}
          <div className="hidden md:flex items-center gap-1 ml-2">
            {STEPS_ORDER.map((s, idx) => {
              const isCurrent = s.id === activeWorkflow;
              const isPast = idx + 1 < current.stepNumber;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelectWorkflow(s.id)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                    isCurrent
                      ? 'bg-[#1B4D7E] text-white font-semibold'
                      : isPast
                      ? 'text-emerald-600 dark:text-emerald-400 hover:bg-slate-200/50 dark:hover:bg-slate-800'
                      : `${textMuted} hover:bg-slate-200/50 dark:hover:bg-slate-800`
                  }`}
                >
                  {isPast && <CheckCircle2 className="w-3 h-3" />}
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Expert Mode Toggle inside guide */}
          <button
            type="button"
            onClick={() => setExpertMode(prev => !prev)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
              expertMode
                ? 'bg-[#1B4D7E] border-[#1B4D7E] text-white'
                : darkMode
                ? 'bg-[#0D1E36] border-slate-700 text-slate-300 hover:border-slate-500'
                : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F2942] hover:bg-[#EEF3F9]'
            }`}
            title="Toggle between simplified Guided view and full Expert controls"
          >
            <Sliders className="w-3 h-3" />
            <span>{expertMode ? 'Expert Mode: On' : 'Expert Mode: Off'}</span>
          </button>

          <button
            type="button"
            onClick={() => setCollapsed(prev => !prev)}
            className={`p-1 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer ${textMuted}`}
            title={collapsed ? 'Show step guide' : 'Minimize step guide'}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Guidance Body */}
      {!collapsed && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1 max-w-3xl">
            <p className="text-xs leading-relaxed">
              {current.instruction}
            </p>
            {expertMode && (
              <p className="text-[11px] text-[#1B4D7E] dark:text-sky-400 flex items-center gap-1 font-medium">
                <Sparkles className="w-3 h-3 shrink-0" />
                <span>{current.expertNote}</span>
              </p>
            )}
          </div>

          {current.nextTab && current.nextLabel && (
            <button
              type="button"
              onClick={() => onSelectWorkflow(current.nextTab!)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#1B4D7E] hover:bg-[#153E66] text-white shrink-0 transition-colors cursor-pointer"
            >
              <span>{current.nextLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
