export type SupportedLocale = 'en' | 'es' | 'fr' | 'de' | 'ja';

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'EN',
  es: 'ES',
  fr: 'FR',
  de: 'DE',
  ja: '日本語',
};

export interface LocaleStrings {
  workspace: string;
  media: string;
  compare: string;
  analysis: string;
  batch: string;
  report: string;
  pairLoaded: string;
  loading: string;
  expertMode: string;
  guidedMode: string;
  darkMode: string;
  currentPair: string;
  homeGuide: string;
  overview: string;
}

export const TRANSLATIONS: Record<SupportedLocale, LocaleStrings> = {
  en: {
    workspace: 'WORKSPACE',
    media: 'Media',
    compare: 'Compare',
    analysis: 'Analysis',
    batch: 'Batch',
    report: 'Report',
    pairLoaded: 'Pair loaded',
    loading: 'Loading...',
    expertMode: 'Expert mode',
    guidedMode: 'Guided',
    darkMode: 'Dark mode',
    currentPair: 'CURRENT PAIR',
    homeGuide: 'Home guide',
    overview: 'Overview',
  },
  es: {
    workspace: 'ESPACIO DE TRABAJO',
    media: 'Medios',
    compare: 'Comparar',
    analysis: 'Análisis',
    batch: 'Lotes',
    report: 'Informe',
    pairLoaded: 'Par cargado',
    loading: 'Cargando...',
    expertMode: 'Modo experto',
    guidedMode: 'Guiado',
    darkMode: 'Modo oscuro',
    currentPair: 'PAR ACTUAL',
    homeGuide: 'Guía inicial',
    overview: 'Resumen',
  },
  fr: {
    workspace: 'ESPACE DE TRAVAIL',
    media: 'Médias',
    compare: 'Comparer',
    analysis: 'Analyse',
    batch: 'Lot',
    report: 'Rapport',
    pairLoaded: 'Paire chargée',
    loading: 'Chargement...',
    expertMode: 'Mode expert',
    guidedMode: 'Guidé',
    darkMode: 'Mode sombre',
    currentPair: 'PAIRE ACTUELLE',
    homeGuide: 'Accueil',
    overview: 'Aperçu',
  },
  de: {
    workspace: 'ARBEITSBEREICH',
    media: 'Medien',
    compare: 'Vergleich',
    analysis: 'Analyse',
    batch: 'Stapel',
    report: 'Bericht',
    pairLoaded: 'Paar geladen',
    loading: 'Lädt...',
    expertMode: 'Expertenmodus',
    guidedMode: 'Geführt',
    darkMode: 'Dunkelmodus',
    currentPair: 'AKTUELLES PAAR',
    homeGuide: 'Startseite',
    overview: 'Übersicht',
  },
  ja: {
    workspace: 'ワークスペース',
    media: 'メディア',
    compare: '比較',
    analysis: '分析',
    batch: 'バッチ',
    report: 'レポート',
    pairLoaded: '読み込み完了',
    loading: '読み込み中...',
    expertMode: 'エキスパート',
    guidedMode: 'ガイド',
    darkMode: 'ダークモード',
    currentPair: '現在のペア',
    homeGuide: 'ホームガイド',
    overview: '概要',
  },
};

/**
 * Input Validation & Anti-Infiltration Sanitization Utilities
 */
export function validateAndSanitizeImageUrl(rawInput: string): { valid: boolean; url: string; error?: string } {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { valid: false, url: '', error: 'Please enter an image URL.' };
  }
  // Reject script injection or dangerous schemes
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:text/html') ||
    lower.includes('<script')
  ) {
    return { valid: false, url: '', error: 'Blocked unsafe URL protocol.' };
  }
  if (trimmed.startsWith('/')) {
    return { valid: true, url: trimmed };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, url: '', error: 'Only HTTP and HTTPS image URLs are allowed.' };
    }
    return { valid: true, url: parsed.toString() };
  } catch {
    return { valid: false, url: '', error: 'Malformed URL format.' };
  }
}

export function sanitizeReportName(rawName: string): string {
  // Strip control characters, HTML tags, and path traversal characters
  const cleaned = rawName
    .replace(/[<>"'&\\/|?*:\x00-\x1F]/g, '')
    .replace(/\.\.+/g, '.')
    .trim();
  return cleaned.slice(0, 80) || 'Untitled comparison — Report';
}

export function validateMediaFile(file: File): { valid: boolean; error?: string } {
  const MAX_BYTES = 100 * 1024 * 1024; // 100 MB safety ceiling
  if (file.size <= 0) {
    return { valid: false, error: 'Selected file is empty.' };
  }
  if (file.size > MAX_BYTES) {
    return { valid: false, error: 'File exceeds the 100 MB size limit.' };
  }
  const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(file.name);
  const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(file.name);
  if (!isImage && !isVideo) {
    return { valid: false, error: 'Unsupported file format. Please upload an image or video.' };
  }
  return { valid: true };
}

/**
 * Versioned Workspace Preferences Storage & Migration
 */
const STORAGE_KEY = 'vmit_workspace_prefs';
const CURRENT_SCHEMA_VERSION = 2;

export interface PersistedWorkspacePrefs {
  version: number;
  darkMode: boolean;
  expertMode: boolean;
  locale: SupportedLocale;
  reportFormat: 'PDF' | 'CSV' | 'PNG';
}

export function loadPersistedPrefs(): PersistedWorkspacePrefs {
  const defaults: PersistedWorkspacePrefs = {
    version: CURRENT_SCHEMA_VERSION,
    darkMode: false,
    expertMode: false,
    locale: 'en',
    reportFormat: 'PDF',
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;

    // Schema migration from v1 -> v2
    const migrated: PersistedWorkspacePrefs = {
      version: CURRENT_SCHEMA_VERSION,
      darkMode: Boolean(parsed.darkMode),
      expertMode: Boolean(parsed.expertMode),
      locale: ['en', 'es', 'fr', 'de', 'ja'].includes(parsed.locale) ? parsed.locale : 'en',
      reportFormat: ['PDF', 'CSV', 'PNG'].includes(parsed.reportFormat) ? parsed.reportFormat : 'PDF',
    };
    if (parsed.version !== CURRENT_SCHEMA_VERSION) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    }
    return migrated;
  } catch {
    return defaults;
  }
}

export function savePersistedPrefs(prefs: Omit<PersistedWorkspacePrefs, 'version'>): void {
  try {
    const payload: PersistedWorkspacePrefs = {
      ...prefs,
      version: CURRENT_SCHEMA_VERSION,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors in restricted frames
  }
}
