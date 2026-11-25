import {act, render, renderHook, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, expect, it} from 'vitest';
import {SlideSidePanel} from '@renderer/features/slides/SlideSidePanel';
import {usePreviewScreen} from '@renderer/features/slides/SlidePreview';
import {useThemes} from '@renderer/platform/documents/themes';
import {themes, themeScreens} from '@fixtures/core/themeOutput';

beforeEach(() => {
  useThemes.setState({themes: themes(), screens: themeScreens});
});

function Panel() {
  const choice = usePreviewScreen();
  return (
    <SlideSidePanel label="세부정보" screen={choice}>
      <ul aria-label="그리는 화면">
        {choice.views.map(view => (
          <li key={view.id}>{view.name ?? view.role}</li>
        ))}
      </ul>
    </SlideSidePanel>
  );
}

it('offers every screen and 전체, and 전체 draws every screen with its name, as 진행 does', async () => {
  render(<Panel />);
  const options = screen
    .getAllByRole('radio')
    .map(option => option.textContent);
  expect(options.at(-1)).toBe('전체');
  expect(options.length).toBe(themeScreens.length + 1);
  expect(screen.getAllByRole('listitem')).toHaveLength(1);

  await userEvent.click(screen.getByRole('radio', {name: '전체'}));

  expect(screen.getAllByRole('listitem')).toHaveLength(themeScreens.length);
});

it('keeps the choice for every panel of 준비', () => {
  const first = renderHook(() => usePreviewScreen());
  act(() => first.result.current.select('all'));

  const second = renderHook(() => usePreviewScreen());

  expect(second.result.current.value).toBe('all');
  act(() => first.result.current.select(''));
});
