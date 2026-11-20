import {act, render, screen} from '@testing-library/react';
import {useContext, useLayoutEffect, useRef, type JSX} from 'react';
import {expect, it, vi} from 'vitest';
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

it('shows the delayed loading indicator only for a pending replacement', () => {
  vi.useFakeTimers();
  try {
    const view = render(
      <AtomicPictureContent
        identity="a"
        pending
        showLoading
        content={<p>next</p>}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(149);
    });
    expect(screen.queryByRole('status')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole('status', {name: '불러오는 중'})).toBeTruthy();
    view.rerender(
      <AtomicPictureContent
        identity="a"
        pending={false}
        showLoading
        content={<p>next</p>}
      />,
    );
    expect(screen.queryByRole('status')).toBeNull();
    view.rerender(
      <AtomicPictureContent
        identity="b"
        pending
        showLoading
        content={<p>later</p>}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(100);
    });
    view.rerender(
      <AtomicPictureContent
        identity="b"
        pending={false}
        showLoading
        content={<p>later</p>}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.queryByRole('status')).toBeNull();
    view.unmount();
  } finally {
    vi.useRealTimers();
  }
});
