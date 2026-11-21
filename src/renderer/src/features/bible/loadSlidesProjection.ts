import type {LlpApi} from '@contracts/ipc/api';
import {BIBLE_BOOKS} from '@core/bible/bibleBooks';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import type {VerseSlide} from '@core/schema/service';
import type {SlidesItem} from '@core/services/slidesEdits';
import {colorSlideLabels, projectSlides} from '@core/presentation/slides';
import {createBibleMeasureContext} from '@renderer/rendering/bibleMeasure';
import {BibleProjections} from './splitProjection';

type VerseLookup = Pick<VerseSlide, 'id' | 'verse'>;

export async function loadVersePassages(
  api: LlpApi['bible'],
  references: readonly VerseLookup[],
  isCurrent: () => boolean = () => true,
): Promise<ReadonlyMap<string, BibleLookupPassage>> {
  const passages = new Map<string, BibleLookupPassage>();
  const cache = new Map<string, BibleLookupPassage | null>();
  for (const slide of references) {
    if (!isCurrent()) break;
    const reference = slide.verse;
    const book = BIBLE_BOOKS.find(book => book.id === reference.book);
    if (book === undefined) continue;
    const input = `${book.korean} ${reference.chapter}:${reference.verse}`;
    const key = `${reference.translation}:${input}`;
    if (!cache.has(key)) {
      try {
        const reply = await api.lookup({
          translation: reference.translation,
          input,
        });
        const passage = reply.result.ok ? reply.result.value : null;
        cache.set(
          key,
          passage?.verses.some(
            verse =>
              verse.chapter === reference.chapter &&
              verse.verse === reference.verse,
          )
            ? passage
            : null,
        );
      } catch {
        cache.set(key, null);
      }
    }
    const passage = cache.get(key);
    if (passage !== undefined && passage !== null) {
      passages.set(slide.id, passage);
    }
  }
  return passages;
}

/** Reads a complete draft projection before accepting an insertion or cut review. */
export async function loadSlidesProjection(
  api: Pick<LlpApi, 'bible' | 'settings'>,
  item: SlidesItem,
  isCurrent: () => boolean,
) {
  const references = item.slides.slides.filter(
    (slide): slide is VerseSlide => 'verse' in slide,
  );
  const [themes, screens, labels, passages, preferences] = await Promise.all([
    api.settings.get({name: 'themes'}),
    api.settings.get({name: 'screens'}),
    item.slides.slides.some(slide => slide.label !== undefined)
      ? api.settings.get({name: 'labels'}).catch(() => null)
      : Promise.resolve(null),
    loadVersePassages(api.bible, references, isCurrent),
    window.llp?.preferences.get(),
  ]);
  if (!isCurrent()) return null;
  if (passages.size !== references.length) {
    throw Error('성경 구절 불러오기 실패');
  }
  if (themes.name !== 'themes' || screens.name !== 'screens') {
    throw Error('테마 불러오기 실패');
  }
  const canvas = createBibleMeasureContext();
  if (canvas === null) throw Error('절 나누기를 측정할 수 없음');
  const projection = new BibleProjections({
    themes: themes.value,
    screens: screens.value.screens,
    saved: undefined,
    canvas,
    slideBibleDefaults: preferences?.bible.defaults,
  }).get({
    kind: 'slides',
    id: item.id,
    input: colorSlideLabels(
      projectSlides(item, undefined, {
        passages,
        adTitleSettings: {file: themes.value, screens: screens.value.screens},
      }),
      new Map(
        (labels?.name === 'labels' ? labels.value.labels : []).map(label => [
          label.name,
          label.color,
        ]),
      ),
    ),
    verseNumbers: true,
    reference: 'every',
    translationName: false,
    source: 'service',
    review: false,
    ...(item.background === undefined ? {} : {background: item.background}),
    ...(item.theme === undefined ? {} : {theme: item.theme}),
  });
  if (projection === null) throw Error('테마에 현재 슬라이드 글 요소 없음');
  if (projection.problem !== undefined) throw Error('슬라이드가 너무 많습니다');
  if (projection.parts.some(part => part.problem !== undefined)) {
    throw Error('절 나누기를 측정할 수 없음');
  }
  return projection;
}
