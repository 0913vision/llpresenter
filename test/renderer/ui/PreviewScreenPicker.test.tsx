import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {PreviewScreenPicker} from '@renderer/ui/PreviewScreenPicker';

afterEach(cleanup);

const named = (names: readonly string[]) =>
  names.map((name, index) => ({id: `s${index}`, name}));

describe('PreviewScreenPicker', () => {
  it('shows three short names as segments', () => {
    const onChange = vi.fn();
    render(
      <PreviewScreenPicker
        screens={named(['청중 화면', '무대 화면', '방송 화면'])}
        big="s0"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('radio', {name: '방송 화면'}));
    expect(onChange).toHaveBeenCalledWith('s2');
  });

  it.each([
    ['more screens than fit', named(['가', '나', '다', '라'])],
    [
      'a long name',
      named(['청중 화면', '무대 화면', '긴 이름의 캡처용 방송 화면']),
    ],
  ])(
    'turns into a select for %s, so no choice is out of reach',
    (_, screens) => {
      const onChange = vi.fn();
      render(
        <PreviewScreenPicker screens={screens} big="s0" onChange={onChange} />,
      );
      expect(screen.queryByRole('radiogroup')).toBeNull();
      fireEvent.click(screen.getByRole('button', {name: /미리보기 화면/}));
      const last = screens.at(-1);
      if (last === undefined) throw new Error('Missing screen');
      fireEvent.click(screen.getByRole('menuitemradio', {name: last.name}));
      expect(onChange).toHaveBeenCalledWith(last.id);
    },
  );

  it('keeps fifty screens reachable', () => {
    const screens = named(
      Array.from({length: 50}, (_, index) => `화면 ${index + 1}`),
    );
    render(
      <PreviewScreenPicker screens={screens} big="s0" onChange={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', {name: /미리보기 화면/}));
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(50);
  });
});
