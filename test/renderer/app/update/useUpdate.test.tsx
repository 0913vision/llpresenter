import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
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
  it('keeps the downloaded install question out of live output, then offers install and later', async () => {
    const snapshot: UpdateSnapshot = {
      revision: 1,
      status: {kind: 'downloaded', version: '1.2.3'},
      visible: true,
      outputsOn: true,
      busy: false,
    };
    const view = setup(snapshot);
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByRole('button', {name: '설치'})).toBeNull();
    view.push({...snapshot, revision: 2, outputsOn: false});
    expect(screen.getByRole('alertdialog').textContent).toContain('1.2.3');
    fireEvent.click(screen.getByRole('button', {name: '나중에'}));
    expect(view.send).toHaveBeenCalledWith({revision: 2, action: 'later'});
    fireEvent.click(screen.getByRole('button', {name: '설치'}));
    expect(view.send).toHaveBeenCalledWith({revision: 2, action: 'install'});
  });
  it('allows a download from a live notice and displays percent without a dialog', async () => {
    const snapshot: UpdateSnapshot = {
      revision: 1,
      status: {kind: 'available', version: '1.2.3'},
      visible: true,
      outputsOn: true,
      busy: false,
    };
    const view = setup(snapshot);
    fireEvent.click(await screen.findByRole('button', {name: '내려받기'}));
    expect(view.send).toHaveBeenCalledWith({revision: 1, action: 'download'});
    view.push({
      ...snapshot,
      revision: 2,
      status: {kind: 'downloading', version: '1.2.3', percent: 38},
    });
    expect(screen.getByRole('alert').textContent).toContain('38%');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
