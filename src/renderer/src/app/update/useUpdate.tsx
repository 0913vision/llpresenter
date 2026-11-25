import type {JSX} from 'react';
import type {UpdateApi} from '@contracts/ipc/update';
import type {UpdateAction} from '@core/schema/app/update';
import {Dialog} from '@renderer/ui/popups/Dialog';
import {noticeTime, type Notice} from '@renderer/ui/popups/notices';
import {useOutputs} from '@renderer/session/live';
import {isInProgress, UpdateProgressDialog} from './UpdateProgressDialog';
import {updateChoices, updateFacts, updateTitle} from './updateText';
import {useUpdateSnapshot} from './useUpdateSnapshot';

/** The notice key of the update notice. */
export const UPDATE_NOTICE_KEY = 'app:update';

/**
 * What the update shows: a dialog that asks or reports, a notice while it
 * checks or while an offer waits for the outputs to go off, or nothing. One
 * result serves the app's notice stack and its dialog.
 */
export function useUpdate(
  api: UpdateApi | undefined,
  resumeEdits?: () => void,
): {
  readonly dialog: JSX.Element | null;
  readonly notice: Notice | null;
  readonly dismiss: () => void;
} {
  const snapshot = useUpdateSnapshot(api, resumeEdits);
  const outputs = useOutputs();
  const live = Object.values(outputs).some(Boolean);
  const act = (action: UpdateAction['action']): void => {
    if (snapshot !== null) api?.act({action, revision: snapshot.revision});
  };
  const dismiss = (): void => act('dismiss');
  if (
    snapshot === null ||
    !snapshot.visible ||
    snapshot.status.kind === 'idle'
  ) {
    return {dialog: null, notice: null, dismiss};
  }
  const {status} = snapshot;
  if (isInProgress(status)) {
    return {
      notice: null,
      dismiss,
      dialog: <UpdateProgressDialog status={status} />,
    };
  }
  const outputsOn = live || snapshot.outputsOn;
  const asNotice = snapshot.notice === true;
  const title = snapshot.busy
    ? '이미 업데이트를 확인하거나 내려받고 있습니다.'
    : updateTitle(status);
  const facts = updateFacts(status, {outputsOn, asNotice});
  // NOTE(0913vision): An offer that comes while the outputs are on waits as a
  // notice, so it never covers the screens' control during a service.
  if (
    (asNotice && status.kind === 'available' && outputsOn) ||
    status.kind === 'checking'
  ) {
    return {
      dialog: null,
      dismiss,
      notice: {
        key: UPDATE_NOTICE_KEY,
        kind: 'info',
        icon: 'info',
        title:
          status.kind === 'available'
            ? `새 버전이 있습니다 (${status.version})`
            : title,
        time: noticeTime(),
        meta: facts,
      },
    };
  }
  const choices = updateChoices(status);
  return {
    notice: null,
    dismiss,
    dialog: (
      <Dialog
        key={status.kind}
        size="s"
        title={title}
        initialFocus="primary"
        onCancel={() => act(choices.later ? 'later' : 'dismiss')}
        cancelLabel={choices.later ? '나중에' : null}
        primary={{label: choices.label, onSelect: () => act(choices.action)}}
      >
        {facts.map(fact => (
          <p key={fact}>{fact}</p>
        ))}
      </Dialog>
    ),
  };
}
