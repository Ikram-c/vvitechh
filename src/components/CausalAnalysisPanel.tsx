import React, { useState, useMemo } from 'react';
import {
  GitBranch,
  Sliders,
  TrendingUp,
  Layers,
  Plus,
  RotateCcw,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  Sparkles,
  Share2,
  Eye,
  Clock,
  Activity,
} from 'lucide-react';
import { ComparisonStats, SlotMedia } from '../types';
import {
  INITIAL_CROSS_POST_OBSERVATIONS,
  CONNECTED_SOCIAL_PROFILES,
  CrossPostObservation,
  CounterfactualIntervention,
  SocialPlatformId,
  buildLiveWorkspaceObservations,
  runCausicaAnalysis,
  CausalNode,
} from '../services/causicaEngine';

interface CausalAnalysisPanelProps {
  original: SlotMedia | null;
  sites: (SlotMedia | null)[];
  activeSite: number;
  stats: ComparisonStats | null;
  darkMode: boolean;
  onOpenSocialModal?: () => void;
}

const DEFAULT_INTERVENTION: CounterfactualIntervention = {
  targetSsim: 0.95,
  targetDeltaE: 1.5,
  preserveChroma444: true,
  nativePreScale: true,
  alignPeakTiming: true,
  optimizeViewportAspect: true,
  tailorProfileCaptions: true,
};

