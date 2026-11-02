import {
  blockSnapshot,
  type BlockCommand,
  type BlockSnapshot,
} from './blockModel';
import {editGroupedBlocks} from './groupedBlockEdits';

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
  input: BlockSnapshot,
  command: BlockCommand,
): BlockSnapshot {
  return editGroupedBlocks(blockSnapshot(input.song, input.selection), command);
}
