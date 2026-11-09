import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {parseLiveState} from '@core/schema/liveState';
import {AudioPlayer} from '@renderer/rendering/audioPlayer';
import {setPlaybackProblem} from '@renderer/rendering/playbackProblem';

vi.mock('@renderer/rendering/playbackProblem', () => ({
  setPlaybackProblem: vi.fn(),
}));

const MEDIA = '00000000-0000-4000-8000-000000000001';
const AUDIO_CLEAR_FADE_MS = 400;

function cleared(since = 5000) {
  return {
    ...emptyLiveState(),
    clearEffects: [
      {
        target: {kind: 'layer', layer: 'audio'},
        since,
        durationMs: AUDIO_CLEAR_FADE_MS,
      },
    ],
  } as const;
}

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
  const onFadeEnd = vi.fn();
  const onError = vi.fn();
  const player = new AudioPlayer(root, {now, onNext, onFadeEnd, onError});
  player.setTimes({transitionMs: 0, fadeOutMs: 3000});
  onTestFinished(() => player.dispose());
  const [first, second] = root.querySelectorAll('audio');
  if (first === undefined || second === undefined) {
    throw new Error('Missing audio elements');
  }
  return {root, player, first, second, now, onNext, onFadeEnd, onError};
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
afterEach(() => vi.useRealTimers());

