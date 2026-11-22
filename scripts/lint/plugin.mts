import type {ESLint} from 'eslint';
import {allowedCommentsRule} from './comment-rule.mts';
import {hangulEscapeRule} from './hangul-escape-rule.mts';
import {layerImportsRule} from './layer-rule.mts';
import {menuDisabledReasonRule} from './menu-disabled-rule.mts';
import {moduleEntryRule} from './module-rule.mts';
import {LAYER_MAP, MODULE_MAP, TEST_LAYER_MAP} from './layers.mts';

/** The local ESLint plugin that holds the project's own rules. */
export const llpPlugin = {
  meta: {name: 'llp'},
  rules: {
    'allowed-comments': allowedCommentsRule,
    'hangul-escape': hangulEscapeRule,
    'layer-imports': layerImportsRule(LAYER_MAP),
    'menu-disabled-reason': menuDisabledReasonRule,
    'module-entry': moduleEntryRule(MODULE_MAP),
    'test-layer-imports': layerImportsRule(TEST_LAYER_MAP),
  },
} satisfies ESLint.Plugin;
