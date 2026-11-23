import {useRef} from 'react';
import type {Notice} from '@renderer/ui/notices';
import {
  saveMacroCollectionEdit,
  type MacroCollectionEdit,
} from './macroCollectionEdits';
import {saveMacroEdit, type MacroEdit} from './macroEdits';
import {useToolEditing} from './useToolEditing';

/**
 * The writes of the 매크로 panel: macros and 모음 each through their own
 * editing, and a step to run after a save that is dropped when the operator
 * has done something else in the meantime (`moved`).
 */
export function useMacroWrites(
  onProblem: ((notice: Notice) => void) | undefined,
) {
  const turn = useRef(0);
  const macros = useToolEditing({
    api: window.llp,
    write: saveMacroEdit,
    onProblem,
    area: {
      key: 'macros',
      label: '매크로',
      log: 'Could not edit macros',
      history: 'macros',
    },
  });
  const collections = useToolEditing({
    api: window.llp,
    write: saveMacroCollectionEdit,
    onProblem,
    area: {
      key: 'macro-collections',
      label: '모음',
      log: 'Could not edit macro collections',
      history: 'macros',
    },
  });
  /** Runs `after` once `save` holds, unless the operator moved on. */
  const afterSave = (
    save: Promise<boolean>,
    after: (() => void) | undefined,
    failure: string,
  ): void => {
    const at = turn.current;
    save.then(
      saved => {
        if (saved && at === turn.current) after?.();
      },
      (cause: unknown) =>
        window.llp?.log.write({
          level: 'error',
          message: failure,
          detail: String(cause),
        }),
    );
  };
  return {
    /** The macro editing, for its undo and delete keys. */
    macros,
    busy: macros.busy || collections.busy,
    run: macros.run,
    runCollection: collections.run,
    /** The operator did something, so a step waiting on a save is dropped. */
    moved: (): void => {
      turn.current++;
    },
    /** Moves on and resolves whether `save` held with nothing done since. */
    heldUntouched: (save: Promise<boolean>): Promise<boolean> => {
      turn.current++;
      const at = turn.current;
      return save.then(held => held && at === turn.current);
    },
    commit: (edit: MacroEdit, after?: () => void): void =>
      afterSave(macros.run(edit), after, 'Macro edit callback failed'),
    commitCollection: (edit: MacroCollectionEdit, after: () => void): void =>
      afterSave(
        collections.run(edit),
        after,
        'Macro collection callback failed',
      ),
  };
}
