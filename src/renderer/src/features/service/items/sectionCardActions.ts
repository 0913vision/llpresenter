import {hasSectionCard} from '@core/services/sectionCards';
import type {ServiceItemStore} from './serviceItemStore';
export {saveCard, sectionCardEntries} from '../details/sectionCardActions';

export function saveField(
  items: ServiceItemStore,
  field: 'name' | 'english',
  value: string,
): void {
  const {service, item} = items.getSnapshot();
  if (
    service === null ||
    item === null ||
    !hasSectionCard(item) ||
    item.sectionCard[field] === value
  ) {
    return;
  }
  items
    .submitItemEdit({
      target: {serviceId: service.service.id, itemId: item.id},
      failure: '타이틀 저장 실패',
      change: current => {
        if (!hasSectionCard(current)) {
          return null;
        }
        return {
          ...current,
          sectionCard: {...current.sectionCard, [field]: value},
        };
      },
    })
    .catch((error: unknown) => console.error(error));
}
