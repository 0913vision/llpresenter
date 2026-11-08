import {afterEach, expect, it, vi} from 'vitest';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {createDefaultThemes} from '@core/themes/defaults';
import {SECTION_THEME_ID, SUNDAY_SECTIONS} from '@core/themes/sundaySections';
import {prepareSection} from '@renderer/features/service/items/quickAddSection';
import type {LlpApi} from '@contracts/ipc/api';

afterEach(() => {
  delete window.llp;
});

function setup(missing = false) {
  const initial = createDefaultThemes();
  const saved = {
    ...initial,
    themes: initial.themes.filter(
      theme => !missing || theme.id !== SECTION_THEME_ID,
    ),
  };
  const themes = settingsDocument('themes', saved, 7);
  const screens = settingsDocument('screens', {
    screens: [
      {
        id: '00000000-0000-4000-8000-000000000999',
        name: '청중',
        kind: 'audience',
        method: 'fullscreen',
      },
    ],
  });
  const edit = vi
    .fn<LlpApi['settings']['edit']>()
    .mockResolvedValue({ok: true, value: {id: 'themes', revision: 8}});
  const preparePictures = vi
    .fn<LlpApi['media']['edit']>()
    .mockResolvedValue({ok: true, value: null});
  window.llp = mockLlpApi({
    media: {edit: preparePictures},
    settings: {
      get: async request => (request.name === 'themes' ? themes : screens),
      edit,
    },
  });
  return {edit, themes, preparePictures};
}

it('prepares every section as a normal editable one-slide item without automatic advance', async () => {
  const {edit} = setup();
  const items = await Promise.all(SUNDAY_SECTIONS.map(prepareSection));
  for (const [index, item] of items.entries()) {
    const section = SUNDAY_SECTIONS[index];
    expect(item).toMatchObject({
      theme: SECTION_THEME_ID,
      background: section?.background,
      slides: {
        form: 'blank',
        name: section?.name,
        slides: [{text: section?.english}],
      },
    });
    expect(item.slides.slides).toHaveLength(1);
    expect(item.slides.advance).toBeUndefined();
    expect(item.slides.loop).toBeUndefined();
  }
  expect(new Set(items.map(item => item.id)).size).toBe(SUNDAY_SECTIONS.length);
  expect(new Set(items.map(item => item.slides.slides[0]?.id)).size).toBe(
    SUNDAY_SECTIONS.length,
  );
  expect(edit).not.toHaveBeenCalled();
});

it('adds a missing theme for the configured screens while keeping saved themes and defaults', async () => {
  const {edit, themes} = setup(true);
  const section = SUNDAY_SECTIONS[0];
  if (section === undefined || themes.name !== 'themes') {
    throw Error('Missing fixture');
  }
  await prepareSection(section);
  expect(edit).toHaveBeenCalledOnce();
  const change = edit.mock.calls[0]?.[0];
  if (change?.type !== 'settings.update' || change.name !== 'themes') {
    throw Error('Missing theme update');
  }
  expect(change).toMatchObject({
    type: 'settings.update',
    name: 'themes',
    baseRevision: 7,
    value: {defaults: themes.value.defaults},
  });
  expect(change.value.themes.slice(0, -1)).toEqual(themes.value.themes);
  expect(change.value.themes.at(-1)).toMatchObject({
    id: SECTION_THEME_ID,
    screens: {'00000000-0000-4000-8000-000000000999': {mode: {kind: 'own'}}},
  });
});

it('does not return an item when saving its missing theme is refused', async () => {
  const {edit} = setup(true);
  edit.mockResolvedValueOnce({
    ok: false,
    error: {reason: 'stale', message: 'Conflict'},
  });
  const section = SUNDAY_SECTIONS[0];
  if (section === undefined) throw Error('Missing fixture');
  await expect(prepareSection(section)).rejects.toThrow(
    'Could not add the section theme',
  );
});

it('prepares the bundled pictures before returning an item and stops if preparation fails', async () => {
  const {edit, preparePictures} = setup();
  const section = SUNDAY_SECTIONS[0];
  if (section === undefined) throw Error('Missing fixture');
  await prepareSection(section);
  expect(preparePictures).toHaveBeenCalledWith({
    type: 'media.sections.prepare',
  });
  preparePictures.mockResolvedValueOnce({
    ok: false,
    error: {reason: 'read-only', message: 'Cannot prepare pictures'},
  });
  await expect(prepareSection(section)).rejects.toThrow(
    'Could not prepare section pictures',
  );
  expect(edit).not.toHaveBeenCalled();
});
