import {useLayoutEffect, useRef} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {useLive} from '@renderer/session/live';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import type {NamedDocument} from '../../../platform/useSettingsDocument';
import {LookListEditor} from './lookListEditor';
import type {LookListEdit} from '@core/looks/lookListEdits';
import type {LookCardEdit} from '@core/looks/lookCardEdits';
import type {LyricStyleEdit} from '@core/looks/lyricStyleEdits';
import type {MessageStyleChange} from '@core/looks/messageStyleEdits';
import type {MessageStyleId} from '@core/schema/ids';
import type {
  assignMessageStyle,
  createAndAssignMessageStyle,
} from '@core/looks/messageStyleAssignment';
import type {LyricEffectsChange} from '@core/looks/lyricEffectsEdits';
import type {LyricStyleId} from '@core/schema/ids';
import type {LyricStyleListEdit} from './lyricStyleListEdits';

const sessions = new WeakMap<LlpApi, ReturnType<typeof createSession>>();

function createSession(api: LlpApi) {
  const reporters = new Set<(notice: Notice) => void>();
  let macros: NamedDocument<'macros'> | null = null;
  const report = (title: string): void => {
    reporters.values().next().value?.({
      key: 'screens:looks:save',
      kind: 'warning',
      icon: 'warning',
      title,
      time: noticeTime(),
    });
  };
  const editor: LookListEditor = new LookListEditor(api, report, () => {
    const document = editor.getSnapshot();
    if (document === null) throw new Error('Missing Looks document');
    return {
      current: useLive.getState().state?.lookId ?? document.value.current,
      macros: macros?.value.macros ?? [],
    };
  });
  return {
    editor,
    reporters,
    report,
    adoptMacros: (next: NamedDocument<'macros'> | null): void => {
      if (next !== null && next.revision > (macros?.revision ?? -1)) {
        macros = next;
      }
    },
  };
}

function sessionFor(api: LlpApi) {
  let session = sessions.get(api);
  if (session === undefined) {
    session = createSession(api);
    sessions.set(api, session);
  }
  return session;
}

/** Shares Look writes across panels, using the latest live and macro context. */
export function useLookListEditor(
  document: NamedDocument<'looks'> | null,
  macros: NamedDocument<'macros'> | null,
  onProblem: ((notice: Notice) => void) | undefined,
) {
  const session = useRef<ReturnType<typeof createSession> | null>(null);
  const api = window.llp;
  useLayoutEffect(() => {
    if (api === undefined) return undefined;
    const current = sessionFor(api);
    session.current = current;
    const report = (notice: Notice): void => onProblem?.(notice);
    if (onProblem !== undefined) current.reporters.add(report);
    return () => {
      current.reporters.delete(report);
      session.current = null;
    };
  }, [api, onProblem]);
  useLayoutEffect(() => {
    session.current?.editor.adopt(document);
    session.current?.adoptMacros(macros);
  });
  return {
    change: (edit: LookListEdit) => session.current?.editor.change(edit),
    changeCard: (edit: LookCardEdit) =>
      session.current?.editor.changeCard(edit),
    assignMessage: (input: Parameters<typeof assignMessageStyle>[1]) =>
      session.current?.editor.assignMessage(input),
    createMessage: (input: Parameters<typeof createAndAssignMessageStyle>[1]) =>
      session.current?.editor.createMessage(input),
    changeMessageStyle: (id: MessageStyleId, change: MessageStyleChange) =>
      session.current?.editor.changeMessageStyle(id, change),
    changeStyle: (edit: LyricStyleEdit) =>
      session.current?.editor.changeStyle(edit),
    changeEffects: (id: LyricStyleId, change: LyricEffectsChange) =>
      session.current?.editor.changeEffects(id, change),
    changeStyleList: (edit: LyricStyleListEdit) =>
      session.current?.editor.changeStyleList(edit),
    report: (title: string): void => session.current?.report(title),
  };
}
