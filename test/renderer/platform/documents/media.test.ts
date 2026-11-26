import {expect, it} from 'vitest';
import {createMediaId} from '@core/schema/common/ids';
import {parseMediaDocument} from '@core/schema/media/mediaEdit';
import {THEME_BACKGROUNDS} from '@core/theme';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {unavailableMedia} from '@renderer/platform/documents/media';

const LISTED = createMediaId('00000000-0000-4000-8000-000000000001');
const GONE = createMediaId('00000000-0000-4000-8000-000000000002');

const document = expectSuccess(
  parseMediaDocument({
    name: 'media',
    access: 'editable',
    revision: 1,
    value: {
      format: 'llmedia',
      schemaVersion: 1,
      items: [
        {id: LISTED, name: '십자가', kind: 'image', file: 'cross.png', size: 1},
      ],
      playlists: [],
      audioPlaylists: [],
    },
  }),
);
const view = {document, items: document.value.items, missing: new Set([])};

it('counts a media id the list has no item for as unavailable, as one whose file is missing (USER Nov 26)', () => {
  expect(unavailableMedia(view, LISTED)).toBe(false);
  expect(unavailableMedia(view, GONE)).toBe(true);
  expect(unavailableMedia({...view, missing: new Set([LISTED])}, LISTED)).toBe(
    true,
  );
});

it('never counts a picture that comes with the app, nor anything before the list is read', () => {
  const builtIn = THEME_BACKGROUNDS[0];
  if (builtIn === undefined) throw new Error('No built-in background');
  expect(unavailableMedia(view, createMediaId(builtIn.id))).toBe(false);
  expect(
    unavailableMedia({document: null, items: [], missing: null}, GONE),
  ).toBe(false);
});
