import {resolve} from 'node:path';
import {RuleTester} from 'eslint';
import tseslint from 'typescript-eslint';
import {describe, it} from 'vitest';
import {moduleEntryRule} from './module-rule.mts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({languageOptions: {parser: tseslint.parser}});

const rule = moduleEntryRule({
  aliases: {'@core/': 'src/core'},
  areas: [{dir: 'src/core', open: ['schema']}],
});

function at(path: string): string {
  return resolve(path);
}

ruleTester.run('module-entry', rule, {
  valid: [
    {
      name: 'a module by its alias',
      filename: at('src/app/a.ts'),
      code: "import {s} from '@core/songs';",
    },
    {
      name: 'a file of an open folder',
      filename: at('src/core/songs/a.ts'),
      code: "import {t} from '@core/schema/theme';",
    },
    {
      name: 'a file of the own module by a relative path',
      filename: at('src/core/songs/deep/a.ts'),
      code: "import {t} from '../title';",
    },
    {
      name: 'a file outside every area',
      filename: at('src/app/a.ts'),
      code: "import {b} from '../base/b';",
    },
  ],
  invalid: [
    {
      name: 'a file inside another module',
      filename: at('src/app/a.ts'),
      code: "import {t} from '@core/songs/title';",
      errors: [
        {
          messageId: 'usesInside',
          data: {module: 'src/core/songs', path: 'src/core/songs/title'},
        },
      ],
    },
    {
      name: 'a file inside another module by a relative path',
      filename: at('src/core/bible/a.ts'),
      code: "export {t} from '../songs/title';",
      errors: [{messageId: 'usesInside'}],
    },
    {
      name: 'another module by a relative path',
      filename: at('src/core/bible/a.ts'),
      code: "import {s} from '../songs';",
      errors: [{messageId: 'usesRelative'}],
    },
    {
      name: 'an open folder by a relative path',
      filename: at('src/core/bible/a.ts'),
      code: "import {t} from '../schema/theme';",
      errors: [{messageId: 'usesRelative'}],
    },
    {
      name: 'the own module by its alias',
      filename: at('src/core/songs/a.ts'),
      code: "import {t} from '@core/songs';",
      errors: [{messageId: 'usesAlias'}],
    },
  ],
});
