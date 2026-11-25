import {useEffect, useRef, useState, type JSX, type KeyboardEvent} from 'react';
import {LIBRARY_SEARCH_LIMITS} from '@core/schema/songs/librarySearch';
import {IconButton} from '@renderer/ui/buttons/IconButton';
import {Icon} from '@renderer/ui/Icon';
import {MatchedText} from '@renderer/ui/text/MatchedText';
import {EmptyState} from '@renderer/ui/lists/EmptyState';
import {ROW_POINTER_CLASS} from '@renderer/ui/lists/rowPointer';
import {classNames} from '@renderer/ui/classNames';
import {
  Panel,
  PanelActions,
  PanelBody,
  PanelHeader,
  PanelTitle,
} from '@renderer/ui/panels/Panel';
import type {Notice} from '@renderer/ui/popups/notices';
import {hasModifier} from '@renderer/ui/keys/modifierKeys';
import {
  insertLibrarySong,
  rowAfterSelected,
} from '@renderer/session/service/insertIntoOrder';
import {closeSearchResults, type ShownSearch} from './searchResults';
import {useSearchReply} from './useToolbarSearch';
import styles from './SearchResultsPanel.module.css';

const SONG_ICON_SIZE = 16;

/**
 * All the songs a toolbar search found, in the center column: each with the
 * lyric line it was found by. Arrows choose, Enter or a click opens, Ctrl
 * Enter adds to the 예배 순서 where that is possible, and Escape or × closes.
 */
export function SearchResultsPanel({
  shown,
  onProblem,
}: {
  readonly shown: ShownSearch;
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element {
  const {reply} = useSearchReply({
    enabled: true,
    query: shown.query,
    limit: LIBRARY_SEARCH_LIMITS.max,
    onProblem,
  });
  const answered = reply.query === shown.query && !reply.loading;
  const matches = answered ? reply.matches : [];
  const [pointed, setPointed] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.focus({preventScroll: true});
  }, [shown]);
  const open = (index: number): void => {
    const match = matches[index];
    if (match === undefined) return;
    closeSearchResults();
    shown.open(match);
  };
  const keys = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSearchResults();
      return;
    }
    if (event.key === 'Enter' && event.ctrlKey && shown.addsToOrder) {
      event.preventDefault();
      const match = matches[pointed];
      if (match !== undefined) {
        insertLibrarySong(match.songId, rowAfterSelected(), onProblem);
      }
      return;
    }
    if (hasModifier(event)) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      open(pointed);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setPointed(at => Math.min(Math.max(at + step, 0), matches.length - 1));
    }
  };
  const status = !answered
    ? '검색 중'
    : reply.failed
      ? '검색 실패'
      : matches.length === 0
        ? '검색 결과 없음'
        : null;
  return (
    <Panel label="검색 결과" className={styles.panel}>
      <PanelHeader>
        <PanelTitle
          title="검색 결과"
          meta={`"${shown.query}" ${answered ? `${matches.length}곡` : ''}`}
        />
        <PanelActions>
          <IconButton
            icon="x"
            label="검색 결과 닫기"
            shortcut="Esc"
            onClick={closeSearchResults}
          />
        </PanelActions>
      </PanelHeader>
      <PanelBody variant="flush" className={styles.body}>
        {status === null ? null : <EmptyState text={status} />}
        <div
          ref={list}
          role="listbox"
          aria-label="검색 결과"
          tabIndex={0}
          className={styles.list}
          aria-activedescendant={
            matches[pointed] === undefined
              ? undefined
              : `search-result-${matches[pointed].songId}`
          }
          onKeyDown={keys}
        >
          {matches.map((match, index) => (
            <div
              key={match.songId}
              id={`search-result-${match.songId}`}
              role="option"
              aria-selected={index === pointed}
              className={classNames(styles.row, ROW_POINTER_CLASS)}
              onMouseMove={() => setPointed(index)}
              onClick={() => open(index)}
            >
              <Icon name="song" size={SONG_ICON_SIZE} />
              <span className={styles.lines}>
                <MatchedText
                  text={match.title}
                  query={shown.query}
                  className={styles.title}
                />
                {match.match.kind === 'lyrics' ? (
                  <MatchedText
                    text={match.match.line}
                    query={shown.query}
                    className={styles.sub}
                  />
                ) : null}
              </span>
              <span className={styles.meta}>슬라이드 {match.slideCount}개</span>
            </div>
          ))}
        </div>
      </PanelBody>
    </Panel>
  );
}
