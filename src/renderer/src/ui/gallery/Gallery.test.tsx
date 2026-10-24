import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
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

describe('galleryFilter', () => {
  it('reads the component name from the query', () => {
    expect(galleryFilter('?c=Button')).toBe('Button');
    expect(galleryFilter('')).toBeUndefined();
  });
});
