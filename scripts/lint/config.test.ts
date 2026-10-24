import {resolve} from 'node:path';
import {ESLint} from 'eslint';
import ts from 'typescript';
import {beforeAll, describe, expect, it} from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

// NOTE(0913vision): The path decides which config blocks apply (renderer and
// test files), so each probe gets a made-up path in the matching folder. No
// probe is ever written to disk.
const NODE_PROBE_DIR = 'scripts/lint/probes';
const RENDERER_PROBE = 'src/renderer/src/lint-probe.tsx';
const TEST_PROBE = 'src/main/lint-probe.test.ts';

// NOTE(0913vision): Type-aware rules get a tiny in-memory program with only
// the probes and the ES2023 library, instead of the project's program of about
// 500 files, which took most of the lint time.
const PROBE_OPTIONS: ts.CompilerOptions = {
  strict: true,
  target: ts.ScriptTarget.ES2023,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,
  lib: ['lib.es2023.d.ts'],
  types: [],
  noEmit: true,
  skipLibCheck: true,
};

// NOTE(0913vision): Loading the lint plugins took 65 s once when several
// sessions tested at once, so the setup gets room beyond that.
const SETUP_TIMEOUT_MS = 180_000;

const SAVE = [
  'async function save(): Promise<void> {',
  '  await Promise.resolve();',
  '}',
  '',
].join('\n');

const FLOATING_PROMISES = [
  ['a floating promise', `${SAVE}export function f(): void { save(); }`],
  [
    'a promise dropped with void',
    `${SAVE}export function f(): void { void save(); }`,
  ],
] as const;

const ACCEPTED_CODE = [
  [
    'an awaited promise',
    `${SAVE}export async function f(): Promise<void> { await save(); }`,
  ],
  [
    'a returned promise',
    `${SAVE}export function f(): Promise<void> { return save(); }`,
  ],
  [
    'a promise with .catch',
    `${SAVE}export function f(log: (e: unknown) => void): void { save().catch(log); }`,
  ],
  [
    'a promise with a rejection handler in .then',
    `${SAVE}export function f(log: (e: unknown) => void): void { save().then(() => undefined, log); }`,
  ],
  [
    'valid TSDoc',
    '/**\n * Greets someone.\n *\n * @param name - who to greet\n * @returns the greeting\n */\nexport const greet = (name: string): string => `Hello, ${name}`;',
  ],
] as const;

const BANNED_CODE = [
  [
    'any',
    'export const f = (v: any): number => 1;',
    '@typescript-eslint/no-explicit-any',
  ],
  [
    'a non-null assertion',
    'export const f = (t?: string): number => t!.length;',
    '@typescript-eslint/no-non-null-assertion',
  ],
  [
    'a type assertion',
    'export const f = (v: unknown): string => v as string;',
    '@typescript-eslint/consistent-type-assertions',
  ],
  [
    'a switch that misses a union member',
    "export function f(k: 'a' | 'b'): number { switch (k) { case 'a': return 1; } return 0; }",
    '@typescript-eslint/switch-exhaustiveness-check',
  ],
  ['a plain comment', '// plain\nexport const a = 1;', 'llp/allowed-comments'],
  [
    'JSDoc types in TSDoc',
    '/**\n * Does it.\n * @param {string} n - the name\n */\nexport const f = (n: string): string => n;',
    'tsdoc/syntax',
  ],
  [
    'an unused variable',
    'export function f(): number { const unused = 1; return 2; }',
    '@typescript-eslint/no-unused-vars',
  ],
] as const;

const CONDITIONAL_HOOK = [
  'declare function useState<T>(initial: T): [T, (next: T) => void];',
  'export function C({on}: {on: boolean}): number {',
  '  if (on) {',
  '    const [n] = useState(0);',
  '    return n;',
  '  }',
  '  return 0;',
  '}',
].join('\n');

const FOCUSED_TEST = [
  'declare const it: {only(name: string, run: () => void): void};',
  "it.only('x', () => undefined);",
  '',
].join('\n');

const DISABLE_COMMENT = [
  '// eslint-disable-next-line @typescript-eslint/no-explicit-any',
  'export const v: any = 1;',
].join('\n');

