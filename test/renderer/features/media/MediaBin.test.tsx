import {act, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  mediaBinToggle,
  mediaDocument,
  mediaFixture,
  mediaId,
  mediaItem,
  playlistId,
} from '@fixtures/renderer/features/media/mediaTesting';
import {MediaBin} from '@renderer/features/media/MediaBin';
import {MediaViewProvider} from '@renderer/features/media/MediaViewProvider';

function Host({initial}: {readonly initial: boolean}): JSX.Element {
  const [open, setOpen] = useState(initial);
  return (
    <MediaBin
      workspace="show"
      onProblem={vi.fn()}
      open={open}
      onOpenChange={setOpen}
    />
  );
}

function setup(fixture = mediaFixture(), open = false) {
  window.llp = fixture.api;
  render(
    <MediaViewProvider api={fixture.api} onProblem={vi.fn()}>
      <Host initial={open} />
    </MediaViewProvider>,
  );
  return fixture;
}

afterEach(() => {
  delete window.llp;
});

describe('MediaBin', () => {
  it('opens from its summary bar and collapses back with keyboard focus on the toggle', async () => {
    setup(mediaFixture(mediaDocument([mediaItem(1), mediaItem(2)])));
    const bar = screen.getByRole('button', {name: '미디어 펼치기'});
    await vi.waitFor(() => expect(bar.textContent).toBe('미디어모든 미디어 2'));

    bar.focus();
    await userEvent.keyboard('{Enter}');
    const collapse = screen.getByRole('button', {name: '미디어 접기'});
    expect(document.activeElement).toBe(collapse);
    await userEvent.keyboard('{Enter}');

    expect(screen.queryByRole('region', {name: '미디어 보관함'})).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '미디어 펼치기'}),
    );
  });

  it('updates the collapsed count from a media push without mounting the bin', async () => {
    const fixture = setup(mediaFixture(mediaDocument([mediaItem(1)])));
    await vi.waitFor(() =>
      expect(mediaBinToggle().textContent).toBe('미디어모든 미디어 1'),
    );

    act(() =>
      fixture.pushDocument(mediaDocument([mediaItem(1), mediaItem(2)], 2)),
    );

    expect(mediaBinToggle().textContent).toBe('미디어모든 미디어 2');
    expect(screen.queryByRole('region', {name: '미디어 속성'})).toBeNull();
  });

  it('keeps the chosen playlist and the selected media when collapsed and opened again', async () => {
    setup(
      mediaFixture(
        mediaDocument(
          [
            mediaItem(1, {
              name: 'First image',
              kind: 'image',
              file: 'first.png',
            }),
            mediaItem(2, {
              name: 'Second image',
              kind: 'image',
              file: 'second.png',
            }),
          ],
          1,
          {
            playlists: [
              {
                id: playlistId(1),
                name: 'Target',
                items: [mediaId(1), mediaId(2)],
              },
            ],
          },
        ),
      ),
      true,
    );
    const bin = screen.getByRole('region', {name: '미디어 보관함'});
    const playlists = within(bin).getByRole('listbox', {name: '미디어 목록'});
    await userEvent.click(
      await within(playlists).findByRole('option', {name: /Target/}),
    );
    await userEvent.click(
      await within(bin).findByRole('option', {name: 'Second image'}),
    );

    await userEvent.click(mediaBinToggle());
    expect(mediaBinToggle().textContent).toBe('미디어Target 2');
    await userEvent.click(mediaBinToggle());

    expect(
      await screen.findByRole('option', {name: 'Second image', selected: true}),
    ).toBeDefined();
    const properties = screen.getByRole('region', {name: '미디어 속성'});
    expect(within(properties).getByText('Second image')).toBeDefined();
  });
});
