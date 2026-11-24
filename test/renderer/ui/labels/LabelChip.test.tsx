import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {LabelSwatch, LabelTag} from '@renderer/ui/labels/LabelChip';
import {labelInk} from '@renderer/ui/labels/labelInk';
import {resetTooltips} from '@fixtures/renderer/ui/tooltipTesting';

afterEach(resetTooltips);

describe('LabelTag', () => {
  it('shows the 이름표 name', () => {
    render(<LabelTag name="후렴" color="#D6B35F" />);
    expect(screen.getByText('후렴')).toBeDefined();
  });

  it('opens the 이름표 menu as a picker and names an empty one 이름표', async () => {
    const onOpen = vi.fn();
    render(
      <LabelTag
        name={undefined}
        color="none"
        picker={{expanded: true, onOpen}}
      />,
    );
    const picker = screen.getByRole('button', {name: '이름표'});
    expect(picker.getAttribute('aria-haspopup')).toBe('menu');
    expect(picker.getAttribute('aria-expanded')).toBe('true');
    await userEvent.click(picker);
    expect(onOpen).toHaveBeenCalledWith(picker);
  });
});

describe('LabelSwatch', () => {
  it('is hidden from assistive technology', () => {
    const {container} = render(<LabelSwatch color="#8FBF7A" />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });
});

describe('labelInk', () => {
  it.each(['#FFFFFF', '#5FB8C2', '#D6B35F'] as const)(
    'uses dark ink for %s',
    color => {
      expect(labelInk(color)['--label-ink']).toBe('var(--text-on-label)');
    },
  );
  it.each(['#000000', '#102030', '#0000FF'] as const)(
    'uses white ink for %s',
    color => {
      expect(labelInk(color)['--label-ink']).toBe('var(--text-on-fill)');
    },
  );
  it('paints an 이름표 color with the label text color', () => {
    expect(labelInk('#5FB8C2')).toEqual({
      '--label-fill': '#5FB8C2',
      '--label-ink': 'var(--text-on-label)',
    });
  });

  it('paints no 이름표 with gray text on label-none', () => {
    expect(labelInk('none')).toEqual({
      '--label-fill': 'var(--label-none)',
      '--label-ink': 'var(--label-gray)',
    });
  });
});
