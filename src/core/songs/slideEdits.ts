import type {Result} from '../common/result';
import {checkPart} from '../schema/fileFormat';
import {createSongSlideId, type SongSlideId} from '../schema/ids';
import {songSlidesSchema, type SongSlide} from '../schema/song';

export type SlideEditResult = Result<readonly SongSlide[], 'invalid' | 'limit'>;
export type SlideIdFactory = () => SongSlideId;

export const newSongSlideId: SlideIdFactory = () =>
  createSongSlideId(crypto.randomUUID());

function checked(slides: readonly SongSlide[]): SlideEditResult {
  const result = checkPart(songSlidesSchema, slides);
  return result.ok
    ? {ok: true, value: result.value}
    : {ok: false, error: 'invalid'};
}

function indexIn(slides: readonly SongSlide[], index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index <= slides.length;
}

/** Inserts slides at a gap; duplicate identities and hot keys are refused. */
export function insertSlides(
  slides: readonly SongSlide[],
  additions: readonly SongSlide[],
  index: number,
): SlideEditResult {
  if (!indexIn(slides, index)) return {ok: false, error: 'invalid'};
  return checked([
    ...slides.slice(0, index),
    ...additions,
    ...slides.slice(index),
  ]);
}

export function removeSlides(
  slides: readonly SongSlide[],
  ids: readonly SongSlideId[],
): SlideEditResult {
  const selected = new Set(ids);
  return checked(slides.filter(slide => !selected.has(slide.id)));
}

/** The destination is a gap in the original deck, before removing the selection. */
export function moveSlides(
  slides: readonly SongSlide[],
  ids: readonly SongSlideId[],
  index: number,
): SlideEditResult {
  if (!indexIn(slides, index)) return {ok: false, error: 'invalid'};
  const selected = new Set(ids);
  const moving = slides.filter(slide => selected.has(slide.id));
  const before = slides
    .slice(0, index)
    .filter(slide => !selected.has(slide.id));
  const after = slides.slice(index).filter(slide => !selected.has(slide.id));
  return checked([...before, ...moving, ...after]);
}

/** Copies preserve labels and unknown fields, with new IDs and no conflicting hot keys. */
export function pasteSlides(
  slides: readonly SongSlide[],
  copied: readonly SongSlide[],
  {
    index,
    newId = newSongSlideId,
  }: {readonly index: number; readonly newId?: SlideIdFactory},
): SlideEditResult {
  const keys = new Set(
    slides.flatMap(slide => (slide.hotKey === undefined ? [] : [slide.hotKey])),
  );
  const additions = copied.map(slide => {
    const {hotKey, ...rest} = slide;
    const key = hotKey !== undefined && !keys.has(hotKey) ? hotKey : undefined;
    if (key !== undefined) keys.add(key);
    return {
      ...rest,
      id: newId(),
      lines: [...slide.lines],
      ...(key === undefined ? {} : {hotKey: key}),
    };
  });
  return insertSlides(slides, additions, index);
}

export function duplicateSlides(
  slides: readonly SongSlide[],
  ids: readonly SongSlideId[],
  newId: SlideIdFactory = newSongSlideId,
): SlideEditResult {
  const selected = new Set(ids);
  const index = slides.findLastIndex(slide => selected.has(slide.id));
  if (index < 0) return {ok: true, value: slides};
  return pasteSlides(
    slides,
    slides.filter(slide => selected.has(slide.id)),
    {index: index + 1, newId},
  );
}

export function setSlideLabels(
  slides: readonly SongSlide[],
  ids: readonly SongSlideId[],
  name: string | undefined,
): SlideEditResult {
  const selected = new Set(ids);
  const label = name?.trim();
  return checked(
    slides.map(slide => {
      if (!selected.has(slide.id)) return slide;
      const {label: removed, ...rest} = slide;
      return label === undefined || label === '' ? rest : {...rest, label};
    }),
  );
}

/** Splits at a UTF-16 position within one line; the first half keeps its hot key. */
export function splitSlide(
  slides: readonly SongSlide[],
  id: SongSlideId,
  position: {
    readonly line: number;
    readonly character: number;
    readonly newId?: SlideIdFactory;
  },
): SlideEditResult {
  const index = slides.findIndex(slide => slide.id === id);
  const slide = slides[index];
  if (slide === undefined) return {ok: false, error: 'invalid'};
  const {line, character, newId = newSongSlideId} = position;
  const text =
    slide.lines[line] ??
    (line === 0 && slide.lines.length === 0 ? '' : undefined);
  if (
    text === undefined ||
    !Number.isInteger(line) ||
    !Number.isInteger(character) ||
    character < 0 ||
    character > text.length
  ) {
    return {ok: false, error: 'invalid'};
  }
  const {hotKey: removed, ...rest} = slide;
  return checked([
    ...slides.slice(0, index),
    {
      ...slide,
      lines: [...slide.lines.slice(0, line), text.slice(0, character)],
    },
    {
      ...rest,
      id: newId(),
      lines: [text.slice(character), ...slide.lines.slice(line + 1)],
    },
    ...slides.slice(index + 1),
  ]);
}

/** Keeps the previous slide's identity and label; inherits the second key only if vacant. */
export function mergeSlideWithPrevious(
  slides: readonly SongSlide[],
  id: SongSlideId,
): SlideEditResult {
  const index = slides.findIndex(slide => slide.id === id);
  const slide = slides[index];
  const previous = slides[index - 1];
  if (slide === undefined || previous === undefined) {
    return {ok: true, value: slides};
  }
  const hotKey = previous.hotKey ?? slide.hotKey;
  return checked([
    ...slides.slice(0, index - 1),
    {
      ...previous,
      lines: [...previous.lines, ...slide.lines],
      ...(hotKey === undefined ? {} : {hotKey}),
    },
    ...slides.slice(index + 1),
  ]);
}
