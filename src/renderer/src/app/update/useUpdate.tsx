import {useEffect, useState, type JSX} from 'react';
import type {UpdateApi} from '@contracts/ipc/update';
import type {
  UpdateAction,
  UpdateSnapshot,
  UpdateStatus,
} from '@core/schema/update';
import {AlertDialog} from '@renderer/ui/AlertDialog';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {useOutputs} from '@renderer/session/live';

export const UPDATE_NOTICE_KEY = 'app:update';

function titleOf(status: UpdateStatus): string {
  switch (status.kind) {
    case 'idle':
      return '';
    case 'unsupported':
      return '설치된 Windows 앱에서 업데이트를 확인할 수 있습니다';
    case 'checking':
      return '업데이트 확인 중';
    case 'available':
      return `새 버전 ${status.version}을 내려받으시겠습니까?`;
    case 'downloading':
      return `업데이트 내려받는 중 ${status.percent}%`;
    case 'downloaded':
      return `새 버전 ${status.version}을 설치하시겠습니까?`;
    case 'installing':
      return '업데이트 설치 준비 중';
    case 'latest':
      return `최신 버전 ${status.version}을 사용하고 있습니다`;
    case 'error':
      return '업데이트 실패';
  }
}

/** One result shared by the app's existing notice stack and confirmation dialog. */
export function useUpdate(
  api: UpdateApi | undefined,
  resumeEdits?: () => void,
): {
  readonly dialog: JSX.Element | null;
  readonly notice: Notice | null;
  readonly dismiss: () => void;
} {
  const [snapshot, setSnapshot] = useState<UpdateSnapshot | null>(null);
  const outputs = useOutputs();
  const live = Object.values(outputs).some(Boolean);
  useEffect(() => {
    if (api === undefined) return undefined;
    let mounted = true;
    let latestRevision = -1;
    let installing = false;
    const receive = (next: UpdateSnapshot): void => {
      if (!mounted || next.revision < latestRevision) return;
      latestRevision = next.revision;
      if (installing && next.status.kind !== 'installing') resumeEdits?.();
      installing = next.status.kind === 'installing';
      setSnapshot(next);
    };
    const stop = api.subscribe(receive);
    void api.get().then(receive, (error: unknown) => {
      window.llp?.log.write({
        level: 'warn',
        message: 'Could not read update state',
        detail: String(error),
      });
    });
    return () => {
      mounted = false;
      stop();
    };
  }, [api, resumeEdits]);
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
  const outputsOn = live || snapshot.outputsOn;
  const title = snapshot.busy
    ? '이미 업데이트를 확인하거나 내려받고 있습니다'
    : titleOf(status);
  const meta = status.kind === 'error' ? [status.reason] : [];
  const download = status.kind === 'available';
  const install = status.kind === 'downloaded';
  if (
    outputsOn ||
    status.kind === 'checking' ||
    status.kind === 'downloading'
  ) {
    const notice: Notice = {
      key: UPDATE_NOTICE_KEY,
      kind:
        download || install || status.kind === 'downloading'
          ? 'warning'
          : 'info',
      icon: 'info',
      title:
        status.kind === 'available'
          ? `새 버전 ${status.version} 사용 가능`
          : status.kind === 'downloaded'
            ? `새 버전 ${status.version} 내려받기 완료`
            : title,
      time: noticeTime(),
      meta,
      ...(download
        ? {
            actions: [
              {
                icon: 'download',
                label: '내려받기',
                onSelect: () => act('download'),
              },
            ],
          }
        : {}),
    };
    return {dialog: null, notice, dismiss};
  }
  return {
    notice: null,
    dismiss,
    dialog: (
      <AlertDialog
        icon="info"
        title={title}
        meta={meta}
        {...(download || install
          ? {onCancel: () => act('later'), cancelLabel: '나중에'}
          : {})}
        actions={[
          {
            label: download ? '내려받기' : install ? '설치' : '확인',
            primary: true,
            escape: !download && !install,
            onSelect: () =>
              act(download ? 'download' : install ? 'install' : 'dismiss'),
          },
        ]}
      />
    ),
  };
}
