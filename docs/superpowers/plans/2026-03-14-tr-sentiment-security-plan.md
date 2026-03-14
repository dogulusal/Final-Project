# TR Sentiment Analysis & API Key Security Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a localized Turkish sentiment analysis custom dictionary and sanitize the `.env` file from exposed sensitive data.

**Architecture:** Moving away from the `natural` English AFINN dictionary, a custom static local JSON dictionary will be parsed and evaluated using tokenized Turkish input in `ml.service.ts`. Sensitive tokens will be redacted from the `.env` file and template will be generated into `.env.example`.

**Tech Stack:** TypeScript, Node.js, `natural` NLP library.

---

## Chunk 1: TR Sentiment Analysis & Security Cleanup

### Task 1: Create the Turkish Sentiment Dictionary

**Files:**
- Create: `backend/src/modules/ml/tr-sentiment-dict.json`

- [ ] **Step 1: Create the JSON Dictionary file**

Create the file `backend/src/modules/ml/tr-sentiment-dict.json` with the following starter content (we will initialize it with a basic yet functional set of positive and negative Turkish words, which can be expanded later by the user):

```json
{
  "iyi": 3,
  "harika": 4,
  "mükemmel": 5,
  "güzel": 3,
  "şahane": 4,
  "başarı": 4,
  "başarılı": 4,
  "mutlu": 3,
  "sevinç": 3,
  "kötü": -3,
  "berbat": -5,
  "iğrenç": -4,
  "çirkin": -3,
  "başarısız": -4,
  "üzgün": -3,
  "kriz": -4,
  "felaket": -5,
  "zarar": -3,
  "tehlike": -3
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/modules/ml/tr-sentiment-dict.json
git commit -m "feat(ml): add initial Turkish sentiment dictionary"
```

### Task 2: Implement TR Sentiment Logic in `ml.service.ts`

**Files:**
- Modify: `backend/src/modules/ml/ml.service.ts`
- Modify: `backend/src/__tests__/ml.service.test.ts` (if sentiment tests exist, we update them. If not, we add a simple test)

- [ ] **Step 1: Update `analyzeSentiment` logic**

Replace the existing `analyzeSentiment` method in `backend/src/modules/ml/ml.service.ts` to read the new JSON file and calculate the score based on the Turkish tokens.

```typescript
    async analyzeSentiment(text: string): Promise<SentimentResult> {
        // Read and parse the custom Turkish dictionary
        const dictPath = path.resolve(__dirname, 'tr-sentiment-dict.json');
        let sentimentDict: Record<string, number> = {};
        
        try {
            if (fs.existsSync(dictPath)) {
                const rawDict = fs.readFileSync(dictPath, 'utf-8');
                sentimentDict = JSON.parse(rawDict);
            } else {
                console.warn('[ML Warn] tr-sentiment-dict.json bulunamadı. Tüm skorlar 0 dönecek.');
            }
        } catch (error) {
            console.error('[ML Error] Sentiment sözlüğü okunamadı:', error);
        }

        // Tokenize text using our Turkish stemmer
        const tokens = tokenizeAndStem(text);
        
        let score = 0;
        tokens.forEach(token => {
            if (sentimentDict[token]) {
                score += sentimentDict[token];
            }
        });
        
        // Output normalization based on threshold
        let label: 'Pozitif' | 'Negatif' | 'Nötr' = 'Nötr';
        if (score > 0) label = 'Pozitif';
        else if (score < 0) label = 'Negatif';

        return { score, label };
    }
```

- [ ] **Step 2: Update/Add Test for TR Sentiment**

Ensure `backend/src/__tests__/ml.service.test.ts` has a test validating this:

```typescript
  describe('Turkish Sentiment Analysis', () => {
    it('should return Pozitif for positive Turkish text', async () => {
      const mlService = new MlCategorizationService();
      const result = await mlService.analyzeSentiment('Bu haber harika ve çok başarılı.');
      expect(result.label).toBe('Pozitif');
      expect(result.score).toBeGreaterThan(0);
    });

    it('should return Negatif for negative Turkish text', async () => {
      const mlService = new MlCategorizationService();
      const result = await mlService.analyzeSentiment('Büyük bir kriz ve felaket yaşandı.');
      expect(result.label).toBe('Negatif');
      expect(result.score).toBeLessThan(0);
    });
  });
```

- [ ] **Step 3: Run the tests to verify**

Run: `cd backend && npm run test -- ml.service.test.ts`
Expected: Tests should pass, confirming the new sentiment method works using the JSON dictionary.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/ml/ml.service.ts backend/src/__tests__/ml.service.test.ts
git commit -m "feat(ml): implement local Turkish sentiment analysis"
```

### Task 3: API Key Security Cleanup

**Files:**
- Modify: `.env`
- Modify/Create: `.env.example`

- [ ] **Step 1: Sanitize `.env` file**

Edit the `.env` file in the root. Replace real sensitive credentials with placeholders. Make sure variables like `DB_PASSWORD`, `GEMINI_API_KEY`, `LLM_API_KEY`, `N8N_PASSWORD` are reset. 

For example:
```dotenv
DB_PASSWORD=your_db_password_here
GEMINI_API_KEY=your_gemini_api_key_here
LLM_API_KEY=your_llm_api_key_here
N8N_PASSWORD=your_n8n_password_here
```

- [ ] **Step 2: Copy to `.env.example`**

Run the following command to make sure the structure is copied to the example file.

```bash
cp .env .env.example
```

- [ ] **Step 3: Check `.gitignore` for `.env`**

Ensure `.env` exists inside the `.gitignore` file so that it will never be committed.

```bash
grep -q "^\.env$" .gitignore || echo ".env" >> .gitignore
```

- [ ] **Step 4: Commit**

```bash
git add .env.example .gitignore
git commit -m "chore(security): sanitize env vars and update example schema"
```
