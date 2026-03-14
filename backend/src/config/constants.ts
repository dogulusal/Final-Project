import dotenv from 'dotenv';
dotenv.config();

// --- Ortam ---
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const PORT = parseInt(process.env.PORT || '3000', 10);
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// --- Veritabanı ---
export const DATABASE_URL = process.env.DATABASE_URL || '';

// --- LLM Provider ---
export enum LLMProviderType {
    OPENAI = 'openai',
    GEMINI = 'gemini',
    ANTHROPIC = 'anthropic',
    OLLAMA = 'ollama',
}
export const LLM_PROVIDER = (process.env.LLM_PROVIDER || 'ollama') as LLMProviderType;
export const LLM_API_KEY = process.env.LLM_API_KEY || '';
export const LLM_MODEL_NAME = process.env.LLM_MODEL_NAME || '';
export const LLM_BASE_URL = process.env.LLM_BASE_URL || 'http://localhost:11434';
export const LLM_FINE_TUNED_MODEL = process.env.LLM_FINE_TUNED_MODEL || '';
export const LLM_FALLBACK_PROVIDER = process.env.LLM_FALLBACK_PROVIDER || 'ollama';

// --- ML Model ---
export const ML_CONFIDENCE_THRESHOLD = parseFloat(process.env.ML_CONFIDENCE_THRESHOLD || '0.60');

// --- Sosyal Medya ---
export enum SocialMediaMode {
    MOCK = 'mock',
    LIVE = 'live',
}
export const SOCIAL_MEDIA_MODE = (process.env.SOCIAL_MEDIA_MODE || 'mock') as SocialMediaMode;

// --- Cache ---
export const CACHE_TTL_SECONDS = parseInt(process.env.CACHE_TTL_SECONDS || '300', 10);
export const DAILY_NEWS_LIMIT = parseInt(process.env.DAILY_NEWS_LIMIT || '500', 10);

// --- Dedup ---
export const DEDUP_SIMILARITY_THRESHOLD = 0.80;
export const DEDUP_WINDOW_SIZE = 50;

// --- RSS ---
export const RSS_HEALTH_CHECK_TIMEOUT_MS = 30 * 60 * 1000; // 30 dakika
export const RSS_FETCH_INTERVAL_MS = 10 * 60 * 1000; // 10 dakika (15'ten düşürüldü)

// --- Retry ---
export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 15 * 60 * 1000; // 15 dakika

// --- RSS Kaynakları (Seed & n8n İçin) ---
import { IRssSource } from '../modules/rss/rss.interface';

export const RSS_SOURCES: IRssSource[] = [
    // --- Spor ---
    { id: 'trthaber-spor', name: 'TRT Haber Spor', url: 'https://www.trthaber.com/spor_articles.rss', category: 'Spor' },
    { id: 'ntv-spor', name: 'NTV Spor', url: 'https://www.ntvspor.net/son-dakika.rss', category: 'Spor' },
    { id: 'aa-spor', name: 'Anadolu Ajansı Spor', url: 'https://www.aa.com.tr/tr/rss/default?cat=spor', category: 'Spor' },
    // --- Ekonomi ---
    { id: 'trthaber-ekonomi', name: 'TRT Haber Ekonomi', url: 'https://www.trthaber.com/ekonomi_articles.rss', category: 'Ekonomi' },
    { id: 'bloomberght', name: 'BloombergHT', url: 'https://www.bloomberght.com/rss', category: 'Ekonomi' },
    { id: 'aa-ekonomi', name: 'Anadolu Ajansı Ekonomi', url: 'https://www.aa.com.tr/tr/rss/default?cat=ekonomi', category: 'Ekonomi' },
    // --- Teknoloji ---
    { id: 'trthaber-bilim', name: 'TRT Haber Bilim', url: 'https://www.trthaber.com/bilim_teknoloji_articles.rss', category: 'Teknoloji' },
    { id: 'webtekno', name: 'Webtekno', url: 'https://www.webtekno.com/rss.xml', category: 'Teknoloji' },
    { id: 'shiftdelete', name: 'ShiftDelete', url: 'https://shiftdelete.net/feed', category: 'Teknoloji' },
    // --- Siyaset ---
    { id: 'trthaber-gundem', name: 'TRT Haber Gündem', url: 'https://www.trthaber.com/gundem_articles.rss', category: 'Siyaset' },
    { id: 'aa-gundem', name: 'Anadolu Ajansı Gündem', url: 'https://www.aa.com.tr/tr/rss/default?cat=gundem', category: 'Siyaset' },
    // --- Dünya ---
    { id: 'trthaber-dunya', name: 'TRT Haber Dünya', url: 'https://www.trthaber.com/dunya_articles.rss', category: 'Dünya' },
    { id: 'bbc-turkce', name: 'BBC Türkçe', url: 'https://feeds.bbci.co.uk/turkce/rss.xml', category: 'Dünya' },
    { id: 'aa-dunya', name: 'Anadolu Ajansı Dünya', url: 'https://www.aa.com.tr/tr/rss/default?cat=dunya', category: 'Dünya' },
    // --- Sağlık ---
    { id: 'trthaber-saglik', name: 'TRT Haber Sağlık', url: 'https://www.trthaber.com/saglik_articles.rss', category: 'Sağlık' },
    { id: 'aa-saglik', name: 'Anadolu Ajansı Sağlık', url: 'https://www.aa.com.tr/tr/rss/default?cat=saglik', category: 'Sağlık' },
];
