const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const backend = path.resolve(__dirname, '..');
const mlPath = path.join(backend, 'src/modules/ml/ml.service.ts');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const nodePath = process.execPath;
const tsNodeBin = path.join(backend, 'node_modules', 'ts-node', 'dist', 'bin.js');
const ablationScript = path.join(backend, 'src', 'scripts', 'ablation-nb.ts');

// Read without BOM to avoid re-writing with BOM on Windows
let original = fs.readFileSync(mlPath);
if (original[0] === 0xef && original[1] === 0xbb && original[2] === 0xbf) {
  original = original.slice(3);
}
const originalStr = original.toString('utf8');

function replaceStrict(text, oldText, newText, label) {
  if (!text.includes(oldText)) {
    throw new Error(`Replacement target not found for ${label}`);
  }
  return text.replace(oldText, newText);
}

function scenarioContent(name, base) {
  // base is the originalStr (string), not the Buffer
  let text = base;

  if (name === 'baseline') return text;

  if (name === 'no-task11') {
    text = replaceStrict(text, 'const dunyaToSiyaset = injectFromPool(dunyaSiyasetPool, 10);', 'const dunyaToSiyaset = injectFromPool(dunyaSiyasetPool, 0);', 'task11-dunyaToSiyaset');
    text = replaceStrict(text, 'const siyasetToDunya = injectFromPool(siyasetDunyaPool, 10);', 'const siyasetToDunya = injectFromPool(siyasetDunyaPool, 0);', 'task11-siyasetToDunya');
    return text;
  }

  if (name === 'no-task12') {
    return replaceStrict(text, "let cap = category === 'Siyaset' ? 0.08 : 0.18;", "let cap = category === 'Siyaset' ? 0.13 : 0.18;", 'task12-cap');
  }

  if (name === 'no-task13') {
    return replaceStrict(text, "news.icerik ? news.icerik.slice(0, 800) : ''", "news.icerik ? news.icerik.slice(0, 300) : ''", 'task13-slice');
  }

  if (name === 'no-task14') {
    const healthRegex = /\s*'Sağlık':\s*\[[\s\S]*?\],\r?\n\s*'Genel':\s*\[/;
    const healthReplacement = "\n            'Sağlık': ['hastane', 'doktor', 'aşı', 'salgın', 'kanser', 'tedavi', 'sağlık', 'ameliyat'],\n            'Genel': [";
    if (!healthRegex.test(text)) {
      throw new Error('Replacement target not found for task14-health');
    }
    return text.replace(healthRegex, healthReplacement);
  }

  if (name === 'no-task15') {
    return replaceStrict(text, 'const ekonomiToTeknoloji = injectFromPool(ekonomiTechPool, 8);', 'const ekonomiToTeknoloji = injectFromPool(ekonomiTechPool, 0);', 'task15-ekonomi-tech');
  }

  throw new Error(`Unknown scenario: ${name}`);
}

function runScenario(name) {
  const content = scenarioContent(name, originalStr);
  fs.writeFileSync(mlPath, Buffer.from(content, 'utf8'));

  const logFileName = `ablation-${name}-${stamp}.log`;
  const logPath = path.join(backend, logFileName);
  const logFd = fs.openSync(logPath, 'w');
  const run = spawnSync(
    nodePath,
    [tsNodeBin, '--project', 'tsconfig.scripts.json', ablationScript],
    {
      cwd: backend,
      stdio: ['ignore', logFd, logFd],
      timeout: 240000,
    },
  );
  fs.closeSync(logFd);

  let fullOut = '';
  if (fs.existsSync(logPath)) {
    fullOut = fs.readFileSync(logPath, 'utf8');
  } else {
    fullOut = `${run.stdout || ''}\n${run.stderr || ''}`;
    fs.writeFileSync(logPath, fullOut, 'utf8');
  }

  const m = fullOut.match(/\[ML\]\[Diagnostics\] Accuracy=%([0-9]+\.[0-9]+)/);
  const acc = m ? Number(m[1]) : NaN;

  const d = fullOut.match(/\[ML\]\[Diagnostics\]\[TopPair [0-9]+\] Dünya -> Siyaset: ([0-9]+)/);
  const g = fullOut.match(/\[ML\]\[Diagnostics\]\[TopPair [0-9]+\] Genel -> Siyaset: ([0-9]+)/);

  return {
    scenario: name,
    exitCode: run.status,
    spawnError: run.error ? run.error.message : '',
    accuracyPct: acc,
    dunyaToSiyaset: d ? Number(d[1]) : -1,
    genelToSiyaset: g ? Number(g[1]) : -1,
    logPath,
  };
}

const scenarios = ['baseline', 'no-task11', 'no-task12', 'no-task13', 'no-task14', 'no-task15'];
const results = [];

try {
  for (const s of scenarios) {
    console.log(`=== Running ${s} ===`);
    const r = runScenario(s);
    results.push(r);
    console.log(`done ${s}: exit=${r.exitCode}, acc=${Number.isNaN(r.accuracyPct) ? 'NaN' : r.accuracyPct}`);
  }
} finally {
  // Restore original without BOM
  fs.writeFileSync(mlPath, Buffer.from(originalStr, 'utf8'));
}

const baseline = results.find((r) => r.scenario === 'baseline');
if (!baseline || Number.isNaN(baseline.accuracyPct)) {
  throw new Error(`Baseline result missing or invalid: ${JSON.stringify(baseline)}`);
}

const mapped = results.map((r) => ({
  ...r,
  deltaPositiveForTask: Number.isNaN(r.accuracyPct) ? NaN : Number((baseline.accuracyPct - r.accuracyPct).toFixed(2)),
}));

const outJson = path.join(backend, `ablation-summary-${stamp}.json`);
const outCsv = path.join(backend, `ablation-summary-${stamp}.csv`);

fs.writeFileSync(outJson, JSON.stringify(mapped, null, 2), 'utf8');

const csvHeader = 'scenario,accuracyPct,deltaPositiveForTask,dunyaToSiyaset,genelToSiyaset,exitCode,logPath';
const csvLines = mapped.map((r) => [
  r.scenario,
  Number.isNaN(r.accuracyPct) ? '' : r.accuracyPct,
  Number.isNaN(r.deltaPositiveForTask) ? '' : r.deltaPositiveForTask,
  r.dunyaToSiyaset,
  r.genelToSiyaset,
  r.exitCode,
  r.logPath.replace(/,/g, ';'),
].join(','));
fs.writeFileSync(outCsv, [csvHeader, ...csvLines].join('\n'), 'utf8');

console.table(mapped.map((r) => ({
  scenario: r.scenario,
  accuracyPct: r.accuracyPct,
  deltaPositiveForTask: r.deltaPositiveForTask,
  dunyaToSiyaset: r.dunyaToSiyaset,
  genelToSiyaset: r.genelToSiyaset,
  exitCode: r.exitCode,
})));
console.log(`SUMMARY_JSON=${outJson}`);
console.log(`SUMMARY_CSV=${outCsv}`);
