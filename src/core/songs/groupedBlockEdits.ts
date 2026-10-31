import type {GroupedSong, SongGroup} from '../schema/groupedSong';

import {createSongGroupId, type SongGroupId} from '../schema/ids';

import {
  blockSnapshot,
  linearBlockAddress,
  BLANK_LINES,
  linesOf,
  normalize,
  type BlockCommand,
  type BlockSelection,
  type BlockSnapshot,
} from './blockModel';

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

/** Applies a grouped-song command without mutating its bounded snapshot. It retains group references and refuses cross-group merges; it does not save or publish changes. */
export function editGroupedBlocks(
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
