import {act} from '@testing-library/react';
import {vi} from 'vitest';
import styles from './Panel.module.css';

export function mockPanelTabWidths(initialWidth: number) {
  let width = initialWidth;
  const callbacks = new Set<() => void>();
  const disconnect = vi.fn();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      const measured =
        this.className === styles.fitting
          ? width
          : this.className === styles.tab || this.className === styles.more
            ? 60
            : 0;
      return new DOMRect(0, 0, measured, 34);
    },
  );
  vi.stubGlobal(
    'ResizeObserver',
    class implements ResizeObserver {
      private readonly notify: () => void;
      constructor(callback: ResizeObserverCallback) {
        this.notify = () => callback([], this);
      }
      observe(): void {
        callbacks.add(this.notify);
      }
      unobserve(): void {
        callbacks.delete(this.notify);
      }
      disconnect(): void {
        callbacks.delete(this.notify);
        disconnect();
      }
    },
  );
  return {
    disconnect,
    resize(next: number): void {
      width = next;
      act(() => {
        for (const callback of callbacks) callback();
      });
    },
    active: () => callbacks.size,
  };
}
