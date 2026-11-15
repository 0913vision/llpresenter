import {useSyncExternalStore, type JSX} from 'react';
import {isItemOfKind, type ServiceItemOf} from '@core/schema/service';
import {LITURGY, type LiturgyTranslation} from '@core/services/liturgy';
import {LITURGY_SLIDES} from '@core/services/liturgySlides';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {Button} from '@renderer/ui/Button';
import {cardOffset} from '@core/services/sectionCards';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import type {ServiceItemStore} from './serviceItemStore';

/** Changes the church's fixed wording without converting it to editable slides. */
export function LiturgyVersion({
  items,
  item,
  serviceId,
  locked,
}: {
  readonly items: ServiceItemStore;
  readonly item: ServiceItemOf<'liturgy'>;
  readonly serviceId: string;
  readonly locked: boolean;
}): JSX.Element {
  return (
    <SelectMenu
      aria-label="예식문 버전"
      value={item.liturgy.translation}
      disabled={locked}
      options={[
        {value: 'new', label: '새 번역'},
        {value: 'old', label: '옛 번역'},
      ]}
      onChange={value => {
        const translation: LiturgyTranslation = value;
        editorTask(
          items.submitItemEdit({
            target: {serviceId, itemId: item.id},
            failure: '예식문 버전 저장 실패',
            change: current =>
              isItemOfKind(current, 'liturgy')
                ? {...current, liturgy: {...current.liturgy, translation}}
                : null,
          }),
        );
      }}
    />
  );
}

export function LiturgyEditor({
  items,
}: {
  readonly items: ServiceItemStore;
}): JSX.Element | null {
  const state = useSyncExternalStore(items.subscribe, items.getSnapshot);
  const item = state.item;
  if (
    item === null ||
    !isItemOfKind(item, 'liturgy') ||
    state.service === null
  ) {
    return null;
  }
  return (
    <section aria-label={`${LITURGY[item.liturgy.kind].name} 편집`}>
      <h2>{LITURGY[item.liturgy.kind].name}</h2>
      <LiturgyVersion
        items={items}
        item={item}
        serviceId={state.service.service.id}
        locked={state.busy || state.service.access === 'readOnly'}
      />
      {LITURGY_SLIDES[item.liturgy.kind][item.liturgy.translation].map(
        (text, index) => (
          <p key={text}>
            <Button
              aria-pressed={state.position === index + cardOffset(item)}
              onClick={() => items.selectPosition(index + cardOffset(item))}
            >
              {index + 1}
            </Button>{' '}
            {text}
          </p>
        ),
      )}
    </section>
  );
}
