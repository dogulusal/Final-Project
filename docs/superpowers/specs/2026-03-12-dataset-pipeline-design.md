# Dataset Pipeline Design Spec

**Date:** 2026-03-12  
**Status:** Approved (Implemented/Verification in Progress)  
**Topic:** ML Dataset Expansion & Automated Training Pipeline

## 1. Purpose
The project suffered from a "Cold Start" problem where the Naive Bayes classifier only had 30 training samples in a static `dataset.json` file. This led to unreliable categorizations and a hardcoded accuracy metric (0.85). The goal of this pipeline is to automate high-quality data collection from organic RSS sources and establish a continuous learning cycle.

## 2. Architecture & Components

### 2.1. Organic RSS Ingestion (Phase 1)
- **Component:** `constants.ts` & `RssParserService`
- **Design:** Expanded from 1-2 sources to 16 diverse Turkish news outlets (TRT, AA, NTV, BBC Turkish, BloombergHT, etc.).
- **Logic:** Each RSS source is mapped to one of the 6 core categories (Spor, Ekonomi, Teknoloji, Siyaset, Dünya, Sağlık).
- **Update Frequency:** Reduced from 15 min to 10 min. Daily limit increased to 500 news items.

### 2.2. Initial Seed Bootstrapping (Phase 2)
- **Component:** `src/scripts/seed-dataset.ts`
- **Design:** A command-line utility that mass-fetches historical data from all 16 RSS sources in one go.
- **Deduplication:** Uses `NewsService.isDuplicate` (Jaro-Winkler) to prevent saving identical news.
- **Workflow Bypassing:** Saves news directly as `durum: 'hazir'` to bypass LLM/n8n delays for the purpose of training data generation.

### 2.3. Continuous Learning Engine (Phase 3)
- **Component:** `MlCategorizationService`
- **Observer Pattern:** Listens to `new-news` events. Every 50 new approved news items, the model automatically retrains itself from the PostgreSQL database.
- **DB-First Training:** The system prioritizes DB data (`durum: ['hazir', 'yayinda']`) over `dataset.json`.

## 3. Accuracy & Quality Metrics
- **Strategy:** 80/20 Train/Test Split.
- **Computation:** 
  1. Shuffle the dataset.
  2. Train on 80%.
  3. Predict on 20% (unseen data).
  4. Accuracy = Correct Predictions / Test Set Size.
- **Reporting:** Replaced hardcoded `0.85` with `lastAccuracy` computed during the training phase.

## 4. Technical Constraints
- **Language:** Turkish (limited by custom `turkish-stemmer.ts`).
- **Storage:** PostgreSQL (Prisma).
- **Provider:** Decoupled from LLM (RSS meta-data is used as ground truth for labels).

## 5. Success Criteria
- [x] Dataset expanded from 30 to > 1000 items.
- [x] Real-time accuracy computation functional.
- [x] Automated retraining triggered by new news.
- [x] Successful classification of test titles with > 60% accuracy (targeted).

## 6. Future Enhancements
- Integration of Zemberek-NLP for better Turkish stemming.
- Sentiment analysis move from AFINN (English) to Turkish Lexicon.
- Fine-tuning LLMs with the collected >1000 items dataset.
