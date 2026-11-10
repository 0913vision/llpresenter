import {useSyncExternalStore, type JSX} from 'react';
import {
  canHaveSectionCard,
  hasSectionCard,
  newSectionCard,
} from '@core/services/sectionCards';
import {Button} from '@renderer/ui/Button';
import {saveCard} from './sectionCardActions';
import type {ServiceItemStore} from './serviceItemStore';

export function AddSectionCard({
  items,
  itemId,
}: {
  readonly items: ServiceItemStore;
  readonly itemId: string;
}): JSX.Element | null {
  const {item, service, busy} = useSyncExternalStore(
    items.subscribe,
    items.getSnapshot,
  );
  if (
    item?.id !== itemId ||
    !canHaveSectionCard(item) ||
    hasSectionCard(item)
  ) {
    return null;
  }
  return (
    <Button
      variant="ghost"
      icon="plus"
      disabled={busy || service === null || service.access === 'readOnly'}
      onClick={() => saveCard(items, newSectionCard())}
    >
      구역 이름
    </Button>
  );
}
