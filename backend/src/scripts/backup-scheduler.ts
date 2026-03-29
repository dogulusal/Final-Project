import cron, { ScheduledTask } from 'node-cron';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * Backup scheduler: Runs daily database backup at 02:00 UTC
 * 
 * Environment variables:
 * - BACKUP_ENABLED: Set to 'true' to enable (default: true)
 * - BACKUP_SCHEDULE: Cron expression (default: "0 2 * * *" = 02:00 UTC daily)
 * - DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD, etc from .env
 */

interface BackupConfig {
    enabled: boolean;
    schedule: string;
    scriptPath: string;
    logDir: string;
}

class BackupScheduler {
    private config: BackupConfig;
    private task: ScheduledTask | null = null;

    constructor() {
        this.config = {
            enabled: process.env.BACKUP_ENABLED !== 'false',
            schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *', // 02:00 UTC daily
            scriptPath: path.resolve(__dirname, './backup-db.sh'),
            logDir: path.resolve(__dirname, '../backups')
        };
    }

    start(): void {
        if (!this.config.enabled) {
            console.log('[Backup Scheduler] ⏸️  Yedekleme devre dışı (BACKUP_ENABLED=false)');
            return;
        }

        // Create backups directory if not exists
        if (!fs.existsSync(this.config.logDir)) {
            fs.mkdirSync(this.config.logDir, { recursive: true });
        }

        // Validate script exists
        if (!fs.existsSync(this.config.scriptPath)) {
            console.error(`[Backup Scheduler] ❌ Script bulunamadı: ${this.config.scriptPath}`);
            return;
        }

        // Make script executable (Unix-like systems)
        try {
            fs.chmodSync(this.config.scriptPath, 0o755);
        } catch (e) {
            // Windows doesn't require this, silently fail
        }

        // Schedule the backup
        this.task = cron.schedule(this.config.schedule, () => {
            this.executeBackup();
        });

        console.log(`[Backup Scheduler] ✅ Zamanlandı: ${this.config.schedule} UTC`);
        console.log(`[Backup Scheduler] Betik: ${this.config.scriptPath}`);
        console.log(`[Backup Scheduler] Backup dizini: ${this.config.logDir}`);
    }

    private executeBackup(): void {
        const timestamp = new Date().toISOString();
        console.log(`[Backup Scheduler] ${timestamp} Yedekleme başlıyor...`);

        // Set environment variables
        const env = {
            ...process.env,
            BACKUP_DIR: this.config.logDir,
            DATABASE_NAME: process.env.DB_NAME || 'news_db',
            DATABASE_USER: process.env.DB_USER || 'postgres',
            DATABASE_PASSWORD: process.env.DB_PASSWORD || '',
            DATABASE_HOST: process.env.DB_HOST || '127.0.0.1',
            DATABASE_PORT: process.env.DB_PORT || '5432',
            RETENTION_DAYS: process.env.BACKUP_RETENTION_DAYS || '7',
            DOCKER_CONTAINER: process.env.DOCKER_CONTAINER || 'final-project-backend-1'
        };

        // Execute backup script
        exec(`bash "${this.config.scriptPath}"`, { env }, (error, stdout, stderr) => {
            const endTimestamp = new Date().toISOString();
            
            if (error) {
                console.error(`[Backup Scheduler] ${endTimestamp} ❌ Hata: ${error.message}`);
                if (stderr) {
                    console.error(`[Backup Scheduler] stderr: ${stderr}`);
                }
                // TODO: Send alert/email notification on failure
                return;
            }

            console.log(`[Backup Scheduler] ${endTimestamp} ✅ Yedekleme başarılı`);
            if (stdout) {
                stdout.split('\n').filter(line => line).forEach(line => {
                    console.log(`[Backup Scheduler] ${line}`);
                });
            }
        });
    }

    stop(): void {
        if (this.task) {
            this.task.stop();
            console.log('[Backup Scheduler] ⏹️  Yedekleme zamanlaması durduruldu');
        }
    }
}

// Export singleton instance
export const backupScheduler = new BackupScheduler();
