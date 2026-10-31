import type {JSX} from 'react';
import type {ItemOverlay} from '@core/schema/itemOverlays';
import type {ItemOverlayId} from '@core/schema/ids';
import {thumbnailUrl} from '@contracts/ipc/mediaUrls';
import {LabelTag} from '@renderer/ui/LabelChip';
import type {MenuAnchor} from '@renderer/ui/Menu';
import {isComposing} from '@renderer/ui/ime';
import {hasModifier} from '@renderer/ui/modifierKeys';
import type {ItemSlide} from './useItemSlides';
import styles from './ItemOverlays.module.css';

export interface ItemSlideActions {
  readonly select: (index: number) => void;
  readonly overlay: (id: ItemOverlayId, index: number) => void;
  readonly edit: ((index: number) => void) | undefined;
  readonly menu: (index: number, anchor: MenuAnchor) => void;
  readonly move: (index: number) => void;
}

export function ItemSlideRow({
  slide,
  index,
  overlay,
  selected,
  menuTarget,
  overlaySelected,
  count,
  actions,
  targetNames,
}: {
  readonly slide: ItemSlide;
  readonly index: number;
  readonly overlay: ItemOverlay | undefined;
  readonly selected: boolean;
  readonly menuTarget: boolean;
  readonly overlaySelected: boolean;
  readonly count: number;
  readonly actions: ItemSlideActions;
  readonly targetNames: readonly string[];
}): JSX.Element {
  return (
    <div
      role="row"
      aria-rowindex={index + 2}
      className={styles.row}
      data-selected={selected ? '' : undefined}
    >
      <span role="cell">{index + 1}</span>
      <span role="cell">
        <button
          type="button"
          className={styles.slide}
          aria-label={`슬라이드 ${index + 1}`}
          aria-description={[slide.label, slide.text]
            .filter(Boolean)
            .join(', ')}
          aria-pressed={selected}
          tabIndex={selected ? 0 : -1}
          data-slide-position={index}
          data-menu-target={menuTarget ? '' : undefined}
          onClick={() => actions.select(index)}
          onContextMenu={event => {
            event.preventDefault();
            actions.menu(index, {
              kind: 'point',
              point: {x: event.clientX, y: event.clientY},
              target: event.currentTarget,
            });
          }}
          onDoubleClick={() => {
            actions.edit?.(index);
          }}
          onKeyDown={event => {
            if (isComposing(event)) return;
            if (
              (event.key === 'ContextMenu' && !hasModifier(event)) ||
              (event.key === 'F10' &&
                event.shiftKey &&
                !event.ctrlKey &&
                !event.altKey &&
                !event.metaKey)
            ) {
              event.preventDefault();
              actions.menu(index, {
                kind: 'element',
                element: event.currentTarget,
              });
              return;
            }
            if (hasModifier(event)) return;
            const next =
              event.key === 'ArrowDown'
                ? Math.min(count - 1, index + 1)
                : event.key === 'ArrowUp'
                  ? Math.max(0, index - 1)
                  : event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? count - 1
                      : undefined;
            if (next !== undefined) {
              event.preventDefault();
              actions.move(next);
            }
          }}
        >
          <span className={styles.thumbnail} aria-hidden="true">
            {slide.media === undefined ? (
              <span className={styles.thumbnailText}>{slide.text}</span>
            ) : (
              <img src={thumbnailUrl(slide.media)} alt="" />
            )}
          </span>
          <span className={styles.summary}>
            <LabelTag name={slide.label} color={slide.color} />
            <span className={styles.truncate}>{slide.text.split('\n')[0]}</span>
          </span>
        </button>
      </span>
      <span role="cell" className={styles.overlayCell}>
        {overlay === undefined ? null : (
          <button
            type="button"
            className={styles.span}
            data-start={overlay.from === index + 1 ? '' : undefined}
            data-end={overlay.to === index + 1 ? '' : undefined}
            aria-label={`${overlay.name}, 슬라이드 ${overlay.from}부터 ${overlay.to}까지`}
            aria-pressed={overlaySelected}
            aria-description={targetNames.join(', ')}
            onClick={() => {
              actions.overlay(overlay.id, index);
            }}
          >
            <span>
              {overlay.from === index + 1 ? (
                <>
                  {overlay.name}
                  <span className={styles.targets}>
                    {targetNames.join(', ')}
                  </span>
                </>
              ) : null}
            </span>
          </button>
        )}
      </span>
    </div>
  );
}
