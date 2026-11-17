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

type SettingsApi = Pick<LlpApi, 'settings'> & Partial<Pick<LlpApi, 'log'>>;

// NOTE(0913vision): the newest document each window has seen, so a panel that
// mounts again (진행 after 준비) draws with it at once while it reads again.
const seen = new WeakMap<SettingsApi, Map<SettingsName, SettingsDocument>>();

function remember(api: SettingsApi, document: SettingsDocument): void {
  const documents = seen.get(api) ?? new Map<SettingsName, SettingsDocument>();
  seen.set(api, documents);
  const known = documents.get(document.name);
  if (known === undefined || known.revision <= document.revision) {
    documents.set(document.name, document);
  }
}

function recalled<TName extends SettingsName>(
  api: SettingsApi | undefined,
  name: TName | null,
): NamedDocument<TName> | null {
  if (api === undefined || name === null) return null;
  const known = seen.get(api)?.get(name);
  return known !== undefined && isNamed(known, name) ? known : null;
}

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
 * @returns The document; until the first read answers, the newest one this
 * window has seen, or `null` when it has seen none. A failure is logged and
 * reported through `onProblem`.
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
  readonly api: SettingsApi | undefined;
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
      remember(api, next);
      setLoaded({request, document: next});
      ready?.();
    };
    const stop = api.settings.subscribe(accept);
    const fail = (cause: unknown): void => {
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
    };
    api.settings.get({name}).then(next => {
      if (!isNamed(next, name)) {
        fail(new Error(`Unexpected ${name} settings reply`));
        return;
      }
      accept(next);
    }, fail);
    return () => {
      active = false;
      ready?.();
      stop();
    };
  }, [name, title, request, api, readiness]);
  return loaded?.request === request
    ? loaded.document
    : recalled(api, name);
}
