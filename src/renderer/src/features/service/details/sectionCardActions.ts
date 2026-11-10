import {isItemOfKind, type SectionCard} from '@core/schema/service';
import {SUNDAY_SECTIONS} from '@core/themes/sundaySections';
import {
  hasSectionCard,
  isStandaloneCard,
  sectionCardOf,
} from '@core/services/sectionCards';
import type {MenuEntry} from '@renderer/ui/menuModel';
import type {ServiceItemStore} from '../items/serviceItemStore';

export function sectionCardEntries(
  items: ServiceItemStore,
): readonly MenuEntry[] {
  const state = items.getSnapshot();
  if (
    state.item === null ||
    (!isItemOfKind(state.item, 'song') &&
      !isItemOfKind(state.item, 'slides') &&
      !isItemOfKind(state.item, 'bible'))
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
      label: '구역 이름 슬라이드 추가',
      disabled,
      title: disabled
        ? '\uc9c0\uae08\uc740 \ucd94\uac00\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4'
        : '',
      submenu: SUNDAY_SECTIONS.map(section => ({
        kind: 'item' as const,
        id: `section:${section.name}`,
        label: section.name,
        onSelect: () => saveCard(items, sectionCardOf(section)),
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
      failure: '구역 이름 저장 실패',
      change: current => {
        if (
          !isItemOfKind(current, 'song') &&
          !isItemOfKind(current, 'slides') &&
          !isItemOfKind(current, 'bible')
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
