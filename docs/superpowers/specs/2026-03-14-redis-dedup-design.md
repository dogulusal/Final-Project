# Redis Deduplication & Performance - Design Specification

## 1. Overview
Currently, the system checks for duplicate news articles by querying the PostgreSQL database for the last 50 entries and calculating Jaro-Winkler distances in-memory. As the volume of news ingestion increases (from 100 to 500+ daily), this database-heavy check will become a bottleneck. We will introduce Redis to act as a fast-access deduplication layer.

## 2. Approach: Redis Hash Sets & Bloom Filter
We will use Redis to store hashes of processed news titles. Before any database operation, we will check Redis.

### 2.1 Architecture & Implementation
- **Redis Integration:** Add a Redis service to `docker-compose.yml`.
- **Backend Dependency:** Install `ioredis`.
- **Deduplication Logic:**
  1. For every new article title, generate a "Fingerprint" (e.g., lowercase, Turkish characters normalizer, whitespace-free hash).
  2. Store these fingerprints in a Redis Set (`news:fingerprints`) with a TTL (Time To Live) of 48 hours (standard window for news freshness).
  3. **Multi-level Check:**
     - **Level 1 (Exact Hash Match):** Fast check in Redis Set. If exists, it's a definite duplicate.
     - **Level 2 (Semantic Similarity):** If Level 1 passes, we still perform the Jaro-Winkler check against the last 50 items (cached in Redis as a List to avoid DB hit).
- **Automation:** Every time a new news item is saved to DB, the Redis cache and Set are updated.

### 2.2 Trade-offs
- *Pros:* Drastically reduces PostgreSQL `SELECT` queries during ingestion. Scaling ingestion to 1000s of items becomes feasible.
- *Cons:* Introduces Redis as a new infrastructure dependency. Requires cache invalidation/sync logic.

## 3. Success Criteria
1. Redis service is running and accessible by the backend.
2. `NewsService.isDuplicate` uses Redis cache before falling back to DB.
3. Ingestion speed improves as DB hits are minimized.

## 4. Next Steps
1. Update `docker-compose.yml`.
2. Implement Redis Client wrapper in `backend/src/config/redis.ts`.
3. Update `news.service.ts`.
