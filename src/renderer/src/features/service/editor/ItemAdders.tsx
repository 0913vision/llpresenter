import {useState, type JSX} from 'react';
import {parseMediaId} from '@core/schema/common/ids';
import type {BibleLookupPassage} from '@core/schema/bible/bibleLookup';
import type {SlidesItem} from '@core/schema/services/service';
import {
  pictureSlide,
  makeSlide,
  SERVICE_TITLES,
  titleSlide,
} from '@core/slides';
import {themeOfSlide} from '@core/theme';
import {makePassageSlides} from '@renderer/features/bible/makePassageSlides';
import {MediaPicker} from '@renderer/features/media/picker/MediaPicker';
import {addReason, addSlides} from '@renderer/features/slides/deckCommands';
import type {SlideDeck} from '@renderer/features/slides/slideDeck';
import type {Report} from '@renderer/session/serviceEdit';
import {mediaItem, pictureMedia, useMedia} from '@renderer/platform/media';
import {slideMaking, useThemes} from '@renderer/platform/themes';
import {Button} from '@renderer/ui/buttons/Button';
import {warningNotice} from '@renderer/ui/popups/notices';
import {BibleQuickAdd} from '../items/BibleQuickAdd';
import type {PassageDefaults} from '../items/passageItems';

function addTitle(deck: SlideDeck): void {
  const name = deck.source.title;
  const title = SERVICE_TITLES.find(entry => entry.name === name) ?? {
    name,
    english: '',
  };
  addSlides(deck, [titleSlide(slideMaking(), title)], 0);
}

function addPicture(deck: SlideDeck, choice: string | undefined): void {
  const id = choice === undefined ? null : parseMediaId(choice);
  if (id?.ok !== true) return;
  const making = slideMaking();
  addSlides(deck, [
    mediaItem(id.value)?.kind === 'video'
      ? makeSlide(making, 'media', {
          background: {kind: 'media', media: id.value},
        })
      : pictureSlide(making, id.value),
  ]);
}

async function addPassage(
  deck: SlideDeck,
  passage: BibleLookupPassage,
  defaults: PassageDefaults,
): Promise<void> {
  const api = window.llp;
  if (api === undefined) return;
  const slides = await makePassageSlides(api, passage, {
    settings: defaults,
    ownAddress: true,
  });
  if (slides !== null) addSlides(deck, slides);
}

/** What can be added to an item beside its own kind of slide. */
export function ItemAdders({
  deck,
  item,
  report,
}: {
  readonly deck: SlideDeck;
  readonly item: SlidesItem;
  readonly report: Report;
}): JSX.Element {
  const themes = useThemes(view => view.themes);
  const media = useMedia(view => view.items);
  const [picture, setPicture] = useState<HTMLButtonElement | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [query, setQuery] = useState('');
  const [passage, setPassage] = useState(false);
  const disabled = addReason(deck) !== undefined;
  const first = deck.slides[0];
  const titled =
    first !== undefined && themeOfSlide(themes, first).purpose === 'title';
  const free = item.kind === 'blank' || item.kind === 'notice';
  return (
    <>
      {titled || item.kind === 'media' ? null : (
        <Button
          variant="ghost"
          icon="plus"
          disabled={disabled}
          onClick={() => addTitle(deck)}
        >
          타이틀
        </Button>
      )}
      {free ? (
        <>
          <Button
            ref={setPicture}
            variant="ghost"
            icon="plus"
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={choosing}
            onClick={() => {
              setQuery('');
              setChoosing(true);
            }}
          >
            그림 추가
          </Button>
          <Button
            variant="ghost"
            icon="plus"
            disabled={disabled}
            onClick={() => setPassage(true)}
          >
            성경 구절
          </Button>
        </>
      ) : null}
      {choosing && picture !== null ? (
        <MediaPicker
          label="그림"
          anchor={picture}
          allowNone={false}
          items={pictureMedia(media)}
          selected={undefined}
          query={query}
          onQueryChange={setQuery}
          onSelect={choice => addPicture(deck, choice)}
          onClose={restore => {
            setChoosing(false);
            if (restore) picture.focus();
          }}
        />
      ) : null}
      {passage ? (
        <BibleQuickAdd
          onInsert={(value, defaults) => {
            addPassage(deck, value, defaults).catch((error: unknown) => {
              console.error('Could not add a passage', error);
              report(warningNotice('slides:passage', '성경 구절 추가 실패'));
            });
          }}
          onClose={() => setPassage(false)}
        />
      ) : null}
    </>
  );
}
