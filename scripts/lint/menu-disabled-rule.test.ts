import {RuleTester} from 'eslint';
import tseslint from 'typescript-eslint';
import {describe, it} from 'vitest';
import {menuDisabledReasonRule} from './menu-disabled-rule.mts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({languageOptions: {parser: tseslint.parser}});

ruleTester.run('menu-disabled-reason', menuDisabledReasonRule, {
  valid: [
    {
      name: 'a row that spreads the derived reason',
      code: "export const row = {kind: 'item', id: 'a', ...menuAvailability(r)};",
    },
    {
      name: 'a disabled row that names its reason',
      code: "export const row = {kind: 'item', id: 'a', disabled: true, title: 'why'};",
    },
    {
      name: 'an enabled row',
      code: "export const row = {kind: 'item', id: 'a', disabled: false};",
    },
    {
      name: 'a disabled object that is not a menu row',
      code: 'export const button = {label: "a", disabled: true};',
    },
    {
      name: 'a disabled flag that comes from a value',
      code: "export const row = {kind: 'item', id: 'a', disabled: off};",
    },
  ],
  invalid: [
    {
      name: 'a bare disabled row',
      code: "export const row = {kind: 'item', id: 'a', disabled: true};",
      errors: [{messageId: 'bareDisabled'}],
    },
    {
      name: 'a bare disabled row with quoted keys',
      code: "export const row = {'kind': 'item', 'disabled': true, onSelect};",
      errors: [{messageId: 'bareDisabled'}],
    },
  ],
});
