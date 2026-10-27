import type {JSX, KeyboardEvent} from 'react';
import {
  NO_LABEL_COLOR,
  paletteColors,
  type LabelColor,
  type PaletteColor,
} from '@shared/colors';
import {classNames} from './classNames';
import {Icon} from './Icon';
import {useRovingSelection} from './roving';
import {useTooltip} from './Tooltip';
import styles from './LabelColorPicker.module.css';

const NONE_ICON_SIZE = 12;

/** The color names for tooltips and `aria-label`; no other names are used. */
export const labelColorNames: Readonly<Record<LabelColor, string>> = {
  teal: '청록',
  green: '초록',
  yellow: '노랑',
  orange: '주황',
  rose: '분홍',
  violet: '보라',
  slate: '남색',
  gray: '회색',
  none: '없음',
};

interface SwatchProps {
  readonly color: LabelColor;
  readonly scope?: string | undefined;
  readonly checked: boolean;
  readonly tabIndex: 0 | -1;
  readonly elementRef: (element: HTMLElement | null) => void;
  readonly onSelect: () => void;
  readonly onKeyDown: (event: KeyboardEvent) => void;
}

function Swatch({
  color,
  scope,
  checked,
  tabIndex,
  elementRef,
  onSelect,
  onKeyDown,
}: SwatchProps): JSX.Element {
  const name = labelColorNames[color];
  const {targetProps, tooltip} = useTooltip({text: name, sub: scope});
  const isNone = color === NO_LABEL_COLOR;
  return (
    <>
      <button
        {...targetProps}
        ref={elementRef}
        type="button"
        role="radio"
        aria-checked={checked}
        aria-label={name}
        tabIndex={tabIndex}
        className={classNames(styles.swatch, isNone && styles.none)}
        onClick={onSelect}
        onKeyDown={onKeyDown}
      >
        <span
          className={styles.chip}
          style={{backgroundColor: `var(--label-${color})`}}
        >
          {isNone ? <Icon name="x" size={NONE_ICON_SIZE} /> : null}
        </span>
      </button>
      {tooltip}
    </>
  );
}

/** The props of a color row; the pickers fill in the colors. */
export interface SwatchRowProps<T extends LabelColor> {
  readonly colors: readonly T[];
  readonly value: T;
  readonly onChange: (color: T) => void;
  /** The row name for assistive technology, such as 후렴 색. */
  readonly label: string;
  /** A secondary tooltip fact when a color affects shared references. */
  readonly scope?: string | undefined;
  /** A visible name before the row, such as 색 in the macro menu. */
  readonly name?: string | undefined;
  /** Draws the row inside a menu, lined up with the menu items. */
  readonly inMenu?: boolean | undefined;
}

function SwatchRow<T extends LabelColor>({
  colors,
  value,
  onChange,
  label,
  scope,
  name,
  inMenu = false,
}: SwatchRowProps<T>): JSX.Element {
  const items = colors.map(color => ({value: color}));
  const roving = useRovingSelection({items, value, onChange, disabled: false});
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={classNames(styles.row, inMenu && styles.inMenu)}
    >
      {name === undefined ? null : (
        <span aria-hidden="true" className={styles.name}>
          {name}
        </span>
      )}
      {colors.map((color, index) => (
        <Swatch
          key={color}
          color={color}
          scope={scope}
          checked={color === value}
          tabIndex={roving.tabIndexOf(index)}
          elementRef={roving.refOf(index)}
          onSelect={() => {
            if (color !== value) onChange(color);
          }}
          onKeyDown={event => roving.onKeyDown(index, event)}
        />
      ))}
    </div>
  );
}

const labelColors: readonly LabelColor[] = [NO_LABEL_COLOR, ...paletteColors];

export type LabelColorPickerProps = Omit<SwatchRowProps<LabelColor>, 'colors'>;

/**
 * The color row of the 이름표 menu: 없음 and the eight colors. A click
 * applies the color at once; Tab enters on the current color and the left and
 * right arrows move and pick.
 */
export function LabelColorPicker(props: LabelColorPickerProps): JSX.Element {
  return <SwatchRow colors={labelColors} {...props} />;
}

export type MacroColorPickerProps = Omit<
  SwatchRowProps<PaletteColor>,
  'colors'
>;

/** The color row of the macro menu: the eight colors, no 없음. */
export function MacroColorPicker(props: MacroColorPickerProps): JSX.Element {
  return <SwatchRow colors={paletteColors} {...props} />;
}
