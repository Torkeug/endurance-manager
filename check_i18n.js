#!/usr/bin/env node
// check_i18n.js
// 1. Verifies fr.json and en.json have identical key sets
// 2. Checks that every key appears in at least one t() call in the codebase

const fs   = require('fs');
const path = require('path');

// ── Load messages ─────────────────────────────────────────────────────────────

const fr = JSON.parse(fs.readFileSync('messages/fr.json', 'utf-8'));
const en = JSON.parse(fs.readFileSync('messages/en.json', 'utf-8'));

// Flatten nested JSON to "namespace.key" paths
function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, full));
    } else {
      out[full] = v;
    }
  }
  return out;
}

const frFlat = flatten(fr);
const enFlat = flatten(en);
const frKeys = new Set(Object.keys(frFlat));
const enKeys = new Set(Object.keys(enFlat));

// ── 1. Parity check ───────────────────────────────────────────────────────────

const onlyInFr = [...frKeys].filter(k => !enKeys.has(k)).sort();
const onlyInEn = [...enKeys].filter(k => !frKeys.has(k)).sort();

console.log('\n=== KEY PARITY ===');
if (onlyInFr.length === 0 && onlyInEn.length === 0) {
  console.log('✓ fr.json and en.json have identical keys');
} else {
  if (onlyInFr.length > 0) {
    console.log(`\n  Missing from en.json (${onlyInFr.length}):`);
    for (const k of onlyInFr) console.log(`    ${k}`);
  }
  if (onlyInEn.length > 0) {
    console.log(`\n  Missing from fr.json (${onlyInEn.length}):`);
    for (const k of onlyInEn) console.log(`    ${k}`);
  }
}

// ── 2. Usage check ────────────────────────────────────────────────────────────

function collectFiles(dir) {
  const out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory() && !['node_modules', '.next'].includes(e.name)) {
      collectFiles(fp).forEach(f => out.push(f));
    } else if (e.isFile() && /\.[jt]sx?$/.test(e.name)) {
      out.push(fp);
    }
  }
  return out;
}

const files = [
  ...collectFiles('app'),
  ...collectFiles('components'),
  ...collectFiles('lib'),
];

// Concatenate all source for fast scanning
const allSource = files.map(f => fs.readFileSync(f, 'utf-8')).join('\n');

// Keys in both files (the authoritative set to check usage for)
const sharedKeys = [...frKeys].filter(k => enKeys.has(k));

const unusedKeys = [];

// Prefixes used via dynamic template literals, e.g. t(`navTab.${tabId}`)
// Any key whose sub-path starts with one of these is considered used.
const DYNAMIC_PREFIXES = ['navTab.'];

for (const fullKey of sharedKeys) {
  // For "raceMode.planned" → subPath = "planned"
  // For "guide.accueil.text1" → subPath = "accueil.text1"
  // next-intl calls are always t("subPath") where the namespace is bound via useTranslations
  const subPath = fullKey.slice(fullKey.indexOf('.') + 1);

  if (DYNAMIC_PREFIXES.some(p => subPath.startsWith(p))) continue;

  const escaped = subPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Match: t("key"), tStats("key"), t.rich("key"), getTranslations("ns") etc.
  const found = new RegExp(`["'\`]${escaped}["'\`]`).test(allSource);

  if (!found) {
    unusedKeys.push(fullKey);
  }
}

console.log('\n=== UNUSED KEYS ===');
if (unusedKeys.length === 0) {
  console.log('✓ All keys appear in at least one t() call');
} else {
  console.log(`  ${unusedKeys.length} keys not found in any t() call:`);
  for (const k of unusedKeys) console.log(`    ${k}`);
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n=== SUMMARY ===');
console.log(`  fr.json keys : ${frKeys.size}`);
console.log(`  en.json keys : ${enKeys.size}`);
console.log(`  Missing from en : ${onlyInFr.length}`);
console.log(`  Missing from fr : ${onlyInEn.length}`);
console.log(`  Potentially unused : ${unusedKeys.length}`);
console.log('');
