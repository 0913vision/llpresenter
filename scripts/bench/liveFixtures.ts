import {emptyLiveState, type LiveState} from '../../src/shared/live';
import {parseLiveState} from '../../src/shared/schema/liveState';

/** An invented UUID v4 for fixture ids. */
export const uuid = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

/** A service state: a two-line slide, a background, a message, three outputs. */
export function typicalState(): LiveState {
  return {
    ...emptyLiveState(),
    version: 10,
    outputs: {main: true, stage: true, broadcast: false},
    layers: {
      ...emptyLiveState().layers,
      media: {mediaId: 'invented-background', loop: true, startedAt: 100},
      slide: {
        itemId: 'invented-item',
        position: 0,
        label: 'Verse',
        lines: ['Invented morning light', 'Invented song of hope'],
      },
      message: {messageId: 'invented-message', text: 'Invented service cue'},
    },
  };
}

/** The largest legal state: every live list and text at its cap, about 3.7 MB. */
export function heavyState(): LiveState {
  const value: unknown = {
    ...emptyLiveState(),
    version: 10,
    stageMessage: 'Invented stage cue',
    outputs: Object.fromEntries([
      ...Array.from({length: 200}, (_, i) => [uuid(i), true] as const),
      ...(['main', 'stage', 'broadcast', 'captions'] as const).map(
        id => [id, true] as const,
      ),
    ]),
    layers: {
      ...emptyLiveState().layers,
      media: {mediaId: 'invented-background', loop: true, startedAt: 100},
      slide: {
        itemId: 'invented-item',
        position: 0,
        label: 'Verse',
        lines: Array.from({length: 1000}, (_, i) =>
          `Invented line ${i}: ${'x'.repeat(3000)}`.slice(0, 3000),
        ),
      },
      message: {
        messageId: 'summary',
        text: '',
        items: Array.from({length: 200}, (_, i) => ({
          messageId: uuid(1000 + i),
          text: `Invented message ${i}: ${'y'.repeat(3000)}`.slice(0, 3000),
          targets: 'all',
          excludedTargets: [],
          startedAt: 100,
          expiresAt: null,
        })),
      },
      notice: {
        noticeId: 'invented-notice',
        playback: {
          media: Array.from({length: 512}, (_, i) => uuid(2000 + i)),
          position: 0,
          interval: 5,
          loop: true,
          targets: [uuid(0)],
          startedAt: 100,
          pausedAt: null,
        },
      },
    },
  };
  const parsed = parseLiveState(value);
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.value;
}
