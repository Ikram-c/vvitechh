import React, { useState, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Upload, 
  Link as LinkIcon, 
  Info, 
  Play, 
  FileCheck, 
  AlertCircle, 
  RefreshCw, 
  Search, 
  ChevronDown,
  Sparkles,
  Sliders,
  Video as VideoIcon,
  Eye,
  Check,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Share2
} from 'lucide-react';
import { SlotMedia } from '../types';
import { SITES_DATABASE, searchSites, detectSiteFromUrl } from '../services/sitesDatabase';

interface LeftPanelProps {
  original: SlotMedia;
  sites: SlotMedia[];
  activeSiteIndex: number;
  setActiveSiteIndex: (idx: number) => void;
  onFileSelect: (slotIndex: number | 'original', file: File) => void;
  onUrlFetch: (slotIndex: number | 'original', url: string) => void;
  onSiteChange: (slotIndex: number, siteName: string) => void;
  onAddSiteSlot: () => void;
  onRemoveSiteSlot: (slotIndex: number) => void;
  onClearSlot: (slotIndex: number | 'original') => void;
  onVisualize: () => void;
  autoVisualize: boolean;
  setAutoVisualize: (v: boolean) => void;
  isComputing: boolean;
  simpleMode?: boolean;
  setSimpleMode?: (v: boolean) => void;
  onOpenSocialModal?: () => void;
  onRunSlamForSlot?: (slotIndex: number) => void;
  isSlamRunning?: boolean;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({
  original,
  sites,
  activeSiteIndex,
  setActiveSiteIndex,
  onFileSelect,
  onUrlFetch,
  onSiteChange,
  onAddSiteSlot,
  onRemoveSiteSlot,
  onClearSlot,
  onVisualize,
  autoVisualize,
  setAutoVisualize,
  isComputing,
  simpleMode = false,
  setSimpleMode,
  onOpenSocialModal,
  onRunSlamForSlot,
  isSlamRunning = false
}) => {
  const [siteQuery, setSiteQuery] = useState<{ [key: number]: string }>({});
  const [dropdownOpen, setDropdownOpen] = useState<{ [key: number]: boolean }>({});
  const [urlInputs, setUrlInputs] = useState<{ [key: string]: string }>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingUploadSlot, setPendingUploadSlot] = useState<number | 'original' | null>(null);

