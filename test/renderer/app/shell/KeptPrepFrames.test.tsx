import {render, screen} from '@testing-library/react';
import {useEffect} from 'react';
import {expect, it, vi} from 'vitest';
import {KeptPrepFrames} from '@renderer/app/shell/KeptPrepFrames';
import {
  PrepPictureSwitch,
  usePrepPictureSwitch,
} from '@renderer/rendering/PrepPictureSwitch';

it('keeps previously shown preparation elements connected while hiding them', () => {
  const unmount = vi.fn<() => void>();
  function Grid({name}: {readonly name: string}) {
    useEffect(() => unmount, []);
    return <div role="listbox" aria-label={name} />;
  }
  const view = render(
    <KeptPrepFrames identity="a">
      <Grid name="A" />
    </KeptPrepFrames>,
  );
  const first = screen.getByRole('listbox', {name: 'A'});
  view.rerender(
    <KeptPrepFrames identity="b">
      <Grid name="B" />
    </KeptPrepFrames>,
  );
  expect(first.isConnected).toBe(true);
  expect(first.closest('[inert]')).not.toBeNull();
  expect(unmount).not.toHaveBeenCalled();
  view.rerender(
    <KeptPrepFrames identity="a">
      <Grid name="A" />
    </KeptPrepFrames>,
  );
  expect(screen.getByRole('listbox', {name: 'A'})).toBe(first);
});

it('does not restart picture handoff when a kept frame is shown again', () => {
  function Grid({name}: {readonly name: string}) {
    const switching = usePrepPictureSwitch();
    return <div data-testid={name}>{String(switching)}</div>;
  }
  function frame(name: string) {
    return (
      <KeptPrepFrames identity={name}>
        <PrepPictureSwitch identity={name}>
          <Grid name={name} />
        </PrepPictureSwitch>
      </KeptPrepFrames>
    );
  }
  const view = render(frame('first'));
  view.rerender(frame('second'));
  view.rerender(frame('first'));
  expect(screen.getByTestId('first').textContent).toBe('false');
});
