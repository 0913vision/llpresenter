import type {JSX} from 'react';
import type {WindowAction} from '@contracts/ipc/window';
import {useWindowShortcuts} from '@renderer/platform/shortcuts/windowShortcuts';
import {Icon} from '@renderer/ui/Icon';
import {useButtonPress} from '@renderer/ui/buttons/press';
import {useTooltip} from '@renderer/ui/popups/Tooltip';
import styles from './MenuBar.module.css';

interface WindowControl {
  readonly action: WindowAction;
  readonly icon: string;
  readonly label: string;
}

const windowControls: readonly WindowControl[] = [
  {action: 'minimize', icon: 'min', label: '최소화'},
  {action: 'toggle-maximize', icon: 'max', label: '최대화'},
  {action: 'close', icon: 'x', label: '닫기'},
];

function WindowButton({
  control,
}: {
  readonly control: WindowControl;
}): JSX.Element {
  const command =
    control.action === 'minimize'
      ? 'window.minimize'
      : control.action === 'toggle-maximize'
        ? 'window.maximize'
        : 'app.quit';
  const run = (): void => window.llp?.window.control(control.action);
  useWindowShortcuts([{id: command, run}]);
  const {targetProps, tooltip} = useTooltip({text: control.label, command});
  const press = useButtonPress<HTMLButtonElement>({
    disabled: false,
    onPress: run,
    onBlur: targetProps.onBlur,
  });
  return (
    <>
      <button
        {...targetProps}
        {...press}
        type="button"
        className={styles.control}
        aria-label={control.label}
      >
        <Icon name={control.icon} size={14} />
      </button>
      {tooltip}
    </>
  );
}

/** 최소화, 최대화 and 닫기 at the right end of the menu bar, which is the title bar. */
export function WindowControls(): JSX.Element {
  return (
    <div className={styles.controls}>
      {windowControls.map(control => (
        <WindowButton key={control.action} control={control} />
      ))}
    </div>
  );
}
