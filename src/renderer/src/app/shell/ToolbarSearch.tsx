import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import type {SongId} from '@core/schema/ids';
import type {LibrarySearchMatch} from '@core/schema/librarySearch';
import {Icon, TextField} from '@renderer/ui';
import {isComposing} from '@renderer/ui/ime';
import {hasModifier} from '@renderer/ui/modifierKeys';
import type {Notice} from '@renderer/ui/notices';
import {TruncatedText} from '@renderer/ui/TruncatedText';
import {useToolbarSearch} from './useToolbarSearch';
import styles from './ToolbarSearch.module.css';
import {useShow} from '@renderer/state/show';
import {useServiceOrderEditing} from '@renderer/features/service/order/useServiceOrderEditing';
import {quickAddBefore} from '@core/services/quickAddPosition';
import {createServiceItemId} from '@core/schema/ids';
import {useTooltip} from '@renderer/ui/Tooltip';

const SONG_ICON_SIZE = 16;
const NO_RESULT = -1;
const WORKSPACE_UNAVAILABLE_TIP =
  '현재 작업 공간에서는 검색 결과를 열 수 없습니다';

type ResultKey = 'ArrowDown' | 'ArrowUp';

function logProblem(notice: Notice): void {
  console.error('Toolbar search failed:', notice.key);
}

/**
 * Moves the pointed result. Down stops at the last result; Up from no result
 * starts at the last one and stops at the first.
 */
export function nextPointed(
  current: number,
  key: ResultKey,
  count: number,
): number {
  if (key === 'ArrowDown') return Math.min(current + 1, count - 1);
  return current === NO_RESULT ? count - 1 : Math.max(0, current - 1);
}

function optionIdOf(listId: string, match: LibrarySearchMatch): string {
  return `${listId}-${match.songId}`;
}

function isResultKey(code: string): code is ResultKey {
  return code === 'ArrowDown' || code === 'ArrowUp';
}

function statusLabel({
  loading,
  failed,
}: {
  readonly loading: boolean;
  readonly failed: boolean;
}): string {
  if (loading) return '검색 중';
  return failed ? '검색 실패' : '검색 결과 없음';
}

function useCloseOnOutsidePointer(
  open: boolean,
  root: RefObject<HTMLElement | null>,
  onOutside: () => void,
): void {
  const closeOutside = useEffectEvent(onOutside);
  useEffect(() => {
    if (!open) return undefined;
    const outside = (event: PointerEvent): void => {
      if (
        event.target instanceof Node &&
        !root.current?.contains(event.target)
      ) {
        closeOutside();
      }
    };
    window.addEventListener('pointerdown', outside, true);
    return () => window.removeEventListener('pointerdown', outside, true);
  }, [open, root]);
}

function ResultRow({
  match,
  id,
  selected,
  onPoint,
  onChoose,
}: {
  readonly match: LibrarySearchMatch;
  readonly id: string;
  readonly selected: boolean;
  readonly onPoint: () => void;
  readonly onChoose: () => void;
}): JSX.Element {
  const lyrics = match.match.kind === 'lyrics' ? match.match.line : null;
  return (
    <button
      type="button"
      role="option"
      id={id}
      aria-selected={selected}
      tabIndex={-1}
      className={lyrics ? `${styles.row} ${styles.double}` : styles.row}
      onMouseDown={event => event.preventDefault()}
      onMouseMove={onPoint}
      onClick={onChoose}
    >
      <Icon name="song" size={SONG_ICON_SIZE} />
      <span className={styles.lines}>
        <TruncatedText text={match.title} />
        {lyrics ? <TruncatedText text={lyrics} className={styles.sub} /> : null}
      </span>
      <span className={styles.meta}>슬라이드 {match.slideCount}개</span>
    </button>
  );
}

