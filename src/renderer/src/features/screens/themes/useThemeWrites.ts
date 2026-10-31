import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {ThemesFile} from '@core/schema/themes';
import type {ThemeEditResult} from '@core/themes/themeEdits';
import type {NamedDocument} from '@renderer/platform/useSettingsDocument';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {ThemeEditor} from './themeEditor';
import {THEME_READ_ONLY, themeProblems} from './themeNames';
export function useThemeWrites(
  document: NamedDocument<'themes'> | null,
  onProblem: ((notice: Notice) => void) | undefined,
) {
  const [file, setFile] = useState<ThemesFile | null>(null);

  const reportRef = useRef(onProblem);

  const mounted = useRef(true);

  const api = window.llp;

  const report = (title: string): void =>
    reportRef.current?.({
      key: 'screens:themes',
      kind: 'warning',
      icon: 'warning',
      title,
      time: noticeTime(),
    });

  const reportError = (error: unknown): void => {
    api?.log.write({
      level: 'error',
      message: 'Could not edit a theme',
      detail: error instanceof Error ? error.message : String(error),
    });
    report('테마 변경 실패');
  };

  const editor = useRef<ThemeEditor | null>(null);

  useLayoutEffect(() => {
    if (api === undefined) return undefined;
    const current = new ThemeEditor(
      api,
      value => {
        if (mounted.current) setFile(value);
      },
      title =>
        reportRef.current?.({
          key: 'screens:themes:save',
          kind: 'warning',
          icon: 'warning',
          title,
          time: noticeTime(),
        }),
    );
    editor.current = current;
    return () => {
      editor.current = null;
    };
  }, [api]);

  useLayoutEffect(() => {
    reportRef.current = onProblem;
  });

  useLayoutEffect(() => {
    editor.current?.adopt(document);
  }, [api, document]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reason = document?.access !== 'editable' ? THEME_READ_ONLY : undefined;

  const change = async (
    transform: (value: ThemesFile) => ThemeEditResult,
    completion: 'applied' | 'saved' = 'applied',
  ) => {
    if (reason !== undefined || editor.current === null) {
      return {ok: true, value: false} as const;
    }
    return editor.current.change(transform, completion);
  };

  const apply = (
    transform: (value: ThemesFile) => ThemeEditResult,
    completed?: (saved: boolean) => void,
  ): void => {
    change(transform)
      .then(result => {
        if (!mounted.current) return;
        if (!result.ok) report(themeProblems[result.error]);
        completed?.(result.ok && result.value);
      })
      .catch((error: unknown) => {
        reportError(error);
        completed?.(false);
      });
  };
  return {file, reason, change, apply, report, reportError};
}
export type ThemeWrites = ReturnType<typeof useThemeWrites>;
