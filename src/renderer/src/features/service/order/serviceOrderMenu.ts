import {NOT_IN_THIS_WINDOW} from '@renderer/platform/problemReasons';
import {ORDER_FULL_REASON} from '@renderer/session/serviceOrderEdits';
import {windowCommandLabels} from '@renderer/ui/windowCommandLabels';
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
  readonly duplicate: () => void;
  readonly moveUp?: (() => void) | undefined;
  readonly moveDown?: (() => void) | undefined;
  readonly moveUpReason?: string | undefined;
  readonly moveDownReason?: string | undefined;
  readonly clipboard?: {
    readonly copy: () => void;
    readonly paste: () => void;
    readonly copyReason: string | undefined;
    readonly pasteReason: string | undefined;
  };
  /** Whether the 예배 순서 is at its item limit, which stops a copy. */
  readonly full?: boolean;
  readonly remove: () => void;
  /** 곡 편집 of the 준비 menu; undefined outside 준비. */
  readonly editSong?:
    | {
        readonly editSong: (() => void) | undefined;
      }
    | undefined;
  readonly song?: {
    readonly save: () => void;
    readonly reload: () => void;
    readonly locked: boolean;
    readonly reason: string | undefined;
    readonly showInLibrary: (() => void) | undefined;
  };
}

function songEditRows({
  editSong,
  song,
}: ServiceOrderMenuInput): readonly MenuEntry[] {
  if (editSong === undefined) return [];
  return [
    menuSeparator('song-edit-separator'),
    {
      kind: 'item',
      id: 'edit-song',
      contextGroup: 'default',
      label: windowCommandLabels.editSong,
      ...menuAvailability(
        song?.reason ??
          (editSong.editSong === undefined
            ? '곡을 찾을 수 없습니다'
            : undefined),
      ),
      onSelect: editSong.editSong,
    },
    menuSeparator('song-edit-end'),
  ];
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
          id: 'save-to-library',
          contextGroup: 'library',
          label: '라이브러리에 저장…',
          ...menuAvailability(
            input.song?.reason ??
              (input.song?.locked ? '예배 순서 편집 불가' : undefined),
          ),
          onSelect: input.song?.save,
        },
        {
          kind: 'item',
          id: 'reload-from-library',
          contextGroup: 'library',
          label: '라이브러리에서 다시 불러오기',
          ...menuAvailability(
            input.song?.reason ??
              (input.song?.locked ? '예배 순서 편집 불가' : undefined),
          ),
          onSelect: input.song?.reload,
        },
        ...songEditRows(input),
        laterRow('destination', '출력할 화면', {submenu: true}),
        ...(openInPrep === undefined
          ? []
          : [
              menuSeparator('edit-separator'),
              {
                kind: 'item',
                id: 'prep',
                contextGroup: 'default',
                label: windowCommandLabels.editSong,
                onSelect: openInPrep,
              } as const,
            ]),
      ];
    case 'bible':
    case 'slides':
    case 'media':
    case 'unknown':
      return openInPrep === undefined
        ? []
        : [
            {
              kind: 'item',
              id: 'prep',
              contextGroup: 'default',
              label: '준비에서 열기',
              onSelect: openInPrep,
            },
          ];
  }
}

function renameRow(input: ServiceOrderMenuInput): readonly MenuItem[] {
  switch (input.row.kind) {
    case 'header':
    case 'slides':
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
      contextGroup: 'library',
      label: '라이브러리에서 보기',
      ...menuAvailability(
        input.song?.reason ??
          (input.song?.showInLibrary === undefined
            ? NOT_IN_THIS_WINDOW
            : undefined),
      ),
      onSelect: input.song?.showInLibrary,
    },
    laterRow('export-bundle', '묶음으로 내보내기…'),
    laterRow('export-images', '이미지로 내보내기…'),
  ];
}

/** Commands for one 예배 순서 row, grouped by the shared context-menu order. */
export function serviceOrderMenuEntries(
  input: ServiceOrderMenuInput,
): readonly MenuEntry[] {
  const open = openRows(input);
  return [
    laterRow('hide', '항목 숨기기'),
    ...(open.length > 0 ? [menuSeparator('open-separator'), ...open] : []),
    menuSeparator('clipboard-separator'),
    {
      kind: 'item',
      id: 'copy',
      contextGroup: 'clipboard',
      label: '복사',
      meta: 'Ctrl C',
      ...menuAvailability(
        input.clipboard?.copyReason ??
          (input.clipboard === undefined
            ? '선택한 항목이 없습니다'
            : undefined),
      ),
      onSelect: input.clipboard?.copy,
    },
    {
      kind: 'item',
      id: 'paste',
      contextGroup: 'clipboard',
      label: '붙여넣기',
      meta: 'Ctrl V',
      ...menuAvailability(
        input.clipboard?.pasteReason ??
          (input.clipboard === undefined
            ? '복사한 예배 순서 항목이 없습니다'
            : undefined),
      ),
      onSelect: input.clipboard?.paste,
    },
    {
      kind: 'item',
      id: 'duplicate',
      contextGroup: 'clipboard',
      label: '복제',
      command: 'edit.duplicate',
      ...menuAvailability(
        input.editable
          ? input.full
            ? ORDER_FULL_REASON
            : undefined
          : '예배 순서 편집 불가',
      ),
      onSelect: input.duplicate,
    },
    ...(input.row.kind === 'header'
      ? []
      : [
          {
            kind: 'item' as const,
            id: 'move-up',
            contextGroup: 'clipboard' as const,
            label: '위로 옮기기',
            command: 'list.moveUp',
            ...menuAvailability(
              input.editable && input.moveUp !== undefined
                ? input.moveUpReason
                : '예배 순서 편집 불가',
            ),
            onSelect: input.moveUp,
          },
          {
            kind: 'item' as const,
            id: 'move-down',
            contextGroup: 'clipboard' as const,
            label: '아래로 옮기기',
            command: 'list.moveDown',
            ...menuAvailability(
              input.editable && input.moveDown !== undefined
                ? input.moveDownReason
                : '예배 순서 편집 불가',
            ),
            onSelect: input.moveDown,
          },
        ]),
    ...renameRow(input),
    {
      kind: 'item',
      id: 'delete',
      contextGroup: 'delete',
      command: 'edit.delete',
      label: '삭제',
      danger: true,
      ...menuAvailability(input.editable ? undefined : '예배 순서 편집 불가'),
      onSelect: input.remove,
    },
    ...exportRows(input),
  ];
}
