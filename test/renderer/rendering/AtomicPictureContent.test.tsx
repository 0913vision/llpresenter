import {act, render, screen} from '@testing-library/react';
import {useContext, useLayoutEffect, useRef, type JSX} from 'react';
import {expect, it} from 'vitest';
import {AtomicPictureContent} from '@renderer/rendering/AtomicPictureContent';
import {PictureReadiness} from '@renderer/rendering/PictureReadiness';

it('waits for every distinct picture before exposing the next content', () => {
  const signals = new Map<string, () => void>();
  function Picture({name}: {readonly name: string}): JSX.Element {
    const ready = useContext(PictureReadiness);
    const source = useRef({});
    useLayoutEffect(() => {
      signals.set(name, () => ready?.(source.current));
      return () => {
        signals.delete(name);
      };
    }, [name, ready]);
    return <span>{name}</span>;
  }
  const panel = (pending: boolean): JSX.Element => (
    <AtomicPictureContent
      identity="next"
      pending={pending}
      waitForPicture
      pictureCount={2}
      initial={<p>previous</p>}
      content={
        <div>
          <Picture name="first" />
          <Picture name="second" />
        </div>
      }
    />
  );
  const view = render(panel(false));
  act(() => {
    signals.get('first')?.();
    signals.get('first')?.();
  });
  expect(screen.getByText('previous')).toBeTruthy();
  expect(
    screen.getByText('first').closest('[aria-hidden="true"]'),
  ).not.toBeNull();
  view.rerender(panel(true));
  view.rerender(panel(false));
  act(() => signals.get('first')?.());
  expect(screen.getByText('previous')).toBeTruthy();
  act(() => signals.get('second')?.());
  expect(screen.queryByText('previous')).toBeNull();
  expect(screen.getByText('first').closest('[aria-hidden="true"]')).toBeNull();
  view.unmount();
});
