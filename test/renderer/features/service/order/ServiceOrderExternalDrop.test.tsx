import type {MediaId} from '@core/schema/ids';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {useServiceOrderDrag} from '@renderer/features/service/order/useServiceOrderDrag';
import {ELEMENT_DRAG_MIME} from '@renderer/features/service/items/paletteItems';
import {MEDIA_DRAG_MIME} from '@renderer/features/media/mediaDrag';
import type {ServiceRow} from '@core/presentation/model';
const rows: ServiceRow[] = [
  {kind: 'slides', form: 'blank', id: 'one', title: 'One'},
  {kind: 'slides', form: 'blank', id: 'two', title: 'Two'},
  {kind: 'bible', id: 'bible', title: 'Bible'},
  {kind: 'media', id: 'media', title: 'Media'},
];
const mediaId = '00000000-0000-4000-8000-000000000001';
function Harness({
  onElement,
  onMedia,
}: {
  onElement: (key: string, before: string | null) => void;
  onMedia: (
    id: MediaId,
    before: string | null,
    background: string | null,
  ) => void;
}) {
  const {dragProps, insertBefore, backgroundTarget} = useServiceOrderDrag({
    enabled: true,
    rows,
    selected: new Set(),
    select: () => undefined,
    onMove: () => undefined,
    onCopy: () => undefined,
    onElement,
    onMedia,
  });
  return (
    <div {...dragProps} data-testid="list">
      <div data-order-id="one">
        <div role="option">One</div>
      </div>
      <div data-order-id="two">
        <div role="option">Two</div>
      </div>
      <div data-order-id="bible">
        <div role="option">Bible</div>
      </div>
      <div data-order-id="media">
        <div role="option">Media</div>
      </div>
      <output>
        {String(insertBefore)}|{String(backgroundTarget)}
      </output>
    </div>
  );
}
function transfer(type: string, value: string) {
  return {
    types: [type],
    getData: (key: string) => (key === type ? value : ''),
    dropEffect: 'none',
  };
}
function drag(
  target: HTMLElement,
  type: string,
  options: {dataTransfer: ReturnType<typeof transfer>; clientY: number},
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientY: options.clientY,
  });
  Object.defineProperty(event, 'dataTransfer', {value: options.dataTransfer});
  fireEvent(target, event);
}
afterEach(cleanup);
describe('order external drops', () => {
  it('inserts a valid element at the drop line and rejects unknown elements', () => {
    const onElement = vi.fn(),
      onMedia = vi.fn();
    render(<Harness onElement={onElement} onMedia={onMedia} />);
    const row = screen.getByRole('option', {name: 'Two'});
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 100, 200, 40),
    );
    const dataTransfer = transfer(ELEMENT_DRAG_MIME, 'standby');
    drag(row, 'dragover', {dataTransfer, clientY: 101});
    expect(screen.getByText('two|null')).toBeTruthy();
    drag(row, 'drop', {dataTransfer, clientY: 101});
    expect(onElement).toHaveBeenCalledWith('standby', 'two');
    const waiting = transfer(ELEMENT_DRAG_MIME, 'waiting-screen');
    drag(row, 'dragover', {dataTransfer: waiting, clientY: 101});
    drag(row, 'drop', {dataTransfer: waiting, clientY: 101});
    expect(onElement).toHaveBeenLastCalledWith('waiting-screen', 'two');
    fireEvent.drop(row, {
      dataTransfer: transfer(ELEMENT_DRAG_MIME, 'unknown'),
      clientY: 101,
    });
    expect(onElement).toHaveBeenCalledTimes(2);
  });
  it('distinguishes a media drop on the row from its edge', () => {
    const onElement = vi.fn(),
      onMedia = vi.fn();
    render(<Harness onElement={onElement} onMedia={onMedia} />);
    const row = screen.getByRole('option', {name: 'Two'});
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 100, 200, 40),
    );
    const dataTransfer = transfer(MEDIA_DRAG_MIME, mediaId);
    drag(row, 'dragover', {dataTransfer, clientY: 120});
    expect(screen.getByText('undefined|two')).toBeTruthy();
    drag(row, 'drop', {dataTransfer, clientY: 120});
    expect(onMedia).toHaveBeenCalledWith(mediaId, 'bible', 'two');
    drag(row, 'dragover', {dataTransfer, clientY: 101});
    expect(screen.getByText('two|null')).toBeTruthy();
    drag(row, 'drop', {dataTransfer, clientY: 101});
    expect(onMedia).toHaveBeenLastCalledWith(mediaId, 'two', null);
  });
  it.each(['Bible', 'Media'])(
    'does not highlight %s as a background target',
    name => {
      const onElement = vi.fn(),
        onMedia = vi.fn();
      render(<Harness onElement={onElement} onMedia={onMedia} />);
      const row = screen.getByRole('option', {name});
      vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(0, 100, 200, 40),
      );
      const dataTransfer = transfer(MEDIA_DRAG_MIME, mediaId);
      drag(row, 'dragover', {dataTransfer, clientY: 120});
      expect(screen.getByText('undefined|null')).toBeTruthy();
      drag(row, 'drop', {dataTransfer, clientY: 120});
      expect(onMedia.mock.calls[0]?.[2]).toBe(name.toLowerCase());
    },
  );
});
