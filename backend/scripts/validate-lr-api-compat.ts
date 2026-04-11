import fs from 'fs';
import path from 'path';
import { MlCategorizationService } from '../src/modules/ml/ml.service';

type CheckResult = {
  name: string;
  pass: boolean;
  details: string;
};

function pushResult(results: CheckResult[], name: string, pass: boolean, details: string): void {
  results.push({ name, pass, details });
}

async function main(): Promise<void> {
  const results: CheckResult[] = [];

  try {
    const ml = new MlCategorizationService('logistic-regression', 'unigram-bigram') as any;
    ml.initializeClassifier();

    const classifier = ml.classifier as any;
    const requiredMethods = ['addDocument', 'train', 'classify', 'getClassifications'];
    const missing = requiredMethods.filter((m) => typeof classifier?.[m] !== 'function');

    pushResult(
      results,
      'API surface methods',
      missing.length === 0,
      missing.length === 0 ? 'All required methods found.' : `Missing methods: ${missing.join(', ')}`,
    );

    if (missing.length === 0) {
      classifier.addDocument('meclis oturumu yasa tasarisi', 'Siyaset');
      classifier.addDocument('son dakika genel gelisme', 'Genel');
      classifier.train();

      const predicted = classifier.classify('meclis yasa tasarisi') as string;
      const scores = classifier.getClassifications('meclis yasa tasarisi') as Array<{ label: string; value: number }>;

      const hasScores = Array.isArray(scores) && scores.length > 0;
      pushResult(results, 'Train + classify roundtrip', typeof predicted === 'string' && predicted.length > 0, `Predicted=${predicted}`);
      pushResult(results, 'getClassifications output', hasScores, hasScores ? `scores=${scores.length}` : 'No score rows returned.');
    }

    const serialized = JSON.stringify(classifier);
    const parsed = JSON.parse(serialized);
    pushResult(results, 'Classifier JSON serialization', !!parsed, 'JSON stringify/parse succeeded.');

    const servicePath = path.resolve(__dirname, '../src/modules/ml/ml.service.ts');
    const serviceText = fs.readFileSync(servicePath, 'utf8');

    const hasBayesRestore = serviceText.includes('BayesClassifier') && serviceText.includes('.restore(');
    const hasLogisticRestore = /LogisticRegressionClassifier[\s\S]{0,120}restore\(/.test(serviceText);

    pushResult(
      results,
      'Persistence compatibility (source inspection)',
      hasBayesRestore && hasLogisticRestore,
      `Bayes restore found=${hasBayesRestore}; Logistic restore found=${hasLogisticRestore}`,
    );
  } catch (error) {
    pushResult(results, 'Runtime exception', false, error instanceof Error ? error.message : String(error));
  }

  const failed = results.filter((r) => !r.pass);

  console.log('=== LR API COMPAT VALIDATION ===');
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'} | ${r.name} | ${r.details}`);
  }

  console.log('');
  if (failed.length === 0) {
    console.log('RESULT: PASS');
    process.exit(0);
  }

  console.log(`RESULT: FAIL (${failed.length} checks)`);
  process.exit(1);
}

main().catch((err) => {
  console.error('validate-lr-api-compat failed:', err);
  process.exit(1);
});
