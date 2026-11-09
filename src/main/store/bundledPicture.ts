import type {ThemePicture} from '@core/themes/pictures';

/** A named app picture with its packaged file location. */
export interface BundledPicture extends ThemePicture {
  readonly file: string;
}
