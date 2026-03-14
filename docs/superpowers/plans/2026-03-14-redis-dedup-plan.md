# Redis Deduplication Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a Redis-backed deduplication layer to increase ingestion performance and reduce database load.

**Architecture:** We will add Redis to the stack, use `ioredis` for communication, and implement a two-level check (Exact Hash Match + Semantic Cache) in `NewsService`.

**Tech Stack:** Node.js, Redis, `ioredis`.

---

## Chunk 1: Infrastructure & Connection

### Task 1: Update Docker & Dependencies

**Files:**
- Modify: `docker-compose.yml`
- Modify: `backend/package.json`
- Modify: `backend/.env`

- [ ] **Step 1: Add Redis to docker-compose.yml**

```yaml
  redis:
    image: redis:7-alpine
    restart: always
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  ...
  redis_data:
```

- [ ] **Step 2: Install ioredis**

```bash
cd backend
npm install ioredis
npm install --save-dev @types/ioredis
```

- [ ] **Step 3: Add Redis Environment Variables**

Add these to root `.env` and `backend/.env`:
```dotenv
REDIS_HOST=localhost
REDIS_PORT=6379
```

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml backend/package.json
git commit -m "chore: add redis infrastructure and dependencies"
```

### Task 2: Create Redis Client

**Files:**
- Create: `backend/src/config/redis.ts`

- [ ] **Step 1: Implement Redis Client**

```typescript
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  retryStrategy: (times) => {
    return Math.min(times * 50, 2000);
  }
});

redis.on('error', (err) => console.error('[Redis Error]', err));
redis.on('connect', () => console.log('[Redis] Connected'));

export { redis };
```

---

## Chunk 2: Business Logic

### Task 3: Implement Redis Dedup in NewsService

**Files:**
- Modify: `backend/src/modules/news/news.service.ts`

- [ ] **Step 1: Update isDuplicate to use Redis**

Implement a check against a Redis Set for exact fingerprints.

- [ ] **Step 2: Update cache on successful creation**

When a news item is created, add its fingerprint to Redis and refresh the recent news cache in Redis.

- [ ] **Step 3: Verification**

Run existing tests and manual check.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/news/news.service.ts
git commit -m "feat(news): implement redis-based deduplication"
```
