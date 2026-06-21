#!/usr/bin/env node
// audit_i18n_ast.js — AST-based i18n audit for next-intl
//
// Finds hardcoded strings across four categories:
//   JSX_TEXT     — text nodes directly in JSX  e.g. <span>Bonjour</span>
//   JSX_TEXT     — mixed nodes                  e.g. {count} tours
//   ATTR(x)      — string literals in user-facing attributes  e.g. title="Retirer"
//   JSX_EXPR     — string literals inside JSX expressions     e.g. {val || "non renseigné"}
//   TEMPLATE     — static parts of template literals          e.g. `Retirer ${x} de ses relais`
//
// Usage:
//   node audit_i18n_ast.js
//
// Excludes: node_modules, .next, api/, auth/

const fs   = require('fs');
const path = require('path');

let parse;
try {
  parse = require('@babel/parser').parse;
} catch {
  console.error('ERROR: @babel/parser not found. Run: npm install --save-dev @babel/parser');
  process.exit(1);
}

// ── Config ───────────────────────────────────────────────────────────────────

const EXCLUDE_DIRS = ['node_modules', '.next', 'api', 'auth'];

// JSX attributes whose string values are always user-facing
const USER_FACING_ATTRS = new Set([
  'title', 'placeholder', 'aria-label', 'aria-description',
  'alt', 'label', 'tooltip', 'content',
]);

// Patterns that mark a string as non-translatable
const TECHNICAL = [
  /^\s*$/,                              // whitespace only
  /^[^a-zA-ZÀ-ɏ]*$/,         // no letters at all (symbols, numbers, punctuation)
  /\bpx\b|\bem\b|\brem\b|%|var\(--/,   // CSS units / custom properties
  /rgba?\(|#[0-9a-fA-F]{3,6}\b/,       // CSS colors
  /Europe\/|UTC\b|GMT\b|America\/|Asia\//,  // timezones
  /\byyyy\b|\bHH\b|\bdd\b|\bEEEE\b|\bMMMM\b/,  // date format tokens
  /^https?:\/\//,                       // URLs
  /^\/[a-z-]+\//,                       // path strings
  /^[A-Z][A-Z0-9_]{2,}$/,              // ALL_CAPS constants
  /\.(js|ts|css|png|svg|json|webp)$/,   // filenames
  /^[a-z][a-z0-9]*([A-Z][a-z0-9]+)+$/, // camelCase identifiers
  /^supabase|^iracing|^garage61/i,      // internal identifiers
];

function isTechnical(str) {
  const s = str.trim();
  if (s.length < 2) return true;
  return TECHNICAL.some(p => p.test(s));
}

// ── AST walker ───────────────────────────────────────────────────────────────

function walk(node, ancestors, visitor) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, ancestors, visitor);
    return;
  }
  if (!node.type) {
    // Plain object (e.g. loc, range) — recurse into values but don't visit
    for (const key of Object.keys(node)) {
      if (!['start', 'end', 'loc', 'range'].includes(key)) {
        walk(node[key], ancestors, visitor);
      }
    }
    return;
  }

  visitor(node, ancestors);

  const next = [...ancestors, node];
  for (const key of Object.keys(node)) {
    if (['type', 'loc', 'start', 'end', 'range', 'errors', 'tokens'].includes(key)) continue;
    walk(node[key], next, visitor);
  }
}

// Returns true if any ancestor is a call to t(), tXxx() etc.
function insideTCall(ancestors) {
  for (const node of ancestors) {
    if (node.type !== 'CallExpression') continue;
    const c = node.callee;
    if (c.type === 'Identifier' && /^t([A-Z]|$)/.test(c.name)) return true;
    if (c.type === 'MemberExpression' && /^t([A-Z]|$)/.test(c.property?.name ?? '')) return true;
  }
  return false;
}

// ── File auditor ─────────────────────────────────────────────────────────────

