import {describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@shared/commands';
import {parseLiveCommand} from '@shared/schema/liveCommand';
import {installFakeClock} from '../../../test/fake-clock';
import type {Logger} from '../log';
import {
  registerSoakScenario,
  scenarioSlide,
  SLIDE_COUNT,
  SLIDE_INTERVAL_MS,
  startSoakScenario,
} from './scenario';

const MEDIA_ID = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b';
const SOAK_ENV = {LLP_SOAK_RECORD: 'D:/soak/record.jsonl'};

function fakeLog(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: async () => undefined,
  };
}

function shownPositions(commands: readonly LiveCommand[]): number[] {
  return commands.flatMap(command =>
    command.type === 'slide.show' ? [command.slide.position] : [],
  );
}

describe('scenarioSlide', () => {
  it('builds 장 that pass the live command check', () => {
    for (let position = 0; position < SLIDE_COUNT; position += 1) {
      const command = {type: 'slide.show', slide: scenarioSlide(position)};
      expect(parseLiveCommand(command).ok).toBe(true);
    }
  });
});

describe('startSoakScenario', () => {
  it('starts the looping background, the 본 화면, and the first 장', () => {
    installFakeClock();
    const commands: LiveCommand[] = [];
    const stop = startSoakScenario({
      dispatch: command => commands.push(command),
      mediaId: MEDIA_ID,
      log: fakeLog(),
    });
    expect(commands).toEqual([
      {type: 'media.show', media: {mediaId: MEDIA_ID, loop: true}},
      {type: 'output.set', screenId: 'main', on: true},
      {type: 'slide.show', slide: scenarioSlide(0)},
    ]);
    stop();
  });

  it('shows the next 장 every interval and starts over after the last', async () => {
    const clock = installFakeClock();
    const commands: LiveCommand[] = [];
    const stop = startSoakScenario({
      dispatch: command => commands.push(command),
      mediaId: null,
      log: fakeLog(),
    });
    await clock.advance(SLIDE_INTERVAL_MS * SLIDE_COUNT);
    expect(shownPositions(commands)).toEqual([
      ...Array.from({length: SLIDE_COUNT}, (_, position) => position),
      0,
    ]);
    stop();
  });

  it('shows no background without a media id', () => {
    installFakeClock();
    const commands: LiveCommand[] = [];
    const stop = startSoakScenario({
      dispatch: command => commands.push(command),
      mediaId: null,
      log: fakeLog(),
    });
    expect(commands.some(command => command.type === 'media.show')).toBe(false);
    stop();
  });

  it('logs a command that throws and keeps changing 장', async () => {
    const clock = installFakeClock();
    const log = fakeLog();
    const positions: number[] = [];
    const stop = startSoakScenario({
      dispatch: command => {
        if (command.type !== 'slide.show') return;
        if (command.slide.position === 1) throw new Error('store broke');
        positions.push(command.slide.position);
      },
      mediaId: null,
      log,
    });
    await clock.advance(SLIDE_INTERVAL_MS * 2);
    expect(positions).toEqual([0, 2]);
    expect(log.error).toHaveBeenCalledWith('soak scenario command failed', {
      type: 'slide.show',
      error: new Error('store broke'),
    });
    stop();
  });

  it('changes no 장 after it stops', async () => {
    const clock = installFakeClock();
    const commands: LiveCommand[] = [];
    const stop = startSoakScenario({
      dispatch: command => commands.push(command),
      mediaId: null,
      log: fakeLog(),
    });
    stop();
    await clock.advance(SLIDE_INTERVAL_MS * 3);
    expect(shownPositions(commands)).toEqual([0]);
  });
});

describe('registerSoakScenario', () => {
  it('does nothing without a soak record', async () => {
    const clock = installFakeClock();
    const dispatch = vi.fn<(command: LiveCommand) => void>();
    const stop = registerSoakScenario(fakeLog(), dispatch, {});
    await clock.advance(SLIDE_INTERVAL_MS * 2);
    expect(dispatch).not.toHaveBeenCalled();
    stop();
  });

  it('does nothing when the soak settings are unusable', () => {
    installFakeClock();
    const dispatch = vi.fn<(command: LiveCommand) => void>();
    const stop = registerSoakScenario(fakeLog(), dispatch, {
      ...SOAK_ENV,
      LLP_SOAK_EXIT_MS: 'soon',
    });
    expect(dispatch).not.toHaveBeenCalled();
    stop();
  });

  it('plays the background that LLP_SOAK_MEDIA_ID names', () => {
    installFakeClock();
    const dispatch = vi.fn<(command: LiveCommand) => void>();
    const stop = registerSoakScenario(fakeLog(), dispatch, {
      ...SOAK_ENV,
      LLP_SOAK_MEDIA_ID: MEDIA_ID,
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'media.show',
      media: {mediaId: MEDIA_ID, loop: true},
    });
    stop();
  });

  it('logs a media id that is not one and runs without a background', () => {
    installFakeClock();
    const log = fakeLog();
    const commands: LiveCommand[] = [];
    const stop = registerSoakScenario(log, command => commands.push(command), {
      ...SOAK_ENV,
      LLP_SOAK_MEDIA_ID: 'loop.webm',
    });
    expect(commands.map(command => command.type)).toEqual([
      'output.set',
      'slide.show',
    ]);
    expect(log.error).toHaveBeenCalledWith(
      'LLP_SOAK_MEDIA_ID is not a media id; the soak scenario runs without a background',
      {value: 'loop.webm'},
    );
    stop();
  });
});
