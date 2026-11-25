import {displayReference} from '@core/bible';
import {createServiceItemId, type MediaId} from '@core/schema/common/ids';
import type {BiblePassage} from '@core/schema/bible/biblePassage';
import type {ServiceItemOf, SlidesItem} from '@core/schema/services/service';
import type {Slide} from '@core/schema/slides/slide';
import type {Song} from '@core/schema/songs/song';
import {withText} from './edits';
import {LITURGY_SLIDES} from './liturgySlides';
import {copySlide, makeSlide, transitionFor, type SlideMaking} from './make';
import {withHideNext} from './nextText';
import {serviceTitle, titleSlide, type TitleCard} from './titles';

/** The liturgies the app has: the creed and the Lord's Prayer. */
export type LiturgyKind = ServiceItemOf<'liturgy'>['liturgy'];
/** Which wording of a liturgy is used. */
export type LiturgyTranslation = ServiceItemOf<'liturgy'>['translation'];

/** The Korean name of each liturgy. */
export const LITURGY_NAMES: Readonly<Record<LiturgyKind, string>> = {
  creed: '사도신경',
  prayer: '주기도문',
};

function newId() {
  return createServiceItemId(crypto.randomUUID());
}

/** The 이름표 of the two titles a song gets in the 예배 순서. */
export const SONG_TITLE_LABELS = {opening: '전주', closing: '후주'} as const;

/**
 * What the slide before a song's closing title shows on 무대, set as the
 * closing title's own next text, so the last lyrics never announce the same
 * song as the next one.
 */
export const CLOSING_TITLE_NEXT = `(${SONG_TITLE_LABELS.closing})`;

/** How a song goes into the 예배 순서. */
export interface SongItemOptions {
  /** 환경설정 준비, 끝 제목: the song also ends with its title. */
  readonly closingTitle: boolean;
}

/** A copy of `source` that keeps its hot key, if it has one. */
function withHotKeyOf(source: Slide, copy: Slide): Slide {
  return source.hotKey === undefined ? copy : {...copy, hotKey: source.hotKey};
}

/**
 * The slides a song has in the 예배 순서 (`team/song-title-design.md`): its
 * title with 이름표 전주, its other slides as they are, and, when the 환경설정
 * says so, its title again with 이름표 후주. Both titles come in with the 곡
 * 제목 transition. A song without a title slide of its own gets one made from
 * its title.
 */
export function songItemSlides(
  song: Song,
  making: SlideMaking,
  {closingTitle}: SongItemOptions,
): readonly Slide[] {
  const title =
    song.titleSlide ??
    makeSlide(making, 'songTitle', {texts: {제목: song.title}});
  const transition = transitionFor(making, 'songTitle');
  // NOTE(0913vision): A hot key of the title stays on the opening title, as
  // on every other slide of the song; the closing copy has none, so the item
  // never holds one key twice.
  const opening: Slide = {
    ...withHotKeyOf(title, copySlide(title)),
    label: SONG_TITLE_LABELS.opening,
    transition,
  };
  const closing: Slide = {
    ...copySlide(title),
    label: SONG_TITLE_LABELS.closing,
    transition,
    next: CLOSING_TITLE_NEXT,
  };
  return [
    opening,
    ...song.slides.map(slide => withHotKeyOf(slide, copySlide(slide))),
    ...(closingTitle ? [closing] : []),
  ];
}

/** A song of the library, with slides of its own in this service. */
export function songItem(
  song: Song,
  making: SlideMaking,
  options: SongItemOptions,
): ServiceItemOf<'song'> {
  return {
    id: newId(),
    kind: 'song',
    name: song.title,
    song: song.id,
    slides: songItemSlides(song, making, options),
  };
}

/** A new 빈 슬라이드 item with one blank slide. */
export function blankItem(making: SlideMaking): ServiceItemOf<'blank'> {
  return {
    id: newId(),
    kind: 'blank',
    name: '빈 슬라이드',
    slides: [makeSlide(making, 'blank')],
  };
}

/** A new 광고 item with one notice slide. */
export function noticeItem(making: SlideMaking): ServiceItemOf<'notice'> {
  return {
    id: newId(),
    kind: 'notice',
    name: '광고',
    slides: [makeSlide(making, 'notice')],
  };
}

/** A new item named after a title card, with one slide of that title. */
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

/** A new 예배 준비 item with one slide. */
export function preparationItem(making: SlideMaking): ServiceItemOf<'blank'> {
  return {
    id: newId(),
    kind: 'blank',
    name: '예배 준비',
    slides: [makeSlide(making, 'preparation')],
  };
}

/** A new 대기 화면 item with one slide. */
export function standbyItem(making: SlideMaking): ServiceItemOf<'blank'> {
  return {
    id: newId(),
    kind: 'blank',
    name: '대기 화면',
    slides: [makeSlide(making, 'standby')],
  };
}

/** The slides of a liturgy in one wording, one per text of LITURGY_SLIDES. */
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

/** A new item for a liturgy in one wording. */
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

/** A new item for a Bible passage with its slides, named by its reference. */
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

/**
 * A sermon: its title, the passage, and the title again. The last title starts
 * with 다음 슬라이드 내용 숨기기 on, as the end of a passage does.
 */
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
  const titled = () =>
    makeSlide(making, 'sermonTitle', {texts: {[SERMON_TITLE_BOX]: title}});
  return {
    id: newId(),
    kind: 'sermon',
    name: title,
    passage,
    slides: [titled(), ...slides, withHideNext(titled(), true)],
  };
}

/** The box of a 설교 제목 슬라이드 that holds the title. */
export const SERMON_TITLE_BOX = '제목';

/**
 * A sermon has one title, shown before and after its passage. When an edit
 * changes the title of one slide, the other slides that showed the same
 * title take the new one too, line breaks and all.
 */
export function withOneSermonTitle(
  before: readonly Slide[],
  after: readonly Slide[],
): readonly Slide[] {
  const titleOf = (slide: Slide): string | undefined =>
    slide.texts[SERMON_TITLE_BOX];
  const old = new Map(before.map(slide => [slide.id, titleOf(slide)]));
  const changed = after.filter(slide => {
    const was = old.get(slide.id);
    return was !== undefined && was !== '' && titleOf(slide) !== was;
  });
  const [edited] = changed;
  if (edited === undefined || changed.length > 1) return after;
  const was = old.get(edited.id);
  const title = titleOf(edited) ?? '';
  return after.map(slide =>
    slide !== edited && old.get(slide.id) === was && titleOf(slide) === was
      ? withText(slide, SERMON_TITLE_BOX, title)
      : slide,
  );
}

/**
 * A new item for a media file. A sound has no slide; any other media gets one
 * slide with it as the background.
 */
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
