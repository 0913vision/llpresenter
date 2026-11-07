import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {SlidesEditorTarget} from '@contracts/ipc/slidesEditor';
import {isItemOfKind} from '@core/schema/service';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import type {SlidesListSession} from './slidesListSession';
import {SlidesItemSessions} from './slidesItemSessions';
import {editorTask} from '../../songs/editor/editorTask';

const noSubscribe = (): (() => void) => () => undefined;

/** The inline item view borrows automatically saved sessions; leaving never asks. */
export function useSlidesEditor(
  api: LlpApi | undefined,
  report: (notice: Notice) => void,
  options: {
    readonly beforeOpen?: (open: () => void) => void;
    readonly onOpened?: (target: SlidesEditorTarget) => void;
    readonly positionOf?: (target: SlidesEditorTarget) => number;
  } = {},
) {
  const pool = useMemo(
    () => new SlidesItemSessions(api, report),
    [api, report],
  );
  useSyncExternalStore(pool.subscribe, pool.getSnapshot);
  const stopped = useSyncExternalStore(
    api === undefined
      ? noSubscribe
      : listener => pendingWritesOf(api).subscribe(listener),
    () => api === undefined || pendingWritesOf(api).isStopped,
  );
  const [session, setSession] = useState<SlidesListSession | null>(null);
  const [focusText, setFocusText] = useState(false);
  const consumeTextFocus = useCallback(() => setFocusText(false), []);
  const target = useRef<SlidesEditorTarget | null>(null);
  const generation = useRef(0);
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });
  const problem = (title: string): void =>
    report({
      key: 'slides-editor',
      kind: 'warning',
      icon: 'warning',
      title,
      time: noticeTime(),
    });
  const close = (): void => {
    generation.current++;
    target.current = null;
    pool.pin(null);
    setSession(null);
    setFocusText(false);
  };
  const requestLeave = (proceed: () => void): void => {
    close();
    proceed();
  };
  const follow = useEffectEvent((next: SlidesEditorTarget | null): void => {
    if (api === undefined || next === null) return;
    if (
      target.current?.serviceId === next.serviceId &&
      target.current.itemId === next.itemId
    ) {
      return;
    }
    generation.current++;
    const proceed = (): void => {
      const turn = ++generation.current;
      const load = async (): Promise<void> => {
        try {
          const document = await api.services.get(next.serviceId);
          if (turn !== generation.current) return;
          const item = document?.service.order.find(
            item => item.id === next.itemId,
          );
          if (
            document?.access === 'readOnly' ||
            item === undefined ||
            !isItemOfKind(item, 'slides')
          ) {
            problem('슬라이드 열기 실패');
            return;
          }
          const commands = pool.sessionFor(item, next);
          commands.draft.select(latest.current.positionOf?.(next) ?? 0);
          target.current = next;
          pool.pin(commands);
          setSession(commands);
          setFocusText(next.focusText === true);
          latest.current.onOpened?.(next);
        } catch (error) {
          console.error('Could not open slides', error);
          if (turn === generation.current) {
            problem('슬라이드 열기 실패');
          }
        }
      };
      editorTask(load());
    };
    if (latest.current.beforeOpen === undefined) proceed();
    else latest.current.beforeOpen(proceed);
  });
  useEffect(() => {
    if (api === undefined) return;
    pool.activate();
    let alive = true;
    let pushed = false;
    const stop = api.slidesEditor.onRetarget(next => {
      pushed = true;
      follow(next);
    });
    api.slidesEditor.target().then(
      next => {
        if (alive && !pushed) follow(next);
      },
      (error: unknown) => console.error('Could not read slides target', error),
    );
    const stopDraft = pendingWritesOf(api).addDraft(
      async () => ((await pool.flush()) ? 'settled' : 'failed'),
      error => console.error('Could not flush slides edits', error),
    );
    const invalidate = (): void => {
      generation.current++;
    };
    return () => {
      alive = false;
      invalidate();
      stop();
      stopDraft();
      pool.dispose();
    };
  }, [api, pool]);
  return {
    draft: session?.draft ?? null,
    session,
    focusText,
    consumeTextFocus,
    sessionFor: pool.sessionFor,
    requestLeave,
    close,
    problem,
    stopped,
    update: (): void => session?.invalidate(),
    flush: pool.flush,
  };
}

export type SlidesEditorModel = ReturnType<typeof useSlidesEditor>;
