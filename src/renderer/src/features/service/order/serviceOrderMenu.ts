import {
  menuAvailability,
  type MenuEntry,
  type MenuItem,
} from '@renderer/ui/menuModel';
import {laterRow, menuSeparator} from '@renderer/ui/menuRows';
import type {ServiceRow} from '@core/presentation/model';

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
          ...menuAvailability(
            !input.editable
              ? '예배 순서 편집 불가'
              : (input.song?.reason ??
                  (input.song?.locked !== false
                    ? '구성 변경 불가'
                    : undefined)),
          ),
        },
        laterRow('destination', '출력 대상', {submenu: true}),
        ...(openInPrep === undefined
          ? []
          : [
              menuSeparator('edit-separator'),
              {
                kind: 'item',
                id: 'prep',
                label: '곡 편집',
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
          ...menuAvailability(
            input.editable ? undefined : '예배 순서 편집 불가',
          ),
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
      ...menuAvailability(
        input.song?.reason ??
          (input.song?.showInLibrary === undefined
            ? '라이브러리 연결 안 됨'
            : undefined),
      ),
      onSelect: input.song?.showInLibrary,
    },
    laterRow('export-bundle', '묶음으로 내보내기…'),
    laterRow('export-images', '그림으로 내보내기…'),
  ];
}

/**
 * The right-click menu of one 예배 순서 row, after ProPresenter's playlist
 * item menu (spec 11): hide, the rows for this kind of item, then copy,
 * rename, and delete.
 */
export function serviceOrderMenuEntries(
  input: ServiceOrderMenuInput,
): readonly MenuEntry[] {
  const open = openRows(input);
  return [
    laterRow('hide', '항목 숨기기'),
    ...(open.length > 0 ? [menuSeparator('open-separator'), ...open] : []),
    menuSeparator('clipboard-separator'),
    laterRow('copy', '복사', {meta: 'Ctrl C'}),
    laterRow('paste', '붙여넣기', {meta: 'Ctrl V'}),
    laterRow('duplicate', '복제', {command: 'edit.duplicate'}),
    ...renameRow(input),
    {
      kind: 'item',
      id: 'delete',
      command: 'edit.delete',
      label: '삭제',
      danger: true,
      ...menuAvailability(input.editable ? undefined : '예배 순서 편집 불가'),
      onSelect: input.remove,
    },
    ...exportRows(input),
  ];
}
