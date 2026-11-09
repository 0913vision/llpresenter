import {useSyncExternalStore, type JSX} from 'react';
import {
  isItemOfKind,
  SLIDES_LIMITS,
  type SectionCard,
} from '@core/schema/service';
import {SUNDAY_SECTIONS} from '@core/themes/sundaySections';
import {sectionCardOf} from '@core/services/sectionCards';
import {Button} from '@renderer/ui/Button';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {useSlideTheme} from '@renderer/platform/useSlideTheme';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import type {ServiceItemStore} from './serviceItemStore';

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
    state.item.sectionCard !== undefined;
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

function saveCard(
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
        return updated;
      },
    })
    .catch((error: unknown) => console.error(error));
}

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
