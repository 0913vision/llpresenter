import type {LiveCommand} from '@shared/commands';
import type {SlideLayer} from '@shared/live';
import {mediaIdSchema} from '@shared/schema/ids';
import {parsePayload} from '@shared/schema/payload';
import type {Logger} from '../log';
import {MAIN_SCREEN_ID} from '../outputs/defaultScreens';
import {readSoakSettings} from './recorder';

/** How often the scenario shows the next 장 (qa's SK2). */
export const SLIDE_INTERVAL_MS = 5000;

/** How many 장 the scenario cycles through. */
export const SLIDE_COUNT = 12;

const SCENARIO_ITEM_ID = 'soak-scenario';
const SLIDE_LABELS = ['1절', '후렴', null] as const;

/** What the soak scenario needs from the app. */
export interface SoakScenario {
  /** Hands a command to the live state, as a window's command would be. */
  readonly dispatch: (command: LiveCommand) => void;
  /** The looping background's id in the media library, or `null` for none. */
  readonly mediaId: string | null;
  readonly log: Logger;
}

/**
 * The scenario's 장 at a position: an invented two-line 장 with a rotating
 * 이름표, so no lyrics are copied.
 */
export function scenarioSlide(position: number): SlideLayer {
  const number = position + 1;
  return {
    itemId: SCENARIO_ITEM_ID,
    position,
    label: SLIDE_LABELS[position % SLIDE_LABELS.length] ?? null,
    lines: [
      `시험 장 ${number}의 첫째 줄입니다`,
      `반복되는 배경 위에 둘째 줄이 놓입니다`,
    ],
  };
}

function send(scenario: SoakScenario, command: LiveCommand): void {
  try {
    scenario.dispatch(command);
  } catch (error) {
    scenario.log.error('soak scenario command failed', {
      type: command.type,
      error,
    });
  }
}

/**
 * Plays the soak test scenario: the looping background, the 본 화면 on, and
 * the next 장 every {@link SLIDE_INTERVAL_MS}, around {@link SLIDE_COUNT} 장.
 * A command that throws is logged, and the scenario goes on.
 *
 * @returns a function that stops the 장 changes
 */
export function startSoakScenario(scenario: SoakScenario): () => void {
  if (scenario.mediaId !== null) {
    send(scenario, {
      type: 'media.show',
      media: {mediaId: scenario.mediaId, loop: true},
    });
  }
  send(scenario, {type: 'output.set', screenId: MAIN_SCREEN_ID, on: true});
  let position = 0;
  send(scenario, {type: 'slide.show', slide: scenarioSlide(position)});
  const changer = setInterval(() => {
    position = (position + 1) % SLIDE_COUNT;
    send(scenario, {type: 'slide.show', slide: scenarioSlide(position)});
  }, SLIDE_INTERVAL_MS);
  scenario.log.info('soak scenario started', {mediaId: scenario.mediaId});
  return () => clearInterval(changer);
}

/**
 * Starts the soak scenario when the soak runner asked for a record
 * (`LLP_SOAK_RECORD` with a usable `LLP_SOAK_EXIT_MS`). The background comes
 * from `LLP_SOAK_MEDIA_ID`. Does nothing otherwise. Call it once the outputs
 * have started.
 *
 * @returns a function that stops the scenario
 */
export function registerSoakScenario(
  log: Logger,
  dispatch: (command: LiveCommand) => void,
  env: NodeJS.ProcessEnv = process.env,
): () => void {
  if (readSoakSettings(env).kind !== 'on') return () => undefined;
  return startSoakScenario({dispatch, mediaId: backgroundId(env, log), log});
}

function backgroundId(env: NodeJS.ProcessEnv, log: Logger): string | null {
  const text = env['LLP_SOAK_MEDIA_ID'] ?? '';
  if (text === '') return null;
  if (parsePayload(mediaIdSchema, text).ok) return text;
  log.error(
    'LLP_SOAK_MEDIA_ID is not a media id; the soak scenario runs without a background',
    {value: text},
  );
  return null;
}
