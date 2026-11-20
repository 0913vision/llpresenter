import {useSyncExternalStore} from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect, it, onTestFinished, vi} from 'vitest';
import {projectSlides} from '@core/presentation/slides';
import {slidesItem} from '@fixtures/core/slides';
import {themeFile, themeScreens} from '@fixtures/core/themeOutput';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {
  fixtureServiceId,
  itemFixture,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {SlideTextFields} from '@renderer/features/service/items/SlideTextFields';
import {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import {SongEditorStore} from '@renderer/features/songs/editor';
import {useShow} from '@renderer/session/show';

it('prefills a theme field, saves its per-slide text, and restores it on clear', async () => {
  const fixture = itemFixture();
  const item = slidesItem('ad');
  const first = item.slides.slides[0];
  if (!first) throw Error('Missing slide');
  const before = fixture.service();
  fixture.pushService({...before, service: {...before.service, order: [item]}});
  const previous = useShow.getState();
  const oldApi = window.llp;
  window.llp = mockLlpApi({
    settings: {
      get: async request => {
        if (request.name === 'themes') {
          return settingsDocument('themes', themeFile(), 1);
        }
        if (request.name === 'screens') {
          return settingsDocument(
            'screens',
            {
              format: 'llsettings.screens',
              schemaVersion: 1,
              screens: themeScreens,
            },
            1,
          );
        }
        return settingsDocument(
          'timers',
          {format: 'llsettings.timers', schemaVersion: 1, timers: []},
          1,
        );
      },
    },
  });
  useShow.setState({
    serviceId: fixtureServiceId,
    openItemId: item.id,
    rows: [{id: item.id, kind: 'slides', form: 'ad', title: item.slides.name}],
    tiles: {[item.id]: projectSlides(item)},
  });
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const items = new ServiceItemStore(fixture.api, editor, vi.fn());
  function Harness() {
    const state = useSyncExternalStore(items.subscribe, items.getSnapshot);
    return <SlideTextFields items={items} state={state} />;
  }
  items.show({serviceId: fixtureServiceId, itemId: item.id});
  const view = render(<Harness />);
  onTestFinished(async () => {
    view.unmount();
    items.dispose();
    await editor.dispose();
    useShow.setState(previous);
    if (oldApi === undefined) delete window.llp;
    else window.llp = oldApi;
  });
  const field = await screen.findByRole<HTMLTextAreaElement>('textbox', {
    name: '슬라이드 이름',
  });
  expect(field.value).toBe('Meeting');
  await userEvent.click(field);
  fireEvent.change(field, {target: {value: 'Changed'}});
  await userEvent.tab();
  await waitFor(() =>
    expect(fixture.service().service.order[0]?.textOverrides).toEqual({
      [`slide:${first.id}`]: {slideName: 'Changed'},
    }),
  );
  await userEvent.click(field);
  fireEvent.change(field, {target: {value: ''}});
  await userEvent.tab();
  await waitFor(() => expect(field.value).toBe('Meeting'));
  expect(fixture.service().service.order[0]?.textOverrides).toEqual({});
});
