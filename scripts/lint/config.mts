import {resolve} from 'node:path';
import js from '@eslint/js';
import {defineConfig, globalIgnores} from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import tsdoc from 'eslint-plugin-tsdoc';
import tseslint from 'typescript-eslint';
import {llpPlugin} from './plugin.mts';
import {legacyExclusions} from './legacy-exclusions.mts';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

const TS_FILES = ['**/*.{ts,tsx,mts,cts}'];
const RENDERER_FILES = ['src/renderer/**/*.{ts,tsx}'];
const TEST_FILES = ['**/*.test.{ts,tsx}', 'test/**/*.{ts,tsx}'];
const TOOL_CONFIG_FILES = ['**/*.config.{ts,mts,mjs}'];
const SOAK_CLIP_PAGE_FILES = ['scripts/soak/clip/*.js'];
const BOUNDARY_TEST_FILES = ['**/*.test.{ts,tsx}', 'src/**/testing/**'];
const MAIN_MODULE_FILES = ['src/main/**/*.{ts,tsx,mts,cts,js,mjs,cjs}'];
const RENDERER_MODULE_FILES = ['src/renderer/**/*.{ts,tsx,mts,cts,js,mjs,cjs}'];
const SOURCE_MODULE_FILES = ['src/**/*.{ts,tsx,mts,cts,js,mjs,cjs}'];
const SOURCE_TEST_FILES = ['src/**/*.test.{ts,tsx}'];

const VALIBOT_IMPORT = {
  regex: '^valibot(?:/|$)',
  message: 'Import validation through src/core/schema/ instead of Valibot.',
};
const MAIN_IMPORT = {
  regex: '^(?:@main(?:/|$)|src/main(?:/|$)|(?:\\.\\./)+(?:src/)?main(?:/|$))',
  message: 'Renderer modules must use shared contracts instead of src/main/.',
};
const RENDERER_IMPORT = {
  regex:
    '^(?:@renderer(?:/|$)|src/renderer(?:/|$)|(?:\\.\\./)+(?:src/)?renderer(?:/|$))',
  message: 'Main modules must use shared contracts instead of src/renderer/.',
};

const MAX_PARAMS = 3;
const MAX_DEPTH = 3;

const BANNED_SYNTAX = [
  {
    selector: 'PrivateIdentifier',
    message: 'Use TypeScript `private` instead of `#private` (Google style).',
  },
  {
    selector: 'ForInStatement',
    message: 'Use `for...of` over `Object.keys()` or `Object.entries()`.',
  },
  {
    selector: 'TSEnumDeclaration[const=true]',
    message: 'Use a plain enum or a string literal union (Google style).',
  },
];

const BANNED_DEFAULT_EXPORTS = [
  {
    selector: 'ExportDefaultDeclaration',
    message: 'Use named exports (Google style).',
  },
  {
    selector: 'ExportSpecifier[exported.name="default"]',
    message: 'Use named exports (Google style).',
  },
];

// NOTE(0913vision): electron-vite 6 bundles electron.vite.config.ts into a
// temporary electron.vite.config.ts.<time>-<hex>.mjs next to it and deletes it
// after loading. verify builds while it lints, so lint could list that file and
// then find it gone (ENOENT).
const ELECTRON_VITE_TEMP_CONFIGS = 'electron.vite.config.ts.*.mjs';

