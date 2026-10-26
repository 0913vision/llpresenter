import {describe, expect, it, vi} from 'vitest';
import type {SettingsDocument} from '@shared/schema/settingsDocuments';
import {
  overlaySettings,
  settingsDocument,
} from '../../../main/live/testing/overlays';
import {followSettingsDocument} from './settingsFeed';

function screensOf(document: SettingsDocument) {
  return document.name === 'screens' ? document.value.screens : undefined;
}

function setup(
  read: () => Promise<SettingsDocument> = () =>
    Promise.resolve(overlaySettings().reader.get('screens')),
) {
  const listeners = new Set<(document: SettingsDocument) => void>();
  const unsubscribe = vi.fn();
  const order: string[] = [];
  const settings = {
    get: vi.fn(() => {
      order.push('get');
      return read();
    }),
    edit: vi.fn(),
    subscribe: vi.fn((listener: (document: SettingsDocument) => void) => {
      order.push('subscribe');
      listeners.add(listener);
      return unsubscribe;
    }),
  };
  const receive = vi.fn();
  const onError = vi.fn();
  const stop = followSettingsDocument({
    settings,
    name: 'screens',
    select: screensOf,
    receive,
    onError,
  });
  const push = (document: SettingsDocument): void => {
    for (const listener of listeners) listener(document);
  };
  return {settings, order, receive, onError, stop, push, unsubscribe};
}

describe('followSettingsDocument', () => {
  it('subscribes before it reads and passes the selected value', async () => {
    const {order, receive, settings} = setup();
    expect(order).toEqual(['subscribe', 'get']);
    expect(settings.get).toHaveBeenCalledWith({name: 'screens'});
    await vi.waitFor(() => expect(receive).toHaveBeenCalledOnce());
    expect(receive.mock.calls[0]?.[0]).toHaveLength(3);
  });

  it('never lets an older revision or another document replace the value', async () => {
    let answer: (document: SettingsDocument) => void = () => undefined;
    const {receive, push} = setup(
      () =>
        new Promise(resolve => {
          answer = resolve;
        }),
    );
    push(settingsDocument('screens', {screens: []}, 5));
    push(settingsDocument('props', {props: []}, 9));
    answer(overlaySettings().reader.get('screens'));
    await Promise.resolve();
    await Promise.resolve();
    expect(receive.mock.calls).toEqual([[[]]]);
  });

  it('reports a failed read and drops everything after it stops', async () => {
    let fail: (error: Error) => void = () => undefined;
    const {receive, onError, push, stop, unsubscribe} = setup(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    fail(new Error('unreadable'));
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
    stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
    push(settingsDocument('screens', {screens: []}, 2));
    expect(receive).not.toHaveBeenCalled();
  });

  it('stays quiet about a read that fails after it stops', async () => {
    let fail: (error: Error) => void = () => undefined;
    const {onError, stop} = setup(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    stop();
    fail(new Error('late'));
    await Promise.resolve();
    await Promise.resolve();
    expect(onError).not.toHaveBeenCalled();
  });
});
