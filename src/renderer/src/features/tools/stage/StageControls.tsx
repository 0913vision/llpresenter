import type {JSX} from 'react';
import {useScreenList} from '@renderer/platform/screens/useScreenList';
import {useSettingsDocument} from '@renderer/platform/documents/useSettingsDocument';
import {sendLive, useLive} from '@renderer/session/live';
import {
  Properties,
  PropertyGroup,
  PropertyRow,
} from '@renderer/ui/panels/PropertyRow';
import {SelectMenu} from '@renderer/ui/choices/SelectMenu';
import type {Notice} from '@renderer/ui/popups/notices';
import {StageMessage} from './StageMessage';
import styles from './StageTab.module.css';

const NO_TIMER = 'none';

type Report = ((notice: Notice) => void) | undefined;

/** Why the 무대 controls are off: no 무대 screen yet, or none at all. */
function useStageReason(onProblem: Report): string | undefined {
  const screens = useScreenList(onProblem);
  return screens?.some(screen => screen.kind === 'stage') === true
    ? undefined
    : '무대 화면 없음';
}

/**
 * The timer the 무대 screens show, at the top of the 타이머 tab of the 진행
 * tools (USER Nov 27: no 무대 tab).
 */
export function StageTimer({
  onProblem,
}: {
  readonly onProblem?: Report;
}): JSX.Element {
  const unavailable = useStageReason(onProblem);
  const timers = useSettingsDocument('timers', '타이머', onProblem);
  const stageTimerId = useLive(view => view.state?.stageTimerId);
  const timerId = timers?.value.timers.find(t => t.id === stageTimerId)?.id;
  return (
    <div className={styles.root}>
      <Properties>
        <PropertyGroup title="무대 화면">
          <PropertyRow label="타이머">
            {({controlId}) => (
              <SelectMenu
                id={controlId}
                aria-label="무대 타이머"
                block
                value={timerId ?? NO_TIMER}
                disabled={timers === null || unavailable !== undefined}
                title={
                  unavailable ??
                  (timers === null ? '타이머 불러오는 중' : undefined)
                }
                options={[
                  {value: NO_TIMER, label: '없음'},
                  ...(timers?.value.timers.map(t => ({
                    value: t.id,
                    label: t.name || '이름 없음',
                  })) ?? []),
                ]}
                onChange={value => {
                  const timer = timers?.value.timers.find(t => t.id === value);
                  if (value === NO_TIMER || timer) {
                    sendLive({
                      type: 'stage.timer.set',
                      timerId: timer?.id ?? null,
                    });
                  }
                }}
              />
            )}
          </PropertyRow>
        </PropertyGroup>
      </Properties>
    </div>
  );
}

/**
 * The text sent to the 무대 screens, at the top of the 메시지 tab of the 진행
 * tools (USER Nov 27: no 무대 tab).
 */
export function StageMessageSection({
  onProblem,
}: {
  readonly onProblem?: Report;
}): JSX.Element {
  const unavailable = useStageReason(onProblem);
  return (
    <div className={styles.root}>
      <Properties>
        <StageMessage available={unavailable === undefined} />
      </Properties>
    </div>
  );
}
