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
export const DAILY_NEWS_LIMIT = parseInt(process.env.DAILY_NEWS_LIMIT || '100', 10);

// --- Dedup ---
export const DEDUP_SIMILARITY_THRESHOLD = 0.80;
export const DEDUP_WINDOW_SIZE = 50;

// --- RSS ---
export const RSS_HEALTH_CHECK_TIMEOUT_MS = 30 * 60 * 1000; // 30 dakika
export const RSS_FETCH_INTERVAL_MS = 15 * 60 * 1000; // 15 dakika

// --- Retry ---
export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 15 * 60 * 1000; // 15 dakika
