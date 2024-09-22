import React, { useState, useEffect, useRef, useContext  } from 'react';
import SlideComponent from './SlideComponent';
import styles from './styles/LyricsWorkspace.module.css';
import { ContextMenuContext } from './ContextMenuProvider';

function LyricsWorkspace({
  currentLyricsGroup,
  updateLyricsGroup
}) {
  const [selectedSlides, setSelectedSlides] = useState([]);
  const [shiftBaseIndex, setShiftBaseIndex] = useState(null);
  const { showMenu, hideMenu, getMenuState } = useContext(ContextMenuContext);
  const workspaceRef = useRef(null);

  useEffect(() => {
    setSelectedSlides([]);
  }, [currentLyricsGroup]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (getMenuState() === false && event.key === 'Escape' && workspaceRef.current === document.activeElement) {
        setSelectedSlides([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 슬라이드 클릭 핸들러
  const handleSlideClick = (event, slideIndex) => {
    hideMenu();
    event.stopPropagation();
    if (event.shiftKey) {
      // Shift 키를 누르고 있을 때: 범위 선택
      if (shiftBaseIndex === null) {
        // 기준점이 없으면 현재 클릭한 슬라이드를 기준점으로 설정
        setShiftBaseIndex(slideIndex);
        setSelectedSlides([slideIndex]);
      } else {
        // 기준점이 설정되어 있으면 기준점에서 현재 슬라이드까지의 범위 선택
        const range = [Math.min(shiftBaseIndex, slideIndex), Math.max(shiftBaseIndex, slideIndex)];
        const newSelection = [];
        for (let i = range[0]; i <= range[1]; i++) {
          if (!newSelection.includes(i)) {
            newSelection.push(i);
          }
        }
        setSelectedSlides(newSelection);
      }
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl(또는 Mac에서는 Command) 키를 누르고 있을 때: 멀티 선택
      if (selectedSlides.includes(slideIndex)) {
        setSelectedSlides(selectedSlides.filter(index => index !== slideIndex)); // 이미 선택된 슬라이드라면 선택 해제
      } else {
        setSelectedSlides([...selectedSlides, slideIndex]); // 새로운 슬라이드를 선택
      }
      setShiftBaseIndex(null); // 기준점 초기화
    } else {
      // 일반 클릭: 단일 선택
      setSelectedSlides([slideIndex]);
      setShiftBaseIndex(slideIndex); // 기준점 초기화
    }
  };

  //우클릭

  const handleSlideContextMenu = (event, slideIndex) => {
    event.preventDefault();
    if (!selectedSlides.includes(slideIndex)) {
      setSelectedSlides([slideIndex]);
    }
    const menuItems = [
      { label: 'Edit', onClick: () => console.log('Edit clicked'), shortcut: 'Ctrl+E' },
      { label: 'Delete', onClick: () => handleDeleteSlides(), shortcut: 'Delete' },
      // { type: 'separator' },
      // { label: 'Properties', onClick: () => console.log('Properties clicked') }
    ];
    showMenu({ x: event.clientX, y: event.clientY }, menuItems);
  };

  // 삭제
  const handleDeleteSlides = () => {
    const updatedSlides = currentLyricsGroup.slides.filter((_, index) => !selectedSlides.includes(index));
    const updatedGroup = { ...currentLyricsGroup, slides: updatedSlides };
    updateLyricsGroup(updatedGroup); // 선택된 그룹을 업데이트
    setSelectedSlides([]);
  };
  

  return (
    <div className={styles.LyricsWorkspace} ref={workspaceRef} tabIndex={0} onClick={() => setSelectedSlides([])}>
      <div className={styles.SlideComponent}>
        {currentLyricsGroup && currentLyricsGroup.slides.map((slide, slideIndex) => (
          <div
            key={slide.id}
            className={`${styles.slide} ${selectedSlides.includes(slideIndex) ? styles.selected : ''}`}
            onClick={(event) => handleSlideClick(event, slideIndex)}
            onContextMenu={(event) => {
              event.preventDefault(); // 우클릭 기본 메뉴 방지
              handleSlideContextMenu(event, slideIndex);
            }}
          >
            <SlideComponent
              slide={slide}
              index={slideIndex}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default LyricsWorkspace;
