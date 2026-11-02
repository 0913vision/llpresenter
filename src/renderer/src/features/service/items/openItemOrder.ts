import type {ServiceItemStore} from './serviceItemStore';

export const ORDER_EDIT_LABEL = '순서 편집…';

/** Opens the 순서 편집 window on the song item shown in 준비. */
export function openItemOrder({
  items,
}: {
  readonly items: ServiceItemStore;
}): void {
  const {service, item} = items.getSnapshot();
  if (service === null || item === null) return;
  window.llp?.window
    .openOrderEditor({serviceId: service.service.id, itemId: item.id})
    .then(result => {
      if (!result.ok) {
        console.error('Could not open the order editor', result.error.reason);
      }
    })
    .catch((error: unknown) =>
      console.error('Could not open the order editor', error),
    );
}
