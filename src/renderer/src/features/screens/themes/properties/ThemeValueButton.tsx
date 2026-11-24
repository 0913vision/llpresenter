import {useState, type JSX} from 'react';
import {IconButton} from '@renderer/ui/buttons/IconButton';
import {Menu} from '@renderer/ui/menus/Menu';
import type {MenuEntry} from '@renderer/ui/menus/menuModel';

/** The text a value puts in: `{제목}`, or `{(제목)}` in brackets. */
function valueText(value: string, bracketed: boolean): string {
  return bracketed ? `{(${value})}` : `{${value}}`;
}

/** The values as they are, then under 괄호로 감싸기 in brackets. */
function valueEntries(
  values: readonly string[],
  pick: (text: string) => void,
): readonly MenuEntry[] {
  const rows = (bracketed: boolean): MenuEntry[] =>
    values.map(value => ({
      kind: 'item',
      id: bracketed ? `(${value})` : value,
      label: bracketed ? `(${value})` : value,
      onSelect: () => pick(valueText(value, bracketed)),
    }));
  return [
    ...rows(false),
    {kind: 'separator', id: 'brackets'},
    {kind: 'group', id: 'bracketed', label: '괄호로 감싸기'},
    ...rows(true),
  ];
}

/** Puts `text` into a text field at its caret, or at its end. */
export function textWithValue(
  current: string,
  area: HTMLTextAreaElement | null | undefined,
  text: string,
): string {
  const start = area?.selectionStart ?? current.length;
  const end = area?.selectionEnd ?? start;
  return `${current.slice(0, start)}${text}${current.slice(end)}`;
}

/** The + beside a phrase that puts one of the values in. */
export function ThemeValueButton({
  values,
  reason,
  onPick,
}: {
  readonly values: readonly string[];
  readonly reason: string | undefined;
  /** Takes the text to put in, such as `{제목}` or `{(이름표)}`. */
  readonly onPick: (text: string) => void;
}): JSX.Element {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <IconButton
        icon="plus"
        label="값 넣기"
        disabled={reason !== undefined}
        title={reason}
        onClick={event => setAnchor(event.currentTarget)}
      />
      {anchor === null ? null : (
        <Menu
          label="값 넣기"
          anchor={{kind: 'element', element: anchor}}
          entries={valueEntries(values, onPick)}
          onClose={() => setAnchor(null)}
        />
      )}
    </>
  );
}
