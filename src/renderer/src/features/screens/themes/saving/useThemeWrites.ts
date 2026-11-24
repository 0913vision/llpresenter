import {useLayoutEffect, useRef, useState} from 'react';
import type {Themes} from '@core/schema/screens/themes';
import type {ThemeListResult} from '@core/theme';
import {type Notice, warningNotice} from '@renderer/ui/popups/notices';
import {THEME_READ_ONLY} from '../themeNames';
import {ThemesEditor} from './themesEditor';
import {useThemeDraft} from './useThemeDraft';
import {useAlive} from '@renderer/ui/useAlive';
import type {NamedDocument} from '@core/schema/app/settingsDocuments';

/** The saved themes, the draft of one of them, and the writes of both. */
export function useThemeWrites(
  document: NamedDocument<'themes'> | null,
  onProblem: ((notice: Notice) => void) | undefined,
) {
  const [saved, setSaved] = useState<Themes | null>(null);
  const reportRef = useRef(onProblem);
  const mounted = useAlive();
  const api = window.llp;

  const report = (title: string): void =>
    reportRef.current?.(warningNotice('screens:themes', title));

  const reportError = (error: unknown): void => {
    api?.log.write({
      level: 'error',
      message: 'Could not edit a theme',
      detail: error instanceof Error ? error.message : String(error),
    });
    report('테마 변경 실패');
  };

  const editor = useRef<ThemesEditor | null>(null);
  useLayoutEffect(() => {
    if (api === undefined) return undefined;
    const current = new ThemesEditor(
      api,
      value => {
        if (mounted.current) setSaved(value);
      },
      title => reportRef.current?.(warningNotice('screens:themes:save', title)),
    );
    editor.current = current;
    return () => {
      editor.current = null;
    };
  }, [api, mounted]);
  useLayoutEffect(() => {
    reportRef.current = onProblem;
  });
  useLayoutEffect(() => {
    editor.current?.adopt(document);
  }, [api, document]);

  const reason = document?.access !== 'editable' ? THEME_READ_ONLY : undefined;

  const write = async (
    transform: (list: Themes) => ThemeListResult,
    completion: 'applied' | 'saved' = 'applied',
  ) => {
    if (reason !== undefined || editor.current === null) {
      return {ok: true, value: false} as const;
    }
    return editor.current.change(transform, completion);
  };

  const draft = useThemeDraft({saved, reason, write, report});

  /** Changes the list itself at once, as a step of the same history. */
  const change = async (
    transform: (list: Themes) => ThemeListResult,
    completion: 'applied' | 'saved' = 'applied',
  ) => {
    let before: Themes | undefined;
    let after: Themes | undefined;
    const result = await write(list => {
      const changed = transform(list);
      if (changed.ok) {
        before = list;
        after = changed.value;
      }
      return changed;
    }, completion);
    if (mounted.current && result.ok && result.value && before && after) {
      draft.recordSaved(before, after);
    }
    return result;
  };

  return {...draft, saved, reason, change, report, reportError};
}
export type ThemeWrites = ReturnType<typeof useThemeWrites>;
