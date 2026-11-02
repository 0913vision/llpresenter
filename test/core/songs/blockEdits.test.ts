import {describe, expect, it, vi} from 'vitest';
import {sampleGroupedSong} from '@fixtures/core/songs/blockFixtures';
import {blockSnapshot} from '@core/songs/blockModel';
import {editBlocks} from '@core/songs/blockEdits';
import {editGroupedBlocks} from '@core/songs/groupedBlockEdits';

vi.mock('@core/songs/groupedBlockEdits', () => ({
  editGroupedBlocks: vi.fn((input: unknown) => input),
}));

describe('editBlocks', () => {
  it('sends a song to the grouped editor', () => {
    const command = {type: 'split'} as const;
    const grouped = blockSnapshot(sampleGroupedSong(), {
      block: 0,
      start: 0,
      end: 0,
    });

    editBlocks(grouped, command);
    expect(editGroupedBlocks).toHaveBeenCalledExactlyOnceWith(grouped, command);
  });
});
