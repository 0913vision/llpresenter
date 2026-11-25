import type {UpdateAction, UpdateStatus} from '@core/schema/app/update';

/** What the update dialog or notice says first for a status. */
export function updateTitle(status: UpdateStatus): string {
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

/**
 * The lines under the title: for a failure, its version, step and reason; for
 * an update to take while outputs are on, that the screens go off and come
 * back, unless the notice already says so.
 */
export function updateFacts(
  status: UpdateStatus,
  {
    outputsOn,
    asNotice,
  }: {readonly outputsOn: boolean; readonly asNotice: boolean},
): string[] {
  const facts =
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
  const takes = status.kind === 'available' || status.kind === 'downloaded';
  if (takes && outputsOn && !asNotice) {
    facts.push('업데이트 중 화면이 꺼지고 다시 시작하면 복원됩니다.');
  }
  return facts;
}

/** The dialog's buttons for a status: the main one, and 나중에 where it can wait. */
export function updateChoices(status: UpdateStatus): {
  readonly label: string;
  readonly action: UpdateAction['action'];
  readonly later: boolean;
} {
  switch (status.kind) {
    case 'available':
      return {label: '업데이트', action: 'download', later: true};
    case 'downloaded':
      return {label: '다시 시작', action: 'install', later: true};
    case 'error':
      return {label: '다시 시도', action: 'retry', later: false};
    case 'idle':
    case 'unsupported':
    case 'checking':
    case 'downloading':
    case 'installing':
    case 'restarting':
    case 'latest':
      return {label: '확인', action: 'dismiss', later: false};
  }
}
