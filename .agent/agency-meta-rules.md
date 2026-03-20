# 🚨 AI News Agency Meta-Rules

This document is a mandatory check for all AI agents working on this project. These rules ensure that project-specific "Superpowers" are never forgotten.

## 1. AI & LLM Logic Changes
- **RULE**: Any change to `llm.service.ts` or any prompt must be reviewed using `.agent/skills/ai-prompt-engineer`.
- **CHECK**: Did you test for bias and instruction clarity?

## 2. Dataset & ML Training
- **RULE**: Before running `npm run training:generate`, run `.agent/skills/dataset-quality-guard`.
- **CHECK**: Is the class balance maintained? Are there broken characters?

## 3. RSS & Data Ingestion
- **RULE**: When adding or debugging news sources, run `.agent/workflows/rss-health-monitor.md`.
- **CHECK**: Are we checking for stale feeds?

## 4. Code Standards (Backend)
- **RULE**: Use `comprehensive-review` workflow for all PR-equivalent work.
- **CHECK**: Are N+1 queries addressed?

---
*Signed by Antigravity - Agency Optimization Engine*