/** The ESLint flat config for the whole repository. */
export const lintConfig = defineConfig(
  // NOTE(0913vision): ESLint doesn't read .gitignore. These mirror it, and
  // .claude/ keeps the lead's checkout from linting every session worktree.
  globalIgnores([
    'out/',
    'dist/',
    'coverage/',
    'design/',
    '.claude/',
    '.llp/',
    ELECTRON_VITE_TEMP_CONFIGS,
  ]),
  {
    linterOptions: {
      // NOTE(0913vision): Exclusions live in this config only, never in
      // comments in the code, so a disable comment has no effect.
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error',
    },
  },
  // NOTE(0913vision): ESLint's own recommended rules catch plain JavaScript
  // mistakes such as unreachable code, empty blocks, and fallthrough.
  js.configs.recommended,
  {
    plugins: {llp: llpPlugin},
    rules: {
      // NOTE(0913vision): CLAUDE.md allows only TSDoc, NOTE, and TODO
      // comments.
      'llp/allowed-comments': 'error',
      // NOTE(0913vision): Source files use UTF-8 without a byte order mark.
      'unicode-bom': ['error', 'never'],
      // NOTE(0913vision): Loose equality coerces types and hides bugs. The
      // Google style guide allows `== null` to cover undefined too.
      eqeqeq: ['error', 'always', {null: 'ignore'}],
      // NOTE(0913vision): CLAUDE.md requires `const` and `let`.
      'no-var': 'error',
      // NOTE(0913vision): A binding that never changes must say so.
      'prefer-const': 'error',
      // NOTE(0913vision): The Google style guide prefers arrow functions for
      // callbacks, and they keep `this` from changing under you.
      'prefer-arrow-callback': 'error',
      // NOTE(0913vision): CLAUDE.md prefers template literals.
      'prefer-template': 'error',
      // NOTE(0913vision): CLAUDE.md prefers `Object.hasOwn`.
      'prefer-object-has-own': 'error',
      // NOTE(0913vision): The Google style guide requires braces unless the
      // whole statement fits on one line.
      curly: ['error', 'multi-line'],
      // NOTE(0913vision): Deep nesting hides the main path. CLAUDE.md asks
      // for early returns.
      'max-depth': ['error', MAX_DEPTH],
      // NOTE(0913vision): A focused test silently skips the rest of the
      // suite, so it must never reach `main`.
      'no-restricted-properties': [
        'error',
        ...['describe', 'it', 'test'].map(object => ({
          object,
          property: 'only',
          message: 'Remove `.only` before you commit.',
        })),
      ],
      // NOTE(0913vision): Bans the syntax that CLAUDE.md and the Google
      // TypeScript style guide rule out.
      'no-restricted-syntax': [
        'error',
        ...BANNED_SYNTAX,
        ...BANNED_DEFAULT_EXPORTS,
      ],
    },
  },
  {
    files: TS_FILES,
    // NOTE(0913vision): The strictest typescript-eslint presets, with type
    // information. They ban `any` flowing through code (no-unsafe-*),
    // unnecessary conditions, and deprecated APIs, and they prefer `??` and
    // optional chaining.
    extends: [
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    plugins: {tsdoc},
    languageOptions: {
      parserOptions: {projectService: true, tsconfigRootDir: REPO_ROOT},
    },
    rules: {
      // NOTE(0913vision): CLAUDE.md bans `any`.
      '@typescript-eslint/no-explicit-any': 'error',
      // NOTE(0913vision): CLAUDE.md bans type assertions that bypass checks.
      // Validate or narrow instead. `as const` stays allowed.
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        {assertionStyle: 'never'},
      ],
      // NOTE(0913vision): CLAUDE.md bans the non-null assertion `!`.
      '@typescript-eslint/no-non-null-assertion': 'error',
      // NOTE(0913vision): This stylistic rule asks for `!`, which the rule
      // above bans.
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
      // NOTE(0913vision): An unhandled rejection can stop the app during a
      // service. Every promise must be awaited, returned, or caught, and
      // `void` doesn't count as handling it.
      '@typescript-eslint/no-floating-promises': ['error', {ignoreVoid: false}],
      // NOTE(0913vision): A promise passed where a plain callback is expected
      // drops its rejection.
      '@typescript-eslint/no-misused-promises': 'error',
      // NOTE(0913vision): CLAUDE.md requires every switch to be exhaustive. A
      // `default` doesn't count for unions, so a new member shows up here.
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        {
          considerDefaultExhaustiveForUnions: false,
          requireDefaultForNonUnion: true,
        },
      ],
      // NOTE(0913vision): Unused code is dead code. Unused caught errors
      // usually mean a swallowed error.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {args: 'after-used', caughtErrors: 'all', ignoreRestSiblings: true},
      ],
      // NOTE(0913vision): CLAUDE.md asks for `readonly` wherever a member
      // never changes.
      '@typescript-eslint/prefer-readonly': 'error',
      // NOTE(0913vision): CLAUDE.md asks for an object once there are more
      // than three parameters.
      '@typescript-eslint/max-params': ['error', {max: MAX_PARAMS}],
      // NOTE(0913vision): Numbers read naturally in messages. Everything else
      // must be turned into a string on purpose.
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {allowNumber: true},
      ],
      // NOTE(0913vision): `onClick={() => select(id)}` is the normal way to
      // write a React handler, even when `select` returns nothing.
      '@typescript-eslint/no-confusing-void-expression': [
        'error',
        {ignoreArrowShorthand: true},
      ],
      // NOTE(0913vision): `process.env['NAME']` and `process.env.NAME` are
      // both fine.
      '@typescript-eslint/dot-notation': [
        'error',
        {allowIndexSignaturePropertyAccess: true},
      ],
      // NOTE(0913vision): The Google style guide uses `T[]` for simple types
      // and `Array<T>` for the rest.
      '@typescript-eslint/array-type': ['error', {default: 'array-simple'}],
      // NOTE(0913vision): The Google style guide uses interfaces for object
      // types.
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      // NOTE(0913vision): CLAUDE.md requires TSDoc, not JSDoc, so the syntax
      // must parse as TSDoc.
      'tsdoc/syntax': 'error',
    },
  },
  {
    files: RENDERER_FILES,
    // NOTE(0913vision): The hooks rules and the React Compiler checks keep
    // renders pure and dependencies complete, so only what changed
    // re-renders.
    extends: [reactHooks.configs.flat['recommended-latest']],
    rules: {
      // NOTE(0913vision): A missing dependency leaves a stale value on
      // screen. Lint has no warnings here, only errors.
      'react-hooks/exhaustive-deps': 'error',
      // NOTE(0913vision): A library the React Compiler can't analyze needs a
      // decision in review, not a warning that scrolls by.
      'react-hooks/incompatible-library': 'error',
      // NOTE(0913vision): Syntax that the React Compiler can't handle must be
      // rewritten.
      'react-hooks/unsupported-syntax': 'error',
    },
  },
  {
    files: TEST_FILES,
    rules: {
      // NOTE(0913vision): Fakes implement promise-returning interfaces as
      // `async () => value`.
      '@typescript-eslint/require-await': 'off',
      // NOTE(0913vision): Fakes and handlers in tests are often no-ops.
      '@typescript-eslint/no-empty-function': 'off',
      // NOTE(0913vision): `expect(mock.method)` passes a method without
      // calling it.
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    ignores: ['src/core/schema/**', ...BOUNDARY_TEST_FILES],
    rules: {
      // NOTE(0913vision): Keep the validator replaceable behind the schema API.
      'no-restricted-imports': ['error', {patterns: [VALIBOT_IMPORT]}],
    },
  },
  {
    files: RENDERER_MODULE_FILES,
    ignores: BOUNDARY_TEST_FILES,
    rules: {
      // NOTE(0913vision): Renderers cross the process boundary through IPC.
      'no-restricted-imports': [
        'error',
        {patterns: [VALIBOT_IMPORT, MAIN_IMPORT]},
      ],
    },
  },
  {
    files: MAIN_MODULE_FILES,
    ignores: BOUNDARY_TEST_FILES,
    rules: {
      // NOTE(0913vision): Main must not depend on renderer implementations.
      'no-restricted-imports': [
        'error',
        {patterns: [VALIBOT_IMPORT, RENDERER_IMPORT]},
      ],
    },
  },
  {
    files: SOURCE_MODULE_FILES,
    ignores: SOURCE_TEST_FILES,
    rules: {
      // NOTE(0913vision): Imports flow one way between the layers in
      // scripts/lint/layers.mts, so a change in a feature never reaches
      // the layers below it. Fixtures in testing/ folders follow it too, so
      // each one sits in the lowest layer that uses it.
      'llp/layer-imports': 'error',
    },
  },
  {
    files: SOURCE_TEST_FILES,
    rules: {
      // NOTE(0913vision): A test may use any layer of its own process around
      // the code it tests, but never another process's code.
      'llp/test-layer-imports': 'error',
    },
  },
  {
    files: [
      'src/main/**/*.test.{ts,tsx}',
      'src/main/**/testing/**/*.{ts,tsx,mts,cts,js,mjs,cjs}',
    ],
    rules: {
      // NOTE(0913vision): Main tests may use Valibot, but not renderer modules.
      'no-restricted-imports': ['error', {patterns: [RENDERER_IMPORT]}],
    },
  },
  {
    files: SOAK_CLIP_PAGE_FILES,
    languageOptions: {
      // NOTE(0913vision): The soak clip page script runs in Chromium, where
      // these exist; the clip maker calls the functions it defines.
      globals: {
        document: 'readonly',
        OffscreenCanvas: 'readonly',
        VideoEncoder: 'readonly',
        VideoFrame: 'readonly',
      },
    },
  },
  {
    files: TOOL_CONFIG_FILES,
    rules: {
      // NOTE(0913vision): Vite, Vitest, and ESLint read their config from a
      // default export.
      'no-restricted-syntax': ['error', ...BANNED_SYNTAX],
    },
  },
  ...legacyExclusions,
);
