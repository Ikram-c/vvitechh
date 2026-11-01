import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  LogIn, 
  LogOut, 
  Sparkles, 
  Zap, 
  Eye, 
  ExternalLink, 
  RefreshCw, 
  Search, 
  Filter, 
  Upload, 
  Layers, 
  ShieldCheck, 
  Heart, 
  MessageSquare, 
  Share2,
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { SLAM_PRESETS, getPresetForSite } from '../services/slamEngine';

export interface SocialAccount {
  id: string;
  platform: 'instagram' | 'twitter' | 'facebook' | 'reddit' | 'google';
  displayName: string;
  handle: string;
  avatarUrl: string;
  connected: boolean;
  itemCount: number;
  lastSync: string;
  brandColor: string;
  platformName: string;
}

export interface SocialPostImage {
  id: string;
  platform: 'instagram' | 'twitter' | 'facebook' | 'reddit' | 'google';
  title: string;
  caption: string;
  url: string;
  thumbnailUrl: string;
  date: string;
  likes: number;
  comments: number;
  originalDimensions: string;
  targetPlatformDimensions: string;
  tags: string[];
}

const DEFAULT_ACCOUNTS: SocialAccount[] = [
  {
    id: 'instagram',
    platform: 'instagram',
    displayName: 'Alex Studio',
    handle: '@alex.creative',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    connected: true,
    itemCount: 42,
    lastSync: 'Just now',
    brandColor: 'from-pink-500 via-rose-500 to-amber-500',
    platformName: 'Instagram'
  },
  {
    id: 'twitter',
    platform: 'twitter',
    displayName: 'Alex Morgan',
    handle: '@alex_visuals',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    connected: true,
    itemCount: 68,
    lastSync: '2 hrs ago',
    brandColor: 'from-sky-500 to-blue-600',
    platformName: 'X (Twitter)'
  },
  {
    id: 'facebook',
    platform: 'facebook',
    displayName: 'Alex M Photography',
    handle: 'facebook.com/alexmphotos',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    connected: true,
    itemCount: 115,
    lastSync: 'Yesterday',
    brandColor: 'from-blue-600 to-indigo-700',
    platformName: 'Facebook'
  },
  {
    id: 'reddit',
    platform: 'reddit',
    displayName: 'PixelArchivist',
    handle: 'u/pixel_archivist',
    avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
    connected: false,
    itemCount: 19,
    lastSync: 'Not synced',
    brandColor: 'from-orange-500 to-red-600',
    platformName: 'Reddit'
  },
  {
    id: 'google',
    platform: 'google',
    displayName: 'Alex Cloud Library',
    handle: 'alex.morgan.creative@gmail.com',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    connected: true,
    itemCount: 340,
    lastSync: '10 mins ago',
    brandColor: 'from-emerald-500 to-teal-600',
    platformName: 'Google Photos'
  }
];

