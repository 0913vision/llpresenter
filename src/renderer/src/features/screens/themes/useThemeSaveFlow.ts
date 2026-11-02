import {useRef, useState} from 'react';
import type {ThemeId} from '@core/schema/ids';

type SaveDialog =
  | {readonly kind: 'overwrite'}
  | {readonly kind: 'saveAs'}
  | {
      readonly kind: 'leave';
      readonly proceed: () => void;
      readonly cancel?: (() => void) | undefined;
    };

interface SaveFlowOptions {
  readonly dirtyThemeId: ThemeId | null;
  /** Reads the draft itself, so an edit committed a moment ago counts. */
  readonly hasDraft: () => boolean;
  readonly save: () => Promise<boolean>;
  readonly discard: () => void;
  readonly reportError: (error: unknown) => void;
}

/** Which question the 테마 editor asks about unsaved edits, and its answers. */
export function useThemeSaveFlow({
  dirtyThemeId,
  hasDraft,
  save,
  discard,
  reportError,
}: SaveFlowOptions) {
  const [dialog, setDialog] = useState<SaveDialog | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  const close = (): void => {
    if (dialog?.kind === 'leave') dialog.cancel?.();
    setDialog(null);
  };

  const saveThen = async (proceed: () => void): Promise<void> => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      if (await save()) {
        setDialog(null);
        proceed();
      }
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return {
    dialog,
    saving,
    close,
    askOverwrite: (): void => {
      if (dirtyThemeId !== null) setDialog({kind: 'overwrite'});
    },
    askSaveAs: (): void => setDialog({kind: 'saveAs'}),
    askLeave: (proceed: () => void, cancel?: () => void): void => {
      if (hasDraft()) setDialog({kind: 'leave', proceed, cancel});
      else proceed();
    },
    overwrite: (): void => {
      saveThen(() => undefined).catch(reportError);
    },
    saveAndLeave: (proceed: () => void): void => {
      saveThen(proceed).catch(reportError);
    },
    discardAndLeave: (proceed: () => void): void => {
      discard();
      setDialog(null);
      proceed();
    },
  };
}
export type ThemeSaveFlow = ReturnType<typeof useThemeSaveFlow>;
