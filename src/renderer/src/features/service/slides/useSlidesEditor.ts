import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {SlidesEditorTarget} from '@contracts/ipc/slidesEditor';
import {isItemOfKind} from '@core/schema/service';
import {mergeSlidesChanges, SlidesDraft} from '@core/services/slidesEdits';
import {
  pendingWritesOf,
  type DraftOutcome,
} from '@renderer/platform/pendingWrites';
import {updateServiceItem} from '@renderer/session/serviceItemUpdate';
import {noticeTime, type Notice} from '@renderer/ui/notices';

interface Leave {
  readonly proceed: () => void;
  readonly cancel?: (() => void) | undefined;
}

/** Keeps unsaved changes until 저장, a guarded retarget, or close preflight. */
export function useSlidesEditor(api: LlpApi, report: (notice: Notice) => void) {
  const writes = pendingWritesOf(api);
  const stopped = useSyncExternalStore(
    listener => writes.subscribe(listener),
    () => writes.isStopped,
  );
  const [draft, setDraft] = useState<SlidesDraft | null>(null);
  const [, refresh] = useState(0);
  const [leave, setLeave] = useState<Leave | null>(null);
  const pendingLeave = useRef<Leave | null>(null);
  const [saving, setSaving] = useState(false);
  const current = useRef<SlidesDraft | null>(null);
  const target = useRef<SlidesEditorTarget | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const problem = (title: string): void =>
    report({
      key: 'slides-editor',
      kind: 'warning',
      icon: 'warning',
      title,
      time: noticeTime(),
    });
  const update = (): void => refresh(value => value + 1);
  const changeLeave = (next: Leave | null): void => {
    pendingLeave.current = next;
    setLeave(next);
  };
  const askLeave = (proceed: () => void, cancel?: () => void): void => {
    pendingLeave.current?.cancel?.();
    if (current.current?.dirty === true) changeLeave({proceed, cancel});
    else {
      changeLeave(null);
      proceed();
    }
  };
  const open = async (
    next: SlidesEditorTarget,
    turn: number,
  ): Promise<void> => {
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
      const loaded = new SlidesDraft(item);
      target.current = next;
      current.current = loaded;
      setDraft(loaded);
    } catch (error) {
      console.error('Could not open slides', error);
      if (turn === generation.current) problem('슬라이드 열기 실패');
    }
  };
  const follow = useEffectEvent((next: SlidesEditorTarget | null): void => {
    if (next === null) return;
    if (
      target.current?.serviceId === next.serviceId &&
      target.current.itemId === next.itemId
    ) {
      generation.current++;
      const canceled = pendingLeave.current;
      changeLeave(null);
      canceled?.cancel?.();
      return;
    }
    const turn = ++generation.current;
    askLeave(() => {
      open(next, turn).catch((error: unknown) =>
        console.error('Could not open slides', error),
      );
    });
  });
  const settle = useEffectEvent(
    () =>
      new Promise<DraftOutcome>(resolve => {
        askLeave(
          () => resolve('settled'),
          () => resolve('canceled'),
        );
      }),
  );
  useEffect(() => {
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
      () => settle(),
      error => console.error('Could not settle slides edits', error),
    );
    const invalidate = (): void => {
      generation.current++;
    };
    return () => {
      alive = false;
      invalidate();
      stop();
      stopDraft();
      pendingLeave.current?.cancel?.();
      pendingLeave.current = null;
    };
  }, [api]);

  const save = async (): Promise<boolean> => {
    const active = current.current;
    const destination = target.current;
    if (active === null || destination === null || busy.current) return false;
    if (!active.dirty) return true;
    const capture = active.snapshot.item;
    const base = active.base;
    const mergeOutcome = {conflict: false};
    busy.current = true;
    setSaving(true);
    try {
      const result = await pendingWritesOf(api).run({
        write: async () => {
          return updateServiceItem(api, {
            ...destination,
            onApplied: api.slidesEditor.saved,
            change: item => {
              if (!isItemOfKind(item, 'slides')) return null;
              const updated = mergeSlidesChanges(base, capture, item);
              mergeOutcome.conflict = updated === null;
              return updated;
            },
          });
        },
        refused: {
          ok: false as const,
          error: {
            reason: 'request-failed' as const,
            message: 'Edits stopped for closing',
          },
        },
        sent: result => result.ok || result.error.reason === 'write-failed',
      });
      if (!result.ok) {
        problem(
          mergeOutcome.conflict
            ? '다른 창에서 같은 내용을 바꿨습니다'
            : '슬라이드 저장 실패',
        );
        return false;
      }
      active.markSaved(capture);
      update();
      return true;
    } catch (error) {
      console.error('Could not save slides', error);
      problem('슬라이드 저장 실패');
      return false;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  return {
    draft,
    problem,
    update,
    leave,
    saving,
    stopped,
    save,
    cancel: (): void => {
      const next = pendingLeave.current;
      changeLeave(null);
      next?.cancel?.();
    },
    discard: (): void => {
      const next = pendingLeave.current;
      changeLeave(null);
      next?.proceed();
    },
    saveAndLeave: async (): Promise<void> => {
      const next = pendingLeave.current;
      if (next !== null && (await save()) && pendingLeave.current === next) {
        changeLeave(null);
        next.proceed();
      }
    },
  };
}

export type SlidesEditorModel = ReturnType<typeof useSlidesEditor>;
