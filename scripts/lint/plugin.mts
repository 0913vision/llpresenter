import type {ESLint} from 'eslint';
import {allowedCommentsRule} from './comment-rule.mts';
import {layerImportsRule} from './layer-rule.mts';
import {LAYER_MAP, TEST_LAYER_MAP} from './layers.mts';

/** The local ESLint plugin that holds the project's own rules. */
export const llpPlugin = {
  meta: {name: 'llp'},
  rules: {
    'allowed-comments': allowedCommentsRule,
    'layer-imports': layerImportsRule(LAYER_MAP),
    'test-layer-imports': layerImportsRule(TEST_LAYER_MAP),
  },
} satisfies ESLint.Plugin;
