import {describe, expect, it} from 'vitest';
import {thumbnailUrl} from '@contracts/ipc/mediaUrls';
import {
  noteThumbnailItems,
  noteThumbnailStamps,
  thumbnailSrc,
} from '@contracts/ipc/thumbnailRevisions';
import {thumbnailRevision} from '@core/media/thumbnailRevision';
import {createMediaId} from '@core/schema/ids';

describe('thumbnailSrc', () => {
  const id = createMediaId('00000000-0000-4000-8000-000000000003');
  const item = {id, file: 'Dawn.mp4', size: 10};

  it('uses the plain URL until the file and its time are both known', () => {
    noteThumbnailItems([]);
    noteThumbnailStamps({});
    expect(thumbnailSrc(id)).toBe(thumbnailUrl(id));
    noteThumbnailItems([item]);
    expect(thumbnailSrc(id)).toBe(thumbnailUrl(id));
    noteThumbnailItems([]);
    noteThumbnailStamps({[id]: 5});
    expect(thumbnailSrc(id)).toBe(thumbnailUrl(id));
  });

  it('keeps one URL for an unchanged file and takes a new one after a change', () => {
    noteThumbnailItems([item]);
    noteThumbnailStamps({[id]: 5});
    const first = thumbnailSrc(id);
    expect(first).toBe(
      thumbnailUrl(id, thumbnailRevision({...item, modified: 5})),
    );
    noteThumbnailItems([{...item}]);
    noteThumbnailStamps({[id]: 5});
    expect(thumbnailSrc(id)).toBe(first);
    noteThumbnailItems([{...item, file: 'Found.mp4'}]);
    expect(thumbnailSrc(id)).not.toBe(first);
  });

  it('gives a new URL to a file replaced by one of the same size', () => {
    noteThumbnailItems([item]);
    noteThumbnailStamps({[id]: 5});
    const first = thumbnailSrc(id);
    noteThumbnailStamps({[id]: 6});
    expect(thumbnailSrc(id)).not.toBe(first);
  });

  it('forgets an item that left the list', () => {
    noteThumbnailItems([item]);
    noteThumbnailStamps({[id]: 5});
    noteThumbnailItems([]);
    expect(thumbnailSrc(id)).toBe(thumbnailUrl(id));
  });
});
