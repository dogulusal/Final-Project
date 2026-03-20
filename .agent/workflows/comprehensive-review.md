---
description: Run a comprehensive code review using all agent skills
---

1. Run Deep Security Audit (Security Auditor Skill)
   - Perform a rigorous dependency audit (`npm audit`) in both `backend` and `frontend`.
   - Scan for hardcoded secrets/API keys using advanced `grep` (e.g., searching for "AIza", "secret", "api_key").
   - Review controllers and models for injection risks (SQL, shell) and verify that all sensitive endpoints have proper authentication.

2. Run System Health Check (Health Check Workflow)
   - Verify core API connectivity (e.g., `/api/admin/stats`, `/api/ml/train`).
   - Validate Database stability (Prisma connection check) and confirm integration with external services (LLM APIs like Gemini, local ML services, Redis).

3. Run Refactoring & Architectural Analysis (Refactoring Advisor Skill)
   - Hunt for DRY principle violations, "magic strings", and cyclic complexity.
   - Enforce project conventions (backend-conventions.md): verify try-catch usage, centralized logging, and proper error handling.

4. Run Performance Profiling (Performance Profiler Skill)
   - Detect N+1 query problems specifically within loop operations (e.g., RSS processing).
   - Analyze Redis/Cache intensity, I/O bottlenecks (image rendering, LLM calls), and potential memory leaks in persistent states.

5. Run Autonomous Testing (Test Engineer Skill)
   - Execute existing tests (`npm test`) and analyze coverage gaps.
   - Generate new unit tests for critical paths: focus on security middleware, ML confidence logic, and data aggregation.
   - Perform Edge Case Validation: test with null inputs, empty database states, and simulated network failures.

6. Generate Audit Report
   - Summarize findings in a standardized format:
     - 🔴 **Critical**: Unprotected endpoints, data loss risks, severe N+1 bottlenecks.
     - 🟡 **Warning**: Technical debt, DRY violations, missing coverage.
     - 🟢 **Info**: Minor performance tips, code style improvements.

7. Finalize and Commit (Analyze Project Changes Workflow)
   - Run a final lint and type check (`npx tsc --noEmit` and `npm run lint`).
   - If clean, stage and commit the changes safely with a descriptive summary of all optimizations and fixes.
