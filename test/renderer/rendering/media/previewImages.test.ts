import {afterEach, expect, it, vi} from 'vitest';
import {
  lendPreviewImage,
  lentPreviewUrl,
} from '@renderer/rendering/media/previewMedia';

const lent: Array<() => void> = [];

afterEach(() => {
  for (const release of lent.splice(0)) release();
  vi.restoreAllMocks();
});

/** A picture that says it is `bytes` long without holding them. */
class SizedBlob extends Blob {
  constructor(private readonly claimedSize: number) {
    super(['x']);
  }

  override get size(): number {
    return this.claimedSize;
  }
}

function lend(bytes: number) {
  const loan = lendPreviewImage(new SizedBlob(bytes));
  if (loan !== null) lent.push(loan.release);
  return loan;
}

it('lends an image under an address until it is released, then frees the address once', () => {
  const create = vi
    .spyOn(URL, 'createObjectURL')
    .mockReturnValue('blob:invented-preview');
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);

  const loan = lend(10);
  if (loan === null) throw new Error('Expected a loan');
  expect(create).toHaveBeenCalledOnce();
  expect(lentPreviewUrl(loan.id)).toBe('blob:invented-preview');

  loan.release();
  loan.release();
  expect(lentPreviewUrl(loan.id)).toBeUndefined();
  expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:invented-preview');
});

it('lends nothing for an empty image or past 128 MB in all, and lends again once space is freed', () => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:invented-preview');
  vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);

  expect(lend(0)).toBeNull();
  const big = lend(100 * 1024 * 1024);
  expect(big).not.toBeNull();
  expect(lend(40 * 1024 * 1024)).toBeNull();
  big?.release();
  expect(lend(40 * 1024 * 1024)).not.toBeNull();
});
