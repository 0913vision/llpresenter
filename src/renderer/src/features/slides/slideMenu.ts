import {menuAvailability, type MenuEntry} from '@renderer/ui/menuModel';
import {selectionLabel} from '@renderer/ui/selectionDrag';
import {
  addReason,
  addSlide,
  copyReason,
  copySelected,
  duplicateSelected,
  selectionReason,
} from './deckCommands';
import type {SlideDeck} from './slideDeck';
import type {SlideCommands} from './useSlideCommands';

/** The menu of a slide or of the ground between slides. */
export function slideMenuEntries({
  deck,
  count,
  addAt,
  extra,
  hotKey,
  label,
  commands,
}: {
  readonly deck: SlideDeck;
  /** The chosen slides. */
  readonly count: number;
  /** Where 슬라이드 추가 puts the new slide. */
  readonly addAt: number;
  /** Entries of the kind of item, above the ones every list has. */
  readonly extra: readonly MenuEntry[];
  /** Opens 단축키 of the one chosen slide; undefined without it. */
  readonly hotKey: (() => void) | undefined;
  /** Opens the 이름표 menu; undefined without 이름표. */
  readonly label: (() => void) | undefined;
  readonly commands: SlideCommands;
}): readonly MenuEntry[] {
  return [
    {
      kind: 'item',
      id: 'add-slide',
      label: '슬라이드 추가',
      ...menuAvailability(addReason(deck)),
      onSelect: () => addSlide(deck, addAt),
    },
    ...extra,
    ...(hotKey === undefined
      ? []
      : [
          {
            kind: 'item' as const,
            id: 'hot-key',
            label: '단축키…',
            ...menuAvailability(selectionReason(deck)),
            onSelect: hotKey,
          },
        ]),
    ...(label === undefined
      ? []
      : [
          {
            kind: 'item' as const,
            id: 'label',
            label: '이름표',
            command: 'editor.labelMenu',
            ...menuAvailability(selectionReason(deck)),
            onSelect: label,
          },
        ]),
    {
      kind: 'item',
      id: 'copy',
      contextGroup: 'clipboard',
      label: selectionLabel('복사', count),
      meta: 'Ctrl C',
      ...menuAvailability(copyReason(deck)),
      onSelect: () => copySelected(deck),
    },
    {
      kind: 'item',
      id: 'cut',
      contextGroup: 'clipboard',
      label: selectionLabel('잘라내기', count),
      meta: 'Ctrl X',
      ...menuAvailability(selectionReason(deck)),
      onSelect: commands.cut,
    },
    {
      kind: 'item',
      id: 'paste',
      contextGroup: 'clipboard',
      label: '붙여넣기',
      meta: 'Ctrl V',
      ...menuAvailability(addReason(deck)),
      onSelect: commands.paste,
    },
    {
      kind: 'item',
      id: 'duplicate',
      contextGroup: 'clipboard',
      label: selectionLabel('복제', count),
      command: 'edit.duplicate',
      ...menuAvailability(selectionReason(deck) ?? addReason(deck, count)),
      onSelect: () => duplicateSelected(deck),
    },
    {
      kind: 'item',
      id: 'delete',
      contextGroup: 'delete',
      label: selectionLabel('삭제', count),
      command: 'edit.delete',
      ...menuAvailability(selectionReason(deck)),
      onSelect: commands.remove,
    },
    {kind: 'separator', id: 'history'},
    {
      kind: 'item',
      id: 'undo',
      contextGroup: 'clipboard',
      label: '실행 취소',
      command: 'edit.undo',
      ...menuAvailability(commands.replayReason('undo')),
      onSelect: () => commands.replay('undo'),
    },
    {
      kind: 'item',
      id: 'redo',
      contextGroup: 'clipboard',
      label: '다시 실행',
      command: 'edit.redo',
      ...menuAvailability(commands.replayReason('redo')),
      onSelect: () => commands.replay('redo'),
    },
  ];
}
