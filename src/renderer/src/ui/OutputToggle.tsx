import type {JSX} from 'react';
import {classNames} from './classNames';
import {Icon} from './Icon';
import {objectParticle} from './korean';
import {pressHandler} from './press';
import {StatusDot} from './StatusMarks';
import {toolbarIconSize} from './toolbarLook';
import styles from './ToolbarButton.module.css';

/** The drawn output state: on, off, or turned on with its monitor missing. */
export type OutputState = 'live' | 'off' | 'warning';

export interface OutputToggleProps {
  readonly icon: string;
  /** The name on the button, such as 무대. */
  readonly label: string;
  /** The full screen name for the tooltip, such as 무대 화면. */
  readonly screenName?: string | undefined;
  /** The output target from 화면 설정, such as 모니터 2 or NDI. */
  readonly target: string;
  readonly state: OutputState;
  readonly onToggle: () => void;
  readonly compact?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  readonly className?: string | undefined;
}

export interface OutputTooltipParts {
  readonly screenName: string;
  readonly target: string;
  readonly state: OutputState;
}

/** The tooltip of an output toggle: what a click does, or what is missing. */
export function outputTooltip({
  screenName,
  target,
  state,
}: OutputTooltipParts): string {
  switch (state) {
    case 'live':
      return `${screenName} 출력 끄기 (${target})`;
    case 'off':
      return `${screenName} 출력 켜기 (${target})`;
    case 'warning':
      return `${screenName}: ${target}${objectParticle(target)} 찾을 수 없습니다`;
  }
}

/** A toolbar button that turns 출력 for one screen on or off. */
export function OutputToggle({
  icon,
  label,
  screenName = label,
  target,
  state,
  onToggle,
  compact = false,
  disabled = false,
  className,
}: OutputToggleProps): JSX.Element {
  // TODO(0913vision): Draw the tooltip with Tooltip once ui-2 lands.
  return (
    <button
      type="button"
      aria-pressed={state !== 'off'}
      aria-disabled={disabled ? true : undefined}
      data-state={state}
      title={outputTooltip({screenName, target, state})}
      className={classNames(
        styles.button,
        styles.output,
        compact && styles.compact,
        className,
      )}
      onClick={pressHandler(disabled, onToggle)}
    >
      <span className={styles.iconSlot}>
        <Icon
          name={icon}
          size={toolbarIconSize(compact)}
          className={styles.outputIcon}
        />
        {state === 'off' ? null : (
          <StatusDot
            tone={state === 'warning' ? 'warning' : 'live'}
            cut
            className={styles.dot}
          />
        )}
      </span>
      <span className={styles.label}>{label}</span>
    </button>
  );
}