interface Probe {
  readonly label: string;
  readonly path: string;
  readonly code: string;
}

function nodeProbes(
  cases: ReadonlyArray<readonly [string, string, ...string[]]>,
): Probe[] {
  return cases.map(([label, code]) => ({
    label,
    code,
    path: `${NODE_PROBE_DIR}/${label.replaceAll(/\W+/g, '-')}.ts`,
  }));
}

const PROBES: readonly Probe[] = [
  ...nodeProbes(FLOATING_PROMISES),
  ...nodeProbes(ACCEPTED_CODE),
  ...nodeProbes(BANNED_CODE),
  {
    label: 'a disable comment',
    path: `${NODE_PROBE_DIR}/disable-comment.ts`,
    code: DISABLE_COMMENT,
  },
  {label: 'a conditional hook', path: RENDERER_PROBE, code: CONDITIONAL_HOOK},
  {label: 'a focused test', path: TEST_PROBE, code: FOCUSED_TEST},
].map(probe => ({...probe, path: resolve(REPO_ROOT, probe.path)}));

function fileKey(path: string): string {
  return resolve(path).toLowerCase();
}

function probeProgram(probes: readonly Probe[]): ts.Program {
  const texts = new Map(probes.map(probe => [fileKey(probe.path), probe.code]));
  const base = ts.createCompilerHost(PROBE_OPTIONS);
  const host: ts.CompilerHost = {
    ...base,
    fileExists: path => texts.has(fileKey(path)) || base.fileExists(path),
    readFile: path => texts.get(fileKey(path)) ?? base.readFile(path),
    getSourceFile: (path, languageVersion, ...rest) => {
      const text = texts.get(fileKey(path));
      if (text === undefined) {
        return base.getSourceFile(path, languageVersion, ...rest);
      }
      return ts.createSourceFile(path, text, languageVersion, true);
    },
  };
  return ts.createProgram({
    rootNames: probes.map(probe => probe.path),
    options: PROBE_OPTIONS,
    host,
  });
}

async function lintProbes(
  probes: readonly Probe[],
): Promise<ReadonlyMap<string, readonly string[]>> {
  const eslint = new ESLint({
    cwd: REPO_ROOT,
    overrideConfig: {
      languageOptions: {
        parserOptions: {
          projectService: false,
          programs: [probeProgram(probes)],
        },
      },
    },
  });
  const results = new Map<string, readonly string[]>();
  for (const probe of probes) {
    const [result] = await eslint.lintText(probe.code, {filePath: probe.path});
    const ids = (result?.messages ?? []).map(m => m.ruleId ?? 'fatal');
    results.set(probe.label, ids);
  }
  return results;
}

let ruleIdsByLabel: ReadonlyMap<string, readonly string[]> = new Map();

beforeAll(async () => {
  ruleIdsByLabel = await lintProbes(PROBES);
}, SETUP_TIMEOUT_MS);

function ruleIds(label: string): readonly string[] {
  const ids = ruleIdsByLabel.get(label);
  if (ids === undefined) throw new Error(`no probe named ${label}`);
  return ids;
}

describe('the lint config', () => {
  it.each(FLOATING_PROMISES)('reports %s', label => {
    expect(ruleIds(label)).toEqual(['@typescript-eslint/no-floating-promises']);
  });

  it.each(ACCEPTED_CODE)('accepts %s', label => {
    expect(ruleIds(label)).toEqual([]);
  });

  it.each(BANNED_CODE)('reports %s', (label, _code, ruleId) => {
    expect(ruleIds(label)).toContain(ruleId);
  });

  it('reports a hook called conditionally', () => {
    expect(ruleIds('a conditional hook')).toContain(
      'react-hooks/rules-of-hooks',
    );
  });

  it('reports a focused test', () => {
    expect(ruleIds('a focused test')).toEqual(['no-restricted-properties']);
  });

  it('ignores a disable comment and reports the comment itself', () => {
    const ids = ruleIds('a disable comment');
    expect(ids).toContain('llp/allowed-comments');
    expect(ids).toContain('@typescript-eslint/no-explicit-any');
  });
});
