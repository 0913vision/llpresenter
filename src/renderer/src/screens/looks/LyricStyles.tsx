import {useState, type JSX} from 'react';
import type {LooksFile} from '@shared/schema/looks';
import {SegmentedControl} from '@renderer/ui/SegmentedControl';
import type {LyricStyleEdit} from './lyricStyleEdits';
import {LyricStylePreview} from './LyricStylePreview';
import {LyricStyleProperties} from './LyricStyleProperties';
import styles from './LyricStyles.module.css';

/** Authors shared presets below Look cards without changing screen assignments. */
export function LyricStyles({
  looks,
  reason,
  onChange,
}: {
  readonly looks: LooksFile;
  readonly reason: string | undefined;
  readonly onChange: (edit: LyricStyleEdit) => void;
}): JSX.Element {
  const [selected, setSelected] = useState<string | null>(null);
  const style =
    looks.lyricStyles.find(item => item.id === selected) ??
    looks.lyricStyles[0];
  return (
    <section aria-label="가사 스타일" className={styles.section}>
      <h3 className={styles.title}>가사 스타일</h3>
      {style === undefined ? (
        <p className={styles.empty}>가사 스타일 없음</p>
      ) : (
        <>
          <div className={styles.segments}>
            <SegmentedControl
              label="가사 스타일 선택"
              kind="tabs"
              options={looks.lyricStyles.map(item => ({
                value: item.id,
                label: item.name,
              }))}
              value={style.id}
              onChange={setSelected}
            />
          </div>
          <div className={styles.preview}>
            <LyricStylePreview style={style} />
          </div>
          <LyricStyleProperties
            key={style.id}
            style={style}
            reason={reason}
            change={change => onChange({id: style.id, change})}
          />
        </>
      )}
    </section>
  );
}
