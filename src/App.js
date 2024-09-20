// src/App.js
import React, { useState, useRef, useEffect } from 'react';
import './App.css'; // App.css 임포트
import MenuBar from './components/MenuBar';
import Sidebar from './components/Sidebar';
import CraftingZone from './components/CraftingZone';


function App() {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedSlide, setSelectedSlide] = useState(null);

  const [leftWidth, setLeftWidth] = useState(80);
  const [rightWidth, setRightWidth] = useState(250);
  const appRef = useRef(null);

  const leftWidthRef = useRef(leftWidth);
  const rightWidthRef = useRef(rightWidth);

  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);

  const [isToggleHovered, setIsResizerToggleButtonHovered] = useState(false);

  useEffect(() => {
    leftWidthRef.current = leftWidth;
  }, [leftWidth]);

  useEffect(() => {
    rightWidthRef.current = rightWidth;
  }, [rightWidth]);

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

  const handleMouseDown = (side) => (e) => {
    dragging.current = side;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (!dragging.current || !appRef.current) return;
    const appWidth = appRef.current.getBoundingClientRect().width;
    const maxWidth = appWidth * 0.4;

    if (dragging.current === 'left') {
      if(isLeftCollapsed) {
        setIsLeftCollapsed(false);
      }
      let newWidth = e.clientX;
      if (newWidth < 100) newWidth = 50; // 최소 너비
      if (newWidth > maxWidth) newWidth = maxWidth;
      setLeftWidth(newWidth);
    } else if (dragging.current === 'right') {
      if(isRightCollapsed) {
        setIsRightCollapsed(false);
      }
      let newWidth = appWidth - e.clientX;
      if (newWidth < 100) newWidth = 50; // 최소 너비
      if (newWidth > maxWidth) newWidth = maxWidth;
      setRightWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    dragging.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const handleFileUpload = (text) => {
    const newSlides = text.split('\n\n').map((slide, index) => ({
      id: index,
      content: slide.trim(),
    }));
    const newGroup = {
      id: groups.length,
      name: `Group ${groups.length + 1}`,
      slides: newSlides,
    };
    setGroups([...groups, newGroup]);
    setSelectedGroup(newGroup);
    setSelectedSlide(null);
  };

  const handleSelectGroup = (group) => {
    console.log(group);
    setSelectedGroup(group);
    setSelectedSlide(null);
  };

  const handleSelectSlide = (slide) => {
    setSelectedSlide(slide);
  };

  const handleGroupUpdate = (updatedGroups) => {
    setGroups(updatedGroups);
  };

  const handleSlideUpdate = (updatedSlide) => {
    const updatedGroups = groups.map((group) => {
      if (group.id === selectedGroup.id) {
        return {
          ...group,
          slides: group.slides.map((slide) =>
            slide.id === updatedSlide.id ? updatedSlide : slide
          ),
        };
      }
      return group;
    });
    setGroups(updatedGroups);
  };

  const toggleLeftSidebar = () => {
    setIsLeftCollapsed(!isLeftCollapsed);
  };
  const toggleRightSidebar = () => {
    setIsRightCollapsed(!isRightCollapsed);
  };

  // src/App.js

  return (
    <div className="appContainer" ref={appRef}>
      <MenuBar onFileUpload={handleFileUpload} />
      <div className="mainContainer">
        {/* 좌측 사이드바 */}
          <div className={`sidebar leftSidebar ${isLeftCollapsed ? 'collapsed' : ''}`} style={{ width: isLeftCollapsed ? '0px' : leftWidth }}>
            <Sidebar position="left" />
          </div>

          {/* 좌측 리사이저 및 토글 버튼 */}
          <div className={`resizer leftResizer ${isToggleHovered ? 'no-hover' : ''}`} onMouseDown={handleMouseDown('left')}>
            <button className={`toggleButton leftToggle ${isLeftCollapsed ? 'collapsed' : ''}`}
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

        {/* 크래프팅 존 */}
        <div className="craftingZoneContainer">
          <CraftingZone
            groups={groups}
            selectedSlide={selectedSlide}
            onSlideUpdate={handleSlideUpdate}
            onSelectSlide={handleSelectSlide}
          />
        </div>

        {/* 우측 리사이저 및 토글 버튼 */}
        <div className={`resizer rightResizer ${isToggleHovered ? 'no-hover' : ''}`} onMouseDown={handleMouseDown('right')}>
          <button className={`toggleButton rightToggle ${isRightCollapsed ? 'collapsed' : ''}`}
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
        <div className={`sidebar rightSidebar ${isRightCollapsed ? 'collapsed' : ''}`} style={{ width: isRightCollapsed ? '0px' : rightWidth }}>
          <Sidebar position="right" />
        </div>
      </div>
    </div>
  );
};

export default App;
