import type {JSX, ReactNode} from 'react';

/** Common outer surface and insertion footer for an item editor. */
export function ItemEditorShell({
  label,
  as = 'section',
  className,
  header,
  footer,
  children,
}: {
  readonly label?: string;
  readonly as?: 'section' | 'div';
  readonly className?: string | undefined;
  readonly header?: ReactNode;
  readonly footer: ReactNode;
  readonly children: ReactNode;
}): JSX.Element {
  const Tag = as;
  return (
    <Tag className={className} aria-label={label}>
      {header}
      {children}
      {footer}
    </Tag>
  );
}
