import {act, cleanup, render} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import {classes} from '@renderer/render/classes';
import {editorFixture} from './editorFixture';
import {editorPreviewFixture} from './editorPreviewFixture';
import {SongPreviewFrame} from './SongPreview';

afterEach(cleanup);

it('keeps the mounted current picture instant through separate Look, screen and label redraws', async () => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      disconnect = vi.fn();
    },
  );
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockReturnValue(undefined);
  const fixture = editorFixture();
  const documents = editorPreviewFixture();
  const pending = new Map<string, (document: SettingsDocument) => void>();
  vi.spyOn(fixture.api.settings, 'get').mockImplementation(
    ({name}) => new Promise(resolve => pending.set(name, resolve)),
  );
  const picture = {
    song: fixture.first.song,
    block: 0,
    background: undefined,
    position: 1,
    total: 2,
  };
  const view = render(
    <SongPreviewFrame
      settings={fixture.api.settings}
      labels={[]}
      picture={picture}
    />,
  );
  const root = () => view.container.querySelector(`.${classes.root}`);
  expect(root()?.classList.contains(classes.instant)).toBe(true);
  await act(async () => {
    pending.get('looks')?.(documents.looks);
  });
  expect(root()?.classList.contains(classes.instant)).toBe(true);
  await act(async () => {
    pending.get('screens')?.(documents.screens);
  });
  expect(root()?.classList.contains(classes.instant)).toBe(true);
  view.rerender(
    <SongPreviewFrame
      settings={fixture.api.settings}
      labels={[{name: 'Fixture label', color: 'none', key: null}]}
      picture={picture}
    />,
  );
  expect(root()?.classList.contains(classes.instant)).toBe(true);
  view.rerender(
    <SongPreviewFrame
      settings={fixture.api.settings}
      labels={[]}
      picture={{...picture, block: 1, position: 2}}
    />,
  );
  expect(root()?.classList.contains(classes.instant)).toBe(false);
});
