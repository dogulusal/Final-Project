#!/bin/bash

# ============================================
# AI Haber Ajansı — Database Restore Script
# ============================================
# En son veya belirtilen backup'dan restore et
# Restore sonrası data integrity check çalıştır

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-backups}"
DATABASE_NAME="${DATABASE_NAME:-news_db}"
DATABASE_USER="${DATABASE_USER:-postgres}"
DATABASE_HOST="${DATABASE_HOST:-127.0.0.1}"
DATABASE_PORT="${DATABASE_PORT:-5432}"
DOCKER_CONTAINER="${DOCKER_CONTAINER:-final-project-backend-1}"

# Find latest backup
if [ -z "$1" ]; then
    BACKUP_FILE=$(find "$BACKUP_DIR" -type f -name "backup_*.dump.gz" -printf '%T@ %p\n' | sort -rn | head -1 | cut -d' ' -f2-)
    if [ -z "$BACKUP_FILE" ]; then
        echo "❌ Hata: $BACKUP_DIR dizininde backup dosyası bulunamadı"
        exit 1
    fi
else
    BACKUP_FILE="$1"
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Hata: Backup dosyası bulunamadı: $BACKUP_FILE"
    exit 1
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restore başlıyor: $BACKUP_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  DİKKAT: Mevcut veri üzerine yazılacak"
read -p "Devam etmek için 'evet' yazın: " -r
echo

if [[ ! $REPLY =~ ^[Ee][Vv][Ee][Tt]$ ]]; then
    echo "İptal edildi."
    exit 1
fi

# === Method 1: Docker container kullanarak (Production) ===
if command -v docker &> /dev/null && docker ps | grep -q "$DOCKER_CONTAINER"; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Docker container kullanılıyor..."
    
    # Drop existing database
    docker exec -e PGPASSWORD="$DATABASE_PASSWORD" "$DOCKER_CONTAINER" \
        psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -tc \
        "DROP DATABASE IF EXISTS $DATABASE_NAME;"
    
    # Create new database
    docker exec -e PGPASSWORD="$DATABASE_PASSWORD" "$DOCKER_CONTAINER" \
        psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -tc \
        "CREATE DATABASE $DATABASE_NAME;"
    
    # Restore from backup
    docker exec -e PGPASSWORD="$DATABASE_PASSWORD" "$DOCKER_CONTAINER" \
        bash -c "gunzip -c $BACKUP_FILE | psql -h $DATABASE_HOST -p $DATABASE_PORT -U $DATABASE_USER -d $DATABASE_NAME"

# === Method 2: Doğrudan psql (Development) ===
elif command -v psql &> /dev/null; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] psql kullanılıyor (local)..."
    
    # Drop existing database
    PGPASSWORD="$DATABASE_PASSWORD" psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -tc \
        "DROP DATABASE IF EXISTS $DATABASE_NAME;"
    
    # Create new database
    PGPASSWORD="$DATABASE_PASSWORD" psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -tc \
        "CREATE DATABASE $DATABASE_NAME;"
    
    # Restore from backup
    PGPASSWORD="$DATABASE_PASSWORD" gunzip -c "$BACKUP_FILE" | \
        psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME"
else
    echo "❌ Hata: Docker ve psql bulunamadı"
    exit 1
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Restore tamamlandı"

# === Data Integrity Check ===
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Data integrity check yapılıyor..."

# Method 1: Docker
if command -v docker &> /dev/null && docker ps | grep -q "$DOCKER_CONTAINER"; then
    KATEGORI_COUNT=$(docker exec -e PGPASSWORD="$DATABASE_PASSWORD" "$DOCKER_CONTAINER" \
        psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" -tc \
        "SELECT COUNT(*) FROM kategoriler;")
    HABER_COUNT=$(docker exec -e PGPASSWORD="$DATABASE_PASSWORD" "$DOCKER_CONTAINER" \
        psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" -tc \
        "SELECT COUNT(*) FROM haberler;")
# Method 2: Local psql
else
    KATEGORI_COUNT=$(PGPASSWORD="$DATABASE_PASSWORD" psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" -tc \
        "SELECT COUNT(*) FROM kategoriler;")
    HABER_COUNT=$(PGPASSWORD="$DATABASE_PASSWORD" psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" -tc \
        "SELECT COUNT(*) FROM haberler;")
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Kategoriler: ${KATEGORI_COUNT// /} satır"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Haberler: ${HABER_COUNT// /} satır"

if [ "$(echo $KATEGORI_COUNT | tr -d ' ')" -gt 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Data integrity OK"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  UYARI: Kategoriler tablo boş, restore başarısız olabilir"
    exit 1
fi
