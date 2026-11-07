import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {windowCommandLabels} from '@renderer/ui/windowCommandLabels';
import type {LibrarySong} from '@core/schema/contentDocuments';
import {menuAvailability, type MenuEntry} from '@renderer/ui/menuModel';
import {laterRow, menuSeparator} from '@renderer/ui/menuRows';

/** Why a song can't be copied now, for its menu row and for Ctrl D. */
export function songCopyReason(
  song: Pick<LibrarySong, 'access'>,
  busy: boolean,
): string | undefined {
  if (song.access === 'readOnly') return NEWER_FILE_REASON;
  return busy ? '작업 중' : undefined;
}

export function libraryMenuEntries({
  song,
  appendDisabledReason,
  busy,
  open,
  append,
  duplicate,
  remove,
  rename,
  reveal,
}: {
  readonly song: LibrarySong;
  readonly appendDisabledReason: string | undefined;
  readonly busy: boolean;
  readonly open: () => void;
  readonly append: () => void;
  readonly duplicate: () => void;
  readonly remove: () => void;
  readonly rename: () => void;
  readonly reveal: () => void;
}): readonly MenuEntry[] {
  return [
    {
      kind: 'item',
      id: 'add-to',
      label: '예배 순서에 추가',
      ...menuAvailability(
        appendDisabledReason ?? (busy ? '작업 중' : undefined),
      ),
      onSelect: append,
    },
    menuSeparator('arrangement-separator'),
    laterRow('arrangement', '구성', {submenu: true}),
    laterRow('destination', '출력할 화면', {submenu: true}),
    menuSeparator('edit-separator'),
    {
      kind: 'item',
      id: 'lyrics',
      label: windowCommandLabels.editSong,
      ...menuAvailability(busy ? '작업 중' : undefined),
      onSelect: open,
    },
    menuSeparator('clipboard-separator'),
    laterRow('copy', '복사', {icon: 'copy'}),
    laterRow('paste', '붙여넣기', {icon: 'paste'}),
    {
      kind: 'item',
      id: 'duplicate',
      label: '복제',
      icon: 'duplicate',
      ...menuAvailability(songCopyReason(song, busy)),
      onSelect: duplicate,
    },
    {
      kind: 'item',
      id: 'rename',
      label: '이름 바꾸기',
      ...menuAvailability(
        song.access === 'readOnly'
          ? NEWER_FILE_REASON
          : busy
            ? '작업 중'
            : undefined,
      ),
      onSelect: rename,
    },
    {
      kind: 'item',
      id: 'delete',
      label: '삭제',
      danger: true,
      ...menuAvailability(
        song.access === 'readOnly'
          ? NEWER_FILE_REASON
          : busy
            ? '작업 중'
            : undefined,
      ),
      onSelect: remove,
    },
    menuSeparator('export-separator'),
    {
      kind: 'item',
      id: 'reveal',
      label: '탐색기에서 보기',
      onSelect: reveal,
    },
    laterRow('export-bundle', '묶음으로 내보내기…'),
    laterRow('export-images', '이미지로 내보내기…'),
  ];
}
