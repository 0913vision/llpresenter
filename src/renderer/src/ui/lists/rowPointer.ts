import styles from './RowPointer.module.css';

/**
 * The class that gives a row or chip of a list the pointer's look every list
 * shares: raised under the pointer, darker while pressed, fading in and out,
 * and nothing on one that is disabled, selected or on. A row drawn without
 * `ListRow` takes it instead of a hover rule of its own (CONTRIBUTING, "UI
 * consistency").
 */
export const ROW_POINTER_CLASS = styles.pointer;
