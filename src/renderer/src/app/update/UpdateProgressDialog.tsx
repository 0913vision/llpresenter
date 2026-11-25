import type {JSX} from 'react';
import type {UpdateStatus} from '@core/schema/app/update';
import {Dialog} from '@renderer/ui/popups/Dialog';
import {Progress} from '@renderer/ui/tiles/StatusMarks';
import styles from './UpdateProgress.module.css';

/** An update that is on its way: downloading, installing or restarting. */
export type UpdateInProgress = Extract<
  UpdateStatus,
  {kind: 'downloading' | 'installing' | 'restarting'}
>;

const STEPS = ['내려받는 중', '설치 준비', '다시 시작'] as const;

/** Whether the update is on its way, so only its progress shows. */
export function isInProgress(status: UpdateStatus): status is UpdateInProgress {
  return (
    status.kind === 'downloading' ||
    status.kind === 'installing' ||
    status.kind === 'restarting'
  );
}

/**
 * The dialog that shows an update on its way: its three steps and the download
 * percent. It can't be closed; the app restarts at its end.
 */
export function UpdateProgressDialog({
  status,
}: {
  readonly status: UpdateInProgress;
}): JSX.Element {
  const step =
    status.kind === 'downloading' ? 0 : status.kind === 'installing' ? 1 : 2;
  const percent = status.kind === 'downloading' ? status.percent : 100;
  return (
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
          {STEPS.map((label, index) => (
            <li key={label} aria-current={index === step ? 'step' : undefined}>
              <span>{label}</span>
              <span>
                {index < step ? '완료' : index === step ? '진행 중' : '대기'}
              </span>
            </li>
          ))}
        </ol>
        <Progress label="업데이트 내려받기" value={percent} />
        <p className={styles.percent}>{percent}%</p>
      </div>
    </Dialog>
  );
}
