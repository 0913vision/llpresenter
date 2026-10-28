import {
  MACRO_FILE_LIMITS,
  type KnownMacroAction,
  type MacroAction,
} from '@shared/schema/macros';

export type MacroActionEdit =
  | {readonly kind: 'append'; readonly action: KnownMacroAction}
  | {
      readonly kind: 'replace';
      readonly index: number;
      readonly action: KnownMacroAction;
      readonly expected: readonly MacroAction[];
    }
  | {
      readonly kind: 'remove';
      readonly index: number;
      readonly expected: readonly MacroAction[];
    }
  | {
      readonly kind: 'move';
      readonly index: number;
      readonly to: number;
      readonly expected: readonly MacroAction[];
    };

export function editMacroActions(
  current: readonly MacroAction[],
  edit: MacroActionEdit,
): readonly MacroAction[] {
  if (edit.kind === 'append') {
    if (current.length >= MACRO_FILE_LIMITS.actions) {
      throw new Error('Macro actions are full');
    }
    return [...current, edit.action];
  }
  if (JSON.stringify(current) !== JSON.stringify(edit.expected)) {
    throw new Error('Macro actions changed');
  }
  if (
    !Number.isInteger(edit.index) ||
    edit.index < 0 ||
    edit.index >= current.length
  ) {
    throw new Error('Macro action no longer exists');
  }
  if (edit.kind === 'remove') {
    return current.filter((_, index) => index !== edit.index);
  }
  if (edit.kind === 'replace') {
    return current.map((value, index) =>
      index === edit.index ? edit.action : value,
    );
  }
  if (!Number.isInteger(edit.to) || edit.to < 0 || edit.to >= current.length) {
    throw new Error('Invalid action position');
  }
  if (edit.to === edit.index) return current;
  const actions = [...current];
  const [item] = actions.splice(edit.index, 1);
  if (!item) throw new Error('Macro action no longer exists');
  actions.splice(edit.to, 0, item);
  return actions;
}
