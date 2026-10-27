import {useEffect, useState, type JSX} from 'react';
import {isItemOfKind, type ServiceItem} from '@shared/schema/service';
import type {LibrarySearchMatch} from '@shared/schema/librarySearch';
import {createServiceItemId, type SongId} from '@shared/schema/ids';
import {searchRange} from '@shared/searchText';
import {useServiceOrderEditing} from '@renderer/show/useServiceOrderEditing';
import {useShow} from '@renderer/state/show';
import {IconButton} from '@renderer/ui/IconButton';
import {Menu} from '@renderer/ui/Menu';
import {menuButtonProps} from '@renderer/ui/menuButton';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {NEWER_FILE_REASON} from './ItemArrangement';
import {otherItemEntries} from './quickAddItems';
import {passageItem, type PassageDefaults} from './quickAddBible';
import {BibleQuickAdd} from './BibleQuickAdd';
import {quickAddBefore} from './quickAddPosition';
import {useOtherSources} from './useOtherSources';
import {useHeaderRename} from '@renderer/state/headerRename';
import {rememberBiblePassage} from '@renderer/show/bible/recentWriter';

const QUICK_ADD_LIMIT = 20;
const QUICK_ADD_WIDTH = 420;
const NO_SERVICE_REASON = '열린 예배 순서가 없습니다';

function searchFailed(): Notice {
  return {
    key: 'quick-add:search',
    kind: 'warning',
    icon: 'warning',
    title: '라이브러리 검색 실패',
    time: noticeTime(),
  };
}

// NOTE(0913vision): Reads the library songs for a query while the popover
// is open; an answer for an older query is dropped.
function useQuickAddSongs(
  open: boolean,
  query: string,
  onProblem: (notice: Notice) => void,
): readonly LibrarySearchMatch[] {
  const [result, setResult] = useState<{
    readonly query: string;
    readonly matches: readonly LibrarySearchMatch[];
  } | null>(null);
  useEffect(() => {
    const api = window.llp;
    if (!open || api === undefined) return undefined;
    let current = true;
    api.library.search({query, limit: QUICK_ADD_LIMIT}).then(
      answer => {
        if (current && answer.query === query) setResult(answer);
      },
      (error: unknown) => {
        console.error('Quick add search failed', error);
        if (current) onProblem(searchFailed());
      },
    );
    return () => {
      current = false;
    };
  }, [open, query, onProblem]);
  return result?.query === query ? result.matches : [];
}

function songEntries(
  matches: readonly LibrarySearchMatch[],
  query: string,
  onInsert: (songId: SongId) => void,
): readonly MenuEntry[] {
  if (matches.length === 0) return [];
  return [
    {kind: 'group', id: 'library', label: '라이브러리'},
    ...matches.map((match): MenuEntry => ({
      kind: 'item',
      id: match.songId,
      label: match.title,
      icon: 'song',
      match:
        match.match.kind === 'title'
          ? searchRange(match.title, query)
          : undefined,
      meta: `슬라이드 ${match.slideCount}개`,
      onSelect: () => onInsert(match.songId),
    })),
  ];
}

/**
 * 항목 추가: a popover that searches the 라이브러리 and inserts the chosen
 * song at the end of the selected item's group (spec 05, "Quick add").
 */
export function ServiceQuickAdd({
  onProblem,
}: {
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element {
  const serviceId = useShow(view => view.serviceId);
  const readOnly = useShow(view => view.readOnly);
  const editing = useServiceOrderEditing(serviceId, onProblem);
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [typingPassage, setTypingPassage] = useState(false);
  const songs = useQuickAddSongs(open && !typingPassage, query, onProblem);
  const sources = useOtherSources(open);
  const reason =
    serviceId === null
      ? NO_SERVICE_REASON
      : readOnly
        ? NEWER_FILE_REASON
        : undefined;
  const disabled = reason !== undefined || editing.busy;
  const insert = (songId: SongId): void => {
    const {rows, openItemId} = useShow.getState();
    const before = quickAddBefore(rows, openItemId);
    editing.run((edits, id) =>
      edits.insertSong(
        id,
        songId,
        before === null ? null : createServiceItemId(before),
      ),
    );
  };
  const insertPassage = (ref: string, defaults: PassageDefaults): void => {
    const passage = passageItem(ref, defaults);
    insertItem(passage);
  };
  const insertItem = (item: ServiceItem): void => {
    const {rows, openItemId} = useShow.getState();
    const before = quickAddBefore(rows, openItemId);
    if ('header' in item) useHeaderRename.getState().request(item.id);
    editing.run(async (edits, id) => {
      const result = await edits.insertItem(
        id,
        item,
        before === null ? null : createServiceItemId(before),
      );
      if (
        (result.ok ? result.value : result.error.reason === 'write-failed') &&
        isItemOfKind(item, 'bible')
      ) {
        rememberBiblePassage(item.bible);
      }
      return result;
    });
  };
  return (
    <>
      <IconButton
        ref={setButton}
        icon="plus"
        label="항목 추가"
        menu
        expanded={open}
        disabled={disabled}
        title={reason}
        {...menuButtonProps({
          expanded: open,
          disabled,
          onExpandedChange: next => {
            setQuery('');
            setTypingPassage(false);
            setOpen(next);
          },
        })}
      />
      {open && !disabled && button !== null ? (
        <Menu
          label="항목 추가"
          anchor={{kind: 'element', element: button}}
          width={QUICK_ADD_WIDTH}
          search={{
            value: query,
            onChange: setQuery,
            placeholder: '곡, 가사, 초성',
          }}
          onClose={() => setOpen(false)}
          entries={[
            ...songEntries(songs, query, insert),
            ...otherItemEntries({
              ...sources,
              onInsert: insertItem,
              onBible: () => {
                setQuery('');
                setOpen(false);
                setTypingPassage(true);
              },
            }),
          ]}
        />
      ) : null}
      {typingPassage && !disabled ? (
        <BibleQuickAdd
          onInsert={insertPassage}
          onClose={() => setTypingPassage(false)}
        />
      ) : null}
    </>
  );
}
