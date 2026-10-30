import type {MenuEntry, MenuItem} from '@renderer/ui/menuModel';
import {laterRow, menuSeparator} from '@renderer/ui/menuRows';
import type {ServiceRow} from './model';

/** What the 예배 순서 item menu can ask the list to do. */
export interface ServiceOrderMenuInput {
  readonly row: ServiceRow;
  readonly editable: boolean;
  /** Opens the item in 준비; undefined outside 진행. */
  readonly openInPrep: (() => void) | undefined;
  readonly rename: () => void;
  readonly remove: () => void;
  readonly song?: {
    readonly arrangements: readonly MenuEntry[];
    readonly locked: boolean;
    readonly reason: string | undefined;
    readonly showInLibrary: (() => void) | undefined;
  };
}

function openRows(input: ServiceOrderMenuInput): readonly MenuEntry[] {
  const {row, openInPrep} = input;
  switch (row.kind) {
    case 'header':
      return [laterRow('color', '색 바꾸기')];
    case 'song':
      return [
        {
          kind: 'item',
          id: 'arrangement',
          label: '구성',
          submenu: input.song?.arrangements ?? [],
          disabled:
            !input.editable ||
            input.song?.locked !== false ||
            input.song.reason !== undefined,
          title: input.song?.reason,
        },
        laterRow('destination', '출력 대상', {submenu: true}),
        menuSeparator('edit-separator'),
        laterRow('edit-slides', '슬라이드 편집'),
        laterRow('resize', '크기 바꾸기', {submenu: true}),
        ...(openInPrep === undefined
          ? []
          : [
              {
                kind: 'item',
                id: 'prep',
                label: '가사 편집',
                onSelect: openInPrep,
              } as const,
            ]),
      ];
    case 'bible':
    case 'media':
    case 'notice':
    case 'unknown':
      return openInPrep === undefined
        ? []
        : [
            {
              kind: 'item',
              id: 'prep',
              label: '준비에서 열기',
              onSelect: openInPrep,
            },
          ];
  }
}

function renameRow(input: ServiceOrderMenuInput): readonly MenuItem[] {
  switch (input.row.kind) {
    case 'header':
      return [
        {
          kind: 'item',
          id: 'rename',
          label: '이름 바꾸기',
          disabled: !input.editable,
          onSelect: input.rename,
        },
      ];
    case 'song':
      return [];
    case 'bible':
    case 'media':
    case 'notice':
    case 'unknown':
      return [laterRow('rename', '이름 바꾸기')];
  }
}

function exportRows(input: ServiceOrderMenuInput): readonly MenuEntry[] {
  if (input.row.kind !== 'song') return [];
  return [
    menuSeparator('export-separator'),
    {
      kind: 'item',
      id: 'show-in-library',
      label: '라이브러리에서 보기',
      disabled:
        input.song?.showInLibrary === undefined ||
        input.song.reason !== undefined,
      title: input.song?.reason,
      onSelect: input.song?.showInLibrary,
    },
    laterRow('export-bundle', '묶음으로 내보내기…'),
    laterRow('export-images', '그림으로 내보내기…'),
  ];
}

/**
 * The right-click menu of one 예배 순서 row, after ProPresenter's playlist
 * item menu (spec 11): hide and add to another service, the rows for this
 * kind of item, then copy, rename, and delete.
 */
export function serviceOrderMenuEntries(
  input: ServiceOrderMenuInput,
): readonly MenuEntry[] {
  const open = openRows(input);
  return [
    laterRow('hide', '항목 숨기기'),
    laterRow('add-to', '다른 예배에 추가', {submenu: true}),
    ...(open.length > 0 ? [menuSeparator('open-separator'), ...open] : []),
    menuSeparator('clipboard-separator'),
    laterRow('copy', '복사', {meta: 'Ctrl C'}),
    laterRow('paste', '붙여넣기', {meta: 'Ctrl V'}),
    laterRow('duplicate', '복제', {meta: 'Ctrl D'}),
    ...renameRow(input),
    {
      kind: 'item',
      id: 'delete',
      label: '삭제',
      danger: true,
      disabled: !input.editable,
      onSelect: input.remove,
    },
    ...exportRows(input),
  ];
}
