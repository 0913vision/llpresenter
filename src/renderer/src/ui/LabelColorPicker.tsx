import type {JSX, KeyboardEvent} from 'react';
import {
  NO_LABEL_COLOR,
  paletteColors,
  paletteHex,
  type LabelColor,
  type PaletteColor,
} from '@core/labels/colors';
import {classNames} from './classNames';
import {Icon} from './Icon';
import {useRovingSelection} from './roving';
import {useButtonPress} from './press';
import {useTooltip} from './Tooltip';
import styles from './LabelColorPicker.module.css';

const NONE_ICON_SIZE = 12;

/** The color names for tooltips and `aria-label`; no other names are used. */
export const labelColorNames: Readonly<Record<PaletteColor | 'none', string>> =
  {
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

/**
 * What a palette color applies to, said in the tooltip of every swatch, so
 * each place that picks a color from the palette states its reach.
 */
export const paletteColorScopes = {
  macro: '이 매크로에 적용',
  label: '이 이름표를 쓰는 모든 곡에 적용',
} as const;

interface SwatchProps {
  readonly color: PaletteColor | 'none';
  readonly scope: string;
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly tabIndex: 0 | -1;
  readonly elementRef: (element: HTMLElement | null) => void;
  readonly onSelect: () => void;
  readonly onKeyDown: (event: KeyboardEvent) => void;
}

function Swatch({
  color,
  scope,
  checked,
  disabled,
  tabIndex,
  elementRef,
  onSelect,
  onKeyDown,
}: SwatchProps): JSX.Element {
  const name = labelColorNames[color];
  const {targetProps, tooltip} = useTooltip({text: name, sub: scope});
  const press = useButtonPress<HTMLButtonElement>({
    disabled,
    onPress: onSelect,
    onKeyDown,
    onBlur: targetProps.onBlur,
  });
  const isNone = color === NO_LABEL_COLOR;
  return (
    <>
      <button
        {...targetProps}
        {...press}
        ref={elementRef}
        type="button"
        role="radio"
        aria-checked={checked}
        aria-disabled={disabled || undefined}
        aria-label={name}
        tabIndex={tabIndex}
        className={classNames(styles.swatch, isNone && styles.none)}
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
export interface SwatchRowProps<T extends string> {
  readonly colors: readonly T[];
  readonly value: T | undefined;
  readonly onChange: (color: T) => void;
  /** The row name for assistive technology, such as 후렴 색. */
  readonly label: string;
  /** What the color applies to, shown under the color name in the tooltip. */
  readonly scope: string;
  /** A visible name before the row, such as 색 in the macro menu. */
  readonly name?: string | undefined;
  /** Draws the row inside a menu, lined up with the menu items. */
  readonly inMenu?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  readonly onSelectCurrent?: (() => void) | undefined;
}

function SwatchRow<T extends PaletteColor | 'none'>({
  colors,
  value,
  onChange,
  label,
  scope,
  name,
  inMenu = false,
  disabled = false,
  onSelectCurrent,
}: SwatchRowProps<T>): JSX.Element {
  const items = colors.map(color => ({value: color}));
  const roving = useRovingSelection<T | undefined>({
    items,
    value,
    onChange: color => {
      if (color !== undefined) onChange(color);
    },
    disabled,
  });
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
          disabled={disabled}
          tabIndex={roving.tabIndexOf(index)}
          elementRef={roving.refOf(index)}
          onSelect={() => {
            if (color !== value) onChange(color);
            else onSelectCurrent?.();
          }}
          onKeyDown={event => roving.onKeyDown(index, event)}
        />
      ))}
    </div>
  );
}

const labelColors: ReadonlyArray<PaletteColor | 'none'> = [
  NO_LABEL_COLOR,
  ...paletteColors,
];

export type LabelColorPickerProps = Omit<SwatchRowProps<LabelColor>, 'colors'>;

/**
 * The color row of the 이름표 list: 없음 first, then the eight colors. A click
 * applies the color at once; Tab enters on the current color and the left and
 * right arrows move and pick.
 */
export function LabelColorPicker(props: LabelColorPickerProps): JSX.Element {
  const value =
    props.value === 'none'
      ? 'none'
      : paletteColors.find(
          color =>
            paletteHex[color].toUpperCase() === props.value?.toUpperCase(),
        );
  return (
    <SwatchRow
      {...props}
      colors={labelColors}
      value={value}
      onChange={color =>
        props.onChange(color === 'none' ? color : paletteHex[color])
      }
    />
  );
}

export type MacroColorPickerProps = Omit<
  SwatchRowProps<PaletteColor>,
  'colors'
>;

/** The color row of the macro: the same eight colors, no 없음 (a 매크로 always has one). */
export function MacroColorPicker(props: MacroColorPickerProps): JSX.Element {
  return <SwatchRow colors={paletteColors} {...props} />;
}