  const triggerUpload = (slot: number | 'original') => {
    setPendingUploadSlot(slot);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && pendingUploadSlot !== null) {
      onFileSelect(pendingUploadSlot, file);
    }
  };

  const handleDrop = (e: React.DragEvent, slot: number | 'original') => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onFileSelect(slot, file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleUrlSubmit = (slot: number | 'original') => {
    const key = slot === 'original' ? 'original' : slot.toString();
    const url = urlInputs[key]?.trim();
    if (url) {
      // Auto-detect site if for a site slot
      if (typeof slot === 'number') {
        const detected = detectSiteFromUrl(url);
        if (detected) {
          onSiteChange(slot, detected.name);
        }
      }
      onUrlFetch(slot, url);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Helper for simple mode quality assessment
  const getSimpleQualityLabel = (quality: number) => {
    if (quality >= 90) return 'Very High Quality (Minimal compression)';
    if (quality >= 75) return 'Good Quality (Standard social web)';
    if (quality >= 60) return 'Noticeably Compressed (Medium quality)';
    return 'Heavy Compression (Low quality)';
  };

  return (
    <aside className="w-80 h-full bg-neutral-900 border-r border-neutral-800 flex flex-col text-xs select-none z-10 overflow-hidden">
      {/* Hidden file input for file dialog */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header with Mode Toggle & Add Button */}
      <div className="p-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
        <div className="flex items-center gap-1.5">
          <FileCheck className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-neutral-200 uppercase tracking-wider text-[11px]">
            {simpleMode ? 'Photos & Videos' : 'Media Slots'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Simple Mode Toggle */}
          {setSimpleMode && (
            <button
              onClick={() => setSimpleMode(!simpleMode)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                simpleMode
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                  : 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:text-neutral-200'
              }`}
              title={
                simpleMode
                  ? 'Simple Mode: Plain English descriptions (Click for Technical Mode)'
                  : 'Technical Mode: Exact JPEG matrices and forensics (Click for Simple Mode)'
              }
            >
              {simpleMode ? (
                <Sparkles className="w-3 h-3 text-amber-400" />
              ) : (
                <Sliders className="w-3 h-3 text-neutral-400" />
              )}
              <span>{simpleMode ? 'Simple' : 'Technical'}</span>
            </button>
          )}

          {/* Add Site Slot */}
          <button
            onClick={onAddSiteSlot}
            disabled={sites.length >= 16}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition-colors disabled:opacity-40"
            title="Add another site slot"
          >
            <Plus className="w-3 h-3" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Scrollable Slots Container */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
        {/* ================= ORIGINAL SLOT ================= */}
        <div
          onDrop={e => handleDrop(e, 'original')}
          onDragOver={handleDragOver}
          className={`p-2.5 rounded-lg border transition-all ${
            original.imageData || original.videoElement
              ? 'bg-neutral-950/90 border-emerald-900/60 shadow-sm'
              : 'bg-neutral-950/40 border-dashed border-neutral-700 hover:border-neutral-500'
          }`}
        >
          {/* Original Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {/* Small Thumbnail Preview */}
              {original.thumbnailUrl ? (
                <div 
                  onClick={() => triggerUpload('original')}
                  className="relative w-8 h-8 rounded bg-neutral-900 border border-emerald-500/50 overflow-hidden shrink-0 shadow-xs cursor-pointer hover:opacity-80 transition-opacity"
                  title="Click to replace original file"
                >
                  <img
                    src={original.thumbnailUrl}
                    alt="Original thumbnail"
                    className="w-full h-full object-cover"
                  />
                  {original.isVideo && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <VideoIcon className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-8 h-8 rounded bg-neutral-900 border border-dashed border-neutral-700 flex items-center justify-center shrink-0 text-neutral-500">
                  <Upload className="w-3.5 h-3.5" />
                </div>
              )}

              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span className="font-semibold text-neutral-200">
                    {simpleMode ? 'Original File' : 'Original (Before)'}
                  </span>
                </div>
                <div className="text-[10px] text-neutral-500 truncate max-w-[170px]">
                  {original.name || (simpleMode ? 'Uncompressed source' : 'Reference input')}
                </div>
              </div>
            </div>

            {(original.imageData || original.videoElement) && (
              <button
                onClick={() => onClearSlot('original')}
                className="text-neutral-500 hover:text-red-400 transition-colors p-1"
                title="Clear original slot"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Upload / Drag drop prompt if empty */}
          {!original.imageData && !original.videoElement && (
            <div
              onClick={() => triggerUpload('original')}
              className="group relative w-full h-24 rounded bg-neutral-900 border border-neutral-800 overflow-hidden flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500/50 transition-colors"
            >
              <div className="flex flex-col items-center gap-1 text-neutral-400 group-hover:text-neutral-200 transition-colors">
                <Upload className="w-5 h-5 text-neutral-500 group-hover:text-emerald-400 transition-colors" />
                <span className="font-medium text-center px-4 text-[11px]">
                  {simpleMode ? 'Click or drop your original photo/video here' : 'Drop original file or browse'}
                </span>
                <span className="text-[10px] text-neutral-500">
                  PNG, JPG, WebP, MP4
                </span>
              </div>
            </div>
          )}

          {/* If empty: Option to browse social media photos */}
          {!original.imageData && !original.videoElement && onOpenSocialModal && (
            <button
              onClick={onOpenSocialModal}
              className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md bg-neutral-900/90 hover:bg-neutral-800 text-pink-300 border border-neutral-800 hover:border-pink-500/40 text-[11px] font-medium transition-all shadow-xs"
              title="Open your connected social media feeds and cloud photos"
            >
              <Share2 className="w-3.5 h-3.5 text-pink-400" />
              <span>{simpleMode ? 'Browse My Social Media Photos' : 'Import from Social Accounts'}</span>
            </button>
          )}

          {/* Metadata details */}
          {(original.imageData || original.videoElement) && (
            <div className="mt-1.5 space-y-1 text-[11px] text-neutral-400 bg-neutral-900/70 p-2 rounded border border-neutral-800/80">
              <div className="flex justify-between">
                <span className="text-neutral-500">{simpleMode ? 'Dimensions:' : 'Resolution:'}</span>
                <span className="font-mono text-neutral-300">
                  {original.width} × {original.height} px
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">{simpleMode ? 'File Size:' : 'Format & Size:'}</span>
                <span className="font-mono text-neutral-300">
                  {original.format.toUpperCase()} · {formatFileSize(original.fileSize)}
                </span>
              </div>

              {original.jpegInfo && (
                <div className="mt-1 pt-1 border-t border-neutral-800 space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">{simpleMode ? 'Quality:' : 'JPEG Quality:'}</span>
                    <span className="font-mono text-emerald-300">
                      {simpleMode 
                        ? `q${original.jpegInfo.estimatedLumaQuality} (Original source)`
                        : `q${original.jpegInfo.estimatedLumaQuality} ${original.jpegInfo.isCustomTable ? '(custom)' : ''}`
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">{simpleMode ? 'Camera Data:' : 'Metadata:'}</span>
                    <span className="font-mono text-neutral-300">
                      {original.jpegInfo.hasExif 
                        ? (simpleMode ? 'Preserved (Camera info attached)' : 'EXIF preserved') 
                        : (simpleMode ? 'None' : 'no-exif')}
                    </span>
                  </div>
                </div>
              )}

              {/* ⚡ Instant SLAM Generator button for the Original */}
              {onRunSlamForSlot && !original.isVideo && (
                <button
                  onClick={() => onRunSlamForSlot(activeSiteIndex)}
                  disabled={isSlamRunning}
                  className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-medium transition-all shadow-xs"
                  title="Generate simulated social media compression using lightweight SLAM"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>
                    {isSlamRunning 
                      ? 'Simulating Platform Compression...' 
                      : `⚡ Auto-Simulate for ${sites[activeSiteIndex]?.siteName || 'Platform'} (SLAM)`
                    }
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Site Slots Section Divider */}
        <div className="pt-1 pb-0.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
            {simpleMode ? `Social Media Copies (${sites.length})` : `Site Uploads (${sites.length})`}
          </span>
          <span className="text-[10px] text-neutral-500">
            {simpleMode ? 'Select slot to compare' : 'Active slot compares with Original'}
          </span>
        </div>

        {/* ================= SITE SLOTS LIST ================= */}
        {sites.map((slot, idx) => {
          const isActive = idx === activeSiteIndex;
          const currentSiteDef = SITES_DATABASE.find(s => s.name === slot.siteName) || SITES_DATABASE[0];
          const hasMedia = slot.imageData || slot.videoElement;

          return (
            <div
              key={slot.id}
              onDrop={e => handleDrop(e, idx)}
              onDragOver={handleDragOver}
              className={`p-2.5 rounded-lg border transition-all relative ${
                isActive
                  ? 'bg-neutral-950 border-blue-500/80 shadow-md ring-1 ring-blue-500/20'
                  : 'bg-neutral-950/50 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              {/* Slot Header: Selection, Thumbnail Preview & Actions */}
              <div className="flex items-center justify-between mb-2 gap-2">
                <div 
                  className="flex items-center gap-2 cursor-pointer min-w-0"
                  onClick={() => setActiveSiteIndex(idx)}
                  title="Click to select this slot for comparison"
                >
                  <input
                    type="radio"
                    name="activeSlot"
                    checked={isActive}
                    onChange={() => setActiveSiteIndex(idx)}
                    className="accent-blue-500 w-3.5 h-3.5 cursor-pointer shrink-0"
                  />

                  {/* Enhanced Small Thumbnail Preview badge */}
                  {slot.thumbnailUrl ? (
                    <div 
                      onClick={e => {
                        e.stopPropagation();
                        setActiveSiteIndex(idx);
                        triggerUpload(idx);
                      }}
                      className="relative w-8 h-8 rounded bg-neutral-900 border border-blue-500/50 overflow-hidden shrink-0 shadow-xs cursor-pointer hover:ring-1 hover:ring-blue-400 transition-all"
                      title="Loaded media thumbnail (Click to replace)"
                    >
                      <img
                        src={slot.thumbnailUrl}
                        alt={`${slot.siteName} preview thumbnail`}
                        className="w-full h-full object-cover"
                      />
                      {slot.isVideo && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <VideoIcon className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div 
                      onClick={e => {
                        e.stopPropagation();
                        triggerUpload(idx);
                      }}
                      className="w-8 h-8 rounded bg-neutral-900 border border-dashed border-neutral-700 flex items-center justify-center shrink-0 text-neutral-500 hover:border-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                      title="Empty slot: click to load file"
                    >
                      <Upload className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-semibold text-xs truncate ${isActive ? 'text-blue-300' : 'text-neutral-300'}`}>
                        Slot {idx + 1}: {slot.siteName}
                      </span>
                      {hasMedia && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" title="Media loaded" />
                      )}
                    </div>
                    <div className="text-[10px] text-neutral-500 truncate max-w-[150px]">
                      {hasMedia ? (slot.name || slot.siteName) : (simpleMode ? 'Waiting for upload' : 'Empty slot')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {sites.length > 1 && (
                    <button
                      onClick={() => onRemoveSiteSlot(idx)}
                      className="text-neutral-500 hover:text-red-400 transition-colors p-1"
                      title="Remove this site slot"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Fuzzy Site Dropdown */}
              <div className="relative mb-2">
                <div
                  onClick={() => setDropdownOpen(prev => ({ ...prev, [idx]: !prev[idx] }))}
                  className="w-full flex items-center justify-between bg-neutral-900 px-2 py-1.5 rounded border border-neutral-700 text-neutral-200 hover:border-neutral-600 cursor-pointer"
                >
                  <span className="font-medium truncate">
                    {simpleMode ? `Platform: ${slot.siteName}` : slot.siteName}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                </div>

                {/* Dropdown Menu */}
                {dropdownOpen[idx] && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-neutral-900 border border-neutral-700 rounded-md shadow-xl z-30 max-h-56 overflow-y-auto p-1">
                    <div className="px-1 pb-1">
                      <div className="flex items-center bg-neutral-950 px-2 py-1 rounded border border-neutral-800">
                        <Search className="w-3 h-3 text-neutral-500 mr-1.5" />
                        <input
                          type="text"
                          placeholder={simpleMode ? "Search website (Instagram, Twitter...)" : "Fuzzy search (ig, twtr, fb...)"}
                          value={siteQuery[idx] || ''}
                          onChange={e => setSiteQuery(prev => ({ ...prev, [idx]: e.target.value }))}
                          className="bg-transparent text-neutral-200 outline-none w-full text-xs"
                          autoFocus
                        />
                      </div>
                    </div>
                    {searchSites(siteQuery[idx] || '').map(s => (
                      <div
                        key={s.name}
                        onClick={() => {
                          onSiteChange(idx, s.name);
                          setDropdownOpen(prev => ({ ...prev, [idx]: false }));
                        }}
                        className={`px-2 py-1.5 rounded cursor-pointer transition-colors ${
                          s.name === slot.siteName
                            ? 'bg-blue-600 text-white'
                            : 'hover:bg-neutral-800 text-neutral-300'
                        }`}
                      >
                        <div className="font-medium text-[11px]">{s.name}</div>
                        <div className="text-[9px] text-neutral-400 truncate opacity-70">
                          {s.aliases.join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Site Notes: Simple Mode explanation vs Technical notes */}
              <div className="mb-2 bg-neutral-900/60 p-1.5 rounded border border-neutral-800/60 flex items-start gap-1.5 text-[10px] text-neutral-400">
                <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="line-clamp-2 leading-relaxed">
                  {simpleMode ? (
                    slot.siteName === 'Instagram' ? 'Instagram resizes feed images to 1080px and strips private location info.' :
                    slot.siteName === 'Facebook' ? 'Facebook caps photos at 2048px and re-compresses photos to save mobile data.' :
                    slot.siteName === 'Discord' ? 'Discord serves converted WebP images for fast messaging previews.' :
                    slot.siteName === 'TikTok' ? 'TikTok applies heavy video re-encoding optimized for vertical smartphone screens.' :
                    currentSiteDef.notes
                  ) : (
                    currentSiteDef.notes
                  )}
                </p>
              </div>

              {/* URL Fetch Input */}
              <div className="flex items-center gap-1 mb-2">
                <div className="flex-1 flex items-center bg-neutral-900 px-2 py-1 rounded border border-neutral-800">
                  <LinkIcon className="w-3 h-3 text-neutral-500 mr-1.5 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder={simpleMode ? "Paste image / video link..." : "Paste CDN image / video URL..."}
                    value={urlInputs[idx.toString()] || ''}
                    onChange={e => setUrlInputs(prev => ({ ...prev, [idx.toString()]: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleUrlSubmit(idx);
                    }}
                    className="bg-transparent text-neutral-200 outline-none w-full text-[11px]"
                  />
                </div>
                <button
                  onClick={() => handleUrlSubmit(idx)}
                  className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded border border-neutral-700 transition-colors"
                >
                  Fetch
                </button>
              </div>

              {/* ⚡ SLAM One-Click Platform Simulation Button */}
              {onRunSlamForSlot && !original.isVideo && (
                <button
                  onClick={() => onRunSlamForSlot(idx)}
                  disabled={!original.imageData || isSlamRunning}
                  className={`w-full mb-2 flex items-center justify-center gap-1.5 py-1 px-2 rounded text-[11px] font-medium transition-all shadow-xs ${
                    original.imageData
                      ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/35 hover:border-amber-400/60'
                      : 'bg-neutral-900/60 text-neutral-600 border border-neutral-800/80 cursor-not-allowed'
                  }`}
                  title={
                    original.imageData
                      ? `Use SLAM model to simulate how ${slot.siteName} compresses your original image`
                      : 'Load an Original photo first to simulate social media compression'
                  }
                >
                  <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span>
                    {isSlamRunning 
                      ? 'Simulating...' 
                      : `⚡ Auto-Simulate ${slot.siteName} (SLAM)`}
                  </span>
                </button>
              )}

              {/* Media loaded area: shows clear/replace buttons if loaded, or dropzone if empty */}
              {hasMedia ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] bg-neutral-900/80 px-2 py-1 rounded border border-neutral-800">
                    <span className="text-neutral-400 truncate max-w-[170px]">
                      {slot.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => triggerUpload(idx)}
                        className="text-blue-400 hover:text-blue-300 font-medium"
                      >
                        Replace
                      </button>
                      <button
                        onClick={() => onClearSlot(idx)}
                        className="text-neutral-500 hover:text-red-400"
                        title="Clear media from slot"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => triggerUpload(idx)}
                  className="group relative w-full h-20 rounded bg-neutral-900 border border-neutral-800 overflow-hidden flex flex-col items-center justify-center cursor-pointer hover:border-blue-500/50 transition-colors"
                >
                  <div className="flex flex-col items-center gap-1 text-neutral-400 group-hover:text-neutral-200 transition-colors">
                    <Upload className="w-4 h-4 text-neutral-500 group-hover:text-blue-400 transition-colors" />
                    <span className="font-medium text-center text-[10px]">
                      {simpleMode ? `Drop ${slot.siteName} image here or click to browse` : 'Drop site copy or click to browse'}
                    </span>
                  </div>
                </div>
              )}

              {/* Slot Metadata & Forensics Details */}
              {hasMedia && (
                <div className="mt-2 space-y-1 text-[11px] text-neutral-400 bg-neutral-900/70 p-2 rounded border border-neutral-800/80">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">{simpleMode ? 'Resolution:' : 'Dimensions:'}</span>
                    <span className="font-mono text-neutral-300">
                      {slot.width} × {slot.height} px
                      {original.width > 0 && original.width !== slot.width && (
                        <span className="text-amber-400 ml-1 text-[10px]">
                          {simpleMode ? `(Resized from ${original.width}px)` : `(scaled)`}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">{simpleMode ? 'File Size:' : 'Format & Size:'}</span>
                    <span className="font-mono text-neutral-300">
                      {slot.format.toUpperCase()} · {formatFileSize(slot.fileSize)}
                    </span>
                  </div>

                  {slot.jpegInfo && (
                    <div className="mt-1 pt-1 border-t border-neutral-800 space-y-0.5">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">{simpleMode ? 'Visual Quality:' : 'JPEG Quality:'}</span>
                        <span className="font-mono text-blue-300">
                          {simpleMode 
                            ? getSimpleQualityLabel(slot.jpegInfo.estimatedLumaQuality)
                            : `q${slot.jpegInfo.estimatedLumaQuality} ${slot.jpegInfo.isCustomTable ? '(custom table)' : ''}`
                          }
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-neutral-500">{simpleMode ? 'Color Precision:' : 'Subsampling:'}</span>
                        <span className="font-mono text-neutral-300">
                          {simpleMode 
                            ? (slot.jpegInfo.subsampling === '4:2:0' ? 'Standard Web (Half color resolution)' : 'Full color')
                            : `${slot.jpegInfo.subsampling} · ${slot.jpegInfo.progressive ? 'Prog' : 'Base'}`
                          }
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-neutral-500">{simpleMode ? 'Privacy (EXIF):' : 'Metadata:'}</span>
                        <span className="font-mono text-neutral-300 flex items-center gap-1">
                          {slot.jpegInfo.hasExif || slot.jpegInfo.hasIcc ? (
                            <span className="text-neutral-300">
                              {simpleMode ? 'Camera info kept' : 'EXIF / ICC kept'}
                            </span>
                          ) : (
                            <span className="text-amber-400 flex items-center gap-1">
                              {simpleMode ? (
                                <>
                                  <ShieldCheck className="w-3 h-3 text-emerald-400 inline" />
                                  <span>Location & camera info removed (Private)</span>
                                </>
                              ) : (
                                'stripped'
                              )}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Footer */}
      <div className="p-3 border-t border-neutral-800 bg-neutral-900/90 space-y-2">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 cursor-pointer text-neutral-300">
            <input
              type="checkbox"
              checked={autoVisualize}
              onChange={e => setAutoVisualize(e.target.checked)}
              className="accent-blue-500 w-3.5 h-3.5 rounded cursor-pointer"
            />
            <span>{simpleMode ? 'Auto-update comparison' : 'Auto-visualize'}</span>
          </label>
        </div>

        <button
          onClick={onVisualize}
          disabled={isComputing || !original.imageData}
          className="w-full flex items-center justify-center gap-2 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs tracking-wide transition-all shadow-md hover:shadow-blue-900/30 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed"
        >
          {isComputing ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>{simpleMode ? 'Comparing Images...' : 'Computing Metrics...'}</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{simpleMode ? 'Compare Quality Now' : 'Visualize Compression'}</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
