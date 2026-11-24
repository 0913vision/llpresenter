import {useEffect, useState, type JSX} from 'react';
import type {UpdateApi} from '@contracts/ipc/update';
import type {
  UpdateAction,
  UpdateSnapshot,
  UpdateStatus,
} from '@core/schema/update';
import {Dialog} from '@renderer/ui/popups/Dialog';
import {Progress} from '@renderer/ui/tiles/StatusMarks';
import styles from './UpdateProgress.module.css';
import {noticeTime, type Notice} from '@renderer/ui/popups/notices';
import {useOutputs} from '@renderer/session/live';

export const UPDATE_NOTICE_KEY = 'app:update';

function titleOf(status: UpdateStatus): string {
  switch (status.kind) {
    case 'idle':
      return '';
    case 'unsupported':
      return '설치된 Windows 앱에서 업데이트를 확인할 수 있습니다.';
    case 'checking':
      return '업데이트 확인 중';
    case 'available':
      return `새 버전 ${status.version}이 있습니다.`;
    case 'downloading':
      return `업데이트 내려받는 중 ${status.percent}%`;
    case 'downloaded':
      return `새 버전 ${status.version}을 설치하시겠습니까?`;
    case 'installing':
      return '업데이트 설치 준비 중';
    case 'restarting':
      return '업데이트 후 다시 시작 중';
    case 'latest':
      return `최신 버전 ${status.version}을 사용하고 있습니다.`;
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
      const nextInstalling =
        next.status.kind === 'installing' || next.status.kind === 'restarting';
      if (installing && !nextInstalling) resumeEdits?.();
      installing = nextInstalling;
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
    ? '이미 업데이트를 확인하거나 내려받고 있습니다.'
    : titleOf(status);
  if (
    status.kind === 'downloading' ||
    status.kind === 'installing' ||
    status.kind === 'restarting'
  ) {
    const step =
      status.kind === 'downloading' ? 0 : status.kind === 'installing' ? 1 : 2;
    return {
      notice: null,
      dismiss,
      dialog: (
        <Dialog
          size="s"
          title="업데이트 중"
          subtitle={{text: `버전 ${status.version}`}}
          initialFocus="surface"
          hideClose
          onCancel={() => undefined}
          cancelLabel={null}
          primary={{
            label: '업데이트 중',
            disabled: true,
            onSelect: () => undefined,
          }}
        >
          <div className={styles.progress}>
            <ol className={styles.steps} aria-label="업데이트 진행">
              {['내려받는 중', '설치 준비', '다시 시작'].map((label, index) => (
                <li
                  key={label}
                  aria-current={index === step ? 'step' : undefined}
                >
                  <span>{label}</span>
                  <span>
                    {index < step
                      ? '완료'
                      : index === step
                        ? '진행 중'
                        : '대기'}
                  </span>
                </li>
              ))}
            </ol>
            <Progress
              label="업데이트 내려받기"
              value={status.kind === 'downloading' ? status.percent : 100}
            />
            <p className={styles.percent}>
              {status.kind === 'downloading' ? status.percent : 100}%
            </p>
          </div>
        </Dialog>
      ),
    };
  }
  const meta =
    status.kind === 'error'
      ? [
          ...(status.version === undefined ? [] : [`버전 ${status.version}`]),
          status.stage === 'download'
            ? '내려받기 실패'
            : status.stage === 'install'
              ? '설치 준비 실패'
              : '업데이트 확인 실패',
          status.reason,
        ]
      : [];
  const download = status.kind === 'available';
  const install = status.kind === 'downloaded';
  if ((download || install) && outputsOn && !snapshot.notice) {
    meta.push('업데이트 중 화면이 꺼지고 다시 시작하면 복원됩니다.');
  }
  if (
    (snapshot.notice === true && download && outputsOn) ||
    status.kind === 'checking'
  ) {
    const notice: Notice = {
      key: UPDATE_NOTICE_KEY,
      kind: 'info',
      icon: 'info',
      title:
        status.kind === 'available'
          ? `새 버전이 있습니다 (${status.version})`
          : title,
      time: noticeTime(),
      meta,
    };
    return {dialog: null, notice, dismiss};
  }
  return {
    notice: null,
    dismiss,
    dialog: (
      <Dialog
        key={status.kind}
        size="s"
        title={title}
        initialFocus="primary"
        onCancel={() => act(download || install ? 'later' : 'dismiss')}
        cancelLabel={download || install ? '나중에' : null}
        primary={{
          label: download
            ? '업데이트'
            : install
              ? '다시 시작'
              : status.kind === 'error'
                ? '다시 시도'
                : '확인',
          onSelect: () =>
            act(
              download
                ? 'download'
                : install
                  ? 'install'
                  : status.kind === 'error'
                    ? 'retry'
                    : 'dismiss',
            ),
        }}
      >
        {meta.map(fact => (
          <p key={fact}>{fact}</p>
        ))}
      </Dialog>
    ),
  };
}
