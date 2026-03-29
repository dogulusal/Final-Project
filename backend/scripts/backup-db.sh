#!/bin/bash

# ============================================
# AI Haber Ajansı — Database Backup Script
# ============================================
# Günlük PostgreSQL yedeklemesi:
# - pg_dump ile database dump'ı al
# - gzip ile sıkıştır
# - backups/ dizinine tarihli dosya kaydet
# - 7 günden eski backup'ları sil

set -e  # Exit on error

# Configuration
BACKUP_DIR="${BACKUP_DIR:-backups}"
DATABASE_NAME="${DATABASE_NAME:-news_db}"
DATABASE_USER="${DATABASE_USER:-postgres}"
DATABASE_HOST="${DATABASE_HOST:-127.0.0.1}"
DATABASE_PORT="${DATABASE_PORT:-5432}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
DOCKER_CONTAINER="${DOCKER_CONTAINER:-final-project-backend-1}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Timestamp for backup file
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.dump.gz"
BACKUP_LOG="$BACKUP_DIR/backup_${TIMESTAMP}.log"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Yedekleme başlıyor: $DATABASE_NAME" | tee -a "$BACKUP_LOG"

# === Method 1: Docker container kullanarak (Production) ===
if command -v docker &> /dev/null && docker ps | grep -q "$DOCKER_CONTAINER"; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Docker container kullanılıyor..." | tee -a "$BACKUP_LOG"
    docker exec -e PGPASSWORD="$DATABASE_PASSWORD" "$DOCKER_CONTAINER" \
        pg_dump -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" \
        2>> "$BACKUP_LOG" | gzip > "$BACKUP_FILE"
# === Method 2: Doğrudan psql (Development) ===
elif command -v pg_dump &> /dev/null; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] pg_dump kullanılıyor (local)..." | tee -a "$BACKUP_LOG"
    PGPASSWORD="$DATABASE_PASSWORD" pg_dump \
        -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" \
        2>> "$BACKUP_LOG" | gzip > "$BACKUP_FILE"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ Hata: Docker ve pg_dump bulunamadı" | tee -a "$BACKUP_LOG"
    exit 1
fi

# Check backup success
if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Yedekleme başarılı: $BACKUP_FILE ($BACKUP_SIZE)" | tee -a "$BACKUP_LOG"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ Hata: Yedekleme dosyası boş veya oluşturulamadı" | tee -a "$BACKUP_LOG"
    exit 1
fi

# === Cleanup: Eski backup'ları sil (RETENTION_DAYS'den eski) ===
echo "[$(date '+%Y-%m-%d %H:%M:%S')] $RETENTION_DAYS gün'den eski backup'lar siliniyor..." | tee -a "$BACKUP_LOG"
find "$BACKUP_DIR" -type f -name "backup_*.dump.gz" -mtime +"$RETENTION_DAYS" | while read -r old_backup; do
    rm -v "$old_backup" | tee -a "$BACKUP_LOG"
done

# === Cleanup: Eski log dosyaları sil ===
find "$BACKUP_DIR" -type f -name "backup_*.log" -mtime +"$RETENTION_DAYS" -delete

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Yedekleme tamamlandı." | tee -a "$BACKUP_LOG"
