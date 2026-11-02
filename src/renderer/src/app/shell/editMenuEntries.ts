import {
  NOTHING_TO_REDO,
  NOTHING_TO_UNDO,
} from '@renderer/platform/problemReasons';
import {probeCommand, runCommandAt} from '@renderer/ui/commandDispatcher';
import {
  menuAvailability,
  type MenuEntry,
  type MenuItem,
} from '@renderer/ui/menuModel';
import {laterRow, menuSeparator} from '@renderer/ui/menuRows';
import {isInTextEntry} from '@renderer/ui/textEntry';
import type {TextEditAction} from '@contracts/ipc/api';

const TEXT_KEYS = {
  cut: 'Ctrl X',
  copy: 'Ctrl C',
  paste: 'Ctrl V',
  selectAll: 'Ctrl A',
} as const;

/** Why a text editing row is off when no text field had focus. */
export const TEXT_FIELD_ONLY = '글자 입력란에서 쓸 수 있습니다';
/** Why 잘라내기 and 복사 are off with nothing selected. */
export const NO_SELECTION = '선택한 글자가 없습니다';
/** Why 복제 and 삭제 are off where the focused place does not have them. */
export const NOT_HERE = '선택한 곳에서는 쓸 수 없음';

function textField(
  place: Element | null,
): HTMLInputElement | HTMLTextAreaElement | null {
  return (place instanceof HTMLInputElement ||
    place instanceof HTMLTextAreaElement) &&
    isInTextEntry(place)
    ? place
    : null;
}

function hasSelection(field: HTMLInputElement | HTMLTextAreaElement): boolean {
  return field.selectionStart !== field.selectionEnd;
}

function edit(field: HTMLElement, action: TextEditAction): void {
  field.focus();
  window.llp?.window.editText(action);
}

function afterMenu(run: () => void): () => void {
  return () => {
    window.setTimeout(run, 0);
  };
}

function historyRow(kind: 'undo' | 'redo', place: Element | null): MenuItem {
  const id = kind === 'undo' ? 'edit.undo' : 'edit.redo';
  const probe = probeCommand(id, place);
  const field = textField(place);
  const none = kind === 'undo' ? NOTHING_TO_UNDO : NOTHING_TO_REDO;
  const reason = probe.found ? probe.reason : field === null ? none : undefined;
  return {
    kind: 'item',
    id: kind,
    label: kind === 'undo' ? '실행 취소' : '다시 실행',
    command: id,
    ...menuAvailability(reason),
    onSelect: afterMenu(() => {
      if (place instanceof HTMLElement) place.focus();
      if (!runCommandAt(id, place) && field !== null) edit(field, kind);
    }),
  };
}

function textRow(
  action: Exclude<TextEditAction, 'undo' | 'redo'>,
  label: string,
  place: Element | null,
): MenuItem {
  const field = textField(place);
  const needsSelection = action === 'cut' || action === 'copy';
  const reason =
    field === null
      ? TEXT_FIELD_ONLY
      : needsSelection && !hasSelection(field)
        ? NO_SELECTION
        : undefined;
  return {
    kind: 'item',
    id: action,
    label,
    meta: TEXT_KEYS[action],
    ...menuAvailability(reason),
    onSelect: afterMenu(() => {
      if (field !== null) edit(field, action);
    }),
  };
}

function commandRow(
  row: {
    readonly id: 'duplicate' | 'delete' | 'search';
    readonly label: string;
    readonly command: string;
  },
  place: Element | null,
): MenuItem {
  const {id, label, command} = row;
  const probe = probeCommand(command, place);
  const reason = probe.found ? probe.reason : NOT_HERE;
  return {
    kind: 'item',
    id,
    label,
    command,
    ...menuAvailability(reason),
    onSelect: afterMenu(() => {
      if (place instanceof HTMLElement) place.focus();
      runCommandAt(command, place);
    }),
  };
}

/**
 * The 편집 menu (spec 11). `place` is the element that had keyboard focus
 * before the menu opened; every row asks the command dispatcher about that
 * place, so a row is on exactly where its key would work.
 */
export function editMenuEntries(place: Element | null): readonly MenuEntry[] {
  return [
    historyRow('undo', place),
    historyRow('redo', place),
    menuSeparator('clipboard'),
    textRow('cut', '잘라내기', place),
    textRow('copy', '복사', place),
    laterRow('copy-style', '텍스트 스타일 복사', {meta: 'Ctrl Alt C'}),
    textRow('paste', '붙여넣기', place),
    laterRow('paste-style', '텍스트 스타일 붙여넣기', {meta: 'Alt Shift V'}),
    laterRow('paste-match', '스타일 맞춰 붙여넣기', {meta: 'Alt V'}),
    menuSeparator('selection'),
    commandRow(
      {id: 'duplicate', label: '복제', command: 'edit.duplicate'},
      place,
    ),
    commandRow({id: 'delete', label: '삭제', command: 'edit.delete'}, place),
    textRow('selectAll', '모두 선택', place),
    laterRow('deselect', '선택 해제', {meta: 'Ctrl Shift D'}),
    menuSeparator('search'),
    commandRow({id: 'search', label: '찾기', command: 'search.focus'}, place),
    menuSeparator('keys'),
    laterRow('shortcuts', '단축키…'),
  ];
}
