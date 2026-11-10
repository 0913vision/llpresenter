import {useSyncExternalStore} from 'react';
import {hasSectionCard} from '@core/services/sectionCards';
import type {LeadingSlideCard} from '@renderer/features/songs/editor';
import {CardSlideBody} from './CardSlideBody';
import {saveCard, saveField} from './sectionCardActions';
import type {ServiceItemStore} from './serviceItemStore';

/** Bind an item-owned card to the shared slide surface without changing content slides. */
export function useLeadingItemCard(
  items: ServiceItemStore,
  itemId: string | undefined,
): LeadingSlideCard | undefined {
  const {item, service, busy} = useSyncExternalStore(
    items.subscribe,
    items.getSnapshot,
  );
  if (
    item === null ||
    item.id !== itemId ||
    service === null ||
    !hasSectionCard(item)
  ) {
    return undefined;
  }
  const card = item.sectionCard;
  const disabled = busy || service.access === 'readOnly';
  return {
    label: '구역 이름',
    render: mode => (
      <CardSlideBody
        itemId={item.id}
        card={card}
        mode={mode}
        disabled={disabled}
        onChange={(field, value) => {
          if (items.getSnapshot().item?.id === item.id) {
            saveField(items, field, value);
          }
        }}
      />
    ),
    onDelete: () => {
      if (!disabled && items.getSnapshot().item?.id === item.id) {
        saveCard(items, undefined);
      }
    },
    onSelectChange: selected => {
      items.selectPosition(selected ? 0 : 1);
    },
  };
}
