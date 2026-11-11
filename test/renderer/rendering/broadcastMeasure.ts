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
