import {MEDIA_END_OPTIONS} from '@renderer/ui/choices/mediaChoices';
import {useEffect, useRef, type JSX, type RefCallback} from 'react';
import type {PlacedOverlay} from '@core/schema/itemOverlays';
import {thumbnailSrc} from '@contracts/ipc/thumbnailRevisions';
import {editorTask} from '@renderer/platform/editorTask';
import {Button} from '@renderer/ui/buttons/Button';
import {Checkbox} from '@renderer/ui/choices/Checkbox';
import {Icon} from '@renderer/ui/Icon';
import {Properties, PropertyRow} from '@renderer/ui/panels/PropertyRow';
import {SegmentedControl} from '@renderer/ui/choices/SegmentedControl';
import {placeFloating} from '@renderer/ui/popups/floating';
import {Popover} from '@renderer/ui/popups/Popover';
import {viewportSize} from '@renderer/ui/popups/placement';
import {ItemOverlayRange} from './ItemOverlayRange';
import type {OverlayControl} from './useOverlayControl';
import styles from './ItemOverlays.module.css';

const EDGE = 8;
const GAP = 4;
/** Anything in a floating layer, such as a dialog or a picker this one opened. */
const LAYERS = '[data-llp-layer]';

/** Opens below the clip, or above it when the window ends first. */
function placeBelow(anchor: DOMRect): RefCallback<HTMLElement> {
  return node => {
    if (node === null) return;
    placeFloating(node, size => {
      const view = viewportSize();
      const x = Math.max(
        EDGE,
        Math.min(anchor.left, view.width - size.width - EDGE),
      );
      const below = anchor.bottom + GAP;
      const y =
        below + size.height + EDGE <= view.height
          ? below
          : Math.max(EDGE, anchor.top - GAP - size.height);
      return {x, y};
    });
  };
}

/** The controls of one 오버레이, opened by a click on its clip. */
export function OverlayPopover({
  overlay,
  control,
  anchor,
  onClose,
}: {
  readonly overlay: PlacedOverlay;
  readonly control: OverlayControl;
  readonly anchor: DOMRect;
  readonly onClose: () => void;
}): JSX.Element {
  const {editing} = control;
  const {reason} = editing;
  const surface = useRef<HTMLDivElement | null>(null);
  const update = (patch: Partial<PlacedOverlay>): void =>
    editorTask(
      editing.change(current =>
        current.map(row => (row.id === overlay.id ? {...row, ...patch} : row)),
      ),
    );
  useEffect(() => {
    const away = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (surface.current?.contains(target) === true) return;
      if (target.closest(LAYERS) !== null) return;
      if (target.closest('[data-overlay-clip]') !== null) return;
      onClose();
    };
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', escape);
    };
  }, [onClose]);
  const mediaContent = 'media' in overlay.content ? overlay.content : undefined;
  const file = editing.media.find(item => item.id === mediaContent?.media);
  const place = placeBelow(anchor);
  return (
    <Popover>
      <div
        ref={node => {
          surface.current = node;
          place(node);
        }}
        role="dialog"
        aria-label={`${overlay.name} 오버레이`}
        className={styles.popover}
      >
        <Properties placement="panel">
          <PropertyRow label="내용">
            {() => (
              <div className={styles.controls}>
                {file === undefined ? null : (
                  <span
                    className={styles.contentThumbnail}
                    style={{backgroundImage: `url("${thumbnailSrc(file.id)}")`}}
                    aria-hidden="true"
                  >
                    <Icon
                      name={file.kind === 'video' ? 'play' : 'image'}
                      size={14}
                    />
                  </span>
                )}
                <span className={styles.truncate}>
                  {file?.name ??
                    ('text' in overlay.content
                      ? overlay.content.text || '글자'
                      : '미디어 없음')}
                </span>
                <Button
                  disabled={reason !== undefined}
                  title={reason}
                  onClick={() => control.replaceContent(overlay.id)}
                >
                  바꾸기…
                </Button>
              </div>
            )}
          </PropertyRow>
          <ItemOverlayRange
            overlay={overlay}
            rows={editing.overlays}
            change={editing.change}
            count={editing.count}
            reason={reason}
          />
          <PropertyRow label="화면" alignTop>
            {({controlId, labelId}) => (
              <div
                id={controlId}
                role="group"
                aria-labelledby={labelId}
                className={styles.checks}
              >
                {editing.screens.map(screen => (
                  <label key={screen.id} className={styles.controls}>
                    <Checkbox
                      aria-label={screen.name}
                      checked={overlay.screens.includes(screen.id)}
                      disabled={reason !== undefined}
                      title={reason}
                      onChange={checked =>
                        update({
                          screens: checked
                            ? [...overlay.screens, screen.id]
                            : overlay.screens.filter(id => id !== screen.id),
                        })
                      }
                    />
                    {screen.name}
                  </label>
                ))}
              </div>
            )}
          </PropertyRow>
          {mediaContent !== undefined && file?.kind === 'video' ? (
            <>
              <PropertyRow label="끝나면">
                {({controlId, labelId}) => (
                  <SegmentedControl
                    id={controlId}
                    labelledBy={labelId}
                    options={MEDIA_END_OPTIONS}
                    value={mediaContent.loop ? 'loop' : 'stop'}
                    disabled={reason !== undefined}
                    title={reason}
                    onChange={value =>
                      update({
                        content: {
                          ...mediaContent,
                          media: file.id,
                          loop: value === 'loop',
                          sound: mediaContent.sound,
                        },
                      })
                    }
                  />
                )}
              </PropertyRow>
              <PropertyRow label="소리">
                {({controlId}) => (
                  <Checkbox
                    id={controlId}
                    checked={mediaContent.sound}
                    disabled={reason !== undefined}
                    title={reason}
                    onChange={sound =>
                      update({
                        content: {
                          ...mediaContent,
                          media: file.id,
                          loop: mediaContent.loop,
                          sound,
                        },
                      })
                    }
                  />
                )}
              </PropertyRow>
            </>
          ) : null}
        </Properties>
        <Button
          icon="trash"
          disabled={reason !== undefined}
          title={reason}
          onClick={() => {
            onClose();
            control.remove(overlay.id);
          }}
        >
          오버레이 삭제
        </Button>
      </div>
    </Popover>
  );
}
