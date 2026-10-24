import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeAll, describe, expect, it} from 'vitest';
import {Gallery, galleryEntries, galleryFilter} from './Gallery';

describe('Gallery', () => {
  it('draws a section for every component', () => {
    render(<Gallery only={undefined} />);
    for (const {name} of galleryEntries) {
      expect(screen.getByRole('heading', {level: 2, name})).toBeDefined();
    }
  });

  it('draws only the component that the query names', () => {
    render(<Gallery only="Switch" />);
    expect(screen.getAllByRole('heading', {level: 2})).toHaveLength(1);
    expect(
      screen.getByRole('heading', {level: 2, name: 'Switch'}),
    ).toBeDefined();
  });
});

describe('Gallery menu buttons', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = () => undefined;
  });

  it('opens the 파일 menu and the service picker with ↓', async () => {
    render(<Gallery only="Overlays" />);
    for (const [button, menu] of [
      ['파일', '파일'],
      ['주일 예배', '예배 순서'],
    ] as const) {
      screen.getByRole('button', {name: button}).focus();
      await userEvent.keyboard('{ArrowDown}');
      expect(screen.getByRole('menu', {name: menu})).toBeDefined();
      await userEvent.keyboard('{Escape}');
    }
  });
});

describe('galleryFilter', () => {
  it('reads the component name from the query', () => {
    expect(galleryFilter('?c=Button')).toBe('Button');
    expect(galleryFilter('')).toBeUndefined();
  });
});
