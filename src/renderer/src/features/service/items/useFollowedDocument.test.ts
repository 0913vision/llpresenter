import {act, renderHook, waitFor} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {useFollowedDocument, type DocumentSource} from './useFollowedDocument';

interface Doc {
  readonly revision: number;
  readonly name: string;
}

function source() {
  let push: (document: Doc) => void = () => undefined;
  let answer: (document: Doc) => void = () => undefined;
  let fail: (reason: unknown) => void = () => undefined;
  const stop = vi.fn();
  const read = vi.fn(
    () =>
      new Promise<Doc>((resolve, reject) => {
        answer = resolve;
        fail = reject;
      }),
  );
  const value: DocumentSource<Doc> = {
    read,
    follow: accept => {
      push = accept;
      return stop;
    },
  };
  return {
    value,
    read,
    stop,
    push: (document: Doc) => push(document),
    answer: (document: Doc) => answer(document),
    fail: (reason: unknown) => fail(reason),
  };
}

describe('useFollowedDocument', () => {
  it('keeps a newer push over a read that answers later', async () => {
    const doc = source();
    const {result} = renderHook(() => useFollowedDocument(doc.value));
    act(() => doc.push({revision: 3, name: 'pushed'}));
    await act(async () => doc.answer({revision: 2, name: 'read'}));
    expect(result.current.document?.name).toBe('pushed');
    act(() => doc.push({revision: 4, name: 'newer'}));
    expect(result.current.document?.name).toBe('newer');
  });

  it('reports a failed read and reads again on retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const doc = source();
    const {result} = renderHook(() => useFollowedDocument(doc.value));
    await act(async () => doc.fail(new Error('Gone')));
    expect(result.current.failed).toBe(true);
    act(() => result.current.retry());
    expect(result.current.failed).toBe(false);
    await waitFor(() => expect(doc.read).toHaveBeenCalledTimes(2));
    await act(async () => doc.answer({revision: 1, name: 'again'}));
    expect(result.current.document?.name).toBe('again');
  });

  it('reads and follows only while enabled and discards a disabled pending read', async () => {
    const doc = source();
    const view = renderHook(
      ({enabled}) => useFollowedDocument(doc.value, enabled),
      {initialProps: {enabled: false}},
    );
    expect(doc.read).not.toHaveBeenCalled();
    view.rerender({enabled: true});
    await waitFor(() => expect(doc.read).toHaveBeenCalledOnce());
    view.rerender({enabled: false});
    expect(doc.stop).toHaveBeenCalledOnce();
    await act(async () => doc.answer({revision: 1, name: 'late'}));
    expect(view.result.current.document).toBeNull();
    view.unmount();
  });

  it('stops following on unmount', () => {
    const doc = source();
    const {unmount} = renderHook(() => useFollowedDocument(doc.value));
    unmount();
    expect(doc.stop).toHaveBeenCalledOnce();
  });
});
