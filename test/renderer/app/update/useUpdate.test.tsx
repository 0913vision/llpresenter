import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  it('focuses retry when a download fails so Enter retries', async () => {
    const snapshot: UpdateSnapshot = {
      revision: 1,
      status: {kind: 'downloading', version: '1.2.3', percent: 42},
      visible: true,
      outputsOn: false,
      busy: false,
    };
    const view = setup(snapshot);
    await screen.findByRole('progressbar');
    view.push({
      ...snapshot,
      revision: 2,
      status: {
        kind: 'error',
        stage: 'download',
        version: '1.2.3',
        reason: 'Offline',
      },
    });
    const retry = screen.getByRole('button', {name: '다시 시도'});
    expect(document.activeElement).toBe(retry);
    await userEvent.keyboard('{Enter}');
    expect(view.send).toHaveBeenCalledWith({revision: 2, action: 'retry'});
  });
  it('shows version, download progress and installation steps through restart', async () => {
    const snapshot: UpdateSnapshot = {
      revision: 1,
      status: {kind: 'downloading', version: '1.2.3', percent: 42},
      visible: true,
      outputsOn: false,
      busy: false,
    };
    const view = setup(snapshot);
    const progress = await screen.findByRole('progressbar', {
      name: '업데이트 내려받기',
    });
    expect(progress.getAttribute('aria-valuenow')).toBe('42');
    expect(screen.getByRole('alertdialog').textContent).toContain('1.2.3');
    expect(
      screen
        .getByText('내려받는 중')
        .closest('li')
        ?.getAttribute('aria-current'),
    ).toBe('step');
    view.push({
      ...snapshot,
      revision: 2,
      status: {kind: 'installing', version: '1.2.3'},
    });
    expect(
      screen.getByText('설치 준비').closest('li')?.getAttribute('aria-current'),
    ).toBe('step');
    view.push({
      ...snapshot,
      revision: 3,
      status: {kind: 'restarting', version: '1.2.3'},
    });
    expect(
      screen.getByText('다시 시작').closest('li')?.getAttribute('aria-current'),
    ).toBe('step');
  });
  it('offers a retry after a download failure', async () => {
    const snapshot: UpdateSnapshot = {
      revision: 1,
      status: {
        kind: 'error',
        stage: 'download',
        version: '1.2.3',
        reason: 'Offline',
      },
      visible: true,
      outputsOn: false,
      busy: false,
    };
    const view = setup(snapshot);
    expect((await screen.findByRole('alertdialog')).textContent).toContain(
      '내려받기 실패',
    );
    fireEvent.click(screen.getByRole('button', {name: '다시 시도'}));
    expect(view.send).toHaveBeenCalledWith({revision: 1, action: 'retry'});
  });
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
    expect(dialog.textContent).toContain('화면이 꺼지고');
    fireEvent.click(screen.getByRole('button', {name: '업데이트'}));
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
    const view = setup(snapshot);
    expect((await screen.findByRole('status')).textContent).toContain('1.2.3');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByRole('button', {name: '업데이트'})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: '알림 닫기'}));
    expect(view.send).toHaveBeenCalledWith({revision: 1, action: 'dismiss'});
  });
});
