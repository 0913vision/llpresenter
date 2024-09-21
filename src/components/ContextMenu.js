import React from 'react';
import styles from './styles/ContextMenu.module.css';

function ContextMenu({ items, position, onClose }) {
  return (
    <div
      className={styles.contextMenu}
      style={{ top: position.y, left: position.x }}
      onClick={(event) => event.stopPropagation()}
    >
      {items.map((item, index) => (
        item.type === 'separator' ? (
          <div key={index} className={styles.separator}></div>
        ) : (
          <div key={index} className={styles.menuItem} onClick={() => {
            item.onClick();
            onClose();
          }}>
            {item.label}
            {item.shortcut && <span className={styles.shortcut}>{item.shortcut}</span>}
            
          </div>
        )
      ))}
    </div>
  );
}

export default ContextMenu;
