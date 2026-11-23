import {createContext, useContext, type JSX, type ReactNode} from 'react';
import {classNames} from './classNames';
import {Icon} from './Icon';
import {useButtonPress} from './press';
import {useTooltip, withTooltipProps} from './Tooltip';
import styles from './ClearButton.module.css';

const CompactRow = createContext(false);

/**
 * The 지우기 row of 진행. `compact` is the narrow window form, with icons only
 * and the names in the tooltips.
 */
export function ClearRow({
  compact = false,
  children,
}: {
  readonly compact?: boolean | undefined;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <div
      role="group"
      aria-label="지우기"
      className={classNames(styles.row, compact && styles.compact)}
    >
      <CompactRow value={compact}>{children}</CompactRow>
    </div>
  );
}

/** Buttons of the row that belong together. */
export function ClearGroup({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return <div className={styles.group}>{children}</div>;
}

export interface ClearButtonProps {
  /** The short name on the button. */
  readonly name: string;
  readonly icon: string;
  /** What a press does, for the tooltip and assistive technology. */
  readonly label: string;
  readonly command: string;
  /** Whether a press does anything now; it draws the off state otherwise. */
  readonly active: boolean;
  /** A press brings back what the last one took off. */
  readonly restores?: boolean | undefined;
  readonly onPress: () => void;
}

/** One button of the 지우기 row. */
export function ClearButton({
  name,
  icon,
  label,
  command,
  active,
  restores,
  onPress,
}: ClearButtonProps): JSX.Element {
  const compact = useContext(CompactRow);
  const {targetProps, tooltip} = useTooltip({text: label, command});
  const {onBlur: pressBlur, ...press} = useButtonPress<HTMLButtonElement>({
    disabled: !active,
    onPress,
  });
  return (
    <>
      <button
        {...withTooltipProps({onBlur: pressBlur}, targetProps)}
        type="button"
        aria-label={label}
        aria-pressed={restores}
        aria-disabled={active ? undefined : true}
        data-state={active ? undefined : 'off'}
        className={styles.button}
        {...press}
      >
        <Icon name={icon} size={compact ? 16 : 18} />
        {compact ? null : <span className={styles.name}>{name}</span>}
      </button>
      {tooltip}
    </>
  );
}
