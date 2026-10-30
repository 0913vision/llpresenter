import {useEffect, useRef, useState, type JSX} from 'react';
import {useShow, selectTile} from '@renderer/features/presentation/state/show';
import {useLive} from '@renderer/platform/live';
import {bibleSourceFor} from '@renderer/features/presentation/state/showLibrary';
import {
  beginOutputRequest,
  isOutputRequestCurrent,
} from '@renderer/features/presentation/state/showOutput';
import {Button} from '@renderer/ui/Button';
import {openBiblePassage} from './actions';
import {passageBook, type VerseDirection} from '@core/bible/adjacentVerses';
import {lookupAdjacentPassage} from './lookupAdjacentPassage';
import type {BibleSource} from '@core/bible/source';

/** Extends the preview without changing the selected verse or live output. */
export function BibleAdjacentButtons({
  source,
}: {
  readonly source: BibleSource;
}): JSX.Element {
  const api = window.llp;
  const locked = useRef(false);
  const lifetime = useRef({active: true});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [edge, setEdge] = useState<VerseDirection>();
  useEffect(() => {
    const owner = lifetime.current;
    owner.active = true;
    return () => {
      owner.active = false;
    };
  }, []);
  const extend = async (direction: VerseDirection): Promise<void> => {
    const book = passageBook(source.passage);
    if (!api || !book || locked.current) return;
    locked.current = true;
    setBusy(true);
    setProblem(undefined);
    const owner = lifetime.current;
    const request = beginOutputRequest();
    const commandVersion = useLive.getState().commandVersion;
    const initial = useShow.getState();
    const current = (): boolean => {
      const view = useShow.getState();
      return (
        owner.active &&
        bibleSourceFor(view, view.openItemId) === source &&
        view.openItemId === source.id &&
        view.selectedTile === initial.selectedTile &&
        isOutputRequestCurrent(request, commandVersion)
      );
    };
    try {
      const passage = await lookupAdjacentPassage({
        passage: source.passage,
        direction,
        lookup: request => api.bible.lookup(request),
        current,
      });
      if (!current()) return;
      if (passage === null) {
        setEdge(direction);
        return;
      }
      const shift =
        direction === 'previous'
          ? passage.verses.length - source.passage.verses.length
          : 0;
      openBiblePassage(passage, {
        verseNumbers: source.verseNumbers,
        enteredRef: source.enteredRef ?? source.passage.ref,
        enteredTranslation:
          source.enteredTranslation ?? source.passage.translation,
      });
      selectTile(initial.selectedTile + shift);
    } catch (cause) {
      if (current()) {
        api.log.write({
          level: 'error',
          message: 'Could not add an adjacent Bible verse',
          detail: String(cause),
        });
        setProblem('구절 조회 실패');
      }
    } finally {
      if (owner.active) {
        locked.current = false;
        setBusy(false);
      }
    }
  };
  const first = source.passage.verses[0];
  const beginning = first?.chapter === 1 && first.verse === 1;
  return (
    <>
      {(['previous', 'next'] as const).map(direction => {
        const noVerse =
          edge === direction || (direction === 'previous' && beginning);
        const reason = !api
          ? '구절 조회 불가'
          : busy
            ? '구절 조회 중'
            : noVerse
              ? '인접한 절 없음'
              : problem;
        return (
          <Button
            key={direction}
            disabled={!api || busy || noVerse}
            title={reason}
            onClick={() => {
              extend(direction).catch((cause: unknown) =>
                console.error('Could not extend the Bible preview', cause),
              );
            }}
          >
            {direction === 'previous' ? '앞 절 추가' : '뒤 절 추가'}
          </Button>
        );
      })}
    </>
  );
}
