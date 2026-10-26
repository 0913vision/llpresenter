import {useState, type JSX} from 'react';
import {Menu} from '@renderer/ui/Menu';
import {openOnArrowDown} from '@renderer/ui/menuButton';
import styles from './MenuBar.module.css';

export function FileMenu({
  onImport,
}: {
  readonly onImport?: ((source: 'file' | 'clipboard') => void) | undefined;
}): JSX.Element {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <button
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        className={styles.menu}
        onClick={event =>
          setAnchor(anchor === null ? event.currentTarget : null)
        }
        onKeyDown={event =>
          openOnArrowDown(event, {
            expanded: anchor !== null,
            onExpandedChange: expanded =>
              setAnchor(expanded ? event.currentTarget : null),
          })
        }
      >
        파일
      </button>
      {anchor === null ? null : (
        <Menu
          label="파일"
          anchor={{kind: 'element', element: anchor}}
          onClose={() => setAnchor(null)}
          entries={[
            {
              kind: 'item',
              id: 'import',
              label: '가져오기',
              submenu: [
                {
                  kind: 'item',
                  id: 'text',
                  label: '텍스트 파일',
                  disabled: onImport === undefined,
                  onSelect: () => onImport?.('file'),
                },
                {
                  kind: 'item',
                  id: 'clipboard',
                  label: '클립보드 텍스트',
                  disabled: onImport === undefined,
                  onSelect: () => onImport?.('clipboard'),
                },
                {
                  kind: 'item',
                  id: 'powerpoint',
                  label: 'PowerPoint 파일',
                  disabled: true,
                  title: '아직 지원하지 않는 파일 형식입니다',
                },
              ],
            },
          ]}
        />
      )}
    </>
  );
}
