import {toggleProp} from './toolCommands';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {useState, type JSX} from 'react';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import type {MediaItem} from '@core/schema/mediaList';
import type {Prop} from '@core/schema/props';
import {MISSING_MEDIA_TIP} from '@renderer/platform/problemReasons';
import type {Screen} from '@core/schema/screens';
import {useLive} from '@renderer/session/live';
import {MediaTile, TileList, gridMoves} from '@renderer/ui';
import type {MenuAnchor} from '@renderer/ui/Menu';
import styles from './PropGrid.module.css';

export function PropGrid({
  props,
  screens,
  media,
  onMenu,
}: {
  readonly props: readonly Prop[];
  readonly screens: readonly Screen[];
  /** The media list; a 그래픽 whose image is not in it cannot be shown. */
  readonly media?: readonly MediaItem[] | undefined;
  readonly onMenu?:
    | ((
        prop: Prop,
        anchor: MenuAnchor,
        action: {activate: () => void; reason: string | undefined},
      ) => void)
    | undefined;
}): JSX.Element {
  const [selected, setSelected] = useState<string | null>(null);
  const layer = useLive(view => view.state?.layers.prop);
  const isOn = (prop: Prop): boolean =>
    layer?.items
      ? layer.items.some(item => item.propId === prop.id)
      : layer?.propId === prop.id;
  const imageGone = (prop: Prop): boolean => {
    const {content} = prop;
    return (
      media !== undefined &&
      content.kind === 'image' &&
      !media.some(item => item.id === content.media)
    );
  };
  const toggle = (prop: Prop): void => {
    if (imageGone(prop) && !isOn(prop)) return;
    toggleProp(prop.id);
  };
  useWindowShortcuts(
    props.map(prop => ({id: `prop.${prop.id}`, run: () => toggle(prop)})),
  );
  return (
    <TileList
      label="그래픽"
      className={styles.grid}
      workspace="show"
      moves={gridMoves}
      columns="auto"
      arrowsMove="focus"
      spaceKey="press"
      selected={props.findIndex(prop => prop.id === selected)}
      onMenu={(index, anchor) => {
        const prop = props[index];
        if (prop) {
          setSelected(prop.id);
          onMenu?.(prop, anchor, {
            activate: () => toggle(prop),
            reason:
              imageGone(prop) && !isOn(prop) ? MISSING_MEDIA_TIP : undefined,
          });
        }
      }}
      onActivate={index => {
        const prop = props[index];
        if (prop) toggle(prop);
      }}
    >
      {props.map(prop => {
        const targets = prop.targets
          .map(id => screens.find(screen => screen.id === id)?.name)
          .filter((name): name is string => Boolean(name));
        const title = prop.name || '이름 없음';
        const name =
          targets.length === 0 ? title : `${title} (${targets.join(', ')})`;
        return (
          <MediaTile
            key={prop.id}
            name={name}
            picture={
              prop.content.kind === 'image' ? (
                mediaUrl(prop.content.media)
              ) : (
                <span className={styles.text}>{prop.content.text}</span>
              )
            }
            live={isOn(prop)}
            missingReason={imageGone(prop) ? MISSING_MEDIA_TIP : undefined}
          />
        );
      })}
    </TileList>
  );
}
