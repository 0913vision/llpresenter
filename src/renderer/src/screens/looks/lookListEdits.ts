import type {Result} from '@shared/result';
import type {LookId} from '@shared/schema/ids';
import type {Look, LooksFile} from '@shared/schema/looks';
import {isKnownMacroAction, type Macro} from '@shared/schema/macros';
import {nameProblem} from '../screenEdits';

/** Bounds newly created Looks without rejecting an existing imported list. */
export const LOOK_LIST_LIMIT = 1000;

export type LookListEdit =
  | {readonly kind: 'add'; readonly id: LookId}
  | {readonly kind: 'duplicate'; readonly id: LookId; readonly source: LookId}
  | {readonly kind: 'rename'; readonly id: LookId; readonly name: string}
  | {
      readonly kind: 'delete';
      readonly id: LookId;
      readonly confirmed?: boolean;
    };

export interface LookListContext {
  readonly current: LookId;
  readonly macros: readonly Macro[];
}

export interface LookListProblem {
  readonly reason:
    | 'missing'
    | 'duplicate-id'
    | 'full'
    | 'current'
    | 'empty'
    | 'taken'
    | 'confirmation-required';
  readonly macros?: readonly string[];
}

type EditResult = Result<LooksFile, LookListProblem>;

function refused(reason: LookListProblem['reason']): EditResult {
  return {ok: false, error: {reason}};
}

function unusedName(base: string, looks: readonly Look[]): string {
  const names = new Set(looks.map(look => look.name.trim()));
  let name = base;
  for (let suffix = 2; names.has(name); suffix++) name = `${base} ${suffix}`;
  return name;
}

function copyLook(
  file: LooksFile,
  edit: Extract<LookListEdit, {kind: 'add' | 'duplicate'}>,
  current: LookId,
): EditResult {
  if (file.looks.length >= LOOK_LIST_LIMIT) return refused('full');
  if (file.looks.some(look => look.id === edit.id)) {
    return refused('duplicate-id');
  }
  const sourceId = edit.kind === 'add' ? current : edit.source;
  const source = file.looks.find(look => look.id === sourceId);
  if (source === undefined) return refused('missing');
  const name = unusedName(
    edit.kind === 'add' ? '새 Look' : `${source.name} 복사본`,
    file.looks,
  );
  return {
    ok: true,
    value: {...file, looks: [...file.looks, {...source, id: edit.id, name}]},
  };
}

function renameLook(
  file: LooksFile,
  edit: Extract<LookListEdit, {kind: 'rename'}>,
): EditResult {
  if (!file.looks.some(look => look.id === edit.id)) return refused('missing');
  const problem = nameProblem(edit.name, file.looks, edit.id);
  if (problem !== undefined) return refused(problem);
  return {
    ok: true,
    value: {
      ...file,
      looks: file.looks.map(look =>
        look.id === edit.id ? {...look, name: edit.name.trim()} : look,
      ),
    },
  };
}

function deleteLook(
  file: LooksFile,
  edit: Extract<LookListEdit, {kind: 'delete'}>,
  context: LookListContext,
): EditResult {
  if (!file.looks.some(look => look.id === edit.id)) return refused('missing');
  if (file.current === edit.id || context.current === edit.id) {
    return refused('current');
  }
  const macros = context.macros
    .filter(macro =>
      macro.actions.some(
        action =>
          isKnownMacroAction(action) &&
          action.kind === 'look' &&
          action.look === edit.id,
      ),
    )
    .map(macro => macro.name);
  if (macros.length > 0 && edit.confirmed !== true) {
    return {ok: false, error: {reason: 'confirmation-required', macros}};
  }
  return {
    ok: true,
    value: {...file, looks: file.looks.filter(look => look.id !== edit.id)},
  };
}

/** Applies Look lifecycle rules while preserving styles and unknown fields. */
export function editLookList(
  file: LooksFile,
  edit: LookListEdit,
  context: LookListContext,
): EditResult {
  switch (edit.kind) {
    case 'add':
    case 'duplicate':
      return copyLook(file, edit, context.current);
    case 'rename':
      return renameLook(file, edit);
    case 'delete':
      return deleteLook(file, edit, context);
  }
}
