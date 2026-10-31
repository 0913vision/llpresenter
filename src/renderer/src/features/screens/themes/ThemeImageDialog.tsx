import {useState, type JSX} from 'react';
import type {MediaId} from '@core/schema/ids';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import {ThemeImageChoice} from './ThemeImageChoice';
import {Dialog} from '@renderer/ui/Dialog';
import type {ThemeModel} from './useThemeEditor';
import styles from './Themes.module.css';

export function ThemeImageDialog({
  model,
}: {
  readonly model: ThemeModel;
}): JSX.Element {
  const [selected, setSelected] = useState<MediaId>();
  const image = model.images.find(value => value.id === selected);
  return (
    <Dialog
      title="그림 선택"
      size="s"
      onCancel={model.cancelImage}
      primary={{
        label: '추가',
        disabled: image === undefined,
        onSelect: () => {
          if (image !== undefined) model.confirmImage(image.id);
        },
      }}
    >
      <ThemeImageChoice
        images={model.images}
        selected={selected}
        reason={model.elementReason}
        change={setSelected}
      />
      {image === undefined ? null : (
        <img
          className={styles.imageChoice}
          src={mediaUrl(image.id)}
          alt={image.name}
        />
      )}
    </Dialog>
  );
}