/** A toolbar search field and its bounded list; choosing only opens a source. */
export function ToolbarSearch({
  enabled,
  onProblem = logProblem,
  onOpenPrepSong,
  focusSearch = false,
  onSearchFocused,
}: {
  readonly enabled: boolean;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
  readonly onOpenPrepSong?: ((songId: SongId) => void) | undefined;
  readonly focusSearch?: boolean | undefined;
  readonly onSearchFocused?: (() => void) | undefined;
}): JSX.Element {
  const search = useToolbarSearch(enabled, onProblem, onOpenPrepSong);
  const serviceId = useShow(view => view.serviceId);
  const readOnly = useShow(view => view.readOnly);
  const editing = useServiceOrderEditing(serviceId, onProblem);
  const addReason =
    serviceId === null
      ? '열린 예배 순서가 없습니다'
      : readOnly
        ? '읽기 전용 예배 순서'
        : editing.busy
          ? '예배 순서를 변경하는 중'
          : undefined;
  const addTooltip = useTooltip(addReason ? {text: addReason} : undefined);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [pointedId, setPointedId] = useState<SongId | null>(null);
  const expanded = enabled && open && search.query.trim() !== '';
  const pointed = search.matches.findIndex(match => match.songId === pointedId);
  const selected = search.matches[pointed];
  useEffect(() => {
    if (!focusSearch || !enabled) return;
    const input = root.current?.querySelector('input');
    if (input === undefined || input === null) return;
    input.focus();
    input.select();
    onSearchFocused?.();
  }, [focusSearch, enabled, onSearchFocused]);
  useEffect(() => {
    if (!expanded || !selected) return;
    document
      .getElementById(optionIdOf(listId, selected))
      ?.scrollIntoView({block: 'nearest'});
  }, [expanded, selected, listId]);
  useCloseOnOutsidePointer(open, root, () => setOpen(false));

  const choose = (match: LibrarySearchMatch): void => {
    setOpen(false);
    search
      .choose(match)
      .catch((cause: unknown) =>
        console.error('Toolbar result callback failed:', cause),
      );
  };
  const keys = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (isComposing(event)) return;
    if (
      event.code === 'Enter' &&
      event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey &&
      !event.metaKey
    ) {
      if (!expanded || !selected) return;
      event.preventDefault();
      if (event.repeat || addReason !== undefined) return;
      const {rows, openItemId} = useShow.getState();
      const before = quickAddBefore(rows, openItemId);
      editing.run((edits, id) =>
        edits.insertSong(
          id,
          selected.songId,
          before === null ? null : createServiceItemId(before),
        ),
      );
      setOpen(false);
      return;
    }
    if (hasModifier(event)) return;
    if (search.matches.length === 0) return;
    if (isResultKey(event.code)) {
      event.preventDefault();
      if (!expanded) {
        setOpen(true);
        return;
      }
      const next = nextPointed(pointed, event.code, search.matches.length);
      setPointedId(search.matches[next]?.songId ?? null);
    } else if (event.code === 'Enter' && expanded && selected) {
      event.preventDefault();
      choose(selected);
    }
  };
  return (
    <div className={styles.center}>
      <div
        ref={root}
        className={styles.search}
        onBlur={event => {
          if (
            !(event.relatedTarget instanceof Node) ||
            !event.currentTarget.contains(event.relatedTarget)
          ) {
            setOpen(false);
          }
        }}
      >
        <TextField
          ring
          clearable
          icon="search"
          block
          placeholder="곡, 가사, 초성"
          aria-label="검색"
          aria-keyshortcuts="Control+F"
          disabled={!enabled || !window.llp}
          title={!enabled ? WORKSPACE_UNAVAILABLE_TIP : undefined}
          role="combobox"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-activedescendant={
            expanded && selected ? optionIdOf(listId, selected) : undefined
          }
          value={search.query}
          onChange={value => {
            search.setQuery(value);
            setPointedId(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={keys}
        />
        {expanded ? (
          <div className={styles.popup}>
            <div
              role="listbox"
              id={listId}
              aria-label="곡 검색 결과"
              aria-busy={search.loading}
            >
              {search.matches.map(match => (
                <ResultRow
                  key={match.songId}
                  match={match}
                  id={optionIdOf(listId, match)}
                  selected={match.songId === pointedId}
                  onPoint={() => setPointedId(match.songId)}
                  onChoose={() => choose(match)}
                />
              ))}
            </div>
            {search.matches.length === 0 ? (
              <div role="status" className={styles.status}>
                {statusLabel(search)}
              </div>
            ) : null}
            <div className={styles.footer}>
              <span>Enter 열기</span>
              <span
                {...addTooltip.targetProps}
                aria-disabled={addReason !== undefined}
              >
                Ctrl Enter 예배 순서에 추가
              </span>
            </div>
            {addTooltip.tooltip}
          </div>
        ) : null}
      </div>
    </div>
  );
}
