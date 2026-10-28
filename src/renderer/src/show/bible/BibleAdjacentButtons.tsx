import {useEffect, useRef, useState, type JSX} from 'react';
import {useShow, selectTile} from '@renderer/state/show';
import {useLive} from '@renderer/state/live';
import {bibleSourceFor} from '@renderer/state/showLibrary';
import {
  beginOutputRequest,
  isOutputRequestCurrent,
  withinLookupTimeout,
} from '@renderer/state/showOutput';
import {Button} from '@renderer/ui/Button';
import {openBiblePassage} from './actions';
import {
  adjacentVerseRange,
  passageBook,
  type VerseDirection,
} from './adjacentVerses';
import type {BibleSource} from './source';

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
      const metadata = await withinLookupTimeout(() =>
        api.bible.lookup({
          translation: source.passage.translation,
          input: book.korean,
        }),
      );
      if (!current()) return;
      if (!metadata.bounds) {
        throw new Error('Bible chapter counts are unavailable');
      }
      const input = adjacentVerseRange(
        source.passage,
        metadata.bounds,
        direction,
      );
      if (input === null) {
        setEdge(direction);
        return;
      }
      const reply = await withinLookupTimeout(() =>
        api.bible.lookup({
          translation: source.passage.translation,
          input,
        }),
      );
      if (!current()) return;
      if (!reply.result.ok) throw new Error(reply.result.error.message);
      const passage = reply.result.value;
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
