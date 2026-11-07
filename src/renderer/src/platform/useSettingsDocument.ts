import {useContext, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {LoadReadinessContext} from '@renderer/ui/loadReadiness';
import type {LlpApi} from '@contracts/ipc/api';
import type {
  SettingsDocument,
  SettingsName,
} from '@core/schema/settingsDocuments';
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
 * A null name disables its read and subscription.
 *
 * @returns The document, or `null` until the first read answers or when it
 * fails; a failure is logged and reported through `onProblem`.
 */
export function useSettingsDocument<TName extends SettingsName>(
  name: TName | null,
  title: string,
  onProblem: ((notice: Notice) => void) | undefined,
): NamedDocument<TName> | null {
  return useApiSettingsDocument({api: window.llp, name, title, onProblem});
}

export function useApiSettingsDocument<TName extends SettingsName>({
  api,
  name,
  title,
  onProblem,
}: {
  readonly api:
    (Pick<LlpApi, 'settings'> & Partial<Pick<LlpApi, 'log'>>) | undefined;
  readonly name: TName | null;
  readonly title: string;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): NamedDocument<TName> | null {
  const readiness = useContext(LoadReadinessContext);
  const [request, setRequest] = useState({name, api});
  if (request.name !== name || request.api !== api) setRequest({name, api});
  const [loaded, setLoaded] = useState<{
    request: typeof request;
    document: NamedDocument<TName>;
  } | null>(null);
  const report = useRef(onProblem);
  useLayoutEffect(() => {
    report.current = onProblem;
  });
  useEffect(() => {
    if (api === undefined || name === null) return undefined;
    const ready = readiness?.begin();
    let active = true;
    let revision = -1;
    const accept = (next: SettingsDocument): void => {
      if (!active || !isNamed(next, name) || next.revision <= revision) return;
      revision = next.revision;
      setLoaded({request, document: next});
      ready?.();
    };
    const stop = api.settings.subscribe(accept);
    api.settings.get({name}).then(accept, (cause: unknown) => {
      ready?.();
      api.log?.write({
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
      ready?.();
      stop();
    };
  }, [name, title, request, api, readiness]);
  return loaded?.request === request ? loaded.document : null;
}
