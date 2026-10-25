import type {JSX} from 'react';
import {useShow} from '@renderer/state/show';
import {Icon} from '@renderer/ui/Icon';
import {TruncatedText} from '@renderer/ui/TruncatedText';
import styles from './ServiceOrderHeader.module.css';

const CHEVRON_SIZE = 12;

/** The chosen service name; the service picker is not available yet. */
export function ServiceOrderHeader(): JSX.Element {
  const name = useShow(view =>
    view.serviceId === null ? null : view.serviceName,
  );
  return (
    <div className={styles.heading}>
      <TruncatedText text={name ?? '예배 순서'} className={styles.name} />
      {name === null ? null : (
        <Icon name="down" size={CHEVRON_SIZE} className={styles.chevron} />
      )}
    </div>
  );
}
