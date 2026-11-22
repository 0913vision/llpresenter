import {useId, type JSX} from 'react';
import {SLIDES_LIMITS} from '@core/schema/service';
import type {Slide, SlidesItem} from '@core/services/slidesEdits';
import {Button, TextField} from '@renderer/ui';
import {TextArea} from '@renderer/ui/TextArea';
import {useShownTexts} from '../items/SlideBoxFields';
import styles from './SlidesEditor.module.css';

/** The texts of one slide of a slides item, where they are kept. */
export function SlideFields({
  slide,
  form,
  name,
  replace,
  change,
  endTyping,
}: {
  readonly slide: Slide;
  readonly form: SlidesItem['slides']['form'];
  readonly name: string;
  readonly replace?: ((button: HTMLElement) => void) | undefined;
  readonly change: (slide: Slide, field: string) => void;
  readonly endTyping: () => void;
}): JSX.Element {
  const shown = useShownTexts();
  const id = useId();
  if ('verse' in slide) {
    return (
      <div className={styles.fields}>
        <span className={styles.verseReference}>{name}</span>
      </div>
    );
  }
  if ('media' in slide) {
    return (
      <div className={styles.pictureFile}>
        <span>{name}</span>
        {replace === undefined ? null : (
          <Button
            variant="ghost"
            onClick={event => replace(event.currentTarget)}
          >
            바꾸기
          </Button>
        )}
      </div>
    );
  }
  const ad = form === 'ad';
  const {reference, ...textSlide} =
    'reference' in slide ? slide : {...slide, reference: undefined};
  return (
    <div className={styles.fields} data-form={form}>
      {ad ? (
        <>
          <label htmlFor={`name-${id}`}>이름</label>
          <TextField
            className={styles.nameField}
            id={`name-${id}`}
            aria-label="슬라이드 이름"
            value={slide.name ?? ''}
            maxLength={SLIDES_LIMITS.name}
            onChange={name => change({...slide, name}, 'name')}
            onBlur={endTyping}
          />
        </>
      ) : null}
      {shown.text || slide.text !== '' ? (
        <>
          {ad ? <label htmlFor={`text-${id}`}>내용</label> : null}
          <TextArea
            id={`text-${id}`}
            aria-label={ad ? '내용' : '글'}
            value={slide.text}
            maxLength={SLIDES_LIMITS.text}
            onChange={text => change({...slide, text}, 'text')}
            onBlur={endTyping}
          />
        </>
      ) : null}
      {shown.reference || reference !== undefined ? (
        <>
          <label htmlFor={`reference-${id}`}>본문 주소</label>
          <TextField
            id={`reference-${id}`}
            value={reference ?? ''}
            maxLength={SLIDES_LIMITS.reference}
            onChange={value => {
              const next =
                value === '' ? textSlide : {...textSlide, reference: value};
              change(next, 'reference');
            }}
            onBlur={endTyping}
          />
        </>
      ) : null}
    </div>
  );
}
