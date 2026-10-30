import type {JSX} from 'react';
import type {RecentPassage} from '@core/schema/bible';
import {
  BibleReferenceForm,
  type BibleReferenceFormProps,
} from './BibleReferenceForm';
import styles from './BibleReferenceField.module.css';

export interface BibleReferenceFieldProps extends Omit<
  BibleReferenceFormProps,
  'onSubmit'
> {
  readonly recents: readonly RecentPassage[];
  readonly onShow: BibleReferenceFormProps['onSubmit'];
}

/** The Show mount retains preview and output as separate actions. */
export function BibleReferenceField({
  onShow,
  ...props
}: BibleReferenceFieldProps): JSX.Element {
  return (
    <div className={styles.field}>
      <BibleReferenceForm {...props} onSubmit={onShow} />
    </div>
  );
}
