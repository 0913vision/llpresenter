import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {CLICK_FOCUS_SELECTOR} from './clickFocus';
import {
  MediaGrid,
  MediaStrip,
  MediaTile,
  copyingText,
  type MediaTileProps,
} from './MediaTile';
import {missingFileText} from './MissingFile';
import {hoverForTooltip, resetTooltips} from './tooltipTesting';
import styles from './MediaTile.module.css';

afterEach(resetTooltips);

const COLUMNS = 2;
const PATH = 'D:\\예배 미디어\\배경\\따뜻한 빛.mp4';

const library: readonly MediaTileProps[] = [
  {name: '따뜻한 빛', picture: 'blob:warm', duration: '0:30', loop: true},
  {name: '새벽 하늘', picture: 'blob:dawn', duration: '1:00', loop: true},
  {name: '부활절 배경.mp4', picture: 'blob:easter', copying: 62},
  {name: '11월 1일 광고', picture: 'blob:notice'},
];

function one(props: MediaTileProps): HTMLElement {
  render(
    <MediaStrip
      label="배경 영상"
      selected={undefined}
      onSelect={() => {}}
      onActivate={() => {}}
    >
      <MediaTile {...props} />
    </MediaStrip>,
  );
  return screen.getByRole('option');
}

function Grid({
  onActivate = () => {},
  onOutput = () => {},
}: {
  readonly onActivate?: (index: number) => void;
  readonly onOutput?: (index: number) => void;
}): JSX.Element {
  const [selected, setSelected] = useState(0);
  return (
    <MediaGrid
      label="배경 영상"
      columns={COLUMNS}
      selected={selected}
      onSelect={setSelected}
      onActivate={onActivate}
      onOutput={onOutput}
    >
      {library.map((media, index) => (
        <MediaTile key={media.name} {...media} selected={index === selected} />
      ))}
    </MediaGrid>
  );
}

function tile(name: string): HTMLElement {
  return screen.getByRole('option', {name});
}

describe('MediaTile', () => {
  it('shows the picture, a looping duration, and the name', () => {
    const option = one(library[0] ?? {name: ''});
    expect(option.getAttribute('aria-label')).toBe('따뜻한 빛');
    expect(option.querySelector('img')?.getAttribute('src')).toBe('blob:warm');
    expect(option.textContent).toBe('0:30따뜻한 빛');
    expect(option.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
  });

  it('writes no duration for an image', () => {
    const option = one({name: '11월 1일 광고', picture: 'blob:notice'});
    expect(option.textContent).toBe('11월 1일 광고');
  });

  it('accepts a paused video element and hides it for a missing file', () => {
    const picture = <video muted preload="metadata" aria-hidden="true" />;
    const {rerender} = render(
      <MediaTile name="새 영상" picture={picture} duration="0:30" loop />,
    );
    const option = screen.getByRole('option', {name: '새 영상'});
    const video = option.querySelector('video');
    expect(video?.muted).toBe(true);
    expect(video?.autoplay).toBe(false);
    expect(video?.preload).toBe('metadata');
    if (!video?.parentElement) throw new Error('Missing preview fill wrapper');
    expect(video.parentElement.className).toBe(styles.picture);
    expect(video.parentElement.parentElement?.tagName).toBe('SPAN');
    expect(option.textContent).toBe('0:30새 영상');
    rerender(<MediaTile name="새 영상" picture={picture} missingFile={PATH} />);
    expect(option.querySelector('video')).toBeNull();
    expect(option.getAttribute('data-state')).toBe('warning');
  });

  it('marks live, the missing file, and copying in data-state', () => {
    const {rerender} = render(<MediaTile name="별빛" live />);
    const option = (): HTMLElement => screen.getByRole('option');
    expect(option().getAttribute('data-state')).toBe('live');
    rerender(<MediaTile name="별빛" live missingFile={PATH} />);
    expect(option().getAttribute('data-state')).toBe('live warning');
    rerender(<MediaTile name="별빛" copying={10} />);
    expect(option().getAttribute('data-state')).toBe('busy');
    rerender(<MediaTile name="별빛" selected />);
    expect(option().getAttribute('data-state')).toBe(null);
    expect(option().getAttribute('aria-selected')).toBe('true');
  });

  it('shows the warning instead of the picture when the file is missing', async () => {
    const option = one({
      name: '따뜻한 빛',
      picture: 'blob:warm',
      duration: '0:30',
      missingFile: PATH,
    });
    expect(option.querySelector('img')).toBe(null);
    expect(option.textContent).toBe('따뜻한 빛');
    expect((await hoverForTooltip(option))?.textContent).toBe(
      missingFileText(PATH),
    );
  });

  it('shows the copy progress instead of the duration and is disabled', async () => {
    const option = one({
      name: '부활절 배경.mp4',
      picture: 'blob:easter',
      duration: '0:30',
      copying: 62.4,
    });
    expect(option.getAttribute('aria-disabled')).toBe('true');
    expect(option.textContent).toBe('62%부활절 배경.mp4');
    const bar = screen.getByRole('progressbar', {name: '부활절 배경.mp4 복사'});
    expect(bar.getAttribute('aria-valuenow')).toBe('62');
    expect((await hoverForTooltip(option))?.textContent).toBe('복사 중 62%');
  });

  it('writes the copy tooltip as a whole percentage', () => {
    expect(copyingText(7.6)).toBe('복사 중 8%');
    expect(copyingText(130)).toBe('복사 중 100%');
  });
});

describe('MediaGrid', () => {
  it('sets the column count', () => {
    render(<Grid />);
    const grid = screen.getByRole('listbox', {name: '배경 영상'});
    expect(grid.style.getPropertyValue('--media-columns')).toBe(`${COLUMNS}`);
  });

  it('selects on a click and sends out on a double click', async () => {
    const onActivate = vi.fn<(index: number) => void>();
    const onOutput = vi.fn<(index: number) => void>();
    render(<Grid onActivate={onActivate} onOutput={onOutput} />);
    await userEvent.click(tile('새벽 하늘'));
    await userEvent.dblClick(tile('11월 1일 광고'));
    await userEvent.dblClick(tile('부활절 배경.mp4'));
    expect(onActivate.mock.calls).toEqual([[1], [3], [3]]);
    expect(onOutput.mock.calls).toEqual([[3]]);
  });

  it('moves by a row with ↑ and ↓', async () => {
    render(<Grid />);
    tile('따뜻한 빛').focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(tile('부활절 배경.mp4'));
    await userEvent.keyboard('{ArrowRight}{ArrowUp}');
    expect(document.activeElement).toBe(tile('새벽 하늘'));
  });
});

describe('MediaStrip', () => {
  it('sends out on a click and Enter but passes Space on', async () => {
    const onActivate = vi.fn<(index: number) => void>();
    render(
      <MediaStrip
        label="미디어"
        selected={0}
        onSelect={() => {}}
        onActivate={onActivate}
      >
        {library.map((media, index) => (
          <MediaTile key={media.name} {...media} selected={index === 0} />
        ))}
      </MediaStrip>,
    );
    await userEvent.click(tile('새벽 하늘'));
    tile('따뜻한 빛').focus();
    await userEvent.keyboard('{Enter} ');
    expect(onActivate.mock.calls).toEqual([[1], [0]]);
    expect(tile('새벽 하늘').closest(CLICK_FOCUS_SELECTOR)).toBe(null);
    expect(
      screen
        .getByRole('listbox', {name: '미디어'})
        .getAttribute('data-workspace'),
    ).toBe('show');
  });
});
