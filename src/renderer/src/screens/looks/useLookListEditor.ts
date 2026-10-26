import {useLayoutEffect, useRef} from 'react';
import type {LlpApi} from '@shared/ipc';
import {useLive} from '@renderer/state/live';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import type {NamedDocument} from '../useSettingsDocument';
import {LookListEditor} from './lookListEditor';
import type {LookListEdit} from './lookListEdits';

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
    if (onProblem !== undefined) current.reporters.add(onProblem);
    return () => {
      if (onProblem !== undefined) current.reporters.delete(onProblem);
      session.current = null;
    };
  }, [api, onProblem]);
  useLayoutEffect(() => {
    session.current?.editor.adopt(document);
    session.current?.adoptMacros(macros);
  });
  return {
    change: (edit: LookListEdit) => session.current?.editor.change(edit),
    report: (title: string): void => session.current?.report(title),
  };
}
