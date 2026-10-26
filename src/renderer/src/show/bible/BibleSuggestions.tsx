import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type JSX,
  type RefObject,
} from 'react';
import {createPortal} from 'react-dom';
import type {TranslationId} from '@shared/schema/ids';
import {placeFloating} from '@renderer/ui/floating';
import {layerContainer} from '@renderer/ui/layers';
import {modalStack} from '@renderer/ui/modalStack';
import {placeBelow, viewportSize} from '@renderer/ui/placement';
import {TruncatedText} from '@renderer/ui/TruncatedText';
import styles from './BibleReferenceField.module.css';

export interface BibleSuggestion {
  readonly bookId?: number | undefined;
  readonly key: string;
  readonly group: string;
  readonly input: string;
  readonly translation: TranslationId | undefined;
  readonly count?: number | undefined;
  readonly ref?: string | undefined;
}

export function BibleSuggestions({
  id,
  anchor,
  items,
  pointed,
  onPoint,
  onChoose,
  onClose,
}: {
  readonly id: string;
  readonly anchor: RefObject<HTMLElement | null>;
  readonly items: readonly BibleSuggestion[];
  readonly pointed: number;
  readonly onPoint: (index: number) => void;
  readonly onChoose: (item: BibleSuggestion) => void;
  readonly onClose: () => void;
}): JSX.Element {
  const [overModal] = useState(() => modalStack.isOpen);
  const popup = useRef<HTMLDivElement>(null);
  const close = useEffectEvent(onClose);
  useEffect(() => {
    const outside = (event: Event): void => {
      if (
        event.target instanceof Node &&
        (anchor.current?.contains(event.target) ||
          popup.current?.contains(event.target))
      ) {
        return;
      }
      close();
    };
    const resize = (): void => close();
    window.addEventListener('pointerdown', outside, true);
    window.addEventListener('scroll', outside, true);
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('scroll', outside, true);
      window.removeEventListener('resize', resize);
    };
  }, [anchor]);
  useEffect(() => {
    popup.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({block: 'nearest'});
  }, [pointed]);
  return createPortal(
    <div
      id={id}
      role="listbox"
      aria-label="성경 구절 추천"
      className={styles.popup}
      data-over-modal={overModal ? '' : undefined}
      ref={element => {
        popup.current = element;
        if (element && anchor.current) {
          placeFloating(element, size =>
            placeBelow(
              anchor.current?.firstElementChild?.getBoundingClientRect() ?? {
                left: 0,
                top: 0,
                width: 0,
                height: 0,
              },
              size,
              viewportSize(),
            ),
          );
        }
      }}
    >
      {items.map((item, index) => (
        <div key={item.key}>
          {items[index - 1]?.group !== item.group ? (
            <div className={styles.group}>{item.group}</div>
          ) : null}
          <button
            id={`${id}-${index}`}
            role="option"
            type="button"
            tabIndex={-1}
            aria-selected={pointed === index}
            className={styles.option}
            onMouseDown={event => event.preventDefault()}
            onMouseMove={() => onPoint(index)}
            onClick={() => onChoose(item)}
          >
            <TruncatedText className={styles.reference} text={item.input} />
            {item.count === undefined ? null : (
              <span className={styles.count}>{item.count}절</span>
            )}
          </button>
        </div>
      ))}
    </div>,
    layerContainer('popover'),
  );
}