function auditFile(filePath, source) {
  let ast;
  try {
    const isTS = /\.tsx?$/.test(filePath);
    ast = parse(source, {
      sourceType: 'module',
      plugins: [
        'jsx',
        'optionalChaining',
        'nullishCoalescingOperator',
        ...(isTS ? ['typescript'] : []),
      ],
      errorRecovery: true,
    });
  } catch (e) {
    return [{ line: 0, kind: 'PARSE_ERROR', text: String(e.message).slice(0, 120), src: '' }];
  }

  const findings = [];
  const srcLines = source.split('\n');
  const ctx = (line) => srcLines[line - 1]?.trim() ?? '';

  walk(ast, [], (node, ancestors) => {

    // 1. JSX text nodes — always user-facing (covers "{count} tours" style nodes too)
    if (node.type === 'JSXText') {
      const text = node.value;
      if (!isTechnical(text)) {
        findings.push({ line: node.loc.start.line, kind: 'JSX_TEXT', text: text.trim(), src: ctx(node.loc.start.line) });
      }
      return;
    }

    // 2. String literals in user-facing JSX attributes  e.g. title="Retirer"
    if (node.type === 'StringLiteral') {
      const parent = ancestors.at(-1);
      if (parent?.type === 'JSXAttribute') {
        const attr = parent.name?.name ?? '';
        if (USER_FACING_ATTRS.has(attr) && !insideTCall(ancestors) && !isTechnical(node.value)) {
          findings.push({ line: node.loc.start.line, kind: `ATTR(${attr})`, text: node.value, src: ctx(node.loc.start.line) });
        }
        return;
      }

      // 3. String literals inside JSX expressions (fallbacks, ternaries, etc.)
      //    e.g. {value || "non renseigné"}, {ok ? "Oui" : "Non"}
      const inJSXExpr = ancestors.some(a => a.type === 'JSXExpressionContainer');
      const inJSXAttr = ancestors.some(a => a.type === 'JSXAttribute');
      if (inJSXExpr && !inJSXAttr && !insideTCall(ancestors) && !isTechnical(node.value)) {
        // Skip strings used as comparison operands: === "value", !== "value"
        const parent = ancestors.at(-1);
        const grandparent = ancestors.at(-2);
        const isComparsonOperand =
          parent?.type === 'BinaryExpression' &&
          ['===', '!==', '==', '!='].includes(parent.operator);
        // Skip strings inside array literals used as option lists (e.g. ["value", label])
        // when the sibling is already a t() call — these are internal tab/state IDs
        const isInArrayWithTCall =
          parent?.type === 'ArrayExpression' &&
          parent.elements?.some(el => el?.type === 'CallExpression' && /^t([A-Z]|$)/.test(el.callee?.name ?? ''));
        // Skip strings inside object properties (CSS values, style objects)
        const isObjectValue =
          parent?.type === 'ObjectProperty' || parent?.type === 'Property';
        if (!isComparsonOperand && !isInArrayWithTCall && !isObjectValue) {
          findings.push({ line: node.loc.start.line, kind: 'JSX_EXPR', text: node.value, src: ctx(node.loc.start.line) });
        }
      }

      // Case 2: object property value with a display-suggesting key name
      // e.g. { label: "Bonjour", tooltip: "Au revoir" }
      const DISPLAY_KEYS = new Set(['label', 'title', 'text', 'description', 'tooltip', 'message', 'header', 'content', 'placeholder', 'caption', 'summary', 'hint']);
      const directParent = ancestors.at(-1);
      if ((directParent?.type === 'ObjectProperty' || directParent?.type === 'Property') && !insideTCall(ancestors) && !isTechnical(node.value)) {
        const keyName = directParent.key?.name ?? directParent.key?.value ?? '';
        if (DISPLAY_KEYS.has(keyName)) {
          findings.push({ line: node.loc.start.line, kind: `OBJ(${keyName})`, text: node.value, src: ctx(node.loc.start.line) });
        }
      }

      // Case 1: string concatenation with +
      // e.g. "Bonjour " + name, or name + " pilote"
      const inPlus = ancestors.some(a => a.type === 'BinaryExpression' && a.operator === '+');
      if (inPlus && !insideTCall(ancestors) && !isTechnical(node.value)) {
        findings.push({ line: node.loc.start.line, kind: 'CONCAT(+)', text: node.value, src: ctx(node.loc.start.line) });
      }

      return;
    }

    // 4. Template literal quasis NOT inside t() calls
    //    Covers title={`Retirer ${x} de ses relais`} and "{count} tours"-style patterns
    if (node.type === 'TemplateLiteral' && !insideTCall(ancestors)) {
      for (const quasi of node.quasis) {
        const text = quasi.value.cooked ?? quasi.value.raw ?? '';
        if (!isTechnical(text) && text.trim().length >= 2) {
          findings.push({ line: quasi.loc.start.line, kind: 'TEMPLATE', text, src: ctx(quasi.loc.start.line) });
        }
      }
    }

  });

  return findings;
}

// ── File collection ───────────────────────────────────────────────────────────

function collectFiles(dir, excludeDirs) {
  const out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return out; }
  for (const e of entries) {
    const fullPath = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!excludeDirs.includes(e.name)) collectFiles(fullPath, excludeDirs).forEach(f => out.push(f));
    } else if (e.isFile() && /\.[jt]sx?$/.test(e.name)) {
      out.push(fullPath);
    }
  }
  return out;
}

const files = [
  ...collectFiles('app', EXCLUDE_DIRS),
  ...collectFiles('components', ['node_modules', '.next']),
].filter(f => {
  const p = f.replace(/\\/g, '/');
  if (p.includes('/api/') || p.includes('/auth/')) return false;
  return true;
}).sort();

// ── Run ───────────────────────────────────────────────────────────────────────

let total = 0;
let lastFile = null;

for (const file of files) {
  const source = fs.readFileSync(file, 'utf-8');
  const findings = auditFile(file, source);
  for (const f of findings) {
    const fp = file.replace(/\\/g, '/');
    if (fp !== lastFile) {
      console.log(`\n── ${fp}`);
      lastFile = fp;
    }
    console.log(`  ${f.line} [${f.kind}] ${JSON.stringify(f.text)}`);
    console.log(`       ${f.src}`);
    total++;
  }
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`Total candidates: ${total}`);