const SAMPLE_POSTS: SocialPostImage[] = [
  {
    id: 'post-ig-1',
    platform: 'instagram',
    title: 'Neon Cyberpunk Street',
    caption: 'Vivid neon lights reflection after a midnight rain in Neo-Tokyo. High saturation and subtle chromatic contrast.',
    url: '/samples/original.png',
    thumbnailUrl: '/samples/instagram.jpg',
    date: 'Oct 24, 2026',
    likes: 1420,
    comments: 86,
    originalDimensions: '1920 × 1080',
    targetPlatformDimensions: '1080 × 608 (Instagram 1080p cap)',
    tags: ['cyberpunk', 'neon', 'cityscape', 'lighting']
  },
  {
    id: 'post-ig-2',
    platform: 'instagram',
    title: 'Golden Hour Mountain Ridge',
    caption: 'Sunset hues casting long shadows across alpine peaks. Fine gradients test 8-bit banding artifacts.',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=2000&auto=format&fit=crop&q=95',
    thumbnailUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&auto=format&fit=crop&q=75',
    date: 'Oct 21, 2026',
    likes: 2180,
    comments: 112,
    originalDimensions: '2000 × 1333',
    targetPlatformDimensions: '1080 × 720 (Instagram Feed)',
    tags: ['mountains', 'goldenhour', 'landscape', 'gradients']
  },
  {
    id: 'post-tw-1',
    platform: 'twitter',
    title: 'Studio Portrait Color & Texture',
    caption: 'Clean studio lighting highlighting skin pores, fabric weave, and intricate hair details.',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=2400&auto=format&fit=crop&q=95',
    thumbnailUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
    date: 'Oct 22, 2026',
    likes: 840,
    comments: 45,
    originalDimensions: '2400 × 3600',
    targetPlatformDimensions: '2048 × 3072 (Twitter 2048p)',
    tags: ['portrait', 'studio', 'sharpness', 'skin']
  },
  {
    id: 'post-tw-2',
    platform: 'twitter',
    title: 'Architecture Geometric Lines',
    caption: 'Brutalist concrete architecture with crisp edges, checking high-frequency ringing and mosquito noise.',
    url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=2000&auto=format&fit=crop&q=95',
    thumbnailUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop&q=80',
    date: 'Oct 19, 2026',
    likes: 620,
    comments: 29,
    originalDimensions: '2000 × 1333',
    targetPlatformDimensions: '2048 × 1365 (Twitter Web)',
    tags: ['architecture', 'geometry', 'concrete', 'edges']
  },
  {
    id: 'post-fb-1',
    platform: 'facebook',
    title: 'Tropical Ocean Coastline',
    caption: 'Turquoise ocean water ripples against white sand. High chroma saturation reveals 4:2:0 subsampling bleed.',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=2000&auto=format&fit=crop&q=95',
    thumbnailUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=75',
    date: 'Oct 18, 2026',
    likes: 310,
    comments: 18,
    originalDimensions: '2000 × 1333',
    targetPlatformDimensions: '2048 × 1365 (Facebook HQ)',
    tags: ['beach', 'ocean', 'turquoise', 'ripples']
  },
  {
    id: 'post-rd-1',
    platform: 'reddit',
    title: 'Infographic & UI Typography Render',
    caption: 'Red, cyan, and white vector typography over deep black. Ideal test for JPEG 4:2:0 color decimation & block artifacts.',
    url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=2000&auto=format&fit=crop&q=95',
    thumbnailUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=78',
    date: 'Oct 15, 2026',
    likes: 950,
    comments: 134,
    originalDimensions: '2000 × 1125',
    targetPlatformDimensions: '1920 × 1080 (Reddit WebP)',
    tags: ['typography', 'charts', 'subsampling', 'infographic']
  },
  {
    id: 'post-g-1',
    platform: 'google',
    title: 'Macro Autumn Leaf Veins',
    caption: 'Extreme close-up revealing cellular structure, moisture droplets, and complex organic micro-textures.',
    url: 'https://images.unsplash.com/photo-1508873696983-2df5293cb32f?w=2400&auto=format&fit=crop&q=95',
    thumbnailUrl: 'https://images.unsplash.com/photo-1508873696983-2df5293cb32f?w=600&auto=format&fit=crop&q=80',
    date: 'Oct 12, 2026',
    likes: 420,
    comments: 25,
    originalDimensions: '2400 × 1600',
    targetPlatformDimensions: 'Original Source (Backup)',
    tags: ['macro', 'textures', 'leaf', 'details']
  }
];

interface SocialLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadAsOriginal: (url: string, name: string) => void;
  onLoadToSlot: (slotTarget: number | 'original', url: string, name: string) => void;
  onCompareWithSlam: (url: string, platformName: string, title: string) => void;
  activeSlotName: string;
  activeSlotIndex: number;
  onOpenCausalAnalysis?: () => void;
}

