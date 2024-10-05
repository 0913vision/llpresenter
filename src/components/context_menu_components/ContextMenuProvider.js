import React, { useState, useEffect } from 'react';
import ContextMenu from './ContextMenu';

// const { electronAPI } = window;

export const ContextMenuContext = React.createContext();

function ContextMenuProvider({ children }) {
  const [menuState, setMenuState] = useState({ visible: false, position: { x: 0, y: 0 }, items: [] });
  // const [shortcuts, setShortcuts] = useState({});

  const getMenuState = () => menuState;

  const showMenu = (position, items) => {
    // electronAPI.disableMenuShortcuts();

    // const newShortcuts = {};
    // items.forEach(item => {
    //   if (item.shortcut) {
    //     newShortcuts[item.shortcut.toLowerCase()] = item.onClick; // 단축키를 소문자로 저장
    //   }
    // });
    // setShortcuts(newShortcuts);
    // console.log(newShortcuts);
    setMenuState({ visible: true, position, items });
  };

  const hideMenu = () => {
    setMenuState({ visible: false, position: { x: 0, y: 0 }, items: [] });
    // setShortcuts({});
    // electronAPI.enableMenuShortcuts();
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!menuState.visible) return; 
      console.log(event.key);

      if (event.key !== 'Control' && event.key !== 'Shift' && event.key !== 'Alt') {
        hideMenu(); // ESC 키가 눌리면 메뉴 닫기
        return;
      }};
      /*
      console.log(event.key);
      const key = `${event.ctrlKey ? 'ctrl+' : ''}${event.shiftKey ? 'shift+' : ''}${event.altKey ? 'alt+' : ''}${event.key.toLowerCase()}`;
      console.log(key);
      if (shortcuts[key]) {
        event.preventDefault();
        shortcuts[key]();
        hideMenu();
      }
    };
    */
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuState.visible]);//, shortcuts]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuState.visible) {
        hideMenu(); // 메뉴가 열려 있을 때 외부 클릭 시 메뉴 닫기
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('click', handleClickOutside);
    };
  }, [menuState.visible]);

  return (
    <ContextMenuContext.Provider value={{ showMenu, hideMenu, getMenuState }}>
      {children}
      {menuState.visible && (
        <ContextMenu items={menuState.items} position={menuState.position} onClose={hideMenu} />
      )}
    </ContextMenuContext.Provider>
  );
}

export default ContextMenuProvider;
