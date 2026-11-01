import type {Config} from 'stylelint';
import {cssCommentPlugin} from './css-comment-rule.mts';

const COLOR_FUNCTIONS = [
  'rgb',
  'rgba',
  'hsl',
  'hsla',
  'hwb',
  'lab',
  'lch',
  'oklab',
  'oklch',
  'color',
];

const LENGTH_PROPERTIES =
  '/^(?:margin|padding|gap|row-gap|column-gap|width|height|min-width|min-height|max-width|max-height|inline-size|block-size|top|right|bottom|left|inset|font-size|border-radius|border-(?:top|bottom)-(?:left|right)-radius)(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?$/';

const LITERAL_LENGTH = /(?<![\w.-])-?\d*\.?\d+(?:px|rem|em|pt)(?![\w-])/;

/** The Stylelint config for the CSS modules under `src/`. */
export const stylelintConfig = {
  plugins: [cssCommentPlugin],
  ignoreDisables: true,
  rules: {
    'llp/allowed-comments': true,
    'color-no-hex': true,
    'color-named': 'never',
    'function-disallowed-list': COLOR_FUNCTIONS,
    'declaration-property-value-disallowed-list': {
      [LENGTH_PROPERTIES]: [LITERAL_LENGTH],
    },
  },
  overrides: [
    {
      files: ['src/renderer/src/styles/tokens.css'],
      rules: {
        'color-no-hex': null,
        'function-disallowed-list': null,
        'declaration-property-value-disallowed-list': null,
      },
    },
  ],
} satisfies Config;
