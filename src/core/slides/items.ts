import {displayReference} from '@core/bible';
import {createServiceItemId, type MediaId} from '@core/schema/ids';
import type {BiblePassage} from '@core/schema/biblePassage';
import type {ServiceItemOf, SlidesItem} from '@core/schema/service';
import type {Slide} from '@core/schema/slide';
import type {Song} from '@core/schema/song';
import {LITURGY_SLIDES} from './liturgySlides';
import {copySlide, makeSlide, type SlideMaking} from './make';
import {serviceTitle, titleSlide, type TitleCard} from './titles';

export type LiturgyKind = ServiceItemOf<'liturgy'>['liturgy'];
export type LiturgyTranslation = ServiceItemOf<'liturgy'>['translation'];

export const LITURGY_NAMES: Readonly<Record<LiturgyKind, string>> = {
  creed: '사도신경',
  prayer: '주기도문',
};

const newId = () => createServiceItemId(crypto.randomUUID());

/** A song of the library, with slides of its own in this service. */
export function songItem(song: Song): ServiceItemOf<'song'> {
  return {
    id: newId(),
    kind: 'song',
    name: song.title,
    song: song.id,
    slides: song.slides.map(slide => ({
      ...copySlide(slide),
      ...(slide.hotKey === undefined ? {} : {hotKey: slide.hotKey}),
    })),
  };
}

export function blankItem(making: SlideMaking): ServiceItemOf<'blank'> {
  return {
    id: newId(),
    kind: 'blank',
    name: '빈 슬라이드',
    slides: [makeSlide(making, 'blank')],
  };
}

export function noticeItem(making: SlideMaking): ServiceItemOf<'notice'> {
  return {
    id: newId(),
    kind: 'notice',
    name: '광고',
    slides: [makeSlide(making, 'notice')],
  };
}

export function titleItem(
  making: SlideMaking,
  title: TitleCard,
): ServiceItemOf<'blank'> {
  return {
    id: newId(),
    kind: 'blank',
    name: title.name,
    slides: [titleSlide(making, title)],
  };
}

export function preparationItem(making: SlideMaking): ServiceItemOf<'blank'> {
  return {
    id: newId(),
    kind: 'blank',
    name: '예배 준비',
    slides: [makeSlide(making, 'preparation')],
  };
}

export function standbyItem(making: SlideMaking): ServiceItemOf<'blank'> {
  return {
    id: newId(),
    kind: 'blank',
    name: '대기 화면',
    slides: [makeSlide(making, 'standby')],
  };
}

export function liturgySlides(
  making: SlideMaking,
  liturgy: LiturgyKind,
  translation: LiturgyTranslation,
): readonly Slide[] {
  return LITURGY_SLIDES[liturgy][translation].map(text =>
    makeSlide(making, 'creed', {
      texts: {본문: text},
      transition: making.transitions[liturgy],
    }),
  );
}

export function liturgyItem(
  making: SlideMaking,
  liturgy: LiturgyKind,
  translation: LiturgyTranslation,
): ServiceItemOf<'liturgy'> {
  return {
    id: newId(),
    kind: 'liturgy',
    name: LITURGY_NAMES[liturgy],
    liturgy,
    translation,
    slides: liturgySlides(making, liturgy, translation),
  };
}

/** The same item in another translation; its opening titles stay. */
export function withLiturgyTranslation(
  making: SlideMaking,
  item: ServiceItemOf<'liturgy'>,
  translation: LiturgyTranslation,
): ServiceItemOf<'liturgy'> {
  const first = item.slides.findIndex(
    slide => slide.texts['본문'] !== undefined,
  );
  const opening = first < 0 ? item.slides : item.slides.slice(0, first);
  return {
    ...item,
    translation,
    slides: [...opening, ...liturgySlides(making, item.liturgy, translation)],
  };
}

export function bibleItem(
  passage: BiblePassage,
  slides: readonly Slide[],
): ServiceItemOf<'bible'> {
  return {
    id: newId(),
    kind: 'bible',
    name: displayReference(passage.ref),
    passage,
    slides,
  };
}

/** A sermon: its title, the passage, and the title again. */
export function sermonItem(
  making: SlideMaking,
  {
    title,
    passage,
    slides,
  }: {
    readonly title: string;
    readonly passage: BiblePassage;
    readonly slides: readonly Slide[];
  },
): ServiceItemOf<'sermon'> {
  const titled = () => makeSlide(making, 'sermonTitle', {texts: {제목: title}});
  return {
    id: newId(),
    kind: 'sermon',
    name: title,
    passage,
    slides: [titled(), ...slides, titled()],
  };
}

export function mediaItem(
  making: SlideMaking,
  media: MediaId,
  {name, sound}: {readonly name: string; readonly sound: boolean},
): ServiceItemOf<'media'> {
  return {
    id: newId(),
    kind: 'media',
    name,
    media,
    slides: sound
      ? []
      : [makeSlide(making, 'media', {background: {kind: 'media', media}})],
  };
}

/** A picture on a slide of its own. */
export function pictureSlide(making: SlideMaking, media: MediaId): Slide {
  return makeSlide(making, 'picture', {background: {kind: 'media', media}});
}

/** The item with a title in front of its slides. */
export function withOpeningTitle<TItem extends SlidesItem>(
  making: SlideMaking,
  item: TItem,
  title: TitleCard,
): TItem {
  return {...item, slides: [titleSlide(making, title), ...item.slides]};
}

/** The notices of a service, with their opening title. */
export function openedNotices(making: SlideMaking): ServiceItemOf<'notice'> {
  const notices = noticeItem(making);
  return withOpeningTitle(
    making,
    {
      ...notices,
      slides: notices.slides.map(slide => ({
        ...slide,
        texts: {제목: '광고 제목', 내용: '내용 1\n내용 2'},
      })),
    },
    serviceTitle('광고'),
  );
}

const LITURGY_TITLES: Readonly<Record<LiturgyKind, TitleCard>> = {
  creed: serviceTitle('사도신경'),
  prayer: {
    ...serviceTitle('사도신경'),
    name: '주기도문',
    english: "The Lord's Prayer",
  },
};

/** The creed or the prayer of a service, with its opening title. */
export function openedLiturgy(
  making: SlideMaking,
  liturgy: LiturgyKind,
  translation: LiturgyTranslation = 'new',
): ServiceItemOf<'liturgy'> {
  return withOpeningTitle(
    making,
    liturgyItem(making, liturgy, translation),
    LITURGY_TITLES[liturgy],
  );
}
