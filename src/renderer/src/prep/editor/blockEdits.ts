import type {Slide, Song} from '@shared/schema/song';

export interface BlockSelection {
  readonly block: number;
  readonly start: number;
  readonly end: number;
}

export interface BlockSnapshot {
  readonly song: Song;
  readonly selection: BlockSelection;
}

/** Editor actions: `split` is Ctrl Enter, and `insert` is Ctrl Shift N. */
export type BlockCommand =
  | {
      readonly type: 'text';
      readonly text: string;
      readonly start: number;
      readonly end: number;
    }
  | {readonly type: 'paste'; readonly text: string}
  | {readonly type: 'label'; readonly name: string | undefined}
  | {readonly type: 'enter' | 'split' | 'insert' | 'merge'};

const normalize = (text: string): string => text.replace(/\r\n?/g, '\n');
const BLANK_LINES = /\n(?:[^\S\n]*\n)+/g;
const linesOf = (text: string): readonly string[] =>
  text === '' ? [] : text.split('\n');

/** A bounded textarea selection using UTF-16 offsets, like the native input. */
export function blockSnapshot(
  song: Song,
  selection: BlockSelection = {block: 0, start: 0, end: 0},
): BlockSnapshot {
  const block = Math.max(0, Math.min(song.slides.length - 1, selection.block));
  const length = song.slides[block]?.lines.join('\n').length ?? 0;
  const start = Math.max(0, Math.min(length, selection.start));
  const end = Math.max(start, Math.min(length, selection.end));
  return {song, selection: {block, start, end}};
}

interface Splice {
  readonly at: number;
  readonly remove: number;
  readonly blocks: readonly Slide[];
  readonly selection: BlockSelection;
}

function remapReferences(
  references: readonly number[],
  edit: Splice,
): readonly number[] {
  const {at, remove, blocks} = edit;
  const merging = remove === 2 && blocks.length === 1;
  const result: number[] = [];
  for (let index = 0; index < references.length; index++) {
    const number = references[index];
    if (number === undefined) continue;
    if (number <= at) result.push(number);
    else if (number > at + remove) result.push(number + blocks.length - remove);
    else {
      for (let part = 0; part < blocks.length; part++) {
        result.push(at + part + 1);
      }
      const next = references[index + 1];
      if (
        merging &&
        next !== undefined &&
        next !== number &&
        next > at &&
        next <= at + remove
      ) {
        index++;
      }
    }
  }
  return result;
}

function splice(snapshot: BlockSnapshot, edit: Splice): BlockSnapshot {
  const {song} = snapshot;
  const {at, remove, blocks, selection} = edit;
  return blockSnapshot(
    {
      ...song,
      slides: [
        ...song.slides.slice(0, at),
        ...blocks,
        ...song.slides.slice(at + remove),
      ],
      ...(song.arrangements === undefined || blocks.length === remove
        ? {}
        : {
            arrangements: song.arrangements.map(arrangement => ({
              ...arrangement,
              slides: remapReferences(arrangement.slides, edit),
            })),
          }),
    },
    selection,
  );
}

function replace(
  snapshot: BlockSnapshot,
  text: string,
  selection: Pick<BlockSelection, 'start' | 'end'>,
): BlockSnapshot {
  const {start, end} = selection;
  const {block} = snapshot.selection;
  const slide = snapshot.song.slides[block];
  if (slide === undefined) return snapshot;
  if (slide.lines.join('\n') === text) {
    return blockSnapshot(snapshot.song, {block, start, end});
  }
  return splice(snapshot, {
    at: block,
    remove: 1,
    blocks: [{...slide, lines: linesOf(text)}],
    selection: {block, start, end},
  });
}

function split(
  snapshot: BlockSnapshot,
  before: string,
  after: string,
): BlockSnapshot {
  const {block} = snapshot.selection;
  const slide = snapshot.song.slides[block];
  if (slide === undefined) return snapshot;
  return splice(snapshot, {
    at: block,
    remove: 1,
    blocks: [{...slide, lines: linesOf(before)}, {lines: linesOf(after)}],
    selection: {block: block + 1, start: 0, end: 0},
  });
}

function paste(snapshot: BlockSnapshot, insertion: string): BlockSnapshot {
  const {block, start, end} = snapshot.selection;
  const slide = snapshot.song.slides[block];
  if (slide === undefined) return snapshot;
  const original = slide.lines.join('\n');
  if (insertion === '' && start === end) return snapshot;
  const text = original.slice(0, start) + insertion + original.slice(end);
  const parts = text.split(BLANK_LINES);
  if (parts.length === 1) {
    const position = start + insertion.length;
    return replace(snapshot, text, {start: position, end: position});
  }
  let focus = block;
  let position = start + insertion.length;
  for (const match of text.matchAll(BLANK_LINES)) {
    if (match.index > start + insertion.length) break;
    focus++;
    position = Math.max(
      0,
      start + insertion.length - match.index - match[0].length,
    );
  }
  return splice(snapshot, {
    at: block,
    remove: 1,
    blocks: parts.map((part, index) =>
      index === 0 ? {...slide, lines: linesOf(part)} : {lines: linesOf(part)},
    ),
    selection: {block: focus, start: position, end: position},
  });
}

/**
 * Applies a block edit without mutating the song. Splits retain the first
 * block's identity and label; new blocks start unlabeled. Named arrangements
 * expand split references and map merged blocks to the result, collapsing
 * adjacent pairs of different merge sources while retaining deliberate repeats.
 */
export function editBlocks(
  input: BlockSnapshot,
  command: BlockCommand,
): BlockSnapshot {
  const snapshot = blockSnapshot(input.song, input.selection);
  const {block, start, end} = snapshot.selection;
  const slide = snapshot.song.slides[block];
  if (slide === undefined) return snapshot;
  const text = slide.lines.join('\n');
  switch (command.type) {
    case 'text':
      return replace(snapshot, normalize(command.text), command);
    case 'paste':
      return paste(snapshot, normalize(command.text));
    case 'label':
      if ((slide.label ?? '') === (command.name ?? '')) return snapshot;
      return splice(snapshot, {
        at: block,
        remove: 1,
        blocks: [{...slide, label: command.name ?? ''}],
        selection: snapshot.selection,
      });
    case 'split':
      return split(snapshot, text.slice(0, start), text.slice(end));
    case 'insert':
      return splice(snapshot, {
        at: block + 1,
        remove: 0,
        blocks: [{lines: []}],
        selection: {block: block + 1, start: 0, end: 0},
      });
    case 'enter': {
      const first = start === 0 ? 0 : text.lastIndexOf('\n', start - 1) + 1;
      const next = text.indexOf('\n', start);
      const last = next < 0 ? text.length : next;
      if (start === end && text.slice(first, last).trim() === '') {
        return split(
          snapshot,
          text.slice(0, Math.max(0, first - 1)),
          text.slice(Math.min(text.length, last + 1)),
        );
      }
      return replace(snapshot, `${text.slice(0, start)}\n${text.slice(end)}`, {
        start: start + 1,
        end: start + 1,
      });
    }
    case 'merge': {
      const previous = snapshot.song.slides[block - 1];
      if (previous === undefined || start !== 0 || end !== 0) return snapshot;
      const position = previous.lines.join('\n').length;
      return splice(snapshot, {
        at: block - 1,
        remove: 2,
        blocks: [{...previous, lines: [...previous.lines, ...slide.lines]}],
        selection: {block: block - 1, start: position, end: position},
      });
    }
  }
}
