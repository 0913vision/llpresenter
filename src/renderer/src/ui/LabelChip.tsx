import {type JSX, type Ref} from 'react';
import type {LabelColor} from '@core/labels';
import {classNames} from './classNames';
import {Icon} from './Icon';
import {labelInk} from './labelInk';
import {useButtonPress} from './press';
import styles from './LabelChip.module.css';

const CHEVRON_SIZE = 12;
const PICKER_PLACEHOLDER = '이름표';

export interface LabelTagProps {
  /** The 이름표 name; `undefined` when the 슬라이드 has none. */
  readonly name: string | undefined;
  readonly color: LabelColor;
  /** Makes it a button that opens the 이름표 menu. */
  readonly picker?:
    | {
        readonly expanded: boolean;
        readonly onOpen: (button: HTMLElement) => void;
      }
    | undefined;
  readonly buttonRef?: Ref<HTMLButtonElement>;
}

/**
 * The small 22px 이름표 left of a lyric block or in a list row. As a picker,
 * it is a button with a down arrow that opens the 이름표 menu.
 */
export function LabelTag({
  name,
  color,
  picker,
  buttonRef,
}: LabelTagProps): JSX.Element {
  const press = useButtonPress<HTMLButtonElement>({
    disabled: picker === undefined,
    onPress: event => picker?.onOpen(event.currentTarget),
  });
  if (picker === undefined) {
    return (
      <span data-color={color} style={labelInk(color)} className={styles.tag}>
        <span className={styles.tagName}>{name}</span>
      </span>
    );
  }
  return (
    <button
      {...press}
      ref={buttonRef}
      type="button"
      aria-haspopup="menu"
      aria-expanded={picker.expanded}
      data-color={color}
      style={labelInk(color)}
      className={classNames(styles.tag, styles.picker)}
    >
      <span className={styles.tagName}>{name ?? PICKER_PLACEHOLDER}</span>
      <Icon name="down" size={CHEVRON_SIZE} />
    </button>
  );
}

/** A 10px color square next to an 이름표 name, as in the preview name row. */
export function LabelSwatch({
  color,
}: {
  readonly color: LabelColor;
}): JSX.Element {
  return (
    <span
      aria-hidden="true"
      data-color={color}
      style={labelInk(color)}
      className={styles.swatch}
    />
  );
}
