import type {JSX} from 'react';
import {mediaUrl} from '@shared/media';
import type {Prop} from '@shared/schema/props';
import type {Screen} from '@shared/schema/screens';
import {sendLive, useLive} from '@renderer/state/live';
import {MediaTile, TileList, gridMoves} from '@renderer/ui';
import type {MenuAnchor} from '@renderer/ui/Menu';
import styles from './PropGrid.module.css';

export function PropGrid({
  props,
  screens,
  onMenu,
}: {
  readonly props: readonly Prop[];
  readonly screens: readonly Screen[];
  readonly onMenu?: ((prop: Prop, anchor: MenuAnchor) => void) | undefined;
}): JSX.Element {
  const layer = useLive(view => view.state?.layers.prop);
  const isOn = (prop: Prop): boolean =>
    layer?.items
      ? layer.items.some(item => item.propId === prop.id)
      : layer?.propId === prop.id;
  return (
    <TileList
      label="소품"
      className={styles.grid}
      workspace="show"
      moves={gridMoves}
      columns="auto"
      arrowsMove="focus"
      spaceKey="press"
      selected={undefined}
      onMenu={(index, anchor) => {
        const prop = props[index];
        if (prop) onMenu?.(prop, anchor);
      }}
      onActivate={index => {
        const prop = props[index];
        if (!prop) return;
        const current = useLive.getState().state?.layers.prop;
        const on = current?.items
          ? current.items.some(item => item.propId === prop.id)
          : current?.propId === prop.id;
        sendLive({type: 'prop.set', propId: prop.id, on: !on});
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
          />
        );
      })}
    </TileList>
  );
}
