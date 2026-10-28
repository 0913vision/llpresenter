import {useState, type JSX} from 'react';
import type {Result} from '@shared/result';
import type {LooksFile} from '@shared/schema/looks';
import type {LyricStyleId} from '@shared/schema/ids';
import type {LyricEffectsChange} from './lyricEffectsEdits';
import type {LyricStyleEdit} from './lyricStyleEdits';
import {LyricStylePreview} from './LyricStylePreview';
import {LyricStyleProperties} from './LyricStyleProperties';
import {LyricStyleSelector} from './LyricStyleSelector';
import type {
  LyricStyleListEdit,
  LyricStyleListProblem,
} from './lyricStyleListEdits';
import styles from './LyricStyles.module.css';

/** Authors shared presets below Look cards without changing screen assignments. */
export function LyricStyles({
  looks,
  reason,
  onChange,
  onEffectsChange,
  onListChange,
  onProblem,
}: {
  readonly looks: LooksFile;
  readonly reason: string | undefined;
  readonly onChange: (edit: LyricStyleEdit) => Promise<boolean> | undefined;
  readonly onEffectsChange: (
    id: LyricStyleId,
    change: LyricEffectsChange,
  ) => Promise<boolean> | undefined;
  readonly onListChange: (
    edit: LyricStyleListEdit,
  ) => Promise<Result<boolean, LyricStyleListProblem>> | undefined;
  readonly onProblem: (reason: string) => void;
}): JSX.Element {
  const [selected, setSelected] = useState<string | null>(null);
  const style =
    looks.lyricStyles.find(item => item.id === selected) ??
    looks.lyricStyles[0];
  return (
    <section aria-label="가사 스타일" className={styles.section}>
      <h3 className={styles.title}>가사 스타일</h3>
      <LyricStyleSelector
        looks={looks}
        value={style?.id}
        reason={reason}
        onSelect={setSelected}
        onChange={onListChange}
        onProblem={onProblem}
      />
      {style === undefined ? (
        <p className={styles.empty}>가사 스타일 없음</p>
      ) : (
        <>
          <div className={styles.preview}>
            <LyricStylePreview style={style} />
          </div>
          <LyricStyleProperties
            key={style.id}
            style={style}
            reason={reason}
            change={change => onChange({id: style.id, change})}
            changeEffects={change => onEffectsChange(style.id, change)}
          />
        </>
      )}
    </section>
  );
}
