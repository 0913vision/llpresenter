import type {JSX} from 'react';
import type {WindowAction} from '@shared/ipc';
import {Icon, useTooltip} from '@renderer/ui';
import styles from './MenuBar.module.css';

// TODO(0913vision): Open real menus with the Menu component.
const menus = ['파일', '편집', '보기', '출력', '창', '도움말'] as const;

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
  const {targetProps, tooltip} = useTooltip({text: control.label});
  return (
    <>
      <button
        {...targetProps}
        type="button"
        className={styles.control}
        aria-label={control.label}
        onClick={() => window.llp?.window.control(control.action)}
      >
        <Icon name={control.icon} size={14} />
      </button>
      {tooltip}
    </>
  );
}

/**
 * The 30px menu bar, which doubles as the window title bar. The center shows
 * the name of the open service.
 */
export function MenuBar({title}: {readonly title: string}): JSX.Element {
  return (
    <div className={styles.bar}>
      <span className={styles.wordmark}>LoveLight</span>
      <div role="menubar" aria-label="메뉴" className={styles.menus}>
        {menus.map(menu => (
          <button
            key={menu}
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={false}
            className={styles.menu}
          >
            {menu}
          </button>
        ))}
      </div>
      <span className={styles.title}>{title}</span>
      <div className={styles.controls}>
        {windowControls.map(control => (
          <WindowButton key={control.action} control={control} />
        ))}
      </div>
    </div>
  );
}
