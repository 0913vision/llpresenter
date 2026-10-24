import {resolve} from 'node:path';
import {ESLint} from 'eslint';
import {describe, expect, it} from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

// NOTE(0913vision): The TypeScript project service only knows files on disk,
// so each probe borrows the path of an existing file and lints new text in its
// place. The files on disk never change.
const NODE_HOST = 'scripts/verify.mts';
const RENDERER_HOST = 'src/renderer/src/control/main.tsx';
const TEST_HOST = 'scripts/lint/config.test.ts';

// NOTE(0913vision): The first lint loads the lint plugins (two copies of
// TypeScript between them) and builds the project's TypeScript program. With
// several sessions testing at once that took 65 s, so the limit leaves room.
const LINT_TIMEOUT_MS = 180_000;

const eslint = new ESLint({cwd: REPO_ROOT});

async function ruleIds(code: string, filePath = NODE_HOST): Promise<string[]> {
  const [result] = await eslint.lintText(code, {
    filePath: resolve(REPO_ROOT, filePath),
  });
  return (result?.messages ?? []).map(message => message.ruleId ?? 'fatal');
}

const SAVE = [
  'async function save(): Promise<void> {',
  '  await Promise.resolve();',
  '}',
  '',
].join('\n');

describe('the lint config', {timeout: LINT_TIMEOUT_MS}, () => {
  it.each([
    ['a floating promise', `${SAVE}export function f(): void { save(); }`],
    [
      'a promise dropped with void',
      `${SAVE}export function f(): void { void save(); }`,
    ],
  ])('reports %s', async (_label, code) => {
    expect(await ruleIds(code)).toEqual([
      '@typescript-eslint/no-floating-promises',
    ]);
  });

  it.each([
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
  ])('accepts %s', async (_label, code) => {
    expect(await ruleIds(code)).toEqual([]);
  });

  it.each([
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
    [
      'a plain comment',
      '// plain\nexport const a = 1;',
      'llp/allowed-comments',
    ],
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
  ])('reports %s', async (_label, code, ruleId) => {
    expect(await ruleIds(code)).toContain(ruleId);
  });

  it('reports a hook called conditionally', async () => {
    const code = [
      "import {useState} from 'react';",
      'export function C({on}: {on: boolean}): number {',
      '  if (on) {',
      '    const [n] = useState(0);',
      '    return n;',
      '  }',
      '  return 0;',
      '}',
    ].join('\n');
    expect(await ruleIds(code, RENDERER_HOST)).toContain(
      'react-hooks/rules-of-hooks',
    );
  });

  it('reports a focused test', async () => {
    const code = "import {it} from 'vitest';\nit.only('x', () => undefined);\n";
    expect(await ruleIds(code, TEST_HOST)).toEqual([
      'no-restricted-properties',
    ]);
  });

  it('ignores a disable comment and reports the comment itself', async () => {
    const code = [
      '// eslint-disable-next-line @typescript-eslint/no-explicit-any',
      'export const v: any = 1;',
    ].join('\n');
    const ids = await ruleIds(code);
    expect(ids).toContain('llp/allowed-comments');
    expect(ids).toContain('@typescript-eslint/no-explicit-any');
  });
});
