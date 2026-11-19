import type {JSX, ReactNode} from 'react';

/** Common outer surface and insertion footer for an item editor. */
export function ItemEditorShell({
  label,
  as = 'section',
  className,
  footer,
  children,
}: {
  readonly label?: string;
  readonly as?: 'section' | 'div';
  readonly className: string;
  readonly footer: ReactNode;
  readonly children: ReactNode;
}): JSX.Element {
  const Tag = as;
  return (
    <Tag className={className} aria-label={label}>
      {children}
      {footer}
    </Tag>
  );
}
