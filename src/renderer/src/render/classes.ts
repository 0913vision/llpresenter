import styles from './layers.module.css';

function classOf(key: string): string {
  return styles[key] ?? key;
}

/** The class names of `layers.module.css`, never undefined, for `classList`. */
export const classes = {
  root: classOf('root'),
  layer: classOf('layer'),
  video: classOf('video'),
  image: classOf('image'),
  dissolving: classOf('dissolving'),
  page: classOf('page'),
  instant: classOf('instant'),
  shown: classOf('shown'),
  block: classOf('block'),
  shadow: classOf('shadow'),
  outline: classOf('outline'),
} as const;
