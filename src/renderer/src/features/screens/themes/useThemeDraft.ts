import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import {createThemeId, type ThemeId} from '@core/schema/ids';
import type {ThemesFile} from '@core/schema/themes';
import {
  commitDraft,
  editDraft,
  saveDraftAs,
  withDraft,
  type ThemeDraft,
} from '@core/themes/themeDraft';
import {
  findTheme,
  type ThemeEditProblem,
  type ThemeEditResult,
} from '@core/themes/themeEdits';
import {themeProblems} from './themeNames';

interface DraftWrites {
  readonly saved: ThemesFile | null;
  readonly reason: string | undefined;
  readonly change: (
    transform: (value: ThemesFile) => ThemeEditResult,
    completion: 'saved',
  ) => Promise<
    | {readonly ok: true; readonly value: boolean}
    | {readonly ok: false; readonly error: ThemeEditProblem}
  >;
  readonly report: (title: string) => void;
}

/** The most unsaved edits the working copy can step back through. */
export const THEME_HISTORY_LIMIT = 100;

/**
 * The editor's working copy of one 테마's layouts. Edits change only the
 * copy; 덮어쓰기 and 다른 이름으로 저장 write it.
 */
export function useThemeDraft({saved, reason, change, report}: DraftWrites) {
  const [draft, setDraft] = useState<ThemeDraft | null>(null);
  const draftRef = useRef<ThemeDraft | null>(null);
  const savedRef = useRef(saved);
  useLayoutEffect(() => {
    savedRef.current = saved;
  });
  const past = useRef<Array<ThemeDraft | null>>([]);
  const future = useRef<Array<ThemeDraft | null>>([]);
  const keep = (next: ThemeDraft | null): void => {
    draftRef.current = next;
    setDraft(next);
  };
  const forget = (): void => {
    past.current = [];
    future.current = [];
  };
  const file = useMemo(
    () => (saved === null ? null : withDraft(saved, draft)),
    [saved, draft],
  );
  const dirtyThemeId: ThemeId | null =
    saved !== null &&
    draft !== null &&
    findTheme(saved, draft.themeId) !== undefined
      ? draft.themeId
      : null;

  const edit = (
    themeId: ThemeId,
    transform: (shown: ThemesFile) => ThemeEditResult,
    completed?: (applied: boolean) => void,
  ): void => {
    const base = savedRef.current;
    if (reason !== undefined || base === null) {
      completed?.(false);
      return;
    }
    const result = editDraft(
      {saved: base, draft: draftRef.current, themeId},
      transform,
    );
    if (!result.ok) report(themeProblems[result.error]);
    else {
      past.current = [...past.current, draftRef.current].slice(
        -THEME_HISTORY_LIMIT,
      );
      future.current = [];
      keep(result.value);
    }
    completed?.(result.ok);
  };

  const step = (from: typeof past, to: typeof past): void => {
    if (reason !== undefined || from.current.length === 0) return;
    const previous = from.current.pop() ?? null;
    to.current.push(draftRef.current);
    keep(previous);
  };
  const undo = (): void => step(past, future);
  const redo = (): void => step(future, past);

  const commit = async (
    write: (value: ThemesFile) => ThemeEditResult,
  ): Promise<boolean> => {
    const result = await change(write, 'saved');
    if (!result.ok) report(themeProblems[result.error]);
    return result.ok && result.value;
  };

  const save = async (): Promise<boolean> => {
    const current = draftRef.current;
    if (current === null) return true;
    const written = await commit(value => commitDraft(value, current));
    if (written && draftRef.current === current) {
      forget();
      keep(null);
    }
    return written;
  };

  const saveAs = async (
    themeId: ThemeId,
    name: string,
  ): Promise<ThemeId | undefined> => {
    const base = savedRef.current;
    const original = base === null ? undefined : findTheme(base, themeId);
    if (original === undefined) return undefined;
    const current =
      draftRef.current?.themeId === themeId
        ? draftRef.current
        : {themeId, screens: original.screens};
    const copy = {id: createThemeId(crypto.randomUUID()), name};
    const written = await commit(value => saveDraftAs(value, current, copy));
    if (!written) return undefined;
    if (draftRef.current === current) {
      forget();
      keep(null);
    }
    return copy.id;
  };

  return {
    file,
    dirtyThemeId,
    hasDraft: (): boolean => draftRef.current !== null,
    edit,
    save,
    saveAs,
    undo,
    redo,
    discard: () => {
      forget();
      keep(null);
    },
  };
}
