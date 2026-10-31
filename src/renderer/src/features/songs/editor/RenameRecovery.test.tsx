import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {useSyncExternalStore} from 'react';
import {expect, it, onTestFinished, vi} from 'vitest';
import type {EditResult} from '@core/schema/contentEdit';
import type {Label} from '@core/schema/labels';
import {editorFixture} from './editorFixture';
import {SongEditorStore} from './songEditorStore';
import {ArrangementDialog} from './ArrangementDialog';
import {LabelDialog} from './LabelDialog';

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
  {kind: 'arrangement', recovery: 'retry'},
  {kind: 'label', recovery: 'retry'},
  {kind: 'arrangement', recovery: 'correct'},
  {kind: 'label', recovery: 'correct'},
] as const)(
  'recovers the applied $kind identity through $recovery',
  async ({kind, recovery}) => {
    const fixture = editorFixture();
    const originalContent = fixture.api.content.edit;
    let retries = 0;
    let contentFailed = false;
    let settingsFailed = false;
    const content = vi
      .spyOn(fixture.api.content, 'edit')
      .mockImplementation(async command => {
        if (command.type === 'saves.retry') {
          retries++;
          const result = await originalContent(command);
          return retries === 1 ? diskFailure(result) : result;
        }
        const result = await originalContent(command);
        if (
          kind === 'arrangement' &&
          command.type === 'song.arrangement.rename' &&
          !contentFailed
        ) {
          contentFailed = true;
          return diskFailure(result);
        }
        return result;
      });
    const originalSettings = fixture.api.settings.edit;
    const settings = vi
      .spyOn(fixture.api.settings, 'edit')
      .mockImplementation(async command => {
        const result = await originalSettings(command);
        if (
          kind === 'label' &&
          command.type === 'labels.rename' &&
          !settingsFailed
        ) {
          settingsFailed = true;
          return diskFailure(result);
        }
        return result;
      });
    const store = new SongEditorStore(fixture.api, vi.fn());
    store.open(fixture.first);
    await waitFor(() => expect(store.getSnapshot().labels).not.toBeNull());
    const label = store
      .getSnapshot()
      .labels?.value.labels.find(label => label.name === '1절');
    if (label === undefined) throw Error('Missing label');
    const close = vi.fn();
    function Dialog({initialLabel}: {readonly initialLabel: Label}) {
      const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
      return kind === 'arrangement' ? (
        <ArrangementDialog
          name="주일용"
          names={
            state.session?.history.snapshot.song.arrangements?.map(
              item => item.name,
            ) ?? []
          }
          store={store}
          locked={state.busy}
          onClose={close}
        />
      ) : (
        <LabelDialog
          label={initialLabel}
          labels={state.labels?.value.labels ?? []}
          store={store}
          busy={state.busy}
          onClose={close}
        />
      );
    }
    const view = render(<Dialog initialLabel={label} />);
    onTestFinished(async () => {
      view.unmount();
      await store.dispose();
    });
    const field = screen.getByRole('textbox');
    const save = screen.getByRole('button', {name: '저장'});
    fireEvent.change(field, {target: {value: '새 이름'}});
    fireEvent.click(save);
    await waitFor(() => {
      expect(field.getAttribute('aria-invalid')).toBe('true');
      expect(save.getAttribute('aria-disabled')).not.toBe('true');
    });
    const revision =
      kind === 'label'
        ? store.getSnapshot().labels?.revision
        : store.getSnapshot().session?.document.revision;
    expect(revision).toBe(2);
    if (recovery === 'correct') {
      fireEvent.change(field, {target: {value: '고친 이름'}});
      fireEvent.click(save);
      await waitFor(() => expect(close).toHaveBeenCalledOnce());
      if (kind === 'label') {
        expect(settings.mock.calls.at(-1)?.[0]).toMatchObject({
          type: 'labels.rename',
          from: '새 이름',
          to: '고친 이름',
          baseRevision: 2,
        });
      } else {
        expect(content.mock.calls.at(-1)?.[0]).toMatchObject({
          type: 'song.arrangement.rename',
          from: '새 이름',
          to: '고친 이름',
        });
      }
      return;
    }
    fireEvent.click(save);
    await waitFor(() => {
      expect(retries).toBe(1);
      expect(save.getAttribute('aria-disabled')).not.toBe('true');
    });
    expect(close).not.toHaveBeenCalled();
    expect(field).toHaveProperty('value', '새 이름');
    fireEvent.click(save);
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(retries).toBe(2);
    expect(
      content.mock.calls.filter(
        ([command]) => command.type === 'song.arrangement.rename',
      ),
    ).toHaveLength(kind === 'arrangement' ? 1 : 0);
    expect(
      kind === 'label'
        ? store.getSnapshot().labels?.revision
        : store.getSnapshot().session?.document.revision,
    ).toBe(revision);
  },
);
