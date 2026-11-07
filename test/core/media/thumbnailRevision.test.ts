import {describe, expect, it} from 'vitest';
import {thumbnailRevision} from '@core/media/thumbnailRevision';

describe('thumbnailRevision', () => {
  const item = {file: 'Dawn.mp4', size: 1024, modified: 1_700_000_000_000};

  it('stays the same for an unchanged file, as eight hex digits', () => {
    expect(thumbnailRevision({...item})).toBe(thumbnailRevision(item));
    expect(thumbnailRevision(item)).toMatch(/^[0-9a-f]{8}$/);
  });

  it('changes when the file, its size, or its time changes', () => {
    const before = thumbnailRevision(item);
    expect(thumbnailRevision({...item, file: 'Found.mp4'})).not.toBe(before);
    expect(thumbnailRevision({...item, size: 2048})).not.toBe(before);
  });

  it('changes for a replacement of the same size', () => {
    expect(thumbnailRevision({...item, modified: item.modified + 1})).not.toBe(
      thumbnailRevision(item),
    );
  });
});
