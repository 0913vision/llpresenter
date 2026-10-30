import type {JSX} from 'react';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {resolveScreenLook} from '@renderer/rendering/screenLook';
import {sendLive, useLive} from '@renderer/platform/live';
import {Properties, PropertyGroup, PropertyRow, SelectMenu} from '@renderer/ui';
import type {Notice} from '@renderer/ui/notices';
import {StageMessage} from './StageMessage';
import {StageLayoutPicker} from './StageLayoutPicker';
import styles from './StageTab.module.css';

const NO_TIMER = 'none';

export function StageTab({
  onProblem,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const screens = useSettingsDocument('screens', '화면', onProblem);
  const layouts = useSettingsDocument('stage-layouts', '무대 배치', onProblem);
  const looks = useSettingsDocument('looks', 'Look', onProblem);
  const timers = useSettingsDocument('timers', '타이머', onProblem);
  const messages = useSettingsDocument('messages', '메시지', onProblem);
  const lookId = useLive(view => view.state?.lookId);
  const stageLayouts = useLive(view => view.state?.stageLayouts);
  const stageTimerId = useLive(view => view.state?.stageTimerId);
  const layoutReason =
    layouts === null
      ? '무대 배치를 불러오고 있습니다'
      : layouts.value.layouts.length === 0
        ? '무대 배치가 없습니다'
        : undefined;
  const stageScreens =
    screens?.value.screens.filter(s => s.kind === 'stage') ?? [];
  const unavailable =
    stageScreens.length === 0 ? '무대 화면이 없습니다' : undefined;
  const timerId = timers?.value.timers.find(t => t.id === stageTimerId)?.id;
  return (
    <div className={styles.root}>
      <Properties>
        <PropertyGroup title="무대 화면">
          {stageScreens.map(screen => {
            const layoutId =
              stageLayouts?.[screen.id] ??
              resolveScreenLook(looks?.value ?? null, lookId, screen).appearance
                ?.stageLayout;
            return (
              <PropertyRow key={screen.id} label={screen.name || '무대 화면'}>
                {({controlId}) => (
                  <StageLayoutPicker
                    id={controlId}
                    label={`${screen.name || '무대 화면'} 무대 배치`}
                    value={layoutId}
                    reason={layoutReason}
                    layouts={layouts?.value.layouts ?? null}
                    onChange={layoutId =>
                      sendLive({
                        type: 'stage.layout.set',
                        screenId: screen.id,
                        layoutId,
                      })
                    }
                  />
                )}
              </PropertyRow>
            );
          })}
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
      <StageMessage
        available={unavailable === undefined}
        presets={messages?.value.stagePresets ?? []}
      />
    </div>
  );
}
