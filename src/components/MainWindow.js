// src/components/MainWindow.js
import React, { useState, useRef, useEffect } from 'react';

import RightSidebar from './RightSidebar';
import LeftSidebar from './LeftSidebar';
import LyricsWorkspace from './LyricsWorkspace';
import MediaWorkspace from './MediaWorkspace';
import ContextMenuProvider from './ContextMenuProvider';
import styles from './styles/MainWindow.module.css';
// import './styles/MainWindow.css';

function MainWindow () {
  const [lyricsGroups, setLyricsGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);

  const [leftWidth, setLeftWidth] = useState(100);
  const [rightWidth, setRightWidth] = useState(250);
  const [bottomHeight, setBottomHeight] = useState(200);
  const [topHeight, setTopHeight] = useState(0);

  const minLeftWidth = 100;
  const minRightWidth = 100;
  const appRef = useRef(null);

  const leftWidthRef = useRef(leftWidth);
  const rightWidthRef = useRef(rightWidth);
  const bottomHeightRef = useRef(bottomHeight);

  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);

  const [isToggleHovered, setIsResizerToggleButtonHovered] = useState(false);

  useEffect(() => {
    window.electronAPI.handleFileUpload((event, name, data) => {
      handleFileUpload(name, data);
    });
  }, [lyricsGroups]);

  useEffect(() => {
    leftWidthRef.current = leftWidth;
  }, [leftWidth]);

  useEffect(() => {
    rightWidthRef.current = rightWidth;
  }, [rightWidth]);

  useEffect(() => {
    bottomHeightRef.current = bottomHeight;
  }, [bottomHeight]);

  const dragging = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      const appWidth = appRef.current.getBoundingClientRect().width;
      const maxWidth = appWidth * 0.4;
      if (leftWidthRef.current > maxWidth) setLeftWidth(maxWidth);
      if (rightWidthRef.current > maxWidth) setRightWidth(maxWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []); 

  const toggleLeftSidebar = () => {
    setIsLeftCollapsed(!isLeftCollapsed);
  };
  const toggleRightSidebar = () => {
    setIsRightCollapsed(!isRightCollapsed);
  };

  const handleMouseDown = (side) => (e) => {
    dragging.current = side;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (!dragging.current || !appRef.current) return;
    const appWidth = appRef.current.getBoundingClientRect().width;
    const appHeight = appRef.current.getBoundingClientRect().height;
    const maxWidth = appWidth * 0.4;
    const maxHeight = appHeight * 0.5;

    if (dragging.current === 'left') {
      if(isLeftCollapsed) {
        setIsLeftCollapsed(false);
      }
      let newWidth = e.clientX;
      if (newWidth < minLeftWidth) newWidth = minLeftWidth; // 최소 너비
      if (newWidth > maxWidth) newWidth = maxWidth;
      setLeftWidth(newWidth);
    } else if (dragging.current === 'right') {
      if(isRightCollapsed) {
        setIsRightCollapsed(false);
      }
      let newWidth = appWidth - e.clientX;
      if (newWidth < minRightWidth) newWidth = minRightWidth; // 최소 너비
      if (newWidth > maxWidth) newWidth = maxWidth;
      setRightWidth(newWidth);
    } else if (dragging.current === 'middle') {
      let newHeight = appHeight - e.clientY;
      if (newHeight < minRightWidth) newHeight = minRightWidth; // 최소 높이
      if (newHeight > maxHeight) newHeight = maxHeight;
      setBottomHeight(newHeight);
    }
  };

  useEffect(() => {
    if (appRef.current) {
      setTopHeight(appRef.current.getBoundingClientRect().height - bottomHeight);
    }
  }, [bottomHeight]);

  const handleMouseUp = () => {
    dragging.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const handleFileUpload = (name, text) => {
    console.log(text.split('\n\n'));
    const newSlides = text.split('\n\n').map((slide, index) => ({
      id: index,
      content: slide.trim(),
      isLabeled: false,
      subtitle: '',
      labelColor: '',
    }));
    const newLyricGroup = {
      id: lyricsGroups.length,
      name: name,
      slides: newSlides,
    };
    setLyricsGroups([...lyricsGroups, newLyricGroup]);
    setSelectedGroup(newLyricGroup);
  };

  const handleSelectGroup = (group) => {
    setSelectedGroup(group);
  };

  const handleUpdateSelectedGroup = (updatedGroup) => {
    setLyricsGroups((prevGroups) =>
      prevGroups.map((group) =>
        group.id === updatedGroup.id ? updatedGroup : group
      )
    );
    setSelectedGroup(updatedGroup);
  };

  return (
    <ContextMenuProvider>
      <div className={styles.appContainer} ref={appRef}>
        <div className={styles.mainContainer}>
          {/* 좌측 사이드바 */}
          <div className={`${styles.sidebar} ${styles.leftSidebar} ${isLeftCollapsed ? `${styles.collapsed}` : ''}`} style={{ width: isLeftCollapsed ? '0px' : leftWidth }}>
            <LeftSidebar 
              groups={lyricsGroups}
              selectedGroup={selectedGroup}
              onGroupSelect={handleSelectGroup}
            />
          </div>

          {/* 좌측 리사이저 및 토글 버튼 */}
          <div className={`${styles.resizer} ${styles.leftResizer} ${styles.vertical} ${isToggleHovered ? `${styles.no_hover}` : ''}`} onMouseDown={handleMouseDown('left')}>
            <button className={`${styles.toggleButton} ${styles.leftToggle} ${isLeftCollapsed ? `${styles.collapsed}` : ''}`}
              onMouseEnter={() => setIsResizerToggleButtonHovered(true)}
              onMouseLeave={() => setIsResizerToggleButtonHovered(false)}
              onClick={(e) => {
                e.stopPropagation(); // 이벤트 전파 중단
                toggleLeftSidebar();
              }}
              onMouseDown={(e) => {
                e.stopPropagation(); // 드래깅 방지
              }}
            >
              {isLeftCollapsed ? '▶' : '◀'}
            </button>
          </div>

          <div className={styles.WorkspaceContainer}>
            <div className={styles.LyricsWorkspaceContainer} style={{ height: topHeight }}>
              <LyricsWorkspace
                currentLyricsGroup={selectedGroup}
                updateLyricsGroup={handleUpdateSelectedGroup}
              />
            </div>
            <div className={`${styles.resizer} ${styles.horizontal}`} onMouseDown={handleMouseDown('middle')} />
            <div className={styles.MediaWorkspaceContainer} style={{ height: bottomHeight }}>
              <MediaWorkspace />
            </div>
          </div>

          {/* 우측 리사이저 및 토글 버튼 */}
          <div className={`${styles.resizer} ${styles.rightResizer} ${styles.vertical}${isToggleHovered ? `${styles.no_hover}` : ''}`} onMouseDown={handleMouseDown('right')}>
            <button className={`${styles.toggleButton} ${styles.rightToggle} ${isRightCollapsed ? `${styles.collapsed}` : ''}`}
              onMouseEnter={() => setIsResizerToggleButtonHovered(true)}
              onMouseLeave={() => setIsResizerToggleButtonHovered(false)}
              onClick={(e) => {
                e.stopPropagation(); // 이벤트 전파 중단
                toggleRightSidebar();
              }}
              onMouseDown={(e) => {
                e.stopPropagation(); // 드래깅 방지
              }}
            >
              {isRightCollapsed ? '◀' : '▶'}
            </button>
          </div>

          {/* 우측 사이드바 */}
          <div className={`${styles.sidebar} ${styles.rightSidebar} ${isRightCollapsed ? `${styles.collapsed}` : ''}`} style={{ width: isRightCollapsed ? '0px' : rightWidth }}>
            <RightSidebar/>
          </div>
        </div>
      </div>
    </ContextMenuProvider>
  );
};

export default MainWindow;