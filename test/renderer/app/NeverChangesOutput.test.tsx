import {StrictMode} from 'react';
import {
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {editorFixture} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {seedSampleService} from '@fixtures/renderer/session/sampleService';
import {createMemoryColumnWidthStore} from '@renderer/app/shell/columnWidthStore';
import {useLive} from '@renderer/session/live';
import {applyService} from '@renderer/session/show';
import {App} from '@renderer/app/App';
import {useClearKeys} from '@renderer/features/presentation/clearKeys';
import * as clearState from '@renderer/session/clear';
import {Dialog} from '@renderer/ui/Dialog';
import {TextField} from '@renderer/ui/TextField';
import {ControlSession} from '@renderer/app/controlSession';

vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));

const sessions: ControlSession[] = [];

function mountApp() {
  const fixture = editorFixture();
  const send = vi.spyOn(fixture.api.live, 'send');
  const openPreferences = vi.spyOn(fixture.api.window, 'openPreferences');
  window.llp = fixture.api;
  const session = new ControlSession(fixture.api);
  sessions.push(session);
  render(
    <StrictMode>
      <App
        columnWidthStore={createMemoryColumnWidthStore()}
        session={session}
      />
    </StrictMode>,
  );
  return {send, openPreferences};
}

beforeEach(() => {
  seedSampleService();
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(async () => {
  cleanup();
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
  applyService(null);
  useLive.setState({state: null});
  delete window.llp;
  vi.restoreAllMocks();
});

// NOTE(0913vision): Spec 08, "What must never happen during a service": a
// workspace switch and the 환경설정 window never change the output, and F1 to
// F7 work with a dialog open and a text field focused.
it('sends no output command for any workspace switch', () => {
  const {send} = mountApp();

  for (const name of ['준비', '테마', '진행', '준비', '진행']) {
    fireEvent.click(screen.getByRole('tab', {name}));
  }

  expect(send).not.toHaveBeenCalled();
});

it('opens 환경설정 from the 파일 menu without an output command', async () => {
  const {send, openPreferences} = mountApp();

  await userEvent.click(screen.getByRole('menuitem', {name: '파일'}));
  await userEvent.click(screen.getByRole('menuitem', {name: /환경설정/}));

  expect(openPreferences).toHaveBeenCalledOnce();
  expect(send).not.toHaveBeenCalled();
});

it.each(['F1', 'F4', 'F7'])(
  '%s still clears with a dialog open and its text field focused',
  key => {
    const clear = vi
      .spyOn(clearState, 'clearLayer')
      .mockImplementation(() => {});
    const {unmount} = renderHook(() => useClearKeys());
    render(
      <Dialog
        title="이름 바꾸기"
        size="m"
        onCancel={() => {}}
        primary={{label: '확인', onSelect: () => {}}}
      >
        <TextField aria-label="이름" value="" onChange={() => {}} />
      </Dialog>,
    );
    const field = screen.getByRole('textbox', {name: '이름'});
    field.focus();

    field.dispatchEvent(
      new KeyboardEvent('keydown', {
        code: key,
        key: 'Unidentified',
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(clear).toHaveBeenCalledOnce();
    unmount();
  },
);
