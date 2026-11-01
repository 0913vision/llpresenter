import {describe, expect, it, vi} from 'vitest';
import {song, sampleGroupedSong} from '@fixtures/core/songs/blockFixtures';
import {blockSnapshot} from '@core/songs/blockModel';
import {editBlocks} from '@core/songs/blockEdits';
import {editGroupedBlocks} from '@core/songs/groupedBlockEdits';
import {editLegacyBlocks} from '@core/songs/legacyBlockEdits';

vi.mock('@core/songs/groupedBlockEdits', () => ({
  editGroupedBlocks: vi.fn((input: unknown) => input),
}));
vi.mock('@core/songs/legacyBlockEdits', () => ({
  editLegacyBlocks: vi.fn((input: unknown) => input),
}));

describe('editBlocks', () => {
  it('sends a grouped song to the grouped editor and an older song to the legacy editor', () => {
    const command = {type: 'split'} as const;
    const grouped = blockSnapshot(sampleGroupedSong(), {
      block: 0,
      start: 0,
      end: 0,
    });
    const legacy = blockSnapshot(song(), {block: 0, start: 0, end: 0});

    editBlocks(grouped, command);
    expect(editGroupedBlocks).toHaveBeenCalledExactlyOnceWith(grouped, command);
    expect(editLegacyBlocks).not.toHaveBeenCalled();

    editBlocks(legacy, command);
    expect(editLegacyBlocks).toHaveBeenCalledExactlyOnceWith(legacy, command);
    expect(editGroupedBlocks).toHaveBeenCalledOnce();
  });
});
