import {resolve} from 'node:path';
import {RuleTester} from 'eslint';
import tseslint from 'typescript-eslint';
import {describe, expect, it} from 'vitest';
import {layerImportsRule} from './layer-rule.mts';
import {FEATURE_ORDER, LAYER_MAP, TEST_LAYER_MAP} from './layers.mts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({languageOptions: {parser: tseslint.parser}});

const rule = layerImportsRule({
  aliases: {'@base/': 'src/base', '@top/': 'src/top'},
  layers: [
    {name: 'base', dir: 'src/base', imports: []},
    {name: 'middle', dir: 'src/middle', imports: ['base']},
    {name: 'middle/inner', dir: 'src/middle/inner', imports: ['middle']},
    {name: 'top', dir: 'src/top', imports: ['base', 'middle']},
  ],
});

function at(path: string): string {
  return resolve(path);
}

function crossing(from: string, to: string, allowed: string) {
  return [{messageId: 'crossesLayer', data: {from, to, allowed}}];
}

ruleTester.run('layer-imports', rule, {
  valid: [
    {
      name: 'an import of a listed layer through an alias',
      filename: at('src/top/a.ts'),
      code: "import {b} from '@base/b';",
    },
    {
      name: 'a relative import of a listed layer',
      filename: at('src/middle/a.ts'),
      code: "import {b} from '../base/b';",
    },
    {
      name: 'an import inside the same layer',
      filename: at('src/base/deep/a.ts'),
      code: "import {b} from '../b';",
    },
    {
      name: 'a package import',
      filename: at('src/base/a.ts'),
      code: "import {useState} from 'react';",
    },
    {
      name: 'a target outside every layer',
      filename: at('src/base/a.ts'),
      code: "import data from '../../design/a.json';",
    },
    {
      name: 'a file outside every layer',
      filename: at('scripts/a.ts'),
      code: "import {t} from '../src/top/t';",
    },
  ],
  invalid: [
    {
      name: 'an import of a higher layer through an alias',
      filename: at('src/base/a.ts'),
      code: "import {t} from '@top/t';",
      errors: crossing('base', 'top', 'nothing else'),
    },
    {
      name: 'a relative import of a higher layer',
      filename: at('src/middle/a.ts'),
      code: "import type {T} from '../top/t';",
      errors: crossing('middle', 'top', 'base'),
    },
    {
      name: 'a nested layer that reaches past its parent',
      filename: at('src/middle/inner/a.ts'),
      code: "import {b} from '../../base/b';",
      errors: crossing('middle/inner', 'base', 'middle'),
    },
    {
      name: 'a re-export of a higher layer',
      filename: at('src/base/a.ts'),
      code: "export {t} from '../top/t';",
      errors: crossing('base', 'top', 'nothing else'),
    },
    {
      name: 'a dynamic import of a higher layer',
      filename: at('src/base/a.ts'),
      code: "const t = import('../top/t');",
      errors: crossing('base', 'top', 'nothing else'),
    },
  ],
});

describe('the declared layers', () => {
  const names = LAYER_MAP.layers.map(layer => layer.name);

  it('name only layers that exist', () => {
    for (const layer of LAYER_MAP.layers) {
      expect(names).toEqual(expect.arrayContaining([...layer.imports]));
    }
  });

  it('let a feature import only the features before it', () => {
    const songs = LAYER_MAP.layers.find(({name}) => name === 'features/songs');
    expect(songs?.imports).toContain('features/media');
    expect(songs?.imports).not.toContain('features/bible');
    expect(FEATURE_ORDER.at(0)).toBe('media');
  });

  it('keep core free of every other layer', () => {
    const core = LAYER_MAP.layers.find(({name}) => name === 'core');
    expect(core?.imports).toEqual([]);
  });
});

describe('the layers tests may import', () => {
  const importsOf = (name: string) =>
    TEST_LAYER_MAP.layers.find(layer => layer.name === name)?.imports ?? [];

  it('let a renderer test use any renderer layer around its code', () => {
    expect(importsOf('ui')).toEqual(expect.arrayContaining(['app', 'session']));
  });

  it('keep every test inside its own process', () => {
    expect(importsOf('ui')).not.toContain('main');
    expect(importsOf('main')).not.toContain('app');
    expect(importsOf('core')).toEqual([]);
  });
});
