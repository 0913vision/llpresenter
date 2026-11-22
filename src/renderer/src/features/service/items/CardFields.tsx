import type {JSX} from 'react';
import {SLIDES_LIMITS, type SectionCard} from '@core/schema/service';
import {hasSectionCard} from '@core/services/sectionCards';
import {ItemTextField} from './ItemTextField';
import type {ServiceItemStore} from './serviceItemStore';
import styles from './ItemTextField.module.css';

const FIELDS = [
  {field: 'name', label: '타이틀', limit: SLIDES_LIMITS.name},
  {field: 'english', label: '영문 이름', limit: SLIDES_LIMITS.text},
] as const;

/** The texts of an item's 타이틀 slide, where they are kept. */
export function CardFields({
  items,
  serviceId,
  itemId,
  card,
  readOnly,
}: {
  readonly items: ServiceItemStore;
  readonly serviceId: string;
  readonly itemId: string;
  readonly card: SectionCard;
  readonly readOnly: boolean;
}): JSX.Element {
  return (
    <div className={styles.fields}>
      {FIELDS.map(({field, label, limit}) => (
        <ItemTextField
          key={`${itemId}:${field}`}
          label={label}
          singleLine
          value={card[field]}
          items={items}
          readOnly={readOnly}
          maxLength={limit}
          save={text =>
            items.submitItemEdit({
              target: {serviceId, itemId},
              failure: '타이틀 저장 실패',
              change: fresh =>
                hasSectionCard(fresh)
                  ? {
                      ...fresh,
                      sectionCard: {...fresh.sectionCard, [field]: text},
                    }
                  : null,
            })
          }
        />
      ))}
    </div>
  );
}
