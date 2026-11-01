import {expect, it, vi} from 'vitest';
import type {MediaDocument} from '@core/schema/mediaEdit';
import {mediaDocument} from './mediaTesting';
import {subscribeMediaDocument} from './subscribeMediaDocument';

function mockSubscription() {
  let resolve: (document: MediaDocument) => void = () => undefined;
  let reject: (cause: unknown) => void = () => undefined;
  const read = new Promise<MediaDocument>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  let push: (document: MediaDocument) => void = () => undefined;
  const mockStop = vi.fn();
  const mockPublish = vi.fn<(document: MediaDocument) => void>();
  const mockError = vi.fn();
  const mockMedia = {
    get: vi.fn(() => {
      expect(push).toBe(mockMedia.subscribe.mock.calls[0]?.[0]);
      return read;
    }),
    subscribe: vi.fn((listener: (document: MediaDocument) => void) => {
      push = listener;
      return mockStop;
    }),
  };
  const dispose = subscribeMediaDocument(mockMedia, mockPublish, mockError);
  return {
    read,
    resolve,
    reject,
    dispose,
    mockStop,
    mockPublish,
    mockError,
    push: (document: MediaDocument) => push(document),
  };
}

it('fences older and equal revisions and ignores pushes, reads, and failures after disposal', async () => {
  const current = mockSubscription();
  const newest = mediaDocument([], 3);
  current.push(mediaDocument([], 2));
  current.push(mediaDocument([], 2));
  current.push(mediaDocument([], 1));
  current.push(newest);
  current.resolve(mediaDocument([], 1));
  await current.read;
  expect(
    current.mockPublish.mock.calls.map(([document]) => document.revision),
  ).toEqual([2, 3]);
  expect(current.mockPublish).toHaveBeenLastCalledWith(newest);
  current.dispose();
  current.push(mediaDocument([], 4));
  expect(current.mockStop).toHaveBeenCalledOnce();
  expect(current.mockPublish).toHaveBeenCalledTimes(2);
  expect(current.mockError).not.toHaveBeenCalled();

  const cancelledRead = mockSubscription();
  cancelledRead.dispose();
  cancelledRead.resolve(mediaDocument([]));
  await cancelledRead.read;
  expect(cancelledRead.mockPublish).not.toHaveBeenCalled();
  expect(cancelledRead.mockStop).toHaveBeenCalledOnce();

  const cancelledFailure = mockSubscription();
  cancelledFailure.dispose();
  cancelledFailure.reject(new Error('Cancelled read'));
  await Promise.allSettled([cancelledFailure.read]);
  expect(cancelledFailure.mockError).not.toHaveBeenCalled();
  expect(cancelledFailure.mockStop).toHaveBeenCalledOnce();
});
