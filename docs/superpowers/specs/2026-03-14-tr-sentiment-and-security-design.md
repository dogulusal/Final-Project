# TR Sentiment Analysis & API Key Security - Design Specification

## 1. Overview
This specification details two critical backend improvements for the AI News Agency platform:
1.  **TR Sentiment Analysis:** Migrating from the English AFINN dictionary used by the `natural` library to a localized Turkish sentiment approach for accurate tagging and sentiment analysis of news articles.
2.  **API Key Security:** Removing exposed API keys and sensitive environment variables from `.env` and hardcoded files, and establishing a secure standard.

## 2. Approach: TR Sentiment Analysis
We will proceed with **Approach A: Custom Local Turkish Dictionary (JSON)**.

### 2.1 Architecture & Implementation
-   **New Artifact:** A JSON file (`src/modules/ml/tr-sentiment-dict.json`) will be created containing a curated list of Turkish words mapped to sentiment scores (ranging from negative to positive).
-   **Dependency:** We continue using `natural` (already in the project). 
-   **Code modification in `ml.service.ts`:**
    -   We bypass `natural.SentimentAnalyzer`'s `afinn` dictionary.
    -   In the `analyzeSentiment(text: string)` method, we will tokenize the Turkish text (using our existing `tokenizeAndStem` from `turkish-stemmer.ts`).
    -   We calculate the total score by looking up each token in `tr-sentiment-dict.json`.
    -   Average/total score thresholds will interpret the output as `Pozitif` (> 0), `Negatif` (< 0), or `Nötr` (0).
    -   **Fallback:** If a word isn't in the dictionary, it impacts the score by 0.

### 2.2 Trade-offs
-   *Pros:* Extremely fast; runs entirely locally without API calls; deterministic. Does not add new heavy dependencies to the project.
-   *Cons:* Lacks contextual understanding (e.g., sarcasm or complex negations like "kötü değildi").

## 3. Approach: API Key Security

### 3.1 Architecture & Implementation
We will avoid complex external Vaults/Secret Managers for now and stick to standard secure development practices.
-   **`.env` Cleanup:**
    -   Remove the raw values of `GEMINI_API_KEY`, `DB_PASSWORD`, `N8N_PASSWORD` and `LLM_API_KEY` in the physical `Final-Project/.env` file. Replace them with placeholder texts like `your_api_key_here`. 
    -   This prevents accidental commits of secrets to version control.
    -   *Action:* Make sure `.env` is listed within `.gitignore` (it should already be, but we will verify).
-   **`.env.example` Creation:**
    -   Create or update a `.env.example` file that contains the variable keys but empty/dummy string values. This communicates the required configuration to other developers without exposing secrets.

## 4. Success Criteria
1.  `ml.service.ts` successfully calculates sentiment scores for Turkish text correctly using the local JSON dictionary without breaking existing tests.
2.  All exposed tokens in `.env` are replaced with dummy values, ensuring no sensitive data is lying plain in the working directory or at risk of being committed.

## 5. Next Steps
1. Request the `spec-document-reviewer` subagent to review this design.
2. Provide the confirmed implementation plan via the `writing-plans` skill once approved by the user.
