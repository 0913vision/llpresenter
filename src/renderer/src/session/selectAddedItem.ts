import {useShow} from './showStore';

/** Reveals an inserted row after React has rendered the service projection. */
export function revealAddedItem(itemId: string): void {
  requestAnimationFrame(() => {
    if (useShow.getState().openItemId !== itemId) return;
    const rows = document.querySelectorAll<HTMLElement>('[data-order-id]');
    [...rows]
      .find(row => row.dataset['orderId'] === itemId)
      ?.scrollIntoView({block: 'nearest'});
  });
}

/** Selects a saved insertion when its projection arrives, unless the user moved on. */
export function selectAddedItem(
  serviceId: string,
  itemId: string,
  cursor: string | null,
): void {
  let stop = (): void => undefined;
  const cancel = (): void => {
    clearTimeout(timeout);
    stop();
  };
  const check = (): void => {
    const view = useShow.getState();
    if (view.serviceId !== serviceId || view.openItemId !== cursor) {
      cancel();
      return;
    }
    if (!view.rows.some(row => row.id === itemId)) return;
    cancel();
    useShow.setState({openItemId: itemId, selectedTile: 0});
    revealAddedItem(itemId);
  };
  const timeout = setTimeout(() => stop(), 10000);
  stop = useShow.subscribe(check);
  check();
}
