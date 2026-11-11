import {vi} from 'vitest';

/** Supplies line-height based text measurements to the broadcast layout tests. */
export function mockBroadcastMeasure(lineHeight: number): void {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
    function (this: HTMLElement) {
      return Math.ceil(
        this.children.length *
          Number.parseFloat(this.style.fontSize) *
          (Number.parseFloat(this.style.lineHeight) || lineHeight),
      );
    },
  );
}

/** Stubs the measurement element's line-box rectangle for broadcast fitting. */
export function mockBroadcastRect(
  rows: (element: HTMLElement) => number = element => element.children.length,
): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      return new DOMRect(
        0,
        0,
        1600,
        rows(this) *
          Number.parseFloat(this.style.fontSize) *
          Number.parseFloat(this.style.lineHeight),
      );
    },
  );
}
