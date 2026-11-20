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
  {
    shownItem,
    themeTextEditing = false,
  }: {
    readonly shownItem?:
      ReturnType<ServiceItemStore['getSnapshot']> | undefined;
    readonly themeTextEditing?: boolean;
  } = {},
): LeadingSlideCard | undefined {
  const current = useSyncExternalStore(items.subscribe, items.getSnapshot);
  const {item, service, busy} = shownItem ?? current;
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
    mixedSelection: true,
    label: '타이틀',
    render: mode => (
      <CardSlideBody
        itemId={item.id}
        card={card}
        mode={mode}
        hideSourceFields={themeTextEditing}
        textOverrides={item.textOverrides?.['section']}
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
      items.setCardSelected(selected);
      items.selectPosition(selected ? 0 : 1);
    },
  };
}
