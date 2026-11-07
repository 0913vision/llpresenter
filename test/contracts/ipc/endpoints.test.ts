import {describe, expect, it} from 'vitest';
import {appEndpoints} from '@contracts/ipc/app';
import {bibleEndpoints} from '@contracts/ipc/bible';
import {contentEndpoints} from '@contracts/ipc/content';
import {libraryEndpoints} from '@contracts/ipc/library';
import {liveEndpoints} from '@contracts/ipc/live';
import {mediaEndpoints} from '@contracts/ipc/media';
import {outputEndpoints} from '@contracts/ipc/output';
import {recoveryEndpoints} from '@contracts/ipc/recovery';
import {serviceEndpoints} from '@contracts/ipc/service';
import {settingsEndpoints} from '@contracts/ipc/settings';
import {songEditorWindowEndpoints} from '@contracts/ipc/songEditorWindow';
import {slidesEditorEndpoints} from '@contracts/ipc/slidesEditor';
import {uiEndpoints} from '@contracts/ipc/ui';
import {windowEndpoints} from '@contracts/ipc/window';

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
  songEditorWindowEndpoints,
  slidesEditorEndpoints,
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
