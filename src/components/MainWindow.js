// src/components/MainWindow.js
import React, { useState, useRef, useEffect } from 'react';

import RightSidebar from './RightSidebar';
import LeftSidebar from './LeftSidebar';
import LyricsWorkspace from './LyricsWorkspace';
import MediaWorkspace from './MediaWorkspace';
import ContextMenuProvider from './ContextMenuProvider';
import styles from './styles/MainWindow.module.css';
import { useDispatch, useSelector } from 'react-redux';
import { sequenceActions } from '../redux/slices/sequenceSlice';

function MainWindow () {
  const dispatch = useDispatch();
  // const [lyricsGroups, setLyricsGroups] = useState([]); //TODO
  // const [selectedGroup, setSelectedGroup] = useState(null); //TODO

  const [leftWidth, setLeftWidth] = useState(150);
  const [rightWidth, setRightWidth] = useState(400);
  const [bottomHeight, setBottomHeight] = useState(250);
  
  const [isEditMode, setIsEditMode] = useState(false);

  const minLeftWidth = 100;
  const minRightWidth = 100;
  const minBottomHeight = 100;
  const mainRef = useRef(null);
  const topBarRef = useRef(null);

  const leftWidthRef = useRef(leftWidth);
  const rightWidthRef = useRef(rightWidth);
  const bottomHeightRef = useRef(bottomHeight);

  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);

  const [isToggleHovered, setIsResizerToggleButtonHovered] = useState(false);

  useEffect(() => {
    window.electronAPI.handleFileUpload((event, name, text) => {
      dispatch(sequenceActions.createSequence({ name, text, update: true }));
      // dispatch(sequenceActions.setCurrentSequence({ id: sequencesRef.current[sequencesRef.current.length-1].id }));
      // dispatch(sequenceActions.setCurrentSequence({ id: sequences[sequences.length-1].id }));
      // handleFileUpload(name, text);
    });
  }, []);

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
      const appWidth = mainRef.current.getBoundingClientRect().width;
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
    if (!dragging.current || !mainRef.current) return;
    const appWidth = mainRef.current.getBoundingClientRect().width;
    const appHeight = mainRef.current.getBoundingClientRect().height;
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
      let newHeight = appHeight - e.clientY + topBarRef.current.getBoundingClientRect().height;
      if (newHeight < minBottomHeight) newHeight = minRightWidth; // 최소 높이
      if (newHeight > maxHeight) newHeight = maxHeight;
      setBottomHeight(newHeight);
    }
  };

  const handleMouseUp = () => {
    dragging.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  return (
    <ContextMenuProvider>
      <div className={styles.appContainer}>
        <div className={styles.topBar} ref={topBarRef}>
          <div className={`${styles.editButton} ${isEditMode ? styles.activeButton : ''}`} onClick={() => {
            setIsEditMode(!isEditMode);
          }}>편집모드<span className={`material-symbols-outlined ${styles.materialSymbolsOutlined}`}>edit</span></div>
        </div>
        <div className={styles.mainContainer} ref={mainRef}>
          {/* 좌측 사이드바 */}
          <div className={`${styles.sidebar} ${styles.leftSidebar} ${isLeftCollapsed ? `${styles.collapsed}` : ''}`} style={{ width: isLeftCollapsed ? '0px' : leftWidth }}>
            <LeftSidebar />
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
            <div className={styles.LyricsWorkspaceContainer}>
              <LyricsWorkspace editMode={isEditMode}/>
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