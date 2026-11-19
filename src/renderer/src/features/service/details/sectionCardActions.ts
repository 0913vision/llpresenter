import {isItemOfKind, type SectionCard} from '@core/schema/service';
import {SUNDAY_SECTIONS} from '@core/themes/sundaySections';
import {
  hasSectionCard,
  isStandaloneCard,
  sectionCardOf,
} from '@core/services/sectionCards';
import type {MenuEntry} from '@renderer/ui/menuModel';
import type {ServiceItemStore} from '../items/serviceItemStore';
import {defaultSlideTransitions} from '@core/schema/preferences';

export function sectionCardEntries(
  items: ServiceItemStore,
): readonly MenuEntry[] {
  const state = items.getSnapshot();
  if (
    state.item === null ||
    (!isItemOfKind(state.item, 'song') &&
      !isItemOfKind(state.item, 'slides') &&
      !isItemOfKind(state.item, 'liturgy') &&
      !isItemOfKind(state.item, 'bible') &&
      !isItemOfKind(state.item, 'sermon'))
  ) {
    return [];
  }
  const disabled =
    state.service?.access === 'readOnly' ||
    state.busy ||
    hasSectionCard(state.item);
  return [
    {
      kind: 'item',
      id: 'section-card',
      label: '타이틀 슬라이드 추가',
      disabled,
      title: disabled
        ? '\uc9c0\uae08\uc740 \ucd94\uac00\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4'
        : '',
      submenu: SUNDAY_SECTIONS.map(section => ({
        kind: 'item' as const,
        id: `section:${section.name}`,
        label: section.name,
        onSelect: () => {
          const api = window.llp;
          if (api === undefined) {
            saveCard(
              items,
              sectionCardOf(section, defaultSlideTransitions.section),
            );
            return;
          }
          void api.preferences.get().then(
            preferences => {
              if (items.getSnapshot().item?.id === state.item?.id) {
                saveCard(
                  items,
                  sectionCardOf(
                    section,
                    preferences.show.slideDefaults.section,
                  ),
                );
              }
            },
            (error: unknown) =>
              console.error('Could not read transition defaults', error),
          );
        },
      })),
    },
  ];
}

export function saveCard(
  items: ServiceItemStore,
  card: SectionCard | undefined,
): void {
  const {service, item} = items.getSnapshot();
  if (service === null || item === null) return;
  items
    .submitItemEdit({
      target: {serviceId: service.service.id, itemId: item.id},
      failure: '타이틀 저장 실패',
      change: current => {
        if (
          !isItemOfKind(current, 'song') &&
          !isItemOfKind(current, 'slides') &&
          !isItemOfKind(current, 'bible') &&
          !isItemOfKind(current, 'sermon') &&
          !isItemOfKind(current, 'liturgy')
        ) {
          return null;
        }
        const updated = {...current};
        if (card === undefined) delete updated.sectionCard;
        else updated.sectionCard = card;
        if (card !== undefined && isStandaloneCard(current)) {
          return {
            ...current,
            sectionCard: card,
            theme: card.theme,
            slides: {...current.slides, name: card.name},
          };
        }
        return updated;
      },
    })
    .catch((error: unknown) => console.error(error));
}
