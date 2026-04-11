import fs from 'fs';

type Summary = {
  accuracyMeanPct: number;
  accuracyStdPct: number;
  siyasetF1Mean: number;
  macroF1Mean: number;
};

type PairStats = {
  values: number[];
  mean: number;
};

function parseArg(name: string): string {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) throw new Error(`Missing --${name}=...`);
  return arg.split('=')[1];
}

function parseOptionalArg(name: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return undefined;
  return arg.split('=')[1];
}

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function parseSummary(text: string): Summary {
  const acc = text.match(/Accuracy\s+([0-9.]+)\s*±\s*([0-9.]+)/);
  const macro = text.match(/Macro-F1\s+([0-9.]+)\s*±\s*([0-9.]+)/);
  const siyaset = text.match(/Siyaset F1\s+([0-9.]+)\s*±\s*([0-9.]+)/);

  if (!acc || !macro || !siyaset) {
    throw new Error('Could not parse benchmark summary block.');
  }

  return {
    accuracyMeanPct: Number(acc[1]),
    accuracyStdPct: Number(acc[2]),
    macroF1Mean: Number(macro[1]),
    siyasetF1Mean: Number(siyaset[1]),
  };
}

function parseGenelToSiyasetPairs(text: string): PairStats {
  const rx = /\[ML\]\[Diagnostics\]\[Pair\] Genel -> Siyaset: (\d+)/g;
  const values: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text)) !== null) {
    values.push(Number(m[1]));
  }

  const mean = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
  return { values, mean };
}

function parseLatencyP95(text: string): number {
  const m = text.match(/p95\s+([0-9.]+)/);
  if (!m) throw new Error('Could not parse p95 from latency file.');
  return Number(m[1]);
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function std(values: number[]): number {
  if (values.length <= 1) return 0;
  const mu = mean(values);
  const variance = values.reduce((s, v) => s + Math.pow(v - mu, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function normalCdf(z: number): number {
  // Approximation for standard normal CDF.
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) p = 1 - p;
  return p;
}

function pairedTTestPValue(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 1;
  const diffs = Array.from({ length: n }, (_, i) => a[i] - b[i]);
  const mu = mean(diffs);
  const sd = std(diffs);
  if (sd === 0) return 1;
  const t = mu / (sd / Math.sqrt(n));
  // Normal approximation for two-tailed p-value.
  const p = 2 * (1 - normalCdf(Math.abs(t)));
  return Math.max(0, Math.min(1, p));
}

function parseRunAccuracies(text: string): number[] {
  const rx = /\[Run\s+\d+\]\s+success=[YN]\s+acc=([0-9.]+)/g;
  const values: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text)) !== null) {
    values.push(Number(m[1]));
  }
  return values;
}

function parseCriticalFailures(text: string): number {
  const guardFails = (text.match(/KALIBRE BAŞARISIZ|KALIBRE BASARISIZ/g) || []).length;
  const runFails = (text.match(/success=N/g) || []).length;
  return guardFails + runFails;
}

function main() {
  const nb = parseArg('nb');
  const lr = parseArg('lr');
  const nbLatency = parseArg('nb-latency');
  const lrLatency = parseArg('lr-latency');
  const note = parseOptionalArg('note');

  const nbText = readFile(nb);
  const lrText = readFile(lr);
  const nbLatencyText = readFile(nbLatency);
  const lrLatencyText = readFile(lrLatency);

  const nbSummary = parseSummary(nbText);
  const lrSummary = parseSummary(lrText);

  const nbPair = parseGenelToSiyasetPairs(nbText);
  const lrPair = parseGenelToSiyasetPairs(lrText);

  const nbP95 = parseLatencyP95(nbLatencyText);
  const lrP95 = parseLatencyP95(lrLatencyText);

  const nbRunAcc = parseRunAccuracies(nbText);
  const lrRunAcc = parseRunAccuracies(lrText);
  const pValue = pairedTTestPValue(lrRunAcc, nbRunAcc);

  const deltaAcc = lrSummary.accuracyMeanPct - nbSummary.accuracyMeanPct;
  const deltaMacro = lrSummary.macroF1Mean - nbSummary.macroF1Mean;
  const deltaSiyaset = lrSummary.siyasetF1Mean - nbSummary.siyasetF1Mean;
  const latencyGate = lrP95 <= nbP95 * 1.1;

  const criticalFailures = parseCriticalFailures(lrText);

  console.log('=== BENCHMARK COMPARISON ===');
  console.log(`NB accuracy mean: ${nbSummary.accuracyMeanPct.toFixed(2)}%`);
  console.log(`LR accuracy mean: ${lrSummary.accuracyMeanPct.toFixed(2)}%`);
  console.log(`Delta accuracy  : ${deltaAcc.toFixed(2)} pp`);
  console.log(`Delta macroF1   : ${deltaMacro.toFixed(3)}`);
  console.log(`Delta siyasetF1 : ${deltaSiyaset.toFixed(3)}`);
  console.log('');
  console.log(`NB Genel->Siyaset avg: ${nbPair.mean.toFixed(2)} / run`);
  console.log(`LR Genel->Siyaset avg: ${lrPair.mean.toFixed(2)} / run`);
  console.log('');
  console.log(`NB p95 latency: ${nbP95.toFixed(3)} ms`);
  console.log(`LR p95 latency: ${lrP95.toFixed(3)} ms`);
  console.log(`Latency gate (<= NB*1.10): ${latencyGate ? 'PASS' : 'FAIL'}`);
  console.log('');
  console.log(`Paired t-test p-value (accuracy): ${pValue.toFixed(4)}`);
  console.log(`LR critical failures: ${criticalFailures}`);

  const gateAcc = lrSummary.accuracyMeanPct >= 72.5 || (deltaAcc >= 0.5 && pValue < 0.05);
  const gatePair = lrPair.mean < 3.7;
  const gateGuard = criticalFailures === 0;
  const gateStd = lrSummary.accuracyStdPct <= nbSummary.accuracyStdPct + 0.3;

  console.log('');
  console.log('=== GATE STATUS ===');
  console.log(`G1 Accuracy gate : ${gateAcc ? 'PASS' : 'FAIL'}`);
  console.log(`G2 Pair gate     : ${gatePair ? 'PASS' : 'FAIL'}`);
  console.log(`G3 Guard gate    : ${gateGuard ? 'PASS' : 'FAIL'}`);
  console.log(`G4 Std gate      : ${gateStd ? 'PASS' : 'FAIL'}`);
  console.log(`G5 Latency gate  : ${latencyGate ? 'PASS' : 'FAIL'}`);

  const allPass = gateAcc && gatePair && gateGuard && gateStd && latencyGate;
  console.log('');
  console.log(`FINAL: ${allPass ? 'PROMOTION_ELIGIBLE' : 'PROMOTION_BLOCKED'}`);
  if (note) {
    console.log(`NOTE: ${note}`);
  }
}

main();
