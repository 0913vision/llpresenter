import {beforeEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import {emptyLiveState} from '@shared/live';
import {parseLiveState} from '@shared/schema/liveState';
import {AudioPlayer} from './audioPlayer';

const MEDIA = '00000000-0000-4000-8000-000000000001';

function state(trackVersion = 1, playback: object = {}, audioVolume = 100) {
  const initial = emptyLiveState();
  const parsed = parseLiveState({
    ...initial,
    version: trackVersion,
    audioVolume,
    layers: {
      ...initial.layers,
      audio: {
        mediaId: MEDIA,
        playback: {
          source: {kind: 'media', mediaId: MEDIA},
          trackVersion,
          since: 1000,
          positionSeconds: 0,
          ...playback,
        },
      },
    },
  });
  if (!parsed.ok) throw new Error('Invalid audio state fixture');
  return parsed.value;
}

function setup() {
  const root = document.createElement('div');
  const now = vi.fn(() => 5000);
  const onNext = vi.fn();
  const onError = vi.fn();
  const player = new AudioPlayer(root, {now, onNext, onError});
  onTestFinished(() => player.dispose());
  const [first, second] = root.querySelectorAll('audio');
  if (first === undefined || second === undefined) {
    throw new Error('Missing audio elements');
  }
  return {root, player, first, second, now, onNext, onError};
}

async function ready(element: HTMLAudioElement) {
  element.dispatchEvent(new Event('canplay'));
  await Promise.resolve();
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockReturnValue(undefined);
});

describe('AudioPlayer', () => {
  it('creates only two muted hidden elements and leaves empty output idle', () => {
    const {root, player, first, second} = setup();
    for (const element of [first, second]) {
      expect(element.muted).toBe(true);
      expect(element.hidden).toBe(true);
    }
    player.show(emptyLiveState());
    player.show(emptyLiveState());
    expect(HTMLMediaElement.prototype.load).not.toHaveBeenCalled();
    expect(root.querySelectorAll('audio')).toHaveLength(2);
  });

  it('joins the current position, pauses, resumes, and changes volume without reloading', async () => {
    const {player, first, now} = setup();
    player.show(state());
    await ready(first);
    expect(first.currentTime).toBe(4);
    const load = vi.mocked(HTMLMediaElement.prototype.load);
    const loaded = load.mock.calls.length;
    player.show(state(1, {since: null, positionSeconds: 4}));
    expect(
      vi.mocked(HTMLMediaElement.prototype.pause).mock.contexts.at(-1),
    ).toBe(first);
    now.mockReturnValue(12_000);
    player.show(state(1, {since: 12_000, positionSeconds: 4}, 25));
    await Promise.resolve();
    expect(first.currentTime).toBe(4);
    expect(first.volume).toBe(0.25);
    first.currentTime = 6;
    player.show({
      ...state(1, {since: 12_000, positionSeconds: 4}, 50),
      version: 2,
    });
    expect(first.currentTime).toBe(6);
    expect(first.volume).toBe(0.5);
    expect(load.mock.calls).toHaveLength(loaded);
  });

  it('retains the last playing track until the spare starts and ignores a failed replacement', async () => {
    const {player, first, second, onError} = setup();
    player.show(state());
    await ready(first);
    player.show(state(2));
    expect(first.hasAttribute('src')).toBe(true);
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(
      new Error('Decoder failed'),
    );
    await ready(second);
    expect(first.hasAttribute('src')).toBe(true);
    expect(onError).toHaveBeenCalledOnce();
    player.show(state(3));
    await ready(second);
    expect(first.hasAttribute('src')).toBe(false);
    expect(second.hasAttribute('src')).toBe(true);
  });

  it('ignores a stale play completion while a newer selection loads', async () => {
    const {player, first, second} = setup();
    player.show(state());
    await ready(first);
    let resolve = () => {};
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementationOnce(
      () =>
        new Promise<void>(done => {
          resolve = done;
        }),
    );
    player.show(state(2));
    second.dispatchEvent(new Event('canplay'));
    player.show(state(3));
    resolve();
    await Promise.resolve();
    expect(first.hasAttribute('src')).toBe(true);
    await ready(second);
    expect(first.hasAttribute('src')).toBe(false);
  });

  it('pauses the active fallback before a loading replacement is ready, even if it fails', async () => {
    const {player, first, second} = setup();
    player.show(state());
    await ready(first);
    player.show(state(2));
    const pause = vi.mocked(HTMLMediaElement.prototype.pause);
    const play = vi.mocked(HTMLMediaElement.prototype.play);
    pause.mockClear();
    play.mockClear();
    player.show(state(2, {since: null}));
    expect(pause.mock.contexts).toContain(first);
    second.dispatchEvent(new Event('error'));
    player.show(state(2, {since: null}));
    expect(first.hasAttribute('src')).toBe(true);
    expect(play).not.toHaveBeenCalled();
  });

  it('honors pause while play is pending and sends next only once for the current running track', async () => {
    const {player, first, second, onNext} = setup();
    let resolve = () => {};
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementationOnce(
      () =>
        new Promise<void>(done => {
          resolve = done;
        }),
    );
    player.show(state());
    first.dispatchEvent(new Event('canplay'));
    player.show(state(1, {since: null, positionSeconds: 1}));
    resolve();
    await Promise.resolve();
    first.dispatchEvent(new Event('ended'));
    expect(onNext).not.toHaveBeenCalled();
    player.show(state(1, {since: 5000, positionSeconds: 1}));
    await Promise.resolve();
    second.dispatchEvent(new Event('ended'));
    first.dispatchEvent(new Event('ended'));
    first.dispatchEvent(new Event('ended'));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('clears a pending switch, ignores later completions, and releases listeners and sources on disposal', async () => {
    const {root, player, first, second, onNext} = setup();
    player.show(state());
    await ready(first);
    player.show(state(2));
    player.show(emptyLiveState());
    await ready(second);
    expect(first.hasAttribute('src')).toBe(false);
    expect(second.hasAttribute('src')).toBe(false);
    const remove = vi.spyOn(first, 'removeEventListener');
    player.dispose();
    player.dispose();
    player.show(state(3));
    first.dispatchEvent(new Event('ended'));
    expect(remove).toHaveBeenCalledTimes(3);
    expect(root.children).toHaveLength(0);
    expect(onNext).not.toHaveBeenCalled();
  });

  it('bounds distinct error reports and keeps both elements reusable after errors', () => {
    const {player, first, now, onError, root} = setup();
    for (let index = 1; index <= 40; index += 1) {
      now.mockImplementation(() => {
        throw new Error(`Clock ${index}`);
      });
      expect(() => {
        player.show(state(index));
        first.dispatchEvent(new Event('canplay'));
      }).not.toThrow();
    }
    expect(onError).toHaveBeenCalledTimes(32);
    expect(root.querySelectorAll('audio')).toHaveLength(2);
  });
});
