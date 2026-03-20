---
description: Monitor and troubleshoot the health of RSS news sources
---

1. Audit Active Sources
   - Read `src/config/constants.ts` and identify all `RSS_SOURCES`.
   - Execute a diagnostic script to ping each URL and verify it returns a valid XML Feed.

2. Detect Stale Sources
   - query the database for the last news added from each specific source ID.
   - Flag any source that hasn't provided news in the last 24 hours as "Stale".

3. Error Analysis
   - Check `RssScheduler` logs or the `sourceFailures` record.
   - Categorize errors: 🔴 **Down** (404/500), 🟡 **Broken XML** (Parser error), ⚪ **Idle** (No new items).

4. Optimization Suggestions
   - Suggest replacement URLs for dead feeds.
   - Fine-tune `intervalMinutes` for high-frequency sources.

5. Report & Health Update
   - Generate a `RSS_HEALTH_REPORT.md` artifact.
   - Update the `comprehensive-review` if source health impacts the overall system uptime.
