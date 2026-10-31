import {act, cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {AppFlushRequest} from '@core/schema/appFlush';
import {createAppFlushRequestId} from '@core/schema/ids';
import type {SettingsEdit} from '@core/schema/settingsDocuments';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {ControlSession} from '@renderer/app/controlSession';
import {ScreenProperties} from './ScreenProperties';
import {useScreensSelection} from './selection';
import {MAIN_ID, screensDocument} from '@core/testing/screenDocuments';

const requestId = createAppFlushRequestId(
  '00000000-0000-4000-8000-000000000001',
);
let session: ControlSession | undefined;

beforeEach(() => {
  useScreensSelection.setState({selection: {kind: 'screen', id: MAIN_ID}});
});

afterEach(async () => {
  cleanup();
  await session?.dispose();
  session = undefined;
  delete window.llp;
});

function setup() {
  let request: (value: AppFlushRequest) => void = () => undefined;
  let release: () => void = () => undefined;
  const held = new Promise<void>(resolve => {
    release = resolve;
  });
  const edits: SettingsEdit[] = [];
  const flushDone = vi.fn();
  const savePending = vi.fn().mockResolvedValue(true);
  window.llp = fakeLlpApi({
    settings: {
      get: () => Promise.resolve(screensDocument()),
      edit: async edit => {
        edits.push(edit);
        await held;
        return {ok: true, value: {id: 'screens', revision: 2}};
      },
    },
    app: {
      subscribeFlushRequests: listener => {
        request = listener;
        return () => undefined;
      },
      savePending,
      flushDone,
    },
  });
  session = new ControlSession(window.llp);
  render(<ScreenProperties />);
  return {
    edits,
    savePending,
    flushDone,
    release,
    request: () => act(() => request({requestId})),
  };
}

describe('closing with focused screen property drafts', () => {
  it.each([
    {role: 'textbox', name: '이름', text: '본당', expected: {name: '본당'}},
    {
      role: 'spinbutton',
      name: '가장자리 여백',
      text: '50',
      expected: {edgeMargin: 20},
    },
    {
      role: 'spinbutton',
      name: '가로 위치',
      text: '20',
      expected: {offset: {x: 20, y: 0}},
    },
    {
      role: 'spinbutton',
      name: '세로 위치',
      text: '30',
      expected: {offset: {x: 0, y: 30}},
    },
  ])(
    'saves $name before answering the close handshake',
    async ({role, name, text, expected}) => {
      const fixture = setup();
      const field = await screen.findByRole(role, {name});
      const user = userEvent.setup();
      await user.clear(field);
      await user.type(field, text);
      expect(document.activeElement).toBe(field);
      expect(fixture.edits).toEqual([]);

      fixture.request();

      await waitFor(() => expect(fixture.edits).toHaveLength(1));
      const edit = fixture.edits[0];
      expect(edit?.name === 'screens' && edit.value.screens[0]).toMatchObject(
        expected,
      );
      expect(fixture.savePending).not.toHaveBeenCalled();
      expect(fixture.flushDone).not.toHaveBeenCalled();
      fixture.release();
      await waitFor(() =>
        expect(fixture.flushDone).toHaveBeenCalledExactlyOnceWith({
          requestId,
          result: true,
        }),
      );
      expect(fixture.savePending).toHaveBeenCalledOnce();
    },
  );

  it('restores an invalid name without sending it during close', async () => {
    const fixture = setup();
    const field = await screen.findByRole('textbox', {name: '이름'});
    await userEvent.clear(field);
    expect(document.activeElement).toBe(field);
    fixture.request();
    await waitFor(() =>
      expect(fixture.flushDone).toHaveBeenCalledWith({requestId, result: true}),
    );
    expect(fixture.edits).toEqual([]);
    expect(field).toHaveProperty('value', '본 화면');
  });
});
