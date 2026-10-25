import {describe, expect, it} from 'vitest';
import {emptyLiveState} from '../live';
import {parseLiveCommand, parseLiveCommandRequest} from './liveCommand';
import {parseLiveState} from './liveState';
import {
  LIVE_STATE_LIMITS,
  LIVE_OUTPUT_ALIASES,
  LIVE_STATE_BYTE_BUDGET,
} from './liveLimits';
import {
  parseRecoveryRecord,
  serializeRecoveryRecord,
  type RecoveryRecord,
} from './recoveryRecord';
import {expectSuccess} from './testHelpers';

const uuid = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
function state(layers: object = {}, fields: object = {}) {
  const empty = emptyLiveState();
  return {...empty, ...fields, layers: {...empty.layers, ...layers}};
}
function record(value: unknown) {
  return parseRecoveryRecord(
    JSON.stringify({
      format: 'llrecovery',
      schemaVersion: 1,
      savedAt: '2026-10-26T00:00:00.000Z',
      serviceId: null,
      state: value,
    }),
  );
}
function slide() {
  return {itemId: 'item', position: 0, label: null, lines: ['Invented lyric']};
}
function message(text: string) {
  return {
    messageId: uuid(1),
    text,
    targets: 'all',
    excludedTargets: [],
    startedAt: 0,
    expiresAt: null,
  };
}

describe('shared live and recovery limits', () => {
  it.each([
    'slide line',
    'slide label',
    'legacy message',
    'active message',
    'stage message',
    'sent message',
  ])(
    'accepts %s at the text limit and rejects one character more in commands, state, and records',
    kind => {
      for (const length of [
        LIVE_STATE_LIMITS.textCharacters,
        LIVE_STATE_LIMITS.textCharacters + 1,
      ]) {
        const text = '가'.repeat(length);
        const fields = kind === 'stage message' ? {stageMessage: text} : {};
        const layers =
          kind === 'stage message'
            ? {}
            : kind === 'slide line'
              ? {slide: {...slide(), lines: [text]}}
              : kind === 'slide label'
                ? {slide: {...slide(), label: text}}
                : kind === 'active message' || kind === 'sent message'
                  ? {
                      message: {
                        messageId: 'summary',
                        text: '',
                        items: [message(text)],
                      },
                    }
                  : {message: {messageId: 'legacy', text}};
        const command =
          kind === 'stage message'
            ? {type: 'stage.message.set', text}
            : kind === 'sent message'
              ? {type: 'message.send', text, targets: 'all', duration: null}
              : 'slide' in layers
                ? {type: 'slide.show', slide: layers.slide}
                : {type: 'message.show', message: layers.message};
        const accepted = length === LIVE_STATE_LIMITS.textCharacters;
        expect(parseLiveCommand(command).ok).toBe(accepted);
        expect(parseLiveState(state(layers, fields)).ok).toBe(accepted);
        expect(record(state(layers, fields)).ok).toBe(accepted);
        const batch = expectSuccess(
          parseLiveCommandRequest({
            type: 'live.batch',
            commands: [command, {type: 'clear.undo'}],
          }),
        );
        expect(batch.rejected).toHaveLength(accepted ? 0 : 1);
      }
    },
  );

  it('uses the same slide line count for a command, live state, and recovery record', () => {
    for (const count of [
      LIVE_STATE_LIMITS.slideLines,
      LIVE_STATE_LIMITS.slideLines + 1,
    ]) {
      const value = {
        ...slide(),
        lines: Array.from({length: count}, () => 'Invented'),
      };
      const accepted = count === LIVE_STATE_LIMITS.slideLines;
      expect(parseLiveCommand({type: 'slide.show', slide: value}).ok).toBe(
        accepted,
      );
      expect(parseLiveState(state({slide: value})).ok).toBe(accepted);
      expect(record(state({slide: value})).ok).toBe(accepted);
    }
  });

  it('accepts 200 canonical outputs plus all four aliases and rejects one extra canonical output', () => {
    const outputs = Object.fromEntries([
      ...Array.from(
        {length: LIVE_STATE_LIMITS.outputs},
        (_, i) => [uuid(i), true] as const,
      ),
      ...LIVE_OUTPUT_ALIASES.map(alias => [alias, false] as const),
    ]);
    expect(Object.keys(outputs)).toHaveLength(
      LIVE_STATE_LIMITS.outputs + LIVE_OUTPUT_ALIASES.length,
    );
    for (const [key, on] of Object.entries(outputs)) {
      expect(parseLiveCommand({type: 'output.set', screenId: key, on}).ok).toBe(
        true,
      );
    }
    expect(parseLiveState(state({}, {outputs})).ok).toBe(true);
    expect(record(state({}, {outputs})).ok).toBe(true);
    const extra = {...outputs, [uuid(999)]: true};
    expect(parseLiveState(state({}, {outputs: extra})).ok).toBe(false);
    expect(record(state({}, {outputs: extra})).ok).toBe(false);
    const withoutAliases = Object.fromEntries(
      Array.from({length: LIVE_STATE_LIMITS.outputs + 1}, (_, i) => [
        uuid(i),
        true,
      ]),
    );
    expect(parseLiveState(state({}, {outputs: withoutAliases})).ok).toBe(false);
    expect(record(state({}, {outputs: withoutAliases})).ok).toBe(false);
  });

  it('reserves the recovery header at the aggregate live byte budget and rejects one byte more', () => {
    const base = {...emptyLiveState(), futurePadding: ''};
    const size = new TextEncoder().encode(
      `${JSON.stringify({state: base}, null, 2)}\n`,
    ).byteLength;
    const atLimit = {
      ...base,
      futurePadding: 'x'.repeat(LIVE_STATE_BYTE_BUDGET - size),
    };
    expect(parseLiveState(atLimit).ok).toBe(true);
    expect(
      parseLiveState({...atLimit, futurePadding: `${atLimit.futurePadding}x`})
        .ok,
    ).toBe(false);
    const saved = expectSuccess(record(atLimit));
    expect(serializeRecoveryRecord(saved.data).ok).toBe(true);
    const writable: RecoveryRecord = {
      format: 'llrecovery',
      schemaVersion: 1,
      savedAt: '2026-10-26T00:00:00.000Z',
      serviceId: null,
      state: atLimit,
    };
    expect(serializeRecoveryRecord(writable).ok).toBe(true);
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;
    expect(parseLiveState({...emptyLiveState(), future: cyclic}).ok).toBe(
      false,
    );
  });
});
