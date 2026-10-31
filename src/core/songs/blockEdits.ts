import {
  isGroupedSong,
  type AnySong,
  type GroupedSong,
} from '../schema/groupedSong';
import {
  blockSnapshot,
  type BlockCommand,
  type BlockSnapshot,
} from './blockModel';
import {editGroupedBlocks} from './groupedBlockEdits';
import {editLegacyBlocks} from './legacyBlockEdits';

export {
  blockSnapshot,
  groupedSlideCount,
  linearBlockAddress,
  linearSlidesOf,
  slideCountOf,
} from './blockModel';
export type {
  BlockCommand,
  BlockSelection,
  BlockSnapshot,
  EditorSlideItem,
  GroupedSlideAddress,
} from './blockModel';

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
    return editGroupedBlocks(snapshot, command);
  }
  const snapshot = blockSnapshot(song, input.selection);
  return editLegacyBlocks(snapshot, command);
}
