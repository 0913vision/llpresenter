import type {JSX} from 'react';
import {Button} from '@renderer/ui/Button';
import styles from './SlidesEditor.module.css';

/** Returns from an inline item editor to its service. */
export function SlidesBackButton({
  serviceName,
  onBack,
}: {
  readonly serviceName: string;
  readonly onBack: () => void;
}): JSX.Element {
  return (
    <Button className={styles.back} onClick={onBack}>
      ‹ {serviceName || '예배 순서'}
    </Button>
  );
}
