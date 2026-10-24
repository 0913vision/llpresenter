import {RuleTester} from 'eslint';
import tseslint from 'typescript-eslint';
import {describe, it} from 'vitest';
import {allowedCommentsRule} from './comment-rule.mts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({languageOptions: {parser: tseslint.parser}});

const disallowed = [{messageId: 'disallowed'}];

ruleTester.run('allowed-comments', allowedCommentsRule, {
  valid: [
    {
      name: 'TSDoc on an export',
      code: '/** Says hello. */\nexport const hello = 1;',
    },
    {
      name: 'a one-line NOTE',
      code: '// NOTE(0913vision): The port is fixed per session.\nconst a = 1;',
    },
    {
      name: 'a TODO at the end of a line',
      code: 'const a = 1; // TODO(0913vision): Read this from settings.',
    },
    {
      name: 'a NOTE that continues on the next lines',
      code: [
        '  // NOTE(0913vision): Windows locks open files, so the rename',
        '  // retries a few times before it gives up.',
        '  //',
        '  // See docs/WORKFLOW.md.',
        'const a = 1;',
      ].join('\n'),
    },
    {
      name: 'a TODO right under a NOTE',
      code: [
        '// NOTE(0913vision): The port is fixed per session.',
        '// TODO(0913vision): Read it from settings.',
        'const a = 1;',
      ].join('\n'),
    },
    {
      name: 'a NOTE whose next line starts with the word note',
      code: [
        '// NOTE(0913vision): The rename retries a few times.',
        '// note that Windows locks open files.',
        'const a = 1;',
      ].join('\n'),
    },
    {
      name: 'a triple-slash directive',
      code: '/// <reference types="vite/client" />\nexport {};',
    },
  ],
  invalid: [
    {
      name: 'a TODO with another owner right under a NOTE',
      code: [
        '// NOTE(0913vision): The port is fixed per session.',
        '// TODO(someone): Read it from settings.',
        'const a = 1;',
      ].join('\n'),
      errors: [
        {
          messageId: 'malformedTag',
          data: {tag: 'TODO', owner: '0913vision'},
          line: 2,
        },
      ],
    },
    {
      name: 'a NOTE without the owner right under a TODO',
      code: [
        '// TODO(0913vision): Read the port from settings.',
        '// NOTE: It is fixed for now.',
        'const a = 1;',
      ].join('\n'),
      errors: [
        {
          messageId: 'malformedTag',
          data: {tag: 'NOTE', owner: '0913vision'},
          line: 2,
        },
      ],
    },
    {
      name: 'a plain line right under a malformed tag line',
      code: [
        '// NOTE(0913vision): The port is fixed per session.',
        '// TODO(someone): Read it from settings',
        '// and from the command line.',
        'const a = 1;',
      ].join('\n'),
      errors: [
        {messageId: 'malformedTag', line: 2},
        {messageId: 'disallowed', line: 3},
      ],
    },
    {
      name: 'a plain line comment',
      code: '// increment the counter\nlet a = 1;',
      errors: disallowed,
    },
    {
      name: 'a plain block comment',
      code: '/* old code */\nconst a = 1;',
      errors: disallowed,
    },
    {
      name: 'commented-out code',
      code: '// const b = 2;\nconst a = 1;',
      errors: disallowed,
    },
    {
      name: 'an inline lint directive',
      code: '// eslint-disable-next-line no-console\nconsole.log(1);',
      errors: disallowed,
    },
    {
      name: 'a comment inside JSX',
      code: 'const a = <div>{/* hidden */}</div>;',
      languageOptions: {
        parserOptions: {ecmaFeatures: {jsx: true}},
      },
      errors: disallowed,
    },
    {
      name: 'a NOTE without the owner',
      code: '// NOTE: The port is fixed.\nconst a = 1;',
      errors: [
        {messageId: 'malformedTag', data: {tag: 'NOTE', owner: '0913vision'}},
      ],
    },
    {
      name: 'a TODO with another owner',
      code: '// TODO(someone): Fix this.\nconst a = 1;',
      errors: [
        {messageId: 'malformedTag', data: {tag: 'TODO', owner: '0913vision'}},
      ],
    },
    {
      name: 'a NOTE written as a block comment',
      code: '/* NOTE(0913vision): The port is fixed. */\nconst a = 1;',
      errors: [
        {messageId: 'malformedTag', data: {tag: 'NOTE', owner: '0913vision'}},
      ],
    },
    {
      name: 'a NOTE with no text',
      code: '// NOTE(0913vision):\nconst a = 1;',
      errors: [
        {messageId: 'malformedTag', data: {tag: 'NOTE', owner: '0913vision'}},
      ],
    },
    {
      name: 'a plain comment after a blank line under a NOTE',
      code: [
        '// NOTE(0913vision): The port is fixed.',
        '',
        '// unrelated',
        'const a = 1;',
      ].join('\n'),
      errors: disallowed,
    },
    {
      name: 'a plain comment under a NOTE in another column',
      code: [
        '// NOTE(0913vision): The port is fixed.',
        'const a = 1; // unrelated',
      ].join('\n'),
      errors: disallowed,
    },
    {
      name: 'a plain comment under a code line',
      code: ['const a = 1; // NOTE(0913vision): Fixed.', '// unrelated'].join(
        '\n',
      ),
      errors: disallowed,
    },
  ],
});
