import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {
  SettingsDocument,
  SettingsName,
} from '@shared/schema/settingsDocuments';
import {noticeTime, type Notice} from '@renderer/ui/notices';

/** One settings document, narrowed by its file name. */
export type NamedDocument<TName extends SettingsName> = Extract<
  SettingsDocument,
  {name: TName}
>;

function isNamed<TName extends SettingsName>(
  document: SettingsDocument,
  name: TName,
): document is NamedDocument<TName> {
  return document.name === name;
}

/**
 * Reads one settings document and follows its changes. It keeps the newest
 * revision, so a slow first read never replaces a push, and it releases its
 * subscription when the window leaves 화면 설정.
 *
 * @returns The document, or `null` until the first read answers or when it
 * fails; a failure is logged and reported through `onProblem`.
 */
export function useSettingsDocument<TName extends SettingsName>(
  name: TName,
  title: string,
  onProblem: ((notice: Notice) => void) | undefined,
): NamedDocument<TName> | null {
  const [document, setDocument] = useState<NamedDocument<TName> | null>(null);
  const report = useRef(onProblem);
  useLayoutEffect(() => {
    report.current = onProblem;
  });
  useEffect(() => {
    const api = window.llp;
    if (api === undefined) return undefined;
    let active = true;
    let revision = -1;
    const accept = (next: SettingsDocument): void => {
      if (!active || !isNamed(next, name) || next.revision <= revision) return;
      revision = next.revision;
      setDocument(next);
    };
    const stop = api.settings.subscribe(accept);
    api.settings.get({name}).then(accept, (cause: unknown) => {
      api.log.write({
        level: 'error',
        message: `Could not load ${name} settings`,
        detail: cause instanceof Error ? cause.message : String(cause),
      });
      if (!active || revision >= 0) return;
      report.current?.({
        key: `screens:load:${name}`,
        kind: 'warning',
        icon: 'warning',
        title: `${title} 불러오기 실패`,
        time: noticeTime(),
      });
    });
    return () => {
      active = false;
      stop();
    };
  }, [name, title]);
  return document;
}
