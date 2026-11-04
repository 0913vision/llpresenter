import type {JSX} from 'react';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {sendLive, useLive} from '@renderer/session/live';
import {Properties, PropertyGroup, PropertyRow, SelectMenu} from '@renderer/ui';
import type {Notice} from '@renderer/ui/notices';
import {StageMessage} from './StageMessage';
import styles from './StageTab.module.css';

const NO_TIMER = 'none';

export function StageTab({
  onProblem,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const screens = useSettingsDocument('screens', '화면', onProblem);
  const timers = useSettingsDocument('timers', '타이머', onProblem);
  const stageTimerId = useLive(view => view.state?.stageTimerId);
  const stageScreens =
    screens?.value.screens.filter(s => s.kind === 'stage') ?? [];
  const unavailable =
    stageScreens.length === 0 ? '무대 화면이 없습니다' : undefined;
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
                  (timers === null ? '타이머를 불러오고 있습니다' : undefined)
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
      <StageMessage available={unavailable === undefined} />
    </div>
  );
}
