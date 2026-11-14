import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {UpdateSnapshot} from '@core/schema/update';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {useUpdate} from '@renderer/app/update/useUpdate';
import {NotificationStack} from '@renderer/ui/Notification';
import {useLive} from '@renderer/session/live';

afterEach(() => {
  cleanup();
  useLive.setState({state: null});
});

function setup(snapshot: UpdateSnapshot) {
  let receive: (next: UpdateSnapshot) => void = () => undefined;
  const send = vi.fn();
  const resume = vi.fn();
  const api = mockLlpApi({
    update: {
      get: () => Promise.resolve(snapshot),
      act: send,
      subscribe: listener => {
        receive = listener;
        return () => undefined;
      },
    },
  });
  function View() {
    const update = useUpdate(api.update, resume);
    return (
      <>
        {update.dialog}
        <NotificationStack
          notices={update.notice ? [update.notice] : []}
          onClose={update.dismiss}
        />
      </>
    );
  }
  render(<View />);
  return {
    send,
    resume,
    push: (next: UpdateSnapshot) => act(() => receive(next)),
  };
}

describe('update presentation', () => {
  it('resumes editing after an installation shutdown is cancelled', async () => {
    const snapshot: UpdateSnapshot = {
      revision: 1,
      status: {kind: 'installing', version: '1.2.3'},
      visible: false,
      outputsOn: false,
      busy: false,
    };
    const view = setup(snapshot);
    await act(async () => {
      await Promise.resolve();
    });
    view.push({
      ...snapshot,
      revision: 2,
      status: {kind: 'downloaded', version: '1.2.3'},
      visible: true,
    });
    expect(view.resume).toHaveBeenCalledOnce();
  });
  it('offers an update with an output warning on a manual check', async () => {
    const snapshot: UpdateSnapshot = {
      revision: 1,
      status: {kind: 'available', version: '1.2.3'},
      visible: true,
      outputsOn: true,
      busy: false,
      notice: false,
    };
    const view = setup(snapshot);
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain('1.2.3');
    expect(dialog.textContent).toContain(
      '\uD654\uBA74\uC774 \uAEBC\uC9C0\uACE0',
    );
    fireEvent.click(
      screen.getByRole('button', {name: '\uC5C5\uB370\uC774\uD2B8'}),
    );
    expect(view.send).toHaveBeenCalledWith({revision: 1, action: 'download'});
  });
  it('shows a dismissible launch notice without an update action', async () => {
    const snapshot: UpdateSnapshot = {
      revision: 1,
      status: {kind: 'available', version: '1.2.3'},
      visible: true,
      outputsOn: true,
      busy: false,
      notice: true,
    };
    setup(snapshot);
    expect((await screen.findByRole('alert')).textContent).toContain('1.2.3');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(
      screen.queryByRole('button', {name: '\uC5C5\uB370\uC774\uD2B8'}),
    ).toBeNull();
  });
});
