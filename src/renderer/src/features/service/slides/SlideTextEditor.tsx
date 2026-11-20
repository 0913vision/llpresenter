import type {JSX} from 'react';
import {SLIDES_LIMITS} from '@core/schema/service';
import {TextArea, type TextAreaProps} from '@renderer/ui/TextArea';

/** The in-place multiline field shared by announcement and Bible slides. */
export function SlideTextEditor(props: TextAreaProps): JSX.Element {
  return <TextArea {...props} maxLength={SLIDES_LIMITS.text} />;
}
