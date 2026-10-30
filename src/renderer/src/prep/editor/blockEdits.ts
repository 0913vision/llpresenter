import {
  isGroupedSong,
  type AnySong,
  type GroupedSong,
  type SongGroup,
} from '@core/schema/groupedSong';
import {createSongGroupId, type SongGroupId} from '@core/schema/ids';
import type {SlideHotKey} from '@core/schema/slideHotKey';
import type {Slide, Song} from '@core/schema/song';

export interface BlockSelection {
  readonly block: number;
  readonly start: number;
  readonly end: number;
}

export interface BlockSnapshot<S extends AnySong = Song> {
  readonly song: S;
  readonly selection: BlockSelection;
  readonly mergeRefused?: boolean;
}

export interface GroupedSlideAddress {
  readonly groupIndex: number;
  readonly groupId: SongGroupId;
  readonly groupName: string;
  readonly slideIndex: number;
  readonly isGroupStart: boolean;
  readonly slide: {
    readonly lines: readonly string[];
    readonly hotKey?: SlideHotKey;
  };
}

export interface EditorSlideItem {
  readonly lines: readonly string[];
  readonly label?: string | undefined;
  readonly isGroupStart?: boolean;
  readonly groupId?: SongGroupId;
  readonly slideIndex?: number;
  readonly hotKey?: SlideHotKey;
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
  | {
      readonly type: 'label';
      readonly name: string | undefined;
      readonly ids?: readonly [SongGroupId, SongGroupId];
    }
  | {readonly type: 'enter' | 'split' | 'insert' | 'merge'};

const normalize = (text: string): string => text.replace(/\r\n?/g, '\n');
const BLANK_LINES = /\n(?:[^\S\n]*\n)+/g;
const linesOf = (text: string): readonly string[] =>
  text === '' ? [] : text.split('\n');

export function groupedSlideCount(song: GroupedSong): number {
  return song.groups.reduce((sum, group) => sum + group.slides.length, 0);
}

export function slideCountOf(song: AnySong): number {
  return isGroupedSong(song) ? groupedSlideCount(song) : song.slides.length;
}

export function linearBlockAddress(
  song: GroupedSong,
  linearIndex: number,
): GroupedSlideAddress | undefined {
  let offset = 0;
  for (let groupIndex = 0; groupIndex < song.groups.length; groupIndex++) {
    const group = song.groups[groupIndex];
    if (group === undefined) continue;
    if (linearIndex < offset + group.slides.length) {
      const slideIndex = linearIndex - offset;
      const slide = group.slides[slideIndex];
      if (slide === undefined) return undefined;
      return {
        groupIndex,
        groupId: group.id,
        groupName: group.name,
        slideIndex,
        isGroupStart: slideIndex === 0,
        slide,
      };
    }
    offset += group.slides.length;
  }
  return undefined;
}

function groupSlidesOf(group: SongGroup): readonly EditorSlideItem[] {
  return group.slides.map((slide, index) => ({
    lines: slide.lines,
    ...(index === 0 && group.name !== '' ? {label: group.name} : {}),
    isGroupStart: index === 0,
    groupId: group.id,
    slideIndex: index,
    ...(slide.hotKey === undefined ? {} : {hotKey: slide.hotKey}),
  }));
}

export function linearSlidesOf(song: AnySong): readonly EditorSlideItem[] {
  if (isGroupedSong(song)) {
    return song.groups.flatMap(groupSlidesOf);
  }
  return song.slides.map(slide => ({
    lines: slide.lines,
    ...(slide.label === undefined || slide.label === ''
      ? {}
      : {label: slide.label}),
    isGroupStart: true,
  }));
}

/** A bounded textarea selection using UTF-16 offsets, like the native input. */
export function blockSnapshot<S extends AnySong = Song>(
  song: S,
  selection: BlockSelection = {block: 0, start: 0, end: 0},
  mergeRefused?: boolean,
): BlockSnapshot<S> {
  const count = slideCountOf(song);
  const block = Math.max(0, Math.min(Math.max(0, count - 1), selection.block));
  const slides = linearSlidesOf(song);
  const length = slides[block]?.lines.join('\n').length ?? 0;
  const start = Math.max(0, Math.min(length, selection.start));
  const end = Math.max(start, Math.min(length, selection.end));
  return {
    song,
    selection: {block, start, end},
    ...(mergeRefused ? {mergeRefused: true} : {}),
  };
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

function splice(
  snapshot: BlockSnapshot & {song: Song},
  edit: Splice,
): BlockSnapshot {
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
  snapshot: BlockSnapshot & {song: Song},
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
  snapshot: BlockSnapshot & {song: Song},
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

function paste(
  snapshot: BlockSnapshot & {song: Song},
  insertion: string,
): BlockSnapshot {
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

function replaceGrouped(
  snapshot: BlockSnapshot<GroupedSong>,
  text: string,
  selection: Pick<BlockSelection, 'start' | 'end'>,
): BlockSnapshot<GroupedSong> {
  const {song} = snapshot;
  const {block} = snapshot.selection;
  const addr = linearBlockAddress(song, block);
  if (addr === undefined) return snapshot;
  const original = addr.slide.lines.join('\n');
  if (original === text) {
    return blockSnapshot(song, {block, ...selection});
  }
  const targetGroup = song.groups[addr.groupIndex];
  if (targetGroup === undefined) return snapshot;
  const newSlides = [...targetGroup.slides];
  newSlides[addr.slideIndex] = {...addr.slide, lines: linesOf(text)};
  const newGroups = [...song.groups];
  newGroups[addr.groupIndex] = {...targetGroup, slides: newSlides};
  return blockSnapshot({...song, groups: newGroups}, {block, ...selection});
}

function splitGrouped(
  snapshot: BlockSnapshot<GroupedSong>,
  before: string,
  after: string,
): BlockSnapshot<GroupedSong> {
  const {song} = snapshot;
  const {block} = snapshot.selection;
  const addr = linearBlockAddress(song, block);
  if (addr === undefined) return snapshot;
  const targetGroup = song.groups[addr.groupIndex];
  if (targetGroup === undefined) return snapshot;
  const newSlides = [...targetGroup.slides];
  newSlides.splice(
    addr.slideIndex,
    1,
    {...addr.slide, lines: linesOf(before)},
    {lines: linesOf(after)},
  );
  const newGroups = [...song.groups];
  newGroups[addr.groupIndex] = {...targetGroup, slides: newSlides};
  return blockSnapshot(
    {...song, groups: newGroups},
    {block: block + 1, start: 0, end: 0},
  );
}

function insertGrouped(
  snapshot: BlockSnapshot<GroupedSong>,
): BlockSnapshot<GroupedSong> {
  const {song} = snapshot;
  const {block} = snapshot.selection;
  const addr = linearBlockAddress(song, block);
  if (addr === undefined) return snapshot;
  const targetGroup = song.groups[addr.groupIndex];
  if (targetGroup === undefined) return snapshot;
  const newSlides = [...targetGroup.slides];
  newSlides.splice(addr.slideIndex + 1, 0, {lines: []});
  const newGroups = [...song.groups];
  newGroups[addr.groupIndex] = {...targetGroup, slides: newSlides};
  return blockSnapshot(
    {...song, groups: newGroups},
    {block: block + 1, start: 0, end: 0},
  );
}

function pasteGrouped(
  snapshot: BlockSnapshot<GroupedSong>,
  insertion: string,
): BlockSnapshot<GroupedSong> {
  const {song} = snapshot;
  const {block, start, end} = snapshot.selection;
  const addr = linearBlockAddress(song, block);
  if (addr === undefined) return snapshot;
  const targetGroup = song.groups[addr.groupIndex];
  if (targetGroup === undefined) return snapshot;
  const original = addr.slide.lines.join('\n');
  if (insertion === '' && start === end) return snapshot;
  const text = original.slice(0, start) + insertion + original.slice(end);
  const parts = text.split(BLANK_LINES);
  if (parts.length === 1) {
    const position = start + insertion.length;
    return replaceGrouped(snapshot, text, {start: position, end: position});
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
  const newSlides = [...targetGroup.slides];
  const inserted = parts.map((part, index) =>
    index === 0
      ? {...addr.slide, lines: linesOf(part)}
      : {lines: linesOf(part)},
  );
  newSlides.splice(addr.slideIndex, 1, ...inserted);
  const newGroups = [...song.groups];
  newGroups[addr.groupIndex] = {
    ...targetGroup,
    slides: newSlides,
  };
  return blockSnapshot(
    {...song, groups: newGroups},
    {block: focus, start: position, end: position},
  );
}

function labelGrouped(
  snapshot: BlockSnapshot<GroupedSong>,
  name: string | undefined,
  ids?: readonly [SongGroupId, SongGroupId],
): BlockSnapshot<GroupedSong> {
  const {song} = snapshot;
  const {block} = snapshot.selection;
  const addr = linearBlockAddress(song, block);
  if (addr === undefined) return snapshot;
  const newName = name ?? '';
  const targetGroup = song.groups[addr.groupIndex];
  if (targetGroup === undefined) return snapshot;

  // NOTE(0913vision): Slide 0 renames the existing group, keeping its ID and
  // arrangement references.
  if (addr.slideIndex === 0) {
    if (targetGroup.name === newName) {
      return snapshot;
    }
    const newGroups = [...song.groups];
    newGroups[addr.groupIndex] = {
      ...targetGroup,
      name: newName,
    };
    return blockSnapshot({...song, groups: newGroups}, snapshot.selection);
  }

  // NOTE(0913vision): SlideIndex > 0 splits the current group into two groups
  // with fresh UUIDs (or caller-provided deterministic IDs). Arrangements
  // replace every occurrence of the original group with both parts in order
  // ([A] -> [A1, A2]).
  const [id1, id2] = ids ?? [
    createSongGroupId(crypto.randomUUID()),
    createSongGroupId(crypto.randomUUID()),
  ];
  const oldId = targetGroup.id;

  const group1: SongGroup = {
    ...targetGroup,
    id: id1,
    slides: targetGroup.slides.slice(0, addr.slideIndex),
  };
  const group2: SongGroup = {
    ...targetGroup,
    id: id2,
    name: newName,
    slides: targetGroup.slides.slice(addr.slideIndex),
  };

  const newGroups = [
    ...song.groups.slice(0, addr.groupIndex),
    group1,
    group2,
    ...song.groups.slice(addr.groupIndex + 1),
  ];

  const newArrangements = song.arrangements?.map(arrangement => ({
    ...arrangement,
    groups: arrangement.groups.flatMap(id =>
      id === oldId ? [id1, id2] : [id],
    ),
  }));

  return blockSnapshot(
    {
      ...song,
      groups: newGroups,
      ...(newArrangements === undefined ? {} : {arrangements: newArrangements}),
    },
    snapshot.selection,
  );
}

function mergeGrouped(
  snapshot: BlockSnapshot<GroupedSong>,
): BlockSnapshot<GroupedSong> {
  const {song} = snapshot;
  const {block, start, end} = snapshot.selection;
  if (start !== 0 || end !== 0) return snapshot;
  const addr = linearBlockAddress(song, block);
  if (addr === undefined) return snapshot;
  if (addr.slideIndex === 0) {
    return blockSnapshot(song, snapshot.selection, true);
  }
  const targetGroup = song.groups[addr.groupIndex];
  if (targetGroup === undefined) return snapshot;
  const previous = targetGroup.slides[addr.slideIndex - 1];
  if (previous === undefined) return snapshot;
  // NOTE(0913vision): Keep the first slide's hot key when defined, or inherit
  // the merged slide's key when the first slide had none.
  const hotKey = previous.hotKey ?? addr.slide.hotKey;
  const mergedSlide = {
    lines: [...previous.lines, ...addr.slide.lines],
    ...(hotKey !== undefined ? {hotKey} : {}),
  };
  const newSlides = [...targetGroup.slides];
  newSlides.splice(addr.slideIndex - 1, 2, mergedSlide);
  const newGroups = [...song.groups];
  newGroups[addr.groupIndex] = {...targetGroup, slides: newSlides};
  const position = previous.lines.join('\n').length;
  return blockSnapshot(
    {...song, groups: newGroups},
    {block: block - 1, start: position, end: position},
  );
}

function enterGrouped(
  snapshot: BlockSnapshot<GroupedSong>,
): BlockSnapshot<GroupedSong> {
  const {song} = snapshot;
  const {block, start, end} = snapshot.selection;
  const addr = linearBlockAddress(song, block);
  if (addr === undefined) return snapshot;
  const text = addr.slide.lines.join('\n');
  const first = start === 0 ? 0 : text.lastIndexOf('\n', start - 1) + 1;
  const next = text.indexOf('\n', start);
  const last = next < 0 ? text.length : next;
  if (start === end && text.slice(first, last).trim() === '') {
    return splitGrouped(
      snapshot,
      text.slice(0, Math.max(0, first - 1)),
      text.slice(Math.min(text.length, last + 1)),
    );
  }
  return replaceGrouped(
    snapshot,
    `${text.slice(0, start)}\n${text.slice(end)}`,
    {
      start: start + 1,
      end: start + 1,
    },
  );
}

/**
 * Applies a block edit without mutating the song. Splits retain the first
 * block's identity and label; new blocks start unlabeled. Named arrangements
 * expand split references and map merged blocks to the result, collapsing
 * adjacent pairs of different merge sources while retaining deliberate repeats.
 *
 * For grouped songs, edits operate on slides within their containing groups.
 * Backspace at a group boundary (first slide of a group) refuses the merge and
 * preserves lyrics and arrangements intact.
 */
function editGrouped(
  snapshot: BlockSnapshot<GroupedSong>,
  command: BlockCommand,
): BlockSnapshot<GroupedSong> {
  switch (command.type) {
    case 'text':
      return replaceGrouped(snapshot, normalize(command.text), command);
    case 'paste':
      return pasteGrouped(snapshot, normalize(command.text));
    case 'label':
      return labelGrouped(snapshot, command.name, command.ids);
    case 'split': {
      const addr = linearBlockAddress(snapshot.song, snapshot.selection.block);
      if (addr === undefined) return snapshot;
      const text = addr.slide.lines.join('\n');
      return splitGrouped(
        snapshot,
        text.slice(0, snapshot.selection.start),
        text.slice(snapshot.selection.end),
      );
    }
    case 'insert':
      return insertGrouped(snapshot);
    case 'enter':
      return enterGrouped(snapshot);
    case 'merge':
      return mergeGrouped(snapshot);
  }
}

function editV1(snapshot: BlockSnapshot, command: BlockCommand): BlockSnapshot {
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

/**
 * Applies a single editing command to the current snapshot. Preserves
 * selection bounds and clamps to valid offsets after the modification.
 */
export function editBlocks(
  input: BlockSnapshot<GroupedSong>,
  command: BlockCommand,
): BlockSnapshot<GroupedSong>;
export function editBlocks(
  input: BlockSnapshot,
  command: BlockCommand,
): BlockSnapshot;
export function editBlocks<S extends AnySong>(
  input: BlockSnapshot<S>,
  command: BlockCommand,
): BlockSnapshot<S>;
export function editBlocks(
  input: BlockSnapshot<AnySong>,
  command: BlockCommand,
): BlockSnapshot<AnySong> {
  const song = input.song;
  if (isGroupedSong(song)) {
    const snapshot = blockSnapshot(song, input.selection);
    return editGrouped(snapshot, command);
  }
  const snapshot = blockSnapshot(song, input.selection);
  return editV1(snapshot, command);
}
