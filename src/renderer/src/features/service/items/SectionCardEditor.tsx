import {useSyncExternalStore, type JSX} from 'react';
import {isItemOfKind, SLIDES_LIMITS} from '@core/schema/service';
import {Button} from '@renderer/ui/Button';
import {useSlideTheme} from '@renderer/platform/useSlideTheme';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import type {ServiceItemStore} from './serviceItemStore';
import {saveCard} from '../details/sectionCardActions';

export {sectionCardEntries} from '../details/sectionCardActions';

function saveField(
  items: ServiceItemStore,
  field: 'name' | 'english',
  value: string,
): void {
  const {service, item} = items.getSnapshot();
  if (
    service === null ||
    item === null ||
    (!isItemOfKind(item, 'song') &&
      !isItemOfKind(item, 'slides') &&
      !isItemOfKind(item, 'bible')) ||
    item.sectionCard === undefined ||
    item.sectionCard[field] === value
  ) {
    return;
  }
  items
    .submitItemEdit({
      target: {serviceId: service.service.id, itemId: item.id},
      failure: '\uad6c\uc5ed \uc774\ub984 \uc800\uc7a5 \uc2e4\ud328',
      change: current => {
        if (
          (!isItemOfKind(current, 'song') &&
            !isItemOfKind(current, 'slides') &&
            !isItemOfKind(current, 'bible')) ||
          current.sectionCard === undefined
        ) {
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

/** The opening card is service-local and keeps its own appearance. */
export function SectionCardEditor({
  items,
}: {
  readonly items: ServiceItemStore;
}): JSX.Element | null {
  const {item, service, busy} = useSyncExternalStore(
    items.subscribe,
    items.getSnapshot,
  );
  const card =
    item !== null &&
    (isItemOfKind(item, 'song') ||
      isItemOfKind(item, 'slides') ||
      isItemOfKind(item, 'bible'))
      ? item.sectionCard
      : undefined;
  const theme = useSlideTheme(
    card === undefined || item === null
      ? undefined
      : {
          id: item.id,
          kind: 'slides',
          form: 'blank',
          title: card.name,
          theme: card.theme,
        },
  );
  if (card === undefined || item === null) return null;
  const locked = busy || service?.access === 'readOnly';
  return (
    <div
      aria-label="구역 이름 슬라이드"
      style={{display: 'grid', gap: 4, padding: 8}}
    >
      {theme === undefined ? null : (
        <button
          type="button"
          aria-label={card.name}
          onClick={() => items.selectPosition(0)}
          style={{
            position: 'relative',
            overflow: 'hidden',
            width: 160,
            aspectRatio: '16 / 9',
          }}
        >
          <SlidePicture
            {...theme}
            slide={{
              itemId: item.id,
              position: 0,
              label: card.name,
              lines: [card.english],
              sectionCard: card,
            }}
          />
        </button>
      )}
      <label>
        구역 이름{' '}
        <input
          key={`${item.id}:name:${card.name}`}
          defaultValue={card.name}
          style={{width: '100%', boxSizing: 'border-box'}}
          maxLength={SLIDES_LIMITS.name}
          disabled={locked}
          onBlur={event => saveField(items, 'name', event.currentTarget.value)}
        />
      </label>
      <label>
        영문 이름{' '}
        <input
          key={`${item.id}:english:${card.english}`}
          defaultValue={card.english}
          style={{width: '100%', boxSizing: 'border-box'}}
          maxLength={SLIDES_LIMITS.text}
          disabled={locked}
          onBlur={event =>
            saveField(items, 'english', event.currentTarget.value)
          }
        />
      </label>
      <Button disabled={locked} onClick={() => saveCard(items, undefined)}>
        구역 이름 슬라이드 삭제
      </Button>
    </div>
  );
}
