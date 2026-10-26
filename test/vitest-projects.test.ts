import {readFile} from 'node:fs/promises';
import {matchesGlob, resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import config, {RENDERER_NODE_TESTS} from '../vitest.config.mts';

const RENDERER_NODE_TEST = 'src/renderer/src/styles/assets.node.test.ts';
const RENDERER_TEST = 'src/renderer/src/styles/assets.test.ts';

interface ProjectGlobs {
  readonly include: readonly string[];
  readonly exclude: readonly string[];
}

function projectGlobs(name: string): ProjectGlobs {
  for (const project of config.test?.projects ?? []) {
    if (typeof project !== 'object' || !('test' in project)) continue;
    if (project.test.name !== name) continue;
    return {
      include: project.test.include ?? [],
      exclude: project.test.exclude ?? [],
    };
  }
  throw new Error(`no Vitest project named ${name}`);
}

function runs(globs: ProjectGlobs, file: string): boolean {
  const matches = (glob: string): boolean => matchesGlob(file, glob);
  return globs.include.some(matches) && !globs.exclude.some(matches);
}

async function tsconfigGlobs(file: string): Promise<ProjectGlobs> {
  const text = await readFile(resolve(import.meta.dirname, '..', file), 'utf8');
  const parsed: unknown = JSON.parse(text);
  const field = (name: string): string[] => {
    if (typeof parsed !== 'object' || parsed === null) return [];
    const value: unknown = Reflect.get(parsed, name);
    return Array.isArray(value) ? value.filter(v => typeof v === 'string') : [];
  };
  return {include: field('include'), exclude: field('exclude')};
}

describe('renderer tests that need Node', () => {
  it('run in the node project and not in jsdom', () => {
    expect(runs(projectGlobs('node'), RENDERER_NODE_TEST)).toBe(true);
    expect(runs(projectGlobs('renderer'), RENDERER_NODE_TEST)).toBe(false);
  });

  it('leave the other renderer tests in jsdom', () => {
    expect(runs(projectGlobs('renderer'), RENDERER_TEST)).toBe(true);
    expect(runs(projectGlobs('node'), RENDERER_TEST)).toBe(false);
  });

  it('typecheck with Node types and not with the browser ones', async () => {
    expect((await tsconfigGlobs('tsconfig.node.json')).include).toContain(
      RENDERER_NODE_TESTS,
    );
    expect((await tsconfigGlobs('tsconfig.web.json')).exclude).toContain(
      RENDERER_NODE_TESTS,
    );
  });
});

describe('transformed modules', () => {
  it('are not cached between runs, so a glob always sees the current files', () => {
    expect(config.test?.fsModuleCache).toBe(false);
  });
});
