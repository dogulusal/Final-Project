# ML Rollback Prep (Task 3.3)

Date: 2026-04-17
Branch: feature/tokenizer-unicode-aware

## Stable Git Targets

- Latest ablation-validated commit: 3885763
- Faz 1 completion commit: e722bfb
- Pre-ablation runtime stabilization commit: 574a6da

Recommended rollback anchor for current branch:
- `3885763` (keeps Task 1.6 decision: content slice 300)

## Stable DB Model Target

Current `model_state` (top row):
- id: 1
- version: 34
- accuracy: 0.7134
- sampleCount: 940
- hasLr: false (NB-only)

Because `model_state` is single-row upsert in this project, DB-level rollback requires:
1. using existing backup snapshots (`backup/model_state_v24_*.sql` if available), or
2. re-training from a known stable git commit and persisting that model state.

## Automatic Rollback Triggers

1. Accuracy < 67.8%
2. Any category F1 < 0.50
3. p95 inference latency > 200ms

## Non-Destructive Rollback Validation Commands

```bash
# Validate revert path without creating a commit
cd backend

# Example: test reverting a candidate unstable commit
cd ..
git revert --no-commit <unstable-commit-hash>

# Cleanup revert staging/worktree safely
git restore --staged .
git restore .
```

## Smoke Checks Before Deployment Approval

```bash
cd backend
npm run build
npm run evaluate:combined
```

## Notes

- Task 3.2 comparison report ran in SELECT-only mode (verified count unchanged).
- Current evaluator output indicates model loaded as NB-only (`hasLr=false`) with low accuracy (~14.79% on 2488 verified rows). This is a release blocker for Faz 2 deployment and should be treated as a debugging gate before production rollout.
