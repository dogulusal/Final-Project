/**
 * Environment variable validation
 * Checks for required env vars on startup
 */

export interface EnvValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

export function validateEnvironment(): EnvValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // === Backend Required Variables ===
    const requiredEnvVars = [
        'DATABASE_URL',
        'JWT_SECRET',
        'NODE_ENV',
        'PORT',
    ];

    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            errors.push(`Missing required environment variable: ${envVar}`);
        }
    }

    // === Backend Optional But Important ===
    const recommendedEnvVars = [
        'LLM_API_KEY',
    ];

    for (const envVar of recommendedEnvVars) {
        if (!process.env[envVar]) {
            warnings.push(`Missing recommended environment variable: ${envVar}`);
        }
    }

    // === Validate JWT_SECRET strength ===
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
        warnings.push('JWT_SECRET is shorter than recommended (32+ characters)');
    }

    if (process.env.NODE_ENV === 'production') {
        if (!process.env.LLM_API_KEY) {
            warnings.push('LLM_API_KEY eksik: production ortamda LLM tabanlı içerik zenginleştirme devre dışı kalabilir');
        }

        const originsRaw = process.env.CORS_ALLOWED_ORIGINS || '';
        const origins = originsRaw
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);

        if (origins.length === 0) {
            warnings.push('CORS_ALLOWED_ORIGINS boş: production ortamda CORS kuralı beklenenden daha geniş olabilir');
        }
    }

    // === Validate NODE_ENV ===
    const validNodeEnv = ['development', 'production', 'test'];
    if (process.env.NODE_ENV && !validNodeEnv.includes(process.env.NODE_ENV)) {
        errors.push(`Invalid NODE_ENV: ${process.env.NODE_ENV}. Must be one of: ${validNodeEnv.join(', ')}`);
    }

    // === Validate PORT ===
    const port = parseInt(process.env.PORT || '', 10);
    if (isNaN(port) || port < 1 || port > 65535) {
        errors.push(`Invalid PORT: ${process.env.PORT}. Must be a number between 1 and 65535`);
    }

    // === Database URL format check ===
    if (process.env.DATABASE_URL) {
        const isPgURL = process.env.DATABASE_URL.startsWith('postgresql://') ||
                        process.env.DATABASE_URL.startsWith('postgres://');
        if (!isPgURL) {
            errors.push('DATABASE_URL must be a PostgreSQL connection string (postgresql:// or postgres://)');
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

export function logValidationResults(result: EnvValidationResult): void {
    if (result.warnings.length > 0) {
        console.log('[ENV] Warnings:');
        result.warnings.forEach(w => console.log(`  ⚠️  ${w}`));
    }

    if (result.errors.length > 0) {
        console.error('[ENV] Errors:');
        result.errors.forEach(e => console.error(`  ❌ ${e}`));
        throw new Error('Environment validation failed. Cannot start server.');
    }

    console.log('[ENV] ✅ All required environment variables are set.');
}
