import {cleanup, render, screen, within} from '@testing-library/react';
import {useState, type JSX} from 'react';
import {afterEach, expect, it, vi} from 'vitest';
import {libraryFixture} from '@fixtures/renderer/features/songs/library/libraryFixture';
import {LibraryPanel} from '@renderer/features/songs/library/LibraryPanel';
import {
  PanelActionScope,
  PanelActionTarget,
} from '@renderer/ui/panels/PanelActionSlot';

afterEach(cleanup);

function Palette({
  api,
}: {
  readonly api: ReturnType<typeof libraryFixture>['api'];
}): JSX.Element {
  const [place, setPlace] = useState<HTMLElement | null>(null);
  return (
    <>
      <header aria-label="팔레트 제목 줄">
        <PanelActionTarget onPlace={setPlace} />
      </header>
      <PanelActionScope place={place}>
        <LibraryPanel
          api={api}
          embedded
          onOpenSong={vi.fn()}
          onProblem={vi.fn()}
        />
      </PanelActionScope>
    </>
  );
}

it('has no 라이브러리 title row of its own inside 준비, and puts 새 곡 in the palette row (USER Nov 27)', () => {
  const fixture = libraryFixture([]);
  render(<Palette api={fixture.api} />);
  expect(screen.queryByRole('tab', {name: '라이브러리'})).toBeNull();
  expect(
    within(screen.getByRole('banner', {name: '팔레트 제목 줄'})).getByRole(
      'button',
      {name: '새 곡'},
    ),
  ).toBeTruthy();
});