describe('AudioPlayer', () => {
  it('reports decode failure and clears it when the failed track is removed', async () => {
    const {player, first} = setup();
    player.show(state());
    await ready(first);
    first.dispatchEvent(new Event('error'));
    expect(setPlaybackProblem).toHaveBeenLastCalledWith(
      first,
      'playback',
      true,
    );
    vi.mocked(setPlaybackProblem).mockClear();
    player.show(emptyLiveState());
    expect(setPlaybackProblem).toHaveBeenCalledWith(first, 'playback', false);
  });
  it('clears at once by default and leaves no pending audio or timers', async () => {
    vi.useFakeTimers();
    const {player, first} = setup();
    player.show(state());
    await ready(first);
    player.show(emptyLiveState());
    expect(first.hasAttribute('src')).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses the remaining configured clear duration after delayed delivery', async () => {
    vi.useFakeTimers();
    const {player, first, now} = setup();
    player.show(state());
    await ready(first);
    now.mockReturnValue(5300);
    const clear = vi.spyOn(globalThis, 'clearInterval');
    player.show(cleared());
    vi.advanceTimersByTime(100);
    expect(first.hasAttribute('src')).toBe(false);
    expect(clear).toHaveBeenCalledOnce();
  });
  it('multiplies item volume by transport and fade gain, applies speed, and keeps the safety mute', async () => {
    vi.useFakeTimers();
    const {player, first, now} = setup();
    const base = state(1, {}, 50);
    const configured = {
      ...base,
      layers: {
        ...base.layers,
        audio: {
          ...base.layers.audio,
          mediaId: MEDIA,
          properties: {speed: 2, fit: 'fill' as const, volume: 40, audio: true},
        },
      },
    };
    player.show(configured);
    await ready(first);
    expect(first.currentTime).toBe(8);
    expect(first.playbackRate).toBe(2);
    expect(first.volume).toBeCloseTo(0.2);
    expect(first.muted).toBe(true);
    const playback = base.layers.audio?.playback;
    if (playback === undefined) throw new Error('Missing playback');
    player.show({
      ...base,
      layers: {
        ...configured.layers,
        audio: {
          ...configured.layers.audio,
          playback: {...playback, fadeOutSince: 5000},
        },
      },
    });
    now.mockReturnValue(6500);
    vi.advanceTimersByTime(1500);
    expect(first.volume).toBeCloseTo(0.1);
  });
  it('fades both fallback and newly ready replacement for three seconds, then stops without next', async () => {
    vi.useFakeTimers();
    const {root, player, first, second, now, onNext, onFadeEnd} = setup();
    player.show(state());
    await ready(first);
    player.show(state(2, {fadeOutSince: 5000}));
    now.mockReturnValue(6500);
    vi.advanceTimersByTime(1500);
    expect(first.volume).toBeCloseTo(0.5);
    expect(second.volume).toBeCloseTo(0.5);
    await ready(second);
    player.show(state(2, {fadeOutSince: 5000}, 50));
    expect(second.volume).toBeCloseTo(0.25);
    now.mockReturnValue(8000);
    vi.advanceTimersByTime(1500);
    expect(root.querySelector('audio[src]')).toBeNull();
    expect(onFadeEnd).toHaveBeenCalledExactlyOnceWith(2, 5000);
    expect(onNext).not.toHaveBeenCalled();
    player.show(state(2, {fadeOutSince: 5000}));
    expect(root.querySelector('audio[src]')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('interrupts a manual fade with F5 without increasing its current gain', async () => {
    vi.useFakeTimers();
    const {player, first, now, onFadeEnd} = setup();
    player.show(state());
    await ready(first);
    player.show(state(1, {fadeOutSince: 5000}));
    now.mockReturnValue(6500);
    vi.advanceTimersByTime(1500);
    expect(first.volume).toBeCloseTo(0.5);
    player.show(cleared(6500));
    expect(first.volume).toBeCloseTo(0.5);
    now.mockReturnValue(6700);
    vi.advanceTimersByTime(200);
    expect(first.volume).toBeCloseTo(0.25);
    now.mockReturnValue(6900);
    vi.advanceTimersByTime(200);
    expect(first.hasAttribute('src')).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(onFadeEnd).not.toHaveBeenCalled();
  });

  it('finishes an expired fade on reload without playing and treats natural end as stop', async () => {
    vi.useFakeTimers();
    const {player, first, onNext, onFadeEnd} = setup();
    player.show(state(1, {fadeOutSince: 1000}));
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(onFadeEnd).toHaveBeenCalledExactlyOnceWith(1, 1000);
    player.show(state(2));
    await ready(first);
    player.show(state(2, {fadeOutSince: 5000}));
    first.dispatchEvent(new Event('ended'));
    expect(onFadeEnd).toHaveBeenLastCalledWith(2, 5000);
    expect(onNext).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels a manual fade on a fresh play and releases its timers on disposal', async () => {
    vi.useFakeTimers();
    const {player, first, second, now, onFadeEnd} = setup();
    player.show(state());
    await ready(first);
    player.show(state(1, {fadeOutSince: 5000}));
    now.mockReturnValue(6500);
    vi.advanceTimersByTime(1500);
    player.show(state(2));
    await ready(second);
    expect(second.volume).toBe(1);
    vi.advanceTimersByTime(3000);
    expect(second.hasAttribute('src')).toBe(true);
    expect(onFadeEnd).not.toHaveBeenCalled();
    player.show(state(2, {fadeOutSince: 6500}));
    player.dispose();
    vi.advanceTimersByTime(0);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(3000);
    expect(onFadeEnd).not.toHaveBeenCalled();
  });

  it('creates only two muted hidden elements and leaves empty output idle', () => {
    const {root, player, first, second} = setup();
    for (const element of [first, second]) {
      expect(element.muted).toBe(true);
      expect(element.hidden).toBe(true);
    }
    player.show(cleared());
    player.show(cleared());
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
    expect(setPlaybackProblem).toHaveBeenLastCalledWith(
      second,
      'playback',
      true,
    );
    player.show(state(3));
    await ready(second);
    expect(first.hasAttribute('src')).toBe(false);
    expect(second.hasAttribute('src')).toBe(true);
    expect(setPlaybackProblem).toHaveBeenCalledWith(second, 'playback', false);
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
    vi.useFakeTimers();
    const {root, player, first, second, onNext, now} = setup();
    player.show(state());
    await ready(first);
    player.show(state(2));
    player.show(cleared());
    await ready(second);
    expect(first.hasAttribute('src')).toBe(true);
    now.mockReturnValue(5000 + AUDIO_CLEAR_FADE_MS);
    vi.advanceTimersByTime(AUDIO_CLEAR_FADE_MS);
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

  it('honors one configured clear fade, applies volume during it, and stops at its deadline', async () => {
    vi.useFakeTimers();
    const {player, first, now} = setup();
    player.show(state());
    await ready(first);
    player.show(cleared());
    now.mockReturnValue(5200);
    vi.advanceTimersByTime(200);
    expect(first.volume).toBeCloseTo(0.5);
    player.show({...cleared(), version: 20, audioVolume: 20});
    expect(first.volume).toBeCloseTo(0.1);
    now.mockReturnValue(5400);
    vi.advanceTimersByTime(200);
    expect(first.hasAttribute('src')).toBe(false);
    expect(AUDIO_CLEAR_FADE_MS).toBeLessThanOrEqual(500);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['stalled', 'load error', 'play error'])(
    'removes the cleared fallback before replacement readiness (%s)',
    async failure => {
      vi.useFakeTimers();
      const {root, player, first, now, onNext, onError} = setup();
      const playing = new Set<HTMLMediaElement>();
      const play = vi.mocked(HTMLMediaElement.prototype.play);
      play.mockImplementation(function (this: HTMLMediaElement) {
        playing.add(this);
        return Promise.resolve();
      });
      const pause = vi.mocked(HTMLMediaElement.prototype.pause);
      pause.mockImplementation(function (this: HTMLMediaElement) {
        playing.delete(this);
      });
      player.show(state());
      await ready(first);
      expect(playing.has(first)).toBe(true);
      player.show(cleared());
      now.mockReturnValue(5200);
      vi.advanceTimersByTime(200);
      expect(first.volume).toBeCloseTo(0.5);
      pause.mockClear();
      player.show(state(2));
      expect(pause.mock.contexts).toContain(first);
      expect(playing.size).toBe(0);
      const replacement = root.querySelector<HTMLAudioElement>('audio[src]');
      if (replacement === null) throw new Error('Missing replacement');
      if (failure === 'load error') {
        replacement.dispatchEvent(new Event('error'));
      } else if (failure === 'play error') {
        play.mockRejectedValueOnce(new Error('Decoder failed'));
        await ready(replacement);
      }
      player.show(state(2));
      now.mockReturnValue(15_000);
      vi.advanceTimersByTime(10_000);
      expect(playing.size).toBe(0);
      expect(onNext).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledTimes(failure === 'stalled' ? 0 : 1);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('cancels an old clear deadline when new audio starts and on disposal', async () => {
    vi.useFakeTimers();
    const {root, player, first} = setup();
    player.show(state());
    await ready(first);
    player.show(cleared());
    player.show(state(2));
    const replacement = root.querySelector<HTMLAudioElement>('audio[src]');
    if (replacement === null) throw new Error('Missing replacement');
    await ready(replacement);
    vi.advanceTimersByTime(AUDIO_CLEAR_FADE_MS);
    expect(replacement.hasAttribute('src')).toBe(true);
    player.show(cleared());
    player.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('logs a failed clear clock and stops the active audio without leaving timers', async () => {
    const {player, first, now, onError} = setup();
    player.show(state());
    await ready(first);
    now.mockImplementation(() => {
      throw new Error('Clock failed');
    });
    expect(() => player.show(cleared())).not.toThrow();
    expect(first.hasAttribute('src')).toBe(false);
    expect(onError).toHaveBeenCalledOnce();
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

  it('plays to the chosen device on both tracks, and keeps it for a track that starts later', async () => {
    const {player, first, second} = setup();
    const sinks = [first, second].map(element => {
      const setSinkId = vi.fn(() => Promise.resolve());
      Object.defineProperty(element, 'setSinkId', {value: setSinkId});
      return setSinkId;
    });
    player.setSink('hall');
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(sinks.map(sink => sink.mock.calls)).toEqual([
      [['hall']],
      [['hall']],
    ]);
    player.setSink('hall');
    expect(sinks.map(sink => sink.mock.calls.length)).toEqual([1, 1]);
    player.setSink('phones');
    player.show(state());
    await ready(first);
    expect(sinks.map(sink => sink.mock.calls.at(-1))).toEqual([
      ['phones'],
      ['phones'],
    ]);
  });

  it('fades out for the time of the setting', async () => {
    vi.useFakeTimers();
    const {root, player, first, now, onFadeEnd} = setup();
    player.setTimes({transitionMs: 0, fadeOutMs: 1000});
    player.show(state());
    await ready(first);
    player.show(state(1, {fadeOutSince: 5000}));
    now.mockReturnValue(5500);
    vi.advanceTimersByTime(500);
    expect(first.volume).toBeCloseTo(0.5);
    now.mockReturnValue(6000);
    vi.advanceTimersByTime(500);
    expect(root.querySelector('audio[src]')).toBeNull();
    expect(onFadeEnd).toHaveBeenCalledExactlyOnceWith(1, 5000);
  });

  describe('the 오디오 전환', () => {
    async function crossfading() {
      vi.useFakeTimers();
      const made = setup();
      made.now.mockImplementation(() => Date.now());
      made.player.setTimes({transitionMs: 1000, fadeOutMs: 3000});
      return made;
    }

    it('fades a starting track in over the transition time', async () => {
      const {player, first} = await crossfading();
      player.show(state());
      await ready(first);
      await vi.advanceTimersByTimeAsync(0);
      expect(first.volume).toBeCloseTo(0, 1);
      await vi.advanceTimersByTimeAsync(500);
      expect(first.volume).toBeCloseTo(0.5, 1);
      await vi.advanceTimersByTimeAsync(600);
      expect(first.volume).toBe(1);
    });

    it('fades the next track in while the one it replaces fades out and is let go', async () => {
      const {player, first, second} = await crossfading();
      player.show(state());
      await ready(first);
      await vi.advanceTimersByTimeAsync(1100);
      player.show(state(2));
      await ready(second);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(500);
      expect(first.volume).toBeCloseTo(0.5, 1);
      expect(second.volume).toBeCloseTo(0.5, 1);
      expect(first.hasAttribute('src')).toBe(true);
      await vi.advanceTimersByTimeAsync(600);
      expect(first.hasAttribute('src')).toBe(false);
      expect(second.volume).toBe(1);
    });

    it('keeps the track that is fading out through other state changes', async () => {
      const {player, first, second} = await crossfading();
      player.show(state());
      await ready(first);
      await vi.advanceTimersByTimeAsync(1100);
      player.show(state(2));
      await ready(second);
      await vi.advanceTimersByTimeAsync(300);
      player.show(state(2, {}, 80));
      expect(first.hasAttribute('src')).toBe(true);
    });

    it('cuts when the time is 0', async () => {
      vi.useFakeTimers();
      const {player, first, second} = setup();
      player.setTimes({transitionMs: 0, fadeOutMs: 3000});
      player.show(state());
      await ready(first);
      await vi.advanceTimersByTimeAsync(0);
      expect(first.volume).toBe(1);
      player.show(state(2));
      await ready(second);
      await vi.advanceTimersByTimeAsync(0);
      expect(second.volume).toBe(1);
      expect(first.hasAttribute('src')).toBe(false);
    });
  });
});
