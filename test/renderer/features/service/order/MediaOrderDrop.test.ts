import {describe, expect, it} from 'vitest';
import {mediaDropReason} from '@renderer/features/service/order/useServiceOrderDrag';
import {itemMedia} from '@fixtures/core/mediaList';
import {MISSING_MEDIA_TIP} from '@renderer/platform/problemReasons';

describe('media order drop availability', () => {
  it('refuses missing files and accepts existing media as an item', () => {
    const media = itemMedia().value.items[0];
    expect(
      mediaDropReason({
        media,
        missing: true,
        target: undefined,
        asBackground: false,
      }),
    ).toBe(MISSING_MEDIA_TIP);
    expect(
      mediaDropReason({
        media: undefined,
        missing: false,
        target: undefined,
        asBackground: false,
      }),
    ).toBe(MISSING_MEDIA_TIP);
    expect(
      mediaDropReason({
        media,
        missing: false,
        target: undefined,
        asBackground: false,
      }),
    ).toBeUndefined();
  });
  it('only accepts visual media on a song or slides item', () => {
    const [image, , audio] = itemMedia().value.items;
    const song = {kind: 'song' as const, id: 'song', title: 'Song'};
    const bible = {kind: 'bible' as const, id: 'bible', title: 'Bible'};
    expect(
      mediaDropReason({
        media: image,
        missing: false,
        target: song,
        asBackground: true,
      }),
    ).toBeUndefined();
    expect(
      mediaDropReason({
        media: audio,
        missing: false,
        target: song,
        asBackground: true,
      }),
    ).toBeTruthy();
    expect(
      mediaDropReason({
        media: image,
        missing: false,
        target: bible,
        asBackground: true,
      }),
    ).toBeTruthy();
  });
});
