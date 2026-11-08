import {
  Activity,
  useCallback,
  useEffect,
  useRef,
  useState,
  type JSX,
} from 'react';
import type {SettingsRequest, PreferencesRequest} from '@contracts/ipc/window';
import type {PreferencePageId} from '@core/schema/preferencePages';
import type {PreferencesViewHandle} from '@renderer/features/preferences/PreferencesView';
import type {ControlSession} from './controlSession';
import {PreferencesWindow} from './PreferencesWindow';
import {ScreensWindow} from './ScreensWindow';
import styles from './SettingsWindow.module.css';

/** Keeps both settings views in one renderer and suspends hidden view effects. */
export function SettingsWindow({
  session,
  closeFlush,
}: {
  readonly session: ControlSession;
  readonly closeFlush: ControlSession['closeFlush'];
}): JSX.Element {
  const api = window.llp?.window;
  const [current, setCurrent] = useState<SettingsRequest | null>(null);
  const shown = useRef<SettingsRequest | null>(null);
  const preferences = useRef<PreferencesViewHandle>(null);
  const start = useRef<Promise<SettingsRequest> | null>(null);
  useEffect(() => {
    if (api === undefined) return undefined;
    let alive = true;
    let processing = false;
    let reopening = true;
    let next: SettingsRequest | null = null;
    const take = (): SettingsRequest | null => {
      const request = next;
      next = null;
      return request;
    };
    const waiting = (): boolean => next !== null;
    const active = (): boolean => alive;
    const change = async (request: SettingsRequest): Promise<void> => {
      const focused = document.activeElement;
      if (focused instanceof HTMLElement) focused.blur();
      if (
        shown.current?.view === 'preferences' &&
        (request.view !== 'preferences' || request.page !== shown.current.page)
      ) {
        const settled = (await preferences.current?.settle()) ?? true;
        if (!active() || waiting()) return;
        if (!settled) {
          api.rejectSettingsRequest(request);
          return;
        }
      }
      const accepted = await api.beginSettingsRequest(request);
      if (!active() || !accepted || waiting()) return;
      if (!request.preparing && reopening) {
        session.resume();
        reopening = false;
      }
      shown.current = request;
      document.title = request.view === 'screens' ? '화면 설정' : '환경설정';
      setCurrent(request);
    };
    const run = async (): Promise<void> => {
      if (processing) return;
      processing = true;
      try {
        while (active()) {
          const request = take();
          if (request === null) break;
          await change(request);
        }
      } finally {
        processing = false;
      }
    };
    const accept = (request: SettingsRequest): void => {
      if (request.preparing) reopening = true;
      next = request;
      run().catch((error: unknown) =>
        window.llp?.log.write({
          level: 'error',
          message: 'Could not change the settings view',
          detail: error instanceof Error ? error.message : String(error),
        }),
      );
    };
    start.current ??= api.settingsRequest();
    let pushed = false;
    start.current.then(
      request => {
        if (alive && !pushed) accept(request);
      },
      (error: unknown) =>
        window.llp?.log.write({
          level: 'error',
          message: 'Could not read the settings view',
          detail: error instanceof Error ? error.message : String(error),
        }),
    );
    const stop = api.onSettingsRequest(request => {
      pushed = true;
      accept(request);
    });
    return () => {
      alive = false;
      next = null;
      stop();
    };
  }, [api, session]);
  const preferencesReady = useCallback(
    (request: PreferencesRequest): void => {
      const active = shown.current;
      if (active?.view === 'preferences') {
        api?.settingsReady({...active, ...request});
      }
    },
    [api],
  );
  const selectPage = useCallback(
    (page: PreferencePageId): void => api?.openPreferencesAt(page),
    [api],
  );
  const screensReady = useCallback((): void => {
    if (current?.view === 'screens') api?.settingsReady(current);
  }, [api, current]);
  return (
    <div className={styles.window}>
      <Activity mode={current?.view === 'preferences' ? 'visible' : 'hidden'}>
        <PreferencesWindow
          session={session}
          closeFlush={closeFlush}
          request={current?.view === 'preferences' ? current : undefined}
          onReady={preferencesReady}
          onPageSelect={selectPage}
          viewRef={preferences}
        />
      </Activity>
      <Activity mode={current?.view === 'screens' ? 'visible' : 'hidden'}>
        <ScreensWindow
          closeFlush={closeFlush}
          onReady={screensReady}
          preparing={current?.preparing ?? true}
          requestId={current?.requestId}
        />
      </Activity>
    </div>
  );
}
