import {useState, type JSX} from 'react';
import type {ItemRow} from '@core/presentation/model';
import {applyService} from '@renderer/session/show';
import {Button} from '@renderer/ui/Button';
import styles from './BibleLoadNotice.module.css';

/** A failed saved passage is retried only when the operator asks. */
export function BibleLoadNotice({
  row,
}: {
  readonly row: ItemRow;
}): JSX.Element | null {
  const [retrying, setRetrying] = useState(false);
  if (row.problem !== 'loading-bible' && row.problem !== 'missing-bible') {
    return null;
  }
  const loading = retrying || row.problem === 'loading-bible';
  const retry = (): void => {
    if (
      window.llp === undefined ||
      row.kind !== 'bible' ||
      row.bible === undefined
    ) {
      return;
    }
    const api = window.llp;
    setRetrying(true);
    api.bible
      .lookup({translation: row.bible.translation, input: row.bible.ref})
      .then(() => api.service.get())
      .then(
        service => {
          if (service !== null) applyService(service);
        },
        (error: unknown) =>
          console.error('Could not retry Bible passage', error),
      )
      .finally(() => setRetrying(false))
      .catch((error: unknown) => console.error(error));
  };
  return (
    <div className={styles.notice} role="status">
      <span>
        {loading
          ? '\ubcf8\ubb38\uc744 \ubc1b\ub294 \uc911\uc785\ub2c8\ub2e4'
          : '\uc778\ud130\ub137 \uc5f0\uacb0\uc774 \uc5c6\uc5b4 \ubcf8\ubb38\uc744 \ubc1b\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4'}
      </span>
      {!loading && row.kind === 'bible' && row.bible !== undefined ? (
        <Button onClick={retry}>{'\ub2e4\uc2dc \uc2dc\ub3c4'}</Button>
      ) : null}
    </div>
  );
}
