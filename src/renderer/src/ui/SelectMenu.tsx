import {useState, type JSX} from 'react';
import {Menu} from './Menu';
import type {MenuEntry} from './menuModel';
import {Select, type SelectProps} from './Select';

/** One choice in a Select list. */
export interface SelectOption<T extends string> {
  readonly value: T;
  readonly label: string;
  /** A 14px icon in the leading slot of the list. */
  readonly icon?: string | undefined;
  /** Short extra info at the right end of the list row. */
  readonly meta?: string | undefined;
  readonly disabled?: boolean | undefined;
  /** Tooltip text, such as the reason the choice is disabled. */
  readonly title?: string | undefined;
}

/** A command below the choices, such as 새 구성, after a separator. */
export interface SelectAction {
  readonly id: string;
  readonly label: string;
  readonly icon?: string | undefined;
  readonly disabled?: boolean | undefined;
  /** Tooltip text, such as the reason the command is disabled. */
  readonly title?: string | undefined;
  readonly onSelect: () => void;
}

export interface SelectMenuProps<T extends string> extends Omit<
  SelectProps,
  'value' | 'expanded' | 'onExpandedChange' | 'onChange' | 'ref'
> {
  readonly options: ReadonlyArray<SelectOption<T>>;
  readonly value: T | undefined;
  readonly onChange: (value: T) => void;
  /** The text on the button; defaults to the current choice, or 없음. */
  readonly valueText?: string | undefined;
  /** The name of the list; defaults to the button's `aria-label`. */
  readonly menuLabel?: string | undefined;
  readonly actions?: readonly SelectAction[] | undefined;
}

const NO_VALUE = '없음';

function optionEntries<T extends string>(
  options: ReadonlyArray<SelectOption<T>>,
  value: T | undefined,
  onChange: (value: T) => void,
): readonly MenuEntry[] {
  return options.map(option => ({
    kind: 'item',
    id: option.value,
    label: option.label,
    icon: option.icon,
    meta: option.meta,
    disabled: option.disabled,
    title: option.title,
    check: 'radio',
    checked: option.value === value,
    onSelect: () => onChange(option.value),
  }));
}

function actionEntries(actions: readonly SelectAction[]): readonly MenuEntry[] {
  if (actions.length === 0) return [];
  return [
    {kind: 'separator', id: 'actions'},
    ...actions.map((action): MenuEntry => ({
      kind: 'item',
      id: `action:${action.id}`,
      label: action.label,
      icon: action.icon,
      disabled: action.disabled,
      title: action.title,
      onSelect: action.onSelect,
    })),
  ];
}

/**
 * A Select button with its list. The list opens below the button, no
 * narrower than it, with a check mark before the current choice. Choosing
 * closes it and gives focus back to the button.
 */
export function SelectMenu<T extends string>({
  options,
  value,
  onChange,
  valueText,
  menuLabel,
  actions = [],
  ...selectProps
}: SelectMenuProps<T>): JSX.Element {
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const current = options.find(option => option.value === value);
  const label = menuLabel ?? selectProps['aria-label'] ?? valueText ?? '';
  return (
    <>
      <Select
        {...selectProps}
        ref={setTrigger}
        value={valueText ?? current?.label ?? NO_VALUE}
        expanded={open}
        onExpandedChange={setOpen}
      />
      {open && trigger !== null ? (
        <Menu
          label={label}
          entries={[
            ...optionEntries(options, value, onChange),
            ...actionEntries(actions),
          ]}
          anchor={{kind: 'element', element: trigger}}
          minWidth={trigger.getBoundingClientRect().width}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
