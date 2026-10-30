import {describe, expect, it} from 'vitest';
import {appEndpoints} from './app';
import {bibleEndpoints} from './bible';
import {contentEndpoints} from './content';
import {libraryEndpoints} from './library';
import {liveEndpoints} from './live';
import {mediaEndpoints} from './media';
import {outputEndpoints} from './output';
import {recoveryEndpoints} from './recovery';
import {serviceEndpoints} from './service';
import {settingsEndpoints} from './settings';
import {uiEndpoints} from './ui';
import {windowEndpoints} from './window';

function channelsOf(table: object): string[] {
  return Object.values(table).flatMap((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const channel: unknown = Reflect.get(entry, 'channel');
    return typeof channel === 'string' ? [channel] : channelsOf(entry);
  });
}

const DECLARED = [
  appEndpoints,
  bibleEndpoints,
  contentEndpoints,
  libraryEndpoints,
  liveEndpoints,
  mediaEndpoints,
  outputEndpoints,
  recoveryEndpoints,
  serviceEndpoints,
  settingsEndpoints,
  uiEndpoints,
  windowEndpoints,
].flatMap(channelsOf);

describe('IPC endpoints', () => {
  it('give every channel to exactly one endpoint', () => {
    expect(new Set(DECLARED).size).toBe(DECLARED.length);
  });

  it('name channels as area:name in lowercase words', () => {
    for (const channel of DECLARED) {
      expect(channel).toMatch(/^[a-z]+(?:-[a-z]+)*(?::[a-z]+(?:-[a-z]+)*)+$/);
    }
  });
});
