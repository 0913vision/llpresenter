import type {JSX} from 'react';
import {
  isItemOfKind,
  SLIDES_LIMITS,
  type ServiceItemOf,
} from '@core/schema/service';
import {ItemTextField} from './ItemTextField';
import type {ServiceItemStore} from './serviceItemStore';
import styles from './ItemTextField.module.css';

/** The text of a sermon's title slides, where it is kept. */
export function SermonTitleFields({
  items,
  serviceId,
  item,
  readOnly,
}: {
  readonly items: ServiceItemStore;
  readonly serviceId: string;
  readonly item: ServiceItemOf<'sermon'>;
  readonly readOnly: boolean;
}): JSX.Element {
  return (
    <div className={styles.fields}>
      <ItemTextField
        key={item.id}
        label="설교 제목"
        singleLine
        value={item.sermon.title}
        items={items}
        readOnly={readOnly}
        maxLength={SLIDES_LIMITS.name}
        save={title =>
          items.submitItemEdit({
            target: {serviceId, itemId: item.id},
            failure: '설교 제목 저장 실패',
            change: fresh =>
              isItemOfKind(fresh, 'sermon')
                ? {...fresh, sermon: {...fresh.sermon, title}}
                : null,
          })
        }
      />
    </div>
  );
}