export const SocialLoginModal: React.FC<SocialLoginModalProps> = ({
  isOpen,
  onClose,
  onLoadAsOriginal,
  onLoadToSlot,
  onCompareWithSlam,
  activeSlotName,
  activeSlotIndex,
  onOpenCausalAnalysis
}) => {
  const [accounts, setAccounts] = useState<SocialAccount[]>(() => {
    try {
      const saved = localStorage.getItem('cc_social_accounts');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_ACCOUNTS;
  });

  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'gallery' | 'accounts' | 'import'>('gallery');
  const [notification, setNotification] = useState<string | null>(null);

  // Sync accounts to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('cc_social_accounts', JSON.stringify(accounts));
    } catch {}
  }, [accounts]);

  if (!isOpen) return null;

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(prev => (prev === msg ? null : prev));
    }, 3000);
  };

  const toggleAccountConnection = (id: string) => {
    setAccounts(prev => prev.map(acc => {
      if (acc.id === id) {
        const nextState = !acc.connected;
        showNotification(`${acc.platformName} ${nextState ? 'connected successfully!' : 'disconnected'}`);
        return {
          ...acc,
          connected: nextState,
          lastSync: nextState ? 'Just now' : 'Disconnected'
        };
      }
      return acc;
    }));
  };

  const connectedAccountsCount = accounts.filter(a => a.connected).length;

  const filteredPosts = SAMPLE_POSTS.filter(post => {
    const matchesFilter = selectedFilter === 'all' || post.platform === selectedFilter;
    const matchesAccountConnected = accounts.find(a => a.platform === post.platform)?.connected ?? true;
    const matchesSearch = 
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.caption.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesFilter && matchesAccountConnected && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div 
        className="w-full max-w-4xl max-h-[90vh] bg-neutral-900 border border-neutral-700/80 rounded-xl shadow-2xl flex flex-col overflow-hidden text-neutral-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">Social Media & Cloud Library</h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  {connectedAccountsCount} Accounts Connected
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Browse your social media photos, inspect compression artifacts, and instantly simulate platform re-encoding with SLAM.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenCausalAnalysis && (
              <button
                onClick={() => {
                  onClose();
                  onOpenCausalAnalysis();
                }}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Causal Engagement Model (Causica)</span>
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 py-2.5 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('gallery')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
                activeTab === 'gallery'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>My Photos & Feeds ({filteredPosts.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('accounts')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
                activeTab === 'accounts'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Connected Accounts ({connectedAccountsCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('import')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
                activeTab === 'import'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Custom URL / Link</span>
            </button>
          </div>

          {/* Quick Notification */}
          {notification && (
            <div className="text-[11px] text-emerald-400 font-medium animate-fade-in flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>{notification}</span>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* TAB 1: GALLERY & FEEDS */}
          {activeTab === 'gallery' && (
            <div className="space-y-4">
              {/* Filter & Search Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Platform Filter Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-xs">
                  <button
                    onClick={() => setSelectedFilter('all')}
                    className={`px-2.5 py-1 rounded font-medium transition-all ${
                      selectedFilter === 'all'
                        ? 'bg-neutral-700 text-white'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    All Feeds
                  </button>
                  {accounts.map(acc => (
                    <button
                      key={acc.id}
                      onClick={() => setSelectedFilter(acc.platform)}
                      disabled={!acc.connected}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-medium transition-all ${
                        selectedFilter === acc.platform
                          ? 'bg-neutral-700 text-white'
                          : acc.connected
                            ? 'text-neutral-400 hover:text-neutral-200'
                            : 'text-neutral-600 line-through cursor-not-allowed'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${acc.brandColor}`} />
                      <span>{acc.platformName}</span>
                    </button>
                  ))}
                </div>

                {/* Search input */}
                <div className="flex items-center bg-neutral-950 px-2.5 py-1.5 rounded-lg border border-neutral-800 w-64">
                  <Search className="w-3.5 h-3.5 text-neutral-500 mr-2 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Search photos, tags..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="bg-transparent text-xs text-neutral-200 placeholder-neutral-500 outline-none w-full"
                  />
                </div>
              </div>

              {/* Photo Cards Grid */}
              {filteredPosts.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
                  <Camera className="w-10 h-10 text-neutral-600" />
                  <div className="text-neutral-400 font-medium text-sm">No photos found</div>
                  <p className="text-xs text-neutral-500 max-w-sm">
                    {searchQuery ? 'Try adjusting your search query' : 'Connect this platform in the Accounts tab to view your feed photos.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPosts.map(post => {
                    const acc = accounts.find(a => a.platform === post.platform);
                    const preset = getPresetForSite(post.platform);

                    return (
                      <div
                        key={post.id}
                        className="group bg-neutral-950/80 border border-neutral-800 hover:border-neutral-700 rounded-xl overflow-hidden flex flex-col shadow-sm transition-all"
                      >
                        {/* Image Preview Area */}
                        <div className="relative aspect-4/3 w-full bg-neutral-900 overflow-hidden">
                          <img
                            src={post.thumbnailUrl}
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />

                          {/* Platform Badge Overlay */}
                          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-medium text-white border border-white/10">
                            <span className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${acc?.brandColor || 'from-blue-400 to-indigo-500'}`} />
                            <span>{acc?.platformName || post.platform}</span>
                          </div>

                          {/* Dimensions Badge */}
                          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-mono text-neutral-300 backdrop-blur-sm">
                            {post.originalDimensions}
                          </div>
                        </div>

                        {/* Card Details */}
                        <div className="p-3.5 flex-1 flex flex-col justify-between">
                          <div className="space-y-1.5">
                            <h3 className="font-semibold text-xs text-white group-hover:text-blue-300 transition-colors line-clamp-1">
                              {post.title}
                            </h3>
                            <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">
                              {post.caption}
                            </p>
                            
                            <div className="flex items-center gap-3 text-[10px] text-neutral-500 pt-1">
                              <span className="flex items-center gap-1">
                                <Heart className="w-3 h-3 text-rose-400" />
                                {post.likes}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageSquare className="w-3 h-3 text-neutral-400" />
                                {post.comments}
                              </span>
                              <span>{post.date}</span>
                            </div>
                          </div>

                          {/* Seamless Actions */}
                          <div className="mt-3 pt-2.5 border-t border-neutral-800/80 space-y-1.5">
                            {/* Primary: ⚡ Instant Compare with SLAM */}
                            <button
                              onClick={() => {
                                onCompareWithSlam(post.url, acc?.platformName || 'Instagram', post.title);
                                onClose();
                              }}
                              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-[11px] shadow-sm transition-all"
                              title="Loads original file and simulates target social media compression using lightweight SLAM"
                            >
                              <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                              <span>⚡ Instant Compare (SLAM)</span>
                            </button>

                            {/* Secondary Slot Placement buttons */}
                            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                              <button
                                onClick={() => {
                                  onLoadAsOriginal(post.url, post.title);
                                  showNotification('Loaded into Original slot');
                                }}
                                className="px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 hover:border-neutral-700 transition-colors"
                              >
                                As Original
                              </button>
                              <button
                                onClick={() => {
                                  onLoadToSlot(activeSlotIndex, post.url, post.title);
                                  showNotification(`Loaded into ${activeSlotName}`);
                                }}
                                className="px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 hover:border-neutral-700 transition-colors"
                              >
                                To {activeSlotName}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CONNECTED ACCOUNTS MANAGEMENT */}
          {activeTab === 'accounts' && (
            <div className="space-y-4 max-w-2xl mx-auto">
              <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-1">
                <h3 className="font-semibold text-sm text-white">Social Platform Integrations</h3>
                <p className="text-xs text-neutral-400">
                  Connect your accounts to securely access your media library and test platform-specific compression pipelines in real time.
                </p>
              </div>

              <div className="space-y-3">
                {accounts.map(acc => (
                  <div
                    key={acc.id}
                    className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-neutral-700 shrink-0">
                        <img 
                          src={acc.avatarUrl} 
                          alt={acc.displayName}
                          className="w-full h-full object-cover" 
                        />
                        <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-neutral-950 bg-gradient-to-r ${acc.brandColor}`} />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-white">{acc.displayName}</span>
                          <span className="text-xs text-neutral-500 font-mono">{acc.handle}</span>
                        </div>
                        <div className="text-[11px] text-neutral-400 flex items-center gap-2 mt-0.5">
                          <span className="font-medium text-neutral-300">{acc.platformName}</span>
                          <span>•</span>
                          <span>{acc.itemCount} synced photos</span>
                          <span>•</span>
                          <span className="text-neutral-500">{acc.lastSync}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleAccountConnection(acc.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        acc.connected
                          ? 'bg-neutral-800 hover:bg-red-950/40 text-neutral-300 hover:text-red-300 border border-neutral-700 hover:border-red-800/60'
                          : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
                      }`}
                    >
                      {acc.connected ? (
                        <>
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Disconnect</span>
                        </>
                      ) : (
                        <>
                          <LogIn className="w-3.5 h-3.5" />
                          <span>Connect</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOM URL / LINK IMPORT */}
          {activeTab === 'import' && (
            <div className="space-y-4 max-w-xl mx-auto py-4">
              <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-2">
                <h3 className="font-semibold text-sm text-white">Import from Direct URL or Social CDN</h3>
                <p className="text-xs text-neutral-400">
                  Paste any public image URL (Instagram CDN, Twitter twimg.com, Facebook fbcdn.net, Reddit or Unsplash).
                </p>

                <div className="pt-2">
                  <div className="flex items-center bg-neutral-900 px-3 py-2 rounded-lg border border-neutral-700">
                    <input
                      type="text"
                      placeholder="https://... image URL"
                      value={customUrl}
                      onChange={e => setCustomUrl(e.target.value)}
                      className="bg-transparent text-xs text-neutral-200 placeholder-neutral-500 outline-none w-full"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    disabled={!customUrl.trim()}
                    onClick={() => {
                      if (customUrl.trim()) {
                        onCompareWithSlam(customUrl.trim(), 'Instagram', 'Custom Imported Image');
                        onClose();
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs disabled:bg-neutral-800 disabled:text-neutral-500 transition-colors"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                    <span>⚡ Compare with SLAM</span>
                  </button>

                  <button
                    disabled={!customUrl.trim()}
                    onClick={() => {
                      if (customUrl.trim()) {
                        onLoadAsOriginal(customUrl.trim(), 'Imported URL');
                        onClose();
                      }
                    }}
                    className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 disabled:opacity-40 transition-colors"
                  >
                    Load as Original
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Lightweight SLAM model replicates platform MozJPEG, Lanczos resample, and 4:2:0 chroma decimation locally.</span>
          </div>

          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
