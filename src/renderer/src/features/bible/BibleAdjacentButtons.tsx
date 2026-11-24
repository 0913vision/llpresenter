import {useState, type JSX} from 'react';
import {passageBook, type VerseDirection} from '@core/bible';
import type {BibleSource} from '@renderer/session/bibleSource';
import {Button} from '@renderer/ui/buttons/Button';
import {lookupAdjacentPassage} from './lookupAdjacentPassage';
import {usePassageSwap} from './usePassageSwap';

/** Extends the preview without changing the selected verse or live output. */
export function BibleAdjacentButtons({
  source,
}: {
  readonly source: BibleSource;
}): JSX.Element {
  const api = window.llp;
  const {busy, problem, swap} = usePassageSwap(source);
  const [edge, setEdge] = useState<VerseDirection>();
  const extend = async (direction: VerseDirection): Promise<void> => {
    if (passageBook(source.passage) === undefined) return;
    const result = await swap(
      (llp, current) =>
        lookupAdjacentPassage({
          passage: source.passage,
          direction,
          lookup: request => llp.bible.lookup(request),
          current,
        }),
      {
        log: 'Could not add an adjacent Bible verse',
        problem: '구절 불러오기 실패',
      },
    );
    if (result === 'none') setEdge(direction);
  };
  const first = source.passage.verses[0];
  const beginning = first?.chapter === 1 && first.verse === 1;
  return (
    <>
      {(['previous', 'next'] as const).map(direction => {
        const noVerse =
          edge === direction || (direction === 'previous' && beginning);
        const reason = !api
          ? '구절을 불러올 수 없습니다.'
          : busy
            ? '구절 불러오는 중'
            : noVerse
              ? '앞뒤 절 없음'
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
