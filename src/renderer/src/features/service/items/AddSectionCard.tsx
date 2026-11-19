import {useSyncExternalStore, type JSX} from 'react';
import {
  canHaveSectionCard,
  hasSectionCard,
  newSectionCard,
} from '@core/services/sectionCards';
import {Button} from '@renderer/ui/Button';
import {saveCard} from './sectionCardActions';
import type {ServiceItemStore} from './serviceItemStore';
import {defaultSlideTransitions} from '@core/schema/preferences';

export function AddSectionCard({
  items,
  itemId,
  shownItem,
}: {
  readonly items: ServiceItemStore;
  readonly itemId: string;
  readonly shownItem?: ReturnType<ServiceItemStore['getSnapshot']> | undefined;
}): JSX.Element | null {
  const current = useSyncExternalStore(items.subscribe, items.getSnapshot);
  const {item, service, busy} = shownItem ?? current;
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
      onClick={() => {
        const api = window.llp;
        if (api === undefined) {
          saveCard(items, newSectionCard(defaultSlideTransitions.section));
          return;
        }
        void api.preferences.get().then(
          preferences => {
            if (items.getSnapshot().item?.id === itemId) {
              saveCard(
                items,
                newSectionCard(preferences.show.slideDefaults.section),
              );
            }
          },
          (error: unknown) =>
            console.error('Could not read transition defaults', error),
        );
      }}
    >
      제목
    </Button>
  );
}
