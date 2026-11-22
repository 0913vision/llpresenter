import {useMemo, useState, type JSX} from 'react';
import {displayReference} from '@core/bible';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import {isItemOfKind, type ServiceItemOf} from '@core/schema/service';
import {withLiturgyTranslation, replacePassage} from '@core/slides';
import {BiblePassageDialog} from '@renderer/features/bible/BiblePassageDialog';
import {makePassageSlides} from '@renderer/features/bible/makePassageSlides';
import {useVerseSplit} from '@renderer/features/bible/useVerseSplit';
import {type SlideDeck} from '@renderer/features/slides/slideDeck';
import {runEdit, type Report} from '@renderer/session/serviceEdit';
import {slideMaking} from '@renderer/platform/themes';
import {editItem} from '@renderer/session/openService';
import {useShow} from '@renderer/session/show';
import {Button} from '@renderer/ui/Button';
import {noticeTime} from '@renderer/ui/notices';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {useServiceSongMenu} from '../order/useServiceSongMenu';

/** Saves the slides of a song item as the song of the library. */
function SongTools({
  item,
  report,
}: {
  readonly item: ServiceItemOf<'song'>;
  readonly report: Report;
}): JSX.Element {
  const serviceId = useShow(view => view.serviceId);
  const target = useMemo(
    () => ({id: item.id, serviceId}),
    [item.id, serviceId],
  );
  const menu = useServiceSongMenu(target, report);
  return (
    <>
      <Button
        disabled={menu.reason !== undefined || menu.locked}
        title={menu.reason}
        onClick={menu.save}
      >
        라이브러리에 저장…
      </Button>
      {menu.dialog}
    </>
  );
}

type PassageItem = ServiceItemOf<'bible'> | ServiceItemOf<'sermon'>;

async function changePassage(
  item: PassageItem,
  passage: BibleLookupPassage,
  report: Report,
): Promise<void> {
  const api = window.llp;
  if (api === undefined) return;
  const slides = await makePassageSlides(api, passage, {
    settings: item.passage,
    before: item.slides,
  });
  if (slides === null) return;
  const {ref, translation} = passage;
  runEdit(
    editItem(item.id, current =>
      isItemOfKind(current, 'bible') || isItemOfKind(current, 'sermon')
        ? {
            ...current,
            name:
              current.kind === 'bible' ? displayReference(ref) : current.name,
            passage: {...current.passage, ref, translation},
            slides: replacePassage(current.slides, slides),
          }
        : null,
    ),
    report,
  );
}

/** Changes the passage of an item, and cuts its verses. */
function PassageTools({
  deck,
  item,
  report,
}: {
  readonly deck: SlideDeck;
  readonly item: PassageItem;
  readonly report: Report;
}): JSX.Element {
  const split = useVerseSplit(deck, report);
  const [choosing, setChoosing] = useState(false);
  const choose = (passage: BibleLookupPassage): void => {
    setChoosing(false);
    changePassage(item, passage, report).catch((error: unknown) => {
      console.error('Could not change a passage', error);
      report({
        key: 'bible-passage',
        kind: 'warning',
        icon: 'warning',
        title: '성경 구절 변경 실패',
        time: noticeTime(),
      });
    });
  };
  return (
    <>
      <Button
        disabled={split.reason !== undefined}
        title={split.reason}
        onClick={split.open}
      >
        절 나누기
      </Button>
      <Button disabled={deck.readOnly} onClick={() => setChoosing(true)}>
        본문 변경…
      </Button>
      {split.dialog}
      {choosing && window.llp !== undefined ? (
        <BiblePassageDialog
          api={window.llp.bible}
          initialRef={item.passage.ref}
          translation={item.passage.translation}
          action="변경"
          onChoose={choose}
          onClose={() => setChoosing(false)}
        />
      ) : null}
    </>
  );
}

export function LiturgyVersion({
  item,
  disabled,
  report,
}: {
  readonly item: ServiceItemOf<'liturgy'>;
  readonly disabled: boolean;
  readonly report: Report;
}): JSX.Element {
  return (
    <SelectMenu
      aria-label="예식문 버전"
      value={item.translation}
      disabled={disabled}
      options={[
        {value: 'new', label: '새 번역'},
        {value: 'old', label: '옛 번역'},
      ]}
      onChange={translation =>
        runEdit(
          editItem(item.id, current =>
            isItemOfKind(current, 'liturgy')
              ? withLiturgyTranslation(slideMaking(), current, translation)
              : null,
          ),
          report,
        )
      }
    />
  );
}

/** The commands a kind of item has beside the ones of its slides. */
export function ItemTools({
  deck,
  report,
}: {
  readonly deck: SlideDeck;
  readonly report: Report;
}): JSX.Element | null {
  const {item} = deck;
  switch (item?.kind) {
    case 'song':
      return <SongTools item={item} report={report} />;
    case 'bible':
    case 'sermon':
      return <PassageTools deck={deck} item={item} report={report} />;
    case 'liturgy':
      return (
        <LiturgyVersion item={item} disabled={deck.readOnly} report={report} />
      );
    case 'notice':
    case 'blank':
    case 'media':
    case undefined:
      return null;
  }
}
