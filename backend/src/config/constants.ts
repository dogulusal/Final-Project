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

// --- Güvenlik ---
export const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'ag-agency-secret-token-2026';


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
    { id: 'haberturk-spor', name: 'Habertürk Spor', url: 'https://www.haberturk.com/rss/spor.xml', category: 'Spor' },
    { id: 'aa-spor', name: 'Anadolu Ajansı Spor', url: 'https://www.aa.com.tr/tr/rss/default?cat=spor', category: 'Spor' },
    { id: 'trthaber-spor', name: 'TRT Haber Spor', url: 'https://www.trthaber.com/spor_articles.rss', category: 'Spor' },
    { id: 'aa-ekonomi', name: 'Anadolu Ajansı Ekonomi', url: 'https://www.aa.com.tr/tr/rss/default?cat=ekonomi', category: 'Ekonomi' },
    { id: 'trthaber-ekonomi', name: 'TRT Haber Ekonomi', url: 'https://www.trthaber.com/ekonomi_articles.rss', category: 'Ekonomi' },
    { id: 'hurriyet-spor', name: 'Hürriyet Spor', url: 'https://www.hurriyet.com.tr/rss/spor', category: 'Spor' },
    { id: 'haberturk-ekonomi', name: 'Habertürk Ekonomi', url: 'https://www.haberturk.com/rss/ekonomi.xml', category: 'Ekonomi' },
    { id: 'fotomac', name: 'Fotomaç', url: 'https://www.fotomac.com.tr/rss/anasayfa.xml', category: 'Spor' },
    { id: 'trthaber-bilim', name: 'TRT Haber Bilim', url: 'https://www.trthaber.com/bilim_teknoloji_articles.rss', category: 'Teknoloji' },
    { id: 'shiftdelete', name: 'ShiftDelete', url: 'https://shiftdelete.net/feed', category: 'Teknoloji' },
    { id: 'hurriyet-ekonomi', name: 'Hürriyet Ekonomi', url: 'https://www.hurriyet.com.tr/rss/ekonomi', category: 'Ekonomi' },
    { id: 'webtekno', name: 'Webtekno', url: 'https://www.webtekno.com/rss.xml', category: 'Teknoloji' },
    { id: 'donanimhaber', name: 'DonanımHaber', url: 'https://www.donanimhaber.com/rss/tum/', category: 'Teknoloji' },
    { id: 'aa-gundem', name: 'Anadolu Ajansı Gündem', url: 'https://www.aa.com.tr/tr/rss/default?cat=gundem', category: 'Siyaset' },
    { id: 'trthaber-gundem', name: 'TRT Haber Gündem', url: 'https://www.trthaber.com/gundem_articles.rss', category: 'Siyaset' },
    { id: 'hurriyet-teknoloji', name: 'Hürriyet Teknoloji', url: 'https://www.hurriyet.com.tr/rss/teknoloji', category: 'Teknoloji' },
    { id: 'haberturk-gundem', name: 'Habertürk Gündem', url: 'https://www.haberturk.com/rss/manset.xml', category: 'Genel' },
    { id: 'bloomberght', name: 'BloombergHT', url: 'https://www.bloomberght.com/rss', category: 'Ekonomi' },
    { id: 'trthaber-dunya', name: 'TRT Haber Dünya', url: 'https://www.trthaber.com/dunya_articles.rss', category: 'Dünya' },
    { id: 'aa-dunya', name: 'Anadolu Ajansı Dünya', url: 'https://www.aa.com.tr/tr/rss/default?cat=dunya', category: 'Dünya' },
    { id: 'bbc-turkce', name: 'BBC Türkçe', url: 'https://feeds.bbci.co.uk/turkce/rss.xml', category: 'Dünya' },
    { id: 'trthaber-saglik', name: 'TRT Haber Sağlık', url: 'https://www.trthaber.com/saglik_articles.rss', category: 'Sağlık' },
    { id: 'dw-turkce', name: 'DW Türkçe', url: 'https://rss.dw.com/xml/rss-tur-all', category: 'Dünya' },
    { id: 'cumhuriyet-siyaset', name: 'Cumhuriyet Siyaset', url: 'https://www.cumhuriyet.com.tr/rss/3', category: 'Siyaset' },
    { id: 'aa-saglik', name: 'Anadolu Ajansı Sağlık', url: 'https://www.aa.com.tr/tr/rss/default?cat=saglik', category: 'Sağlık' },
    { id: 'cnnturk-anasayfa', name: 'CNN Türk', url: 'https://www.cnnturk.com/feed/rss/all/news', category: 'Genel' },
    { id: 'milliyet-anasayfa', name: 'Milliyet Sondakika', url: 'https://www.milliyet.com.tr/rss/rssnew/sondakikarss.xml', category: 'Genel' },
    { id: 'haberturk-saglik', name: 'Habertürk Sağlık', url: 'https://www.haberturk.com/rss/saglik.xml', category: 'Sağlık' },
    { id: 'cumhuriyet-anasayfa', name: 'Cumhuriyet', url: 'https://www.cumhuriyet.com.tr/rss', category: 'Genel' },
    { id: 'yenisafak', name: 'Yeni Şafak', url: 'https://www.yenisafak.com/rss', category: 'Genel' },
    { id: 'hurriyet-dunya', name: 'Hürriyet Dünya', url: 'https://www.hurriyet.com.tr/rss/dunya', category: 'Dünya' }
];