export const CausalAnalysisPanel: React.FC<CausalAnalysisPanelProps> = ({
  original,
  sites,
  activeSite,
  stats,
  darkMode,
  onOpenSocialModal,
}) => {
  const [customObservations, setCustomObservations] = useState<CrossPostObservation[]>(
    INITIAL_CROSS_POST_OBSERVATIONS
  );
  const [intervention, setIntervention] =
    useState<CounterfactualIntervention>(DEFAULT_INTERVENTION);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('node_ssim_loss');
  const [selectedCohortId, setSelectedCohortId] = useState<string>('all');
  const [showAddPostForm, setShowAddPostForm] = useState<boolean>(false);

  // New Cross-Profile Post Pair form state
  const [newCohortTitle, setNewCohortTitle] = useState('Studio Product Macro — Ceramic Watch');
  const [newCategory, setNewCategory] =
    useState<CrossPostObservation['contentCategory']>('Product Macro');
  const [newPlatformA, setNewPlatformA] = useState<SocialPlatformId>('instagram');
  const [newSsimA, setNewSsimA] = useState(0.82);
  const [newDeltaEA, setNewDeltaEA] = useState(5.4);
  const [newTimingA, setNewTimingA] = useState(3.0);
  const [newAspectA, setNewAspectA] = useState(0.75);

  const [newPlatformB, setNewPlatformB] = useState<SocialPlatformId>('twitter');
  const [newSsimB, setNewSsimB] = useState(0.94);
  const [newDeltaEB, setNewDeltaEB] = useState(1.7);
  const [newTimingB, setNewTimingB] = useState(0.5);
  const [newAspectB, setNewAspectB] = useState(0.96);

  // Build live observations from the user's active comparison slots
  const liveObservations = useMemo(
    () => buildLiveWorkspaceObservations(original, sites, activeSite, stats),
    [original, sites, activeSite, stats]
  );

  // Run Microsoft Causica (DECI) structural causal model
  const model = useMemo(
    () => runCausicaAnalysis(customObservations, liveObservations, intervention),
    [customObservations, liveObservations, intervention]
  );

  const selectedNode: CausalNode = useMemo(
    () => model.nodes.find((n) => n.id === selectedNodeId) || model.nodes[2],
    [model.nodes, selectedNodeId]
  );

  const connectedEdges = useMemo(
    () =>
      model.edges.filter(
        (e) => e.source === selectedNode.id || e.target === selectedNode.id
      ),
    [model.edges, selectedNode.id]
  );

  const filteredCohorts = useMemo(() => {
    if (selectedCohortId === 'all') return model.cohorts;
    return model.cohorts.filter((c) => c.cohortId === selectedCohortId);
  }, [model.cohorts, selectedCohortId]);

  const applyPresetScenario = (
    preset: 'baseline' | 'compression_only' | 'attributes_only' | 'full_optimal'
  ) => {
    if (preset === 'baseline') {
      setIntervention({
        targetSsim: 0.84,
        targetDeltaE: 5.0,
        preserveChroma444: false,
        nativePreScale: false,
        alignPeakTiming: false,
        optimizeViewportAspect: false,
        tailorProfileCaptions: false,
      });
    } else if (preset === 'compression_only') {
      setIntervention({
        targetSsim: 0.96,
        targetDeltaE: 1.2,
        preserveChroma444: true,
        nativePreScale: true,
        alignPeakTiming: false,
        optimizeViewportAspect: false,
        tailorProfileCaptions: false,
      });
    } else if (preset === 'attributes_only') {
      setIntervention({
        targetSsim: 0.84,
        targetDeltaE: 5.0,
        preserveChroma444: false,
        nativePreScale: false,
        alignPeakTiming: true,
        optimizeViewportAspect: true,
        tailorProfileCaptions: true,
      });
    } else {
      setIntervention(DEFAULT_INTERVENTION);
    }
  };

  const handleAddCrossPostPair = (e: React.FormEvent) => {
    e.preventDefault();
    const cohortId = `cohort-custom-${Date.now()}`;
    const profA =
      CONNECTED_SOCIAL_PROFILES.find((p) => p.id === newPlatformA) ||
      CONNECTED_SOCIAL_PROFILES[0];
    const profB =
      CONNECTED_SOCIAL_PROFILES.find((p) => p.id === newPlatformB) ||
      CONNECTED_SOCIAL_PROFILES[1];

    const computeSimEngagement = (
      prof: typeof profA,
      ssim: number,
      deltaE: number,
      timing: number,
      aspect: number
    ) => {
      const ssimDrop = (0.95 - ssim) * 140;
      const deDrop = Math.max(0, deltaE - 1.5) * 2.7;
      const timeDrop = timing * 2.8;
      const aspectBoost = (aspect - 0.8) * 32;
      const relDelta = Number(
        Math.max(-40, Math.min(42, 12 - ssimDrop - deDrop - timeDrop + aspectBoost)).toFixed(1)
      );
      const er = Number(
        Math.max(0.5, prof.baselineEngagementRate * (1 + relDelta / 100)).toFixed(2)
      );
      const impressions = Math.round(prof.followers * 0.52);
      const totalInt = Math.round((impressions * er) / 100);
      return { relDelta, er, impressions, totalInt };
    };

    const simA = computeSimEngagement(profA, newSsimA, newDeltaEA, newTimingA, newAspectA);
    const simB = computeSimEngagement(profB, newSsimB, newDeltaEB, newTimingB, newAspectB);

    const obsA: CrossPostObservation = {
      id: `obs-${Date.now()}-a`,
      cohortId,
      cohortTitle: newCohortTitle.trim() || 'Custom Cross-Profile Post Pair',
      contentCategory: newCategory,
      thumbnailUrl: original?.url || '/samples/instagram.jpg',
      platformId: profA.id,
      handle: profA.handle,
      postedAtIso: new Date().toISOString(),
      ssim: newSsimA,
      psnr: Number((22 + newSsimA * 18).toFixed(1)),
      deltaE2000: newDeltaEA,
      jpegQuality: Math.round(newSsimA * 92),
      chromaSubsampling: newSsimA > 0.92 ? '4:4:4' : '4:2:0',
      resolutionRetention: Number((newSsimA * 0.88).toFixed(2)),
      blockingArtifactScore: Math.round((1 - newSsimA) * 210),
      followersAtPost: profA.followers,
      postingHourDeltaFromPeak: newTimingA,
      captionQualityScore: 84,
      viewportAspectFill: newAspectA,
      crossPostDelayHours: newTimingA,
      visualComplexityScore: 80,
      impressions: simA.impressions,
      likes: Math.round(simA.totalInt * 0.78),
      comments: Math.round(simA.totalInt * 0.09),
      savesAndShares: Math.round(simA.totalInt * 0.13),
      dwellTimeSeconds: Number(Math.max(2.2, 5.6 + simA.relDelta * 0.07).toFixed(1)),
      observedEngagementRate: simA.er,
      relativeEngagementVsBaseline: simA.relDelta,
    };

    const obsB: CrossPostObservation = {
      id: `obs-${Date.now()}-b`,
      cohortId,
      cohortTitle: newCohortTitle.trim() || 'Custom Cross-Profile Post Pair',
      contentCategory: newCategory,
      thumbnailUrl: original?.url || '/samples/original.png',
      platformId: profB.id,
      handle: profB.handle,
      postedAtIso: new Date().toISOString(),
      ssim: newSsimB,
      psnr: Number((22 + newSsimB * 18).toFixed(1)),
      deltaE2000: newDeltaEB,
      jpegQuality: Math.round(newSsimB * 92),
      chromaSubsampling: newSsimB > 0.92 ? '4:4:4' : '4:2:0',
      resolutionRetention: Number((newSsimB * 0.88).toFixed(2)),
      blockingArtifactScore: Math.round((1 - newSsimB) * 210),
      followersAtPost: profB.followers,
      postingHourDeltaFromPeak: newTimingB,
      captionQualityScore: 90,
      viewportAspectFill: newAspectB,
      crossPostDelayHours: 0,
      visualComplexityScore: 80,
      impressions: simB.impressions,
      likes: Math.round(simB.totalInt * 0.78),
      comments: Math.round(simB.totalInt * 0.09),
      savesAndShares: Math.round(simB.totalInt * 0.13),
      dwellTimeSeconds: Number(Math.max(2.2, 5.6 + simB.relDelta * 0.07).toFixed(1)),
      observedEngagementRate: simB.er,
      relativeEngagementVsBaseline: simB.relDelta,
    };

    setCustomObservations((prev) => [obsA, obsB, ...prev]);
    setSelectedCohortId(cohortId);
    setShowAddPostForm(false);
  };

  const cardSurface = darkMode
    ? 'bg-[#112440] border-slate-800 text-slate-100'
    : 'bg-white border-[#E2E8F0] text-[#0F2942]';
  const subtleSurface = darkMode
    ? 'bg-[#0B192E] border-slate-800'
    : 'bg-[#F8FAFC] border-[#E2E8F0]';
  const mutedText = darkMode ? 'text-slate-400' : 'text-[#5A7184]';

  const getCategoryColor = (cat: CausalNode['category']) => {
    switch (cat) {
      case 'confounder':
        return {
          stroke: '#64748B',
          fill: darkMode ? '#1E293B' : '#F1F5F9',
          text: darkMode ? '#CBD5E1' : '#334155',
          label: 'Exogenous Confounder',
        };
      case 'compression_treatment':
        return {
          stroke: '#E11D48',
          fill: darkMode ? '#3B1222' : '#FFF1F2',
          text: darkMode ? '#FDA4AF' : '#BE123C',
          label: 'Compression Artifact (Treatment)',
        };
      case 'profile_attribute':
        return {
          stroke: '#D97706',
          fill: darkMode ? '#38230C' : '#FFFBEB',
          text: darkMode ? '#FCD34D' : '#B45309',
          label: 'Relative Profile Attribute',
        };
      case 'mediator':
        return {
          stroke: '#0284C7',
          fill: darkMode ? '#0C2A44' : '#F0F9FF',
          text: darkMode ? '#7DD3FC' : '#0369A1',
          label: 'Perceptual / Feed Mediator',
        };
      case 'outcome':
        return {
          stroke: '#059669',
          fill: darkMode ? '#092E26' : '#ECFDF5',
          text: darkMode ? '#6EE7B7' : '#047857',
          label: 'Target Outcome',
        };
    }
  };

  const compressionNodes = model.nodes.filter(
    (n) => n.category === 'compression_treatment' || n.id === 'node_pipeline'
  );
  const relativeAttrNodes = model.nodes.filter(
    (n) => n.category === 'profile_attribute' || n.id === 'node_complexity'
  );

  return (
    <div className="space-y-4">
      {/* Header & Model Provenance Bar */}
      <div className={`p-5 rounded-2xl border shadow-sm ${cardSurface}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-current/10">
          <div>
            <div className="flex items-center gap-2.5">
              <GitBranch className="w-5 h-5 text-sky-500 shrink-0" />
              <h3 className="text-base font-bold tracking-tight">
                Microsoft Causica (DECI) — Cross-Profile Engagement Causal Attribution
              </h3>
            </div>
            <p className={`text-xs mt-1 max-w-3xl leading-relaxed ${mutedText}`}>
              Disentangles how much of the relative audience engagement gap between similar posts
              across your social profiles is causally driven by{' '}
              <strong className="font-semibold text-rose-500">
                compression degradation (1 − SSIM, ΔE2000, 4:2:0 subsampling)
              </strong>{' '}
              versus{' '}
              <strong className="font-semibold text-amber-500">
                relative profile &amp; post attributes (posting time offset, viewport aspect ratio,
                caption fit, audience scale)
              </strong>
              .
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onOpenSocialModal && (
              <button
                onClick={onOpenSocialModal}
                className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  darkMode
                    ? 'border-slate-700 hover:bg-slate-800 text-slate-200'
                    : 'border-[#CBD5E1] hover:bg-slate-100 text-[#0F2942]'
                }`}
              >
                <Share2 className="w-3.5 h-3.5 text-sky-500" />
                Connected Profiles ({model.profiles.length})
              </button>
            )}
            <button
              onClick={() => setShowAddPostForm((v) => !v)}
              className="px-3.5 py-2 rounded-xl bg-[#1B4D7E] hover:bg-[#153E66] text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              {showAddPostForm ? 'Close Post Builder' : 'Log Cross-Profile Post Pair'}
            </button>
          </div>
        </div>

        {/* 4-Card Top KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 pt-4">
          <div className={`p-3.5 rounded-xl border ${subtleSurface}`}>
            <div className={`text-[11px] font-semibold uppercase tracking-wider ${mutedText}`}>
              Compression Variance Share
            </div>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-2xl font-bold font-mono tabular-nums text-rose-500">
                {model.summary.totalCompressionSharePct}%
              </span>
              <span className="text-xs font-mono tabular-nums text-rose-500 flex items-center gap-0.5">
                <ArrowDownRight className="w-3.5 h-3.5" />
                ATE {model.summary.averageCompressionPenaltyAte}%
              </span>
            </div>
            <p className={`text-[11px] mt-1 ${mutedText}`}>
              Direct + dwell-mediated impact of SSIM blur, ΔE2000 &amp; 4:2:0 bleed
            </p>
          </div>

          <div className={`p-3.5 rounded-xl border ${subtleSurface}`}>
            <div className={`text-[11px] font-semibold uppercase tracking-wider ${mutedText}`}>
              Relative Profile Attributes Share
            </div>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-2xl font-bold font-mono tabular-nums text-amber-500">
                {model.summary.totalRelativeAttributesSharePct}%
              </span>
              <span className="text-xs font-mono tabular-nums text-emerald-500 flex items-center gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5" />
                ATE +{model.summary.averageTimingAndAspectAte}%
              </span>
            </div>
            <p className={`text-[11px] mt-1 ${mutedText}`}>
              Driven by posting hour offset, 4:5 viewport fill &amp; caption alignment
            </p>
          </div>

          <div className={`p-3.5 rounded-xl border ${subtleSurface}`}>
            <div className={`text-[11px] font-semibold uppercase tracking-wider ${mutedText}`}>
              Unobserved Algorithmic Noise
            </div>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-2xl font-bold font-mono tabular-nums text-sky-500">
                {model.summary.unobservedResidualSharePct}%
              </span>
              <span className={`text-xs font-mono tabular-nums ${mutedText}`}>
                R² = {model.summary.structuralR2.toFixed(3)}
              </span>
            </div>
            <p className={`text-[11px] mt-1 ${mutedText}`}>
              NOTEARS DAG acyclicity loss h(W) = {model.summary.notearsDagAcyclicityLoss}
            </p>
          </div>

          <div className={`p-3.5 rounded-xl border ${subtleSurface}`}>
            <div className={`text-[11px] font-semibold uppercase tracking-wider ${mutedText}`}>
              Active Matched Cohorts
            </div>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-2xl font-bold font-mono tabular-nums">
                {model.cohorts.length} Cohorts
              </span>
              <span className="text-xs font-mono tabular-nums text-emerald-500">
                n = {model.summary.sampleSizeN} posts
              </span>
            </div>
            <p className={`text-[11px] mt-1 ${mutedText}`}>
              {liveObservations.length > 0
                ? 'Includes live workspace comparison pair'
                : 'Synced across 5 connected social profiles'}
            </p>
          </div>
        </div>

        {/* Optional Custom Cross-Profile Post Pair Builder */}
        {showAddPostForm && (
          <form
            onSubmit={handleAddCrossPostPair}
            className={`mt-4 p-4 rounded-xl border ${subtleSurface} space-y-4`}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider">
                Add Matched Cross-Profile Post Comparison
              </h4>
              <span className={`text-[11px] ${mutedText}`}>
                Simulates DECI structural attribution between two profiles publishing the same creative
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${mutedText}`}>
                  Post Cohort Title
                </label>
                <input
                  type="text"
                  value={newCohortTitle}
                  onChange={(e) => setNewCohortTitle(e.target.value)}
                  className={`w-full px-3 py-1.5 rounded-lg border text-xs ${
                    darkMode
                      ? 'bg-[#112440] border-slate-700 text-white'
                      : 'bg-white border-slate-300 text-slate-900'
                  }`}
                  required
                />
              </div>
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${mutedText}`}>
                  Visual Content Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) =>
                    setNewCategory(e.target.value as CrossPostObservation['contentCategory'])
                  }
                  className={`w-full px-3 py-1.5 rounded-lg border text-xs ${
                    darkMode
                      ? 'bg-[#112440] border-slate-700 text-white'
                      : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="Portrait & Skin Tones">Portrait &amp; Skin Tones</option>
                  <option value="Night Street & Neon">Night Street &amp; Neon</option>
                  <option value="Typography & UI">Typography &amp; UI</option>
                  <option value="Landscape & Foliage">Landscape &amp; Foliage</option>
                  <option value="Product Macro">Product Macro</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Profile A */}
              <div className={`p-3 rounded-xl border ${cardSurface} space-y-2.5`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-500">
                    Profile A (Higher Compression / Delayed)
                  </span>
                  <select
                    value={newPlatformA}
                    onChange={(e) => setNewPlatformA(e.target.value as SocialPlatformId)}
                    className={`px-2 py-1 rounded border text-xs ${
                      darkMode
                        ? 'bg-[#0B192E] border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    {CONNECTED_SOCIAL_PROFILES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.platformName} ({p.handle})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className={`block text-[10px] ${mutedText}`}>
                      SSIM ({newSsimA.toFixed(2)})
                    </label>
                    <input
                      type="range"
                      min="0.65"
                      max="0.99"
                      step="0.01"
                      value={newSsimA}
                      onChange={(e) => setNewSsimA( parseFloat(e.target.value) )}
                      className="w-full accent-rose-500"
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] ${mutedText}`}>
                      ΔE2000 ({newDeltaEA.toFixed(1)})
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="10.0"
                      step="0.2"
                      value={newDeltaEA}
                      onChange={(e) => setNewDeltaEA(parseFloat(e.target.value))}
                      className="w-full accent-rose-500"
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] ${mutedText}`}>
                      Off-Peak Timing ({newTimingA.toFixed(1)}h)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="8"
                      step="0.5"
                      value={newTimingA}
                      onChange={(e) => setNewTimingA(parseFloat(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] ${mutedText}`}>
                      Viewport Fill ({Math.round(newAspectA * 100)}%)
                    </label>
                    <input
                      type="range"
                      min="0.55"
                      max="1.0"
                      step="0.03"
                      value={newAspectA}
                      onChange={(e) => setNewAspectA(parseFloat(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Profile B */}
              <div className={`p-3 rounded-xl border ${cardSurface} space-y-2.5`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-500">
                    Profile B (Reference / Pre-Scaled Upload)
                  </span>
                  <select
                    value={newPlatformB}
                    onChange={(e) => setNewPlatformB(e.target.value as SocialPlatformId)}
                    className={`px-2 py-1 rounded border text-xs ${
                      darkMode
                        ? 'bg-[#0B192E] border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    {CONNECTED_SOCIAL_PROFILES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.platformName} ({p.handle})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className={`block text-[10px] ${mutedText}`}>
                      SSIM ({newSsimB.toFixed(2)})
                    </label>
                    <input
                      type="range"
                      min="0.65"
                      max="0.99"
                      step="0.01"
                      value={newSsimB}
                      onChange={(e) => setNewSsimB(parseFloat(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] ${mutedText}`}>
                      ΔE2000 ({newDeltaEB.toFixed(1)})
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="10.0"
                      step="0.2"
                      value={newDeltaEB}
                      onChange={(e) => setNewDeltaEB(parseFloat(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] ${mutedText}`}>
                      Off-Peak Timing ({newTimingB.toFixed(1)}h)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="8"
                      step="0.5"
                      value={newTimingB}
                      onChange={(e) => setNewTimingB(parseFloat(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] ${mutedText}`}>
                      Viewport Fill ({Math.round(newAspectB * 100)}%)
                    </label>
                    <input
                      type="range"
                      min="0.55"
                      max="1.0"
                      step="0.03"
                      value={newAspectB}
                      onChange={(e) => setNewAspectB(parseFloat(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddPostForm(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${mutedText} cursor-pointer`}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-[#1B4D7E] hover:bg-[#153E66] text-white text-xs font-semibold cursor-pointer"
              >
                Run Causica Attribution on Cohort
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Middle Grid: Interactive DECI Causal Graph (DAG) + Dual Attribution Comparison */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Left 7 Cols: Interactive Structural Causal Graph (DAG) */}
        <div className={`xl:col-span-7 p-5 rounded-2xl border shadow-sm flex flex-col ${cardSurface}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-sky-500" />
                Learned Structural Causal Graph (DECI Posterior DAG)
              </h4>
              <p className={`text-[11px] mt-0.5 ${mutedText}`}>
                Click any node to inspect its structural equation path coefficients and Average
                Treatment Effect (ATE).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-medium">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
                Compression Treatment
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
                Profile Attribute
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-sky-500 inline-block" />
                Mediator
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                Engagement Outcome
              </span>
            </div>
          </div>

          {/* Interactive SVG Canvas */}
          <div
            className={`relative w-full rounded-xl border overflow-hidden ${
              darkMode ? 'bg-[#081221] border-slate-800' : 'bg-[#F8FAFC] border-[#E2E8F0]'
            }`}
          >
            <svg
              viewBox="0 0 780 390"
              className="w-full h-[340px] sm:h-[370px] select-none"
              role="img"
              aria-label="Microsoft Causica Directed Acyclic Graph"
            >
              <defs>
                <marker
                  id="arrow-pos"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#10B981" />
                </marker>
                <marker
                  id="arrow-neg"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#F43F5E" />
                </marker>
              </defs>

              {/* Column Header Labels inside SVG */}
              <text
                x="70"
                y="22"
                textAnchor="middle"
                className="text-[9px] font-bold uppercase tracking-widest"
                fill={darkMode ? '#64748B' : '#94A3B8'}
              >
                Confounders
              </text>
              <text
                x="296"
                y="22"
                textAnchor="middle"
                className="text-[9px] font-bold uppercase tracking-widest"
                fill={darkMode ? '#64748B' : '#94A3B8'}
              >
                Compression &amp; Profile Treatments
              </text>
              <text
                x="538"
                y="22"
                textAnchor="middle"
                className="text-[9px] font-bold uppercase tracking-widest"
                fill={darkMode ? '#64748B' : '#94A3B8'}
              >
                HVS &amp; Feed Mediators
              </text>
              <text
                x="710"
                y="22"
                textAnchor="middle"
                className="text-[9px] font-bold uppercase tracking-widest"
                fill={darkMode ? '#64748B' : '#94A3B8'}
              >
                Outcome
              </text>

              {/* Directed Edges */}
              {model.edges.map((edge) => {
                const src = model.nodes.find((n) => n.id === edge.source);
                const tgt = model.nodes.find((n) => n.id === edge.target);
                if (!src || !tgt) return null;

                const x1 = src.x * 760 + 52;
                const y1 = src.y * 350 + 20;
                const x2 = tgt.x * 760 - 54;
                const y2 = tgt.y * 350 + 20;
                const cx1 = x1 + (x2 - x1) * 0.45;
                const cx2 = x1 + (x2 - x1) * 0.55;

                const isHighlighted =
                  selectedNode.id === edge.source || selectedNode.id === edge.target;
                const isPositive = edge.weight >= 0;
                const strokeColor = isPositive ? '#10B981' : '#F43F5E';

                return (
                  <g key={edge.id} opacity={isHighlighted ? 0.98 : 0.32}>
                    <path
                      d={`M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={Math.max(1.5, Math.abs(edge.weight) * 3.8)}
                      strokeDasharray={edge.edgeProbability < 0.95 ? '4 2' : undefined}
                      markerEnd={isPositive ? 'url(#arrow-pos)' : 'url(#arrow-neg)'}
                    />
                    {isHighlighted && (
                      <text
                        x={(x1 + x2) / 2}
                        y={(y1 + y2) / 2 - 5}
                        textAnchor="middle"
                        fill={strokeColor}
                        className="text-[9px] font-mono font-bold"
                      >
                        {edge.weight > 0 ? `+${edge.weight.toFixed(2)}` : edge.weight.toFixed(2)}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Causal Nodes */}
              {model.nodes.map((node) => {
                const cx = node.x * 760;
                const cy = node.y * 350 + 20;
                const isSelected = node.id === selectedNode.id;
                const style = getCategoryColor(node.category);

                return (
                  <g
                    key={node.id}
                    transform={`translate(${cx - 52}, ${cy - 22})`}
                    onClick={() => setSelectedNodeId(node.id)}
                    className="cursor-pointer"
                  >
                    <rect
                      width="104"
                      height="44"
                      rx="8"
                      fill={style.fill}
                      stroke={style.stroke}
                      strokeWidth={isSelected ? '2.5' : '1.2'}
                    />
                    <text
                      x="52"
                      y="17"
                      textAnchor="middle"
                      fill={style.text}
                      className="text-[10px] font-bold"
                    >
                      {node.shortLabel}
                    </text>
                    <text
                      x="52"
                      y="32"
                      textAnchor="middle"
                      fill={darkMode ? '#94A3B8' : '#475569'}
                      className="text-[9px] font-mono"
                    >
                      {node.id === 'node_engagement'
                        ? `${node.meanValue > 0 ? '+' : ''}${node.meanValue}% ER`
                        : `ATE: ${node.ateOnEngagement > 0 ? '+' : ''}${node.ateOnEngagement}%`}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Selected Node Inspector Footer */}
          <div className={`mt-3 p-3.5 rounded-xl border ${subtleSurface}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold">{selectedNode.label}</span>
                <span className={`text-[11px] ${mutedText}`}>
                  ({getCategoryColor(selectedNode.category).label})
                </span>
              </div>
              {selectedNode.id !== 'node_engagement' && (
                <div className="text-xs font-mono tabular-nums font-semibold">
                  ATE on Engagement:{' '}
                  <span
                    className={
                      selectedNode.ateOnEngagement >= 0 ? 'text-emerald-500' : 'text-rose-500'
                    }
                  >
                    {selectedNode.ateOnEngagement > 0 ? '+' : ''}
                    {selectedNode.ateOnEngagement}%
                  </span>{' '}
                  <span className={`text-[11px] font-normal ${mutedText}`}>
                    (95% CI: [{selectedNode.ateCiLower}%, {selectedNode.ateCiUpper}%])
                  </span>
                </div>
              )}
            </div>
            <p className={`text-xs mt-1 leading-relaxed ${mutedText}`}>
              {selectedNode.description}
            </p>
            {connectedEdges.length > 0 && (
              <div className="mt-2 pt-2 border-t border-current/10 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {connectedEdges.slice(0, 4).map((edge) => {
                  const otherNode = model.nodes.find(
                    (n) => n.id === (edge.source === selectedNode.id ? edge.target : edge.source)
                  );
                  const isOutgoing = edge.source === selectedNode.id;
                  return (
                    <div
                      key={edge.id}
                      className="text-[11px] flex items-start gap-1.5 leading-snug"
                    >
                      <span
                        className={`font-mono tabular-nums font-bold shrink-0 ${
                          edge.weight >= 0 ? 'text-emerald-500' : 'text-rose-500'
                        }`}
                      >
                        {isOutgoing ? '→' : '←'} { otherNode?.shortLabel } (
                        {edge.weight > 0 ? `+${edge.weight}` : edge.weight}):
                      </span>
                      <span className={mutedText}>{edge.mechanism}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 5 Cols: Compression vs. Relative Attributes Variance Decomposition */}
        <div className={`xl:col-span-5 p-5 rounded-2xl border shadow-sm flex flex-col justify-between ${cardSurface}`}>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-rose-500" />
              Engagement Attribution: Compression vs. Relative Attributes
            </h4>
            <p className={`text-[11px] mt-0.5 ${mutedText}`}>
              Shapley &amp; Structural Equation variance decomposition across your connected social
              profiles.
            </p>

            {/* Stacked Total Comparison Bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs font-semibold mb-1.5 tabular-nums">
                <span className="text-rose-500">
                  Compression Artifacts: {model.summary.totalCompressionSharePct}%
                </span>
                <span className="text-amber-500">
                  Relative Attributes: {model.summary.totalRelativeAttributesSharePct}%
                </span>
              </div>
              <div className="w-full h-3.5 rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-800">
                <div
                  style={{ width: `${model.summary.totalCompressionSharePct}%` }}
                  className="bg-rose-500 h-full transition-all duration-300"
                  title="Compression Degradation Share"
                />
                <div
                  style={{ width: `${model.summary.totalRelativeAttributesSharePct}%` }}
                  className="bg-amber-500 h-full transition-all duration-300"
                  title="Relative Profile & Post Attributes Share"
                />
                <div
                  style={{ width: `${model.summary.unobservedResidualSharePct}%` }}
                  className="bg-slate-400 dark:bg-slate-600 h-full transition-all duration-300"
                  title="Unobserved Residual"
                />
              </div>
            </div>

            {/* Section 1: Compression Drivers */}
            <div className="mt-5 space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-rose-500 flex items-center justify-between">
                <span>1. Compression &amp; Transcoding Drivers</span>
                <span className="font-mono tabular-nums">Share of Variance</span>
              </div>
              {compressionNodes.map((node) => (
                <div
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    selectedNodeId === node.id
                      ? 'border-rose-500/60 bg-rose-500/5'
                      : subtleSurface
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>{node.label}</span>
                    <span className="font-mono tabular-nums text-rose-500">
                      {node.varianceSharePct}% (ATE {node.ateOnEngagement}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 mt-1.5 overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full"
                      style={{ width: `${Math.min(100, node.varianceSharePct * 2.5)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Section 2: Relative Profile & Post Attributes */}
            <div className="mt-5 space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-500 flex items-center justify-between">
                <span>2. Relative Profile &amp; Post Attributes</span>
                <span className="font-mono tabular-nums">Share of Variance</span>
              </div>
              {relativeAttrNodes.map((node) => (
                <div
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    selectedNodeId === node.id
                      ? 'border-amber-500/60 bg-amber-500/5'
                      : subtleSurface
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>{node.label}</span>
                    <span className="font-mono tabular-nums text-amber-500">
                      {node.varianceSharePct}% (ATE{' '}
                      {node.ateOnEngagement > 0 ? `+${node.ateOnEngagement}` : node.ateOnEngagement}
                      %)
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 mt-1.5 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${Math.min(100, node.varianceSharePct * 2.5)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`mt-4 p-3 rounded-xl border text-xs leading-relaxed ${subtleSurface}`}>
            <span className="font-bold text-sky-500">Key Causal Takeaway: </span>
            <span className={mutedText}>
              Across similar posts, visual compression artifacts account for{' '}
              <strong className="font-mono tabular-nums text-rose-500">
                {model.summary.totalCompressionSharePct}%
              </strong>{' '}
              of relative engagement variance (primarily via reduced scroll-stop dwell time), while
              cross-profile timing offset, 4:5 aspect fill, and caption adaptation account for{' '}
              <strong className="font-mono tabular-nums text-amber-500">
                {model.summary.totalRelativeAttributesSharePct}%
              </strong>
              .
            </span>
          </div>
        </div>
      </div>

      {/* Counterfactual Intervention Simulator (do-Calculus) */}
      <div className={`p-5 rounded-2xl border shadow-sm ${cardSurface}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-current/10">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-500" />
              Counterfactual &ldquo;What-If&rdquo; Intervention Simulator — P(Engagement | do(Compression, ProfileAttributes))
            </h4>
            <p className={`text-xs mt-0.5 ${mutedText}`}>
              Simulate how much engagement each social profile would gain if you intervened on upload
              compression versus posting schedule &amp; viewport formatting.
            </p>
          </div>

          {/* Preset Intervention Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => applyPresetScenario('compression_only')}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer transition-all ${
                darkMode
                  ? 'border-slate-700 hover:bg-slate-800 text-rose-300'
                  : 'border-slate-200 hover:bg-rose-50 text-rose-700'
              }`}
            >
              do(Fix Compression Only)
            </button>
            <button
              onClick={() => applyPresetScenario('attributes_only')}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer transition-all ${
                darkMode
                  ? 'border-slate-700 hover:bg-slate-800 text-amber-300'
                  : 'border-slate-200 hover:bg-amber-50 text-amber-700'
              }`}
            >
              do(Fix Timing &amp; Aspect Only)
            </button>
            <button
              onClick={() => applyPresetScenario('full_optimal')}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold cursor-pointer transition-all"
            >
              do(Full Optimal Pipeline)
            </button>
            <button
              onClick={() => applyPresetScenario('baseline')}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                darkMode
                  ? 'border-slate-700 hover:bg-slate-800 text-slate-400'
                  : 'border-slate-200 hover:bg-slate-100 text-slate-600'
              }`}
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-4">
          {/* Left 5 Cols: Intervention Controls */}
          <div className={`lg:col-span-5 p-4 rounded-xl border space-y-4 ${subtleSurface}`}>
            <div className="space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-rose-500">
                Compression Interventions
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span>Target Structural Fidelity (do(SSIM))</span>
                  <span className="font-mono tabular-nums font-bold">
                    {intervention.targetSsim.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.78"
                  max="0.99"
                  step="0.01"
                  value={intervention.targetSsim}
                  onChange={(e) =>
                    setIntervention((prev) => ({
                      ...prev,
                      targetSsim: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full accent-rose-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span>Max Color Shift Ceiling (do(ΔE2000))</span>
                  <span className="font-mono tabular-nums font-bold">
                    {intervention.targetDeltaE.toFixed(1)} ΔE
                  </span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="6.5"
                  step="0.1"
                  value={intervention.targetDeltaE}
                  onChange={(e) =>
                    setIntervention((prev) => ({
                      ...prev,
                      targetDeltaE: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full accent-rose-500 cursor-pointer"
                />
              </div>

              <label className="flex items-center justify-between text-xs cursor-pointer pt-1">
                <span>Pre-scale to exact platform width (Lanczos-3)</span>
                <input
                  type="checkbox"
                  checked={intervention.nativePreScale}
                  onChange={(e) =>
                    setIntervention((prev) => ({ ...prev, nativePreScale: e.target.checked }))
                  }
                  className="rounded accent-rose-500 w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between text-xs cursor-pointer">
                <span>Mitigate 4:2:0 chroma bleed (sRGB perceptual guard)</span>
                <input
                  type="checkbox"
                  checked={intervention.preserveChroma444}
                  onChange={(e) =>
                    setIntervention((prev) => ({ ...prev, preserveChroma444: e.target.checked }))
                  }
                  className="rounded accent-rose-500 w-4 h-4"
                />
              </label>
            </div>

            <div className="pt-3 border-t border-current/10 space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-500">
                Relative Profile Attribute Interventions
              </div>

              <label className="flex items-center justify-between text-xs cursor-pointer">
                <span>Synchronize post timing to each profile&apos;s peak hour</span>
                <input
                  type="checkbox"
                  checked={intervention.alignPeakTiming}
                  onChange={(e) =>
                    setIntervention((prev) => ({ ...prev, alignPeakTiming: e.target.checked }))
                  }
                  className="rounded accent-amber-500 w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between text-xs cursor-pointer">
                <span>Format 4:5 vertical viewport crop for mobile feeds</span>
                <input
                  type="checkbox"
                  checked={intervention.optimizeViewportAspect}
                  onChange={(e) =>
                    setIntervention((prev) => ({
                      ...prev,
                      optimizeViewportAspect: e.target.checked,
                    }))
                  }
                  className="rounded accent-amber-500 w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between text-xs cursor-pointer">
                <span>Replace raw cross-post copy with native profile hooks</span>
                <input
                  type="checkbox"
                  checked={intervention.tailorProfileCaptions}
                  onChange={(e) =>
                    setIntervention((prev) => ({
                      ...prev,
                      tailorProfileCaptions: e.target.checked,
                    }))
                  }
                  className="rounded accent-amber-500 w-4 h-4"
                />
              </label>
            </div>
          </div>

          {/* Right 7 Cols: Counterfactual Engagement Lift by Social Profile */}
          <div className="lg:col-span-7 space-y-2.5">
            {model.counterfactualByPlatform.map((pred) => (
              <div
                key={pred.platformId}
                className={`p-3.5 rounded-xl border transition-all ${subtleSurface}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold">{pred.platformName}</span>{' '}
                    <span className={`text-xs font-mono ${mutedText}`}>{pred.handle}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                    <span className={mutedText}>
                      Observed:{' '}
                      <strong
                        className={
                          pred.observedRelativeEr >= 0 ? 'text-emerald-500' : 'text-rose-500'
                        }
                      >
                        {pred.observedRelativeEr > 0 ? '+' : ''}
                        {pred.observedRelativeEr}%
                      </strong>
                    </span>
                    <span>→</span>
                    <span className="font-bold text-emerald-500">
                      Counterfactual: {pred.counterfactualRelativeEr > 0 ? '+' : ''}
                      {pred.counterfactualRelativeEr}%
                    </span>
                  </div>
                </div>

                {/* Split Progress Bar showing Compression Gain vs Profile Attribute Gain */}
                <div className="mt-2.5 flex items-center gap-3">
                  <div className="flex-1 h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
                    <div
                      style={{
                        width: `${Math.min(65, pred.compressionLiftComponentPct * 2.2)}%`,
                      }}
                      className="bg-rose-500 h-full transition-all duration-300"
                      title={`Compression Fix Lift: +${pred.compressionLiftComponentPct}%`}
                    />
                    <div
                      style={{
                        width: `${Math.min(45, pred.profileAttributeLiftComponentPct * 2.2)}%`,
                      }}
                      className="bg-amber-500 h-full transition-all duration-300"
                      title={`Profile Attributes Lift: +${pred.profileAttributeLiftComponentPct}%`}
                    />
                  </div>
                  <span className="text-xs font-mono tabular-nums font-bold text-emerald-500 shrink-0">
                    +{pred.netEngagementLiftPct}% Lift
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between text-[11px] font-mono tabular-nums">
                  <div className="flex items-center gap-3">
                    <span className="text-rose-500">
                      Compression Fix: +{pred.compressionLiftComponentPct}%
                    </span>
                    <span className="text-amber-500">
                      Timing/Aspect/Copy Fix: +{pred.profileAttributeLiftComponentPct}%
                    </span>
                  </div>
                  <span className={mutedText}>
                    +{pred.estimatedExtraInteractionsPer10k.toLocaleString()} interactions / 10k
                    reach
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Section: Cross-Profile Similar Posts Cohort Table */}
      <div className={`p-5 rounded-2xl border shadow-sm ${cardSurface}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-sky-500" />
              Matched Cross-Profile Similar Post Cohorts — Causal Spread Decomposition
            </h4>
            <p className={`text-xs mt-0.5 ${mutedText}`}>
              Compares identical or similar visual posts published across your social accounts and
              quantifies why one profile outperformed another.
            </p>
          </div>

          <select
            value={selectedCohortId}
            onChange={(e) => setSelectedCohortId(e.target.value)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold ${
              darkMode
                ? 'bg-[#0B192E] border-slate-700 text-slate-200'
                : 'bg-[#F8FAFC] border-slate-300 text-[#0F2942]'
            }`}
          >
            <option value="all">All Matched Cohorts ({model.cohorts.length})</option>
            {model.cohorts.map((c) => (
              <option key={c.cohortId} value={c.cohortId}>
                {c.cohortTitle}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-4">
          {filteredCohorts.map((cohort) => (
            <div
              key={cohort.cohortId}
              className={`rounded-xl border overflow-hidden ${subtleSurface}`}
            >
              {/* Cohort Header */}
              <div className="p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-current/10">
                <div className="flex items-center gap-3">
                  <img
                    src={cohort.thumbnailUrl}
                    alt={cohort.cohortTitle}
                    className="w-12 h-12 rounded-lg object-cover border border-current/10 shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="text-sm font-bold">{cohort.cohortTitle}</h5>
                      {cohort.isLiveWorkspaceSync && (
                        <span className="text-[11px] font-semibold text-sky-500">
                          • Synced from Active Workspace
                        </span>
                      )}
                    </div>
                    <div className={`text-xs mt-0.5 ${mutedText}`}>
                      Category: {cohort.contentCategory} · Dominant Causal Driver:{' '}
                      <strong className="font-semibold text-current">
                        {cohort.dominantDriverLabel}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Causal Spread Decomposition Metrics */}
                <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
                  <div>
                    <div className={`text-[10px] uppercase ${mutedText}`}>Cross-Profile Spread</div>
                    <div className="font-bold text-sm">{cohort.observedSpreadPct}% gap</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-rose-500">Due to Compression</div>
                    <div className="font-bold text-sm text-rose-500">
                      -{cohort.compressionCausalEffectPct}% (
                      {Math.round(
                        (cohort.compressionCausalEffectPct / cohort.observedSpreadPct) * 100
                      )}
                      %)
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-amber-500">
                      Due to Profile Attributes
                    </div>
                    <div className="font-bold text-sm text-amber-500">
                      -{cohort.relativeAttributesCausalEffectPct}% (
                      {Math.round(
                        (cohort.relativeAttributesCausalEffectPct / cohort.observedSpreadPct) * 100
                      )}
                      %)
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-emerald-500">
                      Recoverable via do()
                    </div>
                    <div className="font-bold text-sm text-emerald-500">
                      +{cohort.counterfactualBestGainPct}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Per-Profile Post Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr
                      className={`border-b border-current/10 text-[10px] uppercase tracking-wider ${mutedText}`}
                    >
                      <th className="py-2.5 px-3.5">Social Profile</th>
                      <th className="py-2.5 px-3 text-right">SSIM</th>
                      <th className="py-2.5 px-3 text-right">ΔE2000</th>
                      <th className="py-2.5 px-3 text-right">Chroma / Q</th>
                      <th className="py-2.5 px-3 text-right">Peak Offset</th>
                      <th className="py-2.5 px-3 text-right">Viewport Fill</th>
                      <th className="py-2.5 px-3 text-right">Dwell Time</th>
                      <th className="py-2.5 px-3 text-right">Observed ER</th>
                      <th className="py-2.5 px-3.5 text-right">Relative vs. Profile Baseline</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-current/5 font-mono tabular-nums">
                    {cohort.posts.map((post) => {
                      const isPositive = post.relativeEngagementVsBaseline >= 0;
                      return (
                        <tr
                          key={post.id}
                          className="hover:bg-sky-500/5 transition-colors"
                        >
                          <td className="py-2.5 px-3.5 font-sans">
                            <div className="font-semibold">{post.handle}</div>
                            <div className={`text-[10px] ${mutedText}`}>
                              {post.impressions.toLocaleString()} reach ·{' '}
                              {post.likes.toLocaleString()} likes · {post.savesAndShares} saves
                            </div>
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-semibold ${
                              post.ssim < 0.85 ? 'text-rose-500' : 'text-emerald-500'
                            }`}
                          >
                            {post.ssim.toFixed(3)}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right ${
                              post.deltaE2000 > 4.0 ? 'text-rose-500 font-semibold' : ''
                            }`}
                          >
                            {post.deltaE2000.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {post.chromaSubsampling} · q{post.jpegQuality}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right ${
                              post.postingHourDeltaFromPeak > 2.0 ? 'text-amber-500' : ''
                            }`}
                          >
                            +{post.postingHourDeltaFromPeak.toFixed(1)}h
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {Math.round(post.viewportAspectFill * 100)}%
                          </td>
                          <td className="py-2.5 px-3 text-right">{post.dwellTimeSeconds}s</td>
                          <td className="py-2.5 px-3 text-right font-semibold">
                            {post.observedEngagementRate.toFixed(2)}%
                          </td>
                          <td
                            className={`py-2.5 px-3.5 text-right font-bold ${
                              isPositive ? 'text-emerald-500' : 'text-rose-500'
                            }`}
                          >
                            {isPositive ? '+' : ''}
                            {post.relativeEngagementVsBaseline.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
