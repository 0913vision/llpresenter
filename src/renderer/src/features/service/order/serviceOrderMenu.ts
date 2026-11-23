import {NOT_IN_THIS_WINDOW} from '@renderer/platform/problemReasons';
import {ORDER_FULL_REASON} from '@renderer/session/serviceOrderEdits';
import {windowCommandLabels} from '@renderer/ui/windowCommandLabels';
import {
  menuAvailability,
  type MenuEntry,
  type MenuItem,
} from '@renderer/ui/menuModel';
import {laterRow, menuSeparator} from '@renderer/ui/menuRows';
import {selectionLabel} from '@renderer/ui/selectionDrag';
import type {Workspace} from '@renderer/ui/workspace';
import type {ServiceRow} from '@core/presentation';
import {fixedKeyText} from '@renderer/ui/fixedKeys';

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
  ];
}

function openRows(input: ServiceOrderMenuInput): readonly MenuEntry[] {
  const {row, openInPrep} = input;
  if (row.kind === 'header') return [];
  if (row.kind === 'song') {
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
  }
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

/** What has a name of its own, instead of the one of its song or passage. */
const NAMED_KINDS: ReadonlySet<string> = new Set([
  'header',
  'notice',
  'blank',
  'media',
]);

function renameRow(input: ServiceOrderMenuInput): readonly MenuItem[] {
  return NAMED_KINDS.has(input.row.kind)
    ? [
        {
          kind: 'item',
          id: 'rename',
          label: '이름 바꾸기',
          ...menuAvailability(
            input.editable ? undefined : '예배 순서 편집 불가',
          ),
          onSelect: input.rename,
        },
      ]
    : [];
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
    ...open,
    ...(open.length > 0 ? [menuSeparator('clipboard-separator')] : []),
    {
      kind: 'item',
      id: 'copy',
      contextGroup: 'clipboard',
      label: '복사',
      meta: fixedKeyText('copy'),
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
      meta: fixedKeyText('paste'),
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

/** The commands that act on every chosen row at once. */
const FOR_MANY_ROWS: ReadonlySet<string> = new Set([
  'copy',
  'paste',
  'duplicate',
  'move-up',
  'move-down',
  'delete',
]);
const MOVES: ReadonlySet<string> = new Set(['move-up', 'move-down']);

/**
 * Fits the item menu to where it opens and to the chosen rows: 진행 has no
 * moves, several rows keep only the commands for all of them, and copy,
 * duplicate and delete name how many rows they take.
 */
export function fitOrderMenu(
  entries: readonly MenuEntry[],
  {
    workspace,
    count,
    copies,
  }: {
    readonly workspace: Workspace;
    /** The chosen rows. */
    readonly count: number;
    /** The rows a duplicate makes: the chosen items, 구역 with their items. */
    readonly copies: number;
  },
): readonly MenuEntry[] {
  return entries
    .filter(
      entry =>
        (workspace === 'prep' ||
          entry.kind !== 'item' ||
          !MOVES.has(entry.id)) &&
        (count === 1 || (entry.kind === 'item' && FOR_MANY_ROWS.has(entry.id))),
    )
    .map(entry =>
      entry.kind !== 'item' ||
      !['copy', 'duplicate', 'delete'].includes(entry.id)
        ? entry
        : {
            ...entry,
            label: selectionLabel(
              entry.label,
              entry.id === 'duplicate' ? copies : count,
            ),
          },
    );
}
