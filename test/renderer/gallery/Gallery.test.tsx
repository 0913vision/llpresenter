import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {Gallery} from '@renderer/gallery/Gallery';

describe('Gallery', () => {
  it('draws only the component that the query names', () => {
    render(<Gallery only="Checkbox" />);
    expect(screen.getAllByRole('heading', {level: 2})).toHaveLength(1);
    expect(
      screen.getByRole('heading', {level: 2, name: 'Checkbox'}),
    ).toBeDefined();
  });
});
