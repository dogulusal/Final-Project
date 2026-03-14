# Better Stemmer (NLP Integration) - Design Specification

## 1. Overview
This specification details the transition from our naïve regex/suffix-based Turkish stemmer to an official, robust algorithm. While "Zemberek" was initially considered, since Zemberek is built natively in Java and lacks a stable native Node.js package, we will pivot to integrating the widely acclaimed `snowball-stemmers` architecture.

## 2. Approach: Snowball Stemmer Integration
We will replace our custom-built `turkish-stemmer.ts` with `snowball-stemmers` which natively supports the officially implemented Turkish language algorithm. This approach aligns with the NLP requirements without introducing a heavy JVM architecture overhead.

### 2.1 Architecture & Implementation
- **Dependency:** Add `snowball-stemmers` via `npm install snowball-stemmers`.
- **Code modification in `turkish-stemmer.ts`:**
  - Create an instance of the snowball stemmer via `const stemmer = require('snowball-stemmers').newStemmer('turkish');`.
  - Replace the `for` loops that attempt to parse suffixes. Instead, use `stemmer.stem(word)`.
  - Maintain the tokenizer `replace` rules that cleanse non-Turkish characters to keep the data clean before passing it to the stemmer.
  
### 2.2 Trade-offs
- *Pros:* Extremely fast; standard snowball algorithm covers many more edge cases than our custom suffix array. Native to JavaScript, no external server required.
- *Cons:* Not quite as intelligent as a fully context-aware NLP engine like Zemberek (which understands parts of speech), but represents an exponential leap over our current state.

## 3. Success Criteria
1. The `turkish-stemmer.ts` file correctly returns stemmed Turkish words using `snowball-stemmers` without runtime errors.
2. The accuracy and testing pipeline pass as expected.

## 4. Next Steps
Move to the execution plan phase to modify dependencies and `turkish-stemmer.ts`.
