# Better Stemmer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the snowball-stemmers library to replace our naive Turkish matching logic, improving accuracy of categorized documents.

**Architecture:** We will swap out the `turkishStem(word: string)` implementation within `turkish-stemmer.ts` with the official, mathematically proven snowball stemmer logic ported over to JavaScript.

**Tech Stack:** TypeScript, Node.js, `snowball-stemmers`.

---

## Chunk 1: Snowball Stemmer Integration

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install snowball-stemmers**

```bash
cd backend
npm install snowball-stemmers @types/snowball-stemmers
```

- [ ] **Step 2: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore(ml): dependencies for improved snowball-stemmer"
```

### Task 2: Replace Logic in turkish-stemmer.ts

**Files:**
- Modify: `backend/src/modules/ml/turkish-stemmer.ts`

- [ ] **Step 1: Re-write turkishStem function**

Replace the entire naïve suffix logic with the `snowball-stemmers` architecture in `backend/src/modules/ml/turkish-stemmer.ts`. It should look like this (keep the `tokenizeAndStem` method intact but ensure it imports properly):

```typescript
import natural from 'natural';

// 'snowball-stemmers' might not have types, but let's assume it works with basic import/require
const Snowball = require('snowball-stemmers');
const stemmer = Snowball.newStemmer('turkish');

export function turkishStem(word: string): string {
    if (!word || word.length < 3) return word;
    return stemmer.stem(word.toLowerCase().trim());
}

export function tokenizeAndStem(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-zA-ZçğıöşüÇĞİÖŞÜ\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 2)
        .map(word => turkishStem(word));
}
```

- [ ] **Step 2: Check Tests**

```bash
cd backend
npm run test -- ml.service.test.ts
```
Expected: Tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/ml/turkish-stemmer.ts
git commit -m "feat(ml): integrate official snowball turkish stemmer"
```
