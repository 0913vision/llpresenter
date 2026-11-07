import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {expect, it, onTestFinished, vi} from 'vitest';
import type {EditResult} from '@core/schema/contentEdit';
import {editorFixture} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';
import {LabelManagerDialog} from '@renderer/features/songs/editor/LabelManagerDialog';

function diskFailure(result: EditResult): EditResult {
  if (!result.ok) throw Error('Fixture rename did not apply');
  return {
    ok: false,
    error: {
      reason: 'write-failed',
      message: 'Invented disk failure',
      applied: result.value,
      unchangedFiles: ['fixture.json'],
    },
  };
}

it.each([
  {kind: 'label', recovery: 'retry'},
  {kind: 'label', recovery: 'correct'},
] as const)(
  'recovers the applied $kind identity through $recovery',
  async ({recovery}) => {
    const fixture = editorFixture();
    const originalContent = fixture.api.content.edit;
    let retries = 0;
    let settingsFailed = false;
    vi.spyOn(fixture.api.content, 'edit').mockImplementation(async command => {
      if (command.type === 'saves.retry') {
        retries++;
        const result = await originalContent(command);
        return retries === 1 ? diskFailure(result) : result;
      }
      const result = await originalContent(command);
      return result;
    });
    const originalSettings = fixture.api.settings.edit;
    const settings = vi
      .spyOn(fixture.api.settings, 'edit')
      .mockImplementation(async command => {
        const result = await originalSettings(command);
        if (command.type === 'labels.rename' && !settingsFailed) {
          settingsFailed = true;
          return diskFailure(result);
        }
        return result;
      });
    const store = new SongEditorStore(fixture.api, vi.fn());
    store.open(fixture.first);
    await waitFor(() => expect(store.getSnapshot().labels).not.toBeNull());
    const close = vi.fn();
    function Dialog() {
      return <LabelManagerDialog store={store} onClose={close} />;
    }
    const view = render(<Dialog />);
    onTestFinished(async () => {
      view.unmount();
      await store.dispose();
    });
    const field = screen.getByRole('textbox', {
      name: '1절 이름',
    });
    const save = (): void => {
      fireEvent.keyDown(field, {key: 'Enter'});
    };
    const expectAccepted = async (name: string): Promise<void> => {
      await waitFor(() => {
        const input = screen.getByRole('textbox', {name: `${name} 이름`});
        expect(input).toHaveProperty('value', name);
        expect(input.getAttribute('aria-invalid')).not.toBe('true');
      });
      expect(close).not.toHaveBeenCalled();
    };
    fireEvent.change(field, {target: {value: '새 이름'}});
    save();
    await waitFor(() => {
      expect(field.getAttribute('aria-invalid')).toBe('true');
      expect(field).toHaveProperty('readOnly', false);
    });
    const revision = store.getSnapshot().labels?.revision;
    expect(revision).toBe(2);
    if (recovery === 'correct') {
      fireEvent.change(field, {target: {value: '고친 이름'}});
      save();
      await expectAccepted('고친 이름');

      expect(settings.mock.calls.at(-1)?.[0]).toMatchObject({
        type: 'labels.rename',
        from: '새 이름',
        to: '고친 이름',
        baseRevision: 2,
      });
      return;
    }
    save();
    await waitFor(() => {
      expect(retries).toBe(1);
      expect(field).toHaveProperty('readOnly', false);
    });
    expect(close).not.toHaveBeenCalled();
    expect(field).toHaveProperty('value', '새 이름');
    save();
    await expectAccepted('새 이름');
    expect(retries).toBe(2);

    expect(store.getSnapshot().labels?.revision).toBe(revision);
  },
);
