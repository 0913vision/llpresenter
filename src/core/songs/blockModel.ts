import type {Song, SongSlide} from '../schema/song';

export interface BlockSelection {
  readonly block: number;
  readonly start: number;
  readonly end: number;
}
export interface BlockSnapshot {
  readonly song: Song;
  readonly selection: BlockSelection;
}
export type EditorSlideItem = SongSlide;
export type BlockCommand =
  | {
      readonly type: 'text';
      readonly text: string;
      readonly start: number;
      readonly end: number;
    }
  | {readonly type: 'paste'; readonly text: string}
  | {readonly type: 'label'; readonly name: string | undefined}
  | {readonly type: 'title'; readonly title: string}
  | {readonly type: 'enter' | 'split' | 'insert' | 'merge'};

export const normalize = (text: string): string => text.replace(/\r\n?/g, '\n');
export const BLANK_LINES = /\n(?:[^\S\n]*\n)+/g;
export const linesOf = (text: string): readonly string[] =>
  text === '' ? [] : text.split('\n');
export function slideCountOf(song: Song): number {
  return song.slides.length;
}
export function linearSlidesOf(song: Song): readonly EditorSlideItem[] {
  return song.slides;
}
export function blockSnapshot(
  song: Song,
  selection: BlockSelection = {block: 0, start: 0, end: 0},
): BlockSnapshot {
  const block = Math.max(
    0,
    Math.min(Math.max(0, song.slides.length - 1), selection.block),
  );
  const length = song.slides[block]?.lines.join('\n').length ?? 0;
  const start = Math.max(0, Math.min(length, selection.start));
  const end = Math.max(start, Math.min(length, selection.end));
  return {song, selection: {block, start, end}};
}
