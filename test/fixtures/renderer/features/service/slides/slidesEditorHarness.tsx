import {useSyncExternalStore, type JSX} from 'react';
import type {ControlSession} from '@renderer/app/controlSession';
import {SlidesEditor} from '@renderer/features/service/slides/SlidesEditor';
import {useSlidesEditor} from '@renderer/features/service/slides/useSlidesEditor';
import {NotificationStack} from '@renderer/ui/Notification';

export function SlidesEditorHarness({
  session,
}: {
  readonly session: ControlSession;
}): JSX.Element | null {
  const model = useSlidesEditor(session.api, session.report);
  const notices = useSyncExternalStore(session.subscribe, session.getNotices);
  return session.api === undefined ? null : (
    <>
      <SlidesEditor
        api={session.api}
        store={session.editor}
        model={model}
        onBack={() => model.requestLeave(() => undefined)}
      />
      <NotificationStack notices={notices} onClose={session.dismiss} />
    </>
  );
}
