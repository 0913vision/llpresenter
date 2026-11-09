import {
  blockSnapshot,
  BLANK_LINES,
  linesOf,
  normalize,
  type BlockCommand,
  type BlockSnapshot,
} from './blockModel';
import {
  newSongSlideId,
  mergeSlideWithPrevious,
  setSlideLabels,
} from './slideEdits';
import {checkPart} from '../schema/fileFormat';
import {songTitleLayoutSchema} from '../schema/songTitleLayout';
import {SONG_LIMITS} from '../schema/song';
export {blockSnapshot, linearSlidesOf, slideCountOf} from './blockModel';
export type {
  BlockCommand,
  BlockSelection,
  BlockSnapshot,
  EditorSlideItem,
} from './blockModel';

/** Adapts the existing text-row editor to independent slides. */
export function editBlocks(
  snapshot: BlockSnapshot,
  command: BlockCommand,
): BlockSnapshot {
  const {song, selection} = snapshot;
  if (command.type === 'title-layout') {
    const slide = song.slides[command.block];
    if (
      !slide?.titleSlide ||
      !checkPart(songTitleLayoutSchema, command.layout).ok
    ) {
      return snapshot;
    }
    return blockSnapshot(
      {
        ...song,
        slides: song.slides.map((entry, index) =>
          index === command.block
            ? {...entry, titleLayout: command.layout}
            : entry,
        ),
      },
      selection,
    );
  }
  if (command.type === 'title') {
    const index = command.index ?? 0;
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index > song.slides.length ||
      song.slides.length >= SONG_LIMITS.slides ||
      command.title.length > SONG_LIMITS.titleLine ||
      /[\r\n]/.test(command.title)
    ) {
      return snapshot;
    }
    return blockSnapshot(
      {
        ...song,
        slides: [
          ...song.slides.slice(0, index),
          {id: newSongSlideId(), titleSlide: true, lines: [command.title]},
          ...song.slides.slice(index),
        ],
      },
      {block: index, start: 0, end: 0},
    );
  }
  const {block, start, end} = selection;
  const slide = song.slides[block];
  if (slide === undefined) {
    return command.type === 'insert' && song.slides.length === 0
      ? blockSnapshot({...song, slides: [{id: newSongSlideId(), lines: []}]})
      : snapshot;
  }
  if (command.type === 'label') {
    const result = setSlideLabels(song.slides, [slide.id], command.name);
    return result.ok
      ? blockSnapshot({...song, slides: result.value}, selection)
      : snapshot;
  }
  if (command.type === 'merge') {
    if (slide.titleSlide || song.slides[block - 1]?.titleSlide) return snapshot;
    if (start !== 0 || end !== 0 || block === 0) return snapshot;
    const result = mergeSlideWithPrevious(song.slides, slide.id);
    const position = song.slides[block - 1]?.lines.join('\n').length ?? 0;
    return result.ok
      ? blockSnapshot(
          {...song, slides: result.value},
          {block: block - 1, start: position, end: position},
        )
      : snapshot;
  }
  const original = slide.lines.join('\n');
  if (slide.titleSlide && command.type === 'split') return snapshot;
  if (
    command.type === 'text' ||
    command.type === 'enter' ||
    (slide.titleSlide && command.type === 'paste')
  ) {
    const text =
      command.type === 'text'
        ? normalize(command.text)
        : `${original.slice(0, start)}${command.type === 'paste' ? normalize(command.text) : '\n'}${original.slice(end)}`;
    if (
      slide.titleSlide &&
      (linesOf(text).length > 2 ||
        linesOf(text).some(line => line.length > SONG_LIMITS.titleLine))
    ) {
      return snapshot;
    }
    const caret =
      command.type === 'text'
        ? command
        : {
            start:
              start +
              (command.type === 'paste' ? normalize(command.text).length : 1),
            end:
              start +
              (command.type === 'paste' ? normalize(command.text).length : 1),
          };
    return blockSnapshot(
      text === original
        ? song
        : {
            ...song,
            slides: song.slides.map((entry, at) =>
              at === block ? {...entry, lines: linesOf(text)} : entry,
            ),
          },
      {block, start: caret.start, end: caret.end},
    );
  }
  if (command.type === 'insert') {
    if (song.slides.length >= SONG_LIMITS.slides) return snapshot;
    const slides = [...song.slides];
    slides.splice(block + 1, 0, {id: newSongSlideId(), lines: []});
    return blockSnapshot(
      {...song, slides},
      {block: block + 1, start: 0, end: 0},
    );
  }
  const insertion = command.type === 'paste' ? normalize(command.text) : '';
  const text = original.slice(0, start) + insertion + original.slice(end);
  const parts =
    command.type === 'split'
      ? [original.slice(0, start), original.slice(end)]
      : text.split(BLANK_LINES);
  if (song.slides.length + parts.length - 1 > SONG_LIMITS.slides) {
    return snapshot;
  }
  if (parts.length === 1) {
    return editBlocks(snapshot, {
      type: 'text',
      text,
      start: start + insertion.length,
      end: start + insertion.length,
    });
  }
  const {hotKey: removed, ...rest} = slide;
  const slides = [...song.slides];
  slides.splice(
    block,
    1,
    ...parts.map((part, at) => ({
      ...(at === 0 ? slide : {...rest, id: newSongSlideId()}),
      lines: linesOf(part),
    })),
  );
  let focus = block + 1;
  let position = 0;
  if (command.type === 'paste') {
    focus = block;
    position = start + insertion.length;
    for (const match of text.matchAll(BLANK_LINES)) {
      if (match.index > start + insertion.length) break;
      focus++;
      position = Math.max(
        0,
        start + insertion.length - match.index - match[0].length,
      );
    }
  }
  return blockSnapshot(
    {...song, slides},
    {block: focus, start: position, end: position},
  );
}
