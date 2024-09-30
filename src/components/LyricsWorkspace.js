import React, { useState, useEffect, useRef, useContext  } from 'react';
import SlideComponent from './SlideComponent';
import styles from './styles/LyricsWorkspace.module.css';
import { ContextMenuContext } from './ContextMenuProvider';
import { useSelector, useDispatch } from 'react-redux';
import { sequenceActions } from '../redux/slices/sequenceSlice';

function LyricsWorkspace() {
  const [shiftBaseIndex, setShiftBaseIndex] = useState(null);

  const { showMenu, hideMenu, getMenuState } = useContext(ContextMenuContext);
  const workspaceRef = useRef(null);

  const currentSequence = useSelector((state) => state.sequence.currentSequence);
  const currentItems = useSelector((state) => state.sequence.currentItems);
  const currentSequenceObject = useSelector((state) => state.sequence.sequences.find(sequence => sequence.id === currentSequence));
  const items = useSelector((state) => state.sequence.items);
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(sequenceActions.setCurrentItems({ ids: [] }));
  }, [currentSequence]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (getMenuState() === false && event.key === 'Escape' && workspaceRef.current === document.activeElement) {
        dispatch(sequenceActions.setCurrentItems({ ids: [] }));
        // setSelectedSlides([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 워크스페이스 클릭 핸들러
  const handleWorkspaceClick = (event) => {
    dispatch(sequenceActions.setCurrentItems({ids: []}))
    // 클릭한 좌표
    const clickX = event.clientX;
    const clickY = event.clientY;
  
    // 슬라이드 컨테이너와 슬라이드 요소 가져오기
    const slideContainer = document.getElementsByClassName(styles.SlideComponent); // 그리드 컨테이너 (클래스명 변경 가능)
    const slideElements = document.getElementsByClassName(styles.slide); // 슬라이드들의 DOM 요소들 (클래스명은 상황에 맞게 변경)
    const slideRects = Array.from(slideElements).map(slide => slide.getBoundingClientRect());
    const gridGap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--grid-gap').trim());  // 그리드 간격
  
    // console.log(slideRects);

    if (slideRects.length === 0) return;  // 슬라이드가 없는 경우 처리
  
    // 슬라이드 하나의 크기
    const slideWidth = slideRects[0].width;  // 슬라이드의 가로 길이
    const slideHeight = slideRects[0].height;  // 슬라이드의 높이 (일정하다고 가정)
  
    // 그리드의 전체 너비 (컨테이너의 가로 길이)
    const gridWidth = slideContainer[0].clientWidth;
    console.log(gridWidth);
  
    // 한 행에 몇 개의 슬라이드가 들어가는지 계산
    const slidesPerRow = (gridWidth+gridGap)/(gridGap+slideWidth)  // 슬라이드 너비 + 간격
  
    // 세로(행) 계산: 클릭한 Y 좌표를 기준으로 행 번호 계산
    const originY = slideRects[0].top;  // 첫 번째 슬라이드의 Y 좌표
    const originX = slideRects[0].left;
    console.log(slideHeight, gridGap);
    let rowIndex = Math.floor((clickY-originY)/(slideHeight+gridGap));
    if(!(originY + rowIndex*(slideHeight+gridGap) <= clickY && clickY <= originY + rowIndex*(slideHeight+gridGap)+ slideHeight)) rowIndex = -1;

    console.log(`클릭한 좌표: (${clickX}, ${clickY}), 클릭한 행: ${rowIndex}`);
  
    // 해당 행에서 몇 개의 슬라이드가 있는지 확인
  
    // 가로(열) 계산: 클릭한 X 좌표를 기준으로 슬라이드 간 공간 찾기
    if(originX > clickX) {
      console.log('맨 앞에 커서 배치');
      return;
    }

    if(originX + slideWidth*slidesPerRow + gridGap*(slidesPerRow-1) <= clickX) {
      console.log('맨 뒤에 커서 배치');
      return;
    }

    let colIndex = Math.floor((clickX-originX)/(slideWidth+gridGap));
    if(originX + colIndex*(slideWidth+gridGap) <= clickX && clickX <= originX + colIndex*(slideWidth+gridGap)+ slideWidth) {
      console.log('invalid');
      colIndex = -1;
      return;
    }
    else {
      console.log(colIndex); 
      
      return;
    }
  };
  


  // 슬라이드 클릭 핸들러
  const handleSlideClick = (event, slideIndex, id) => {
    hideMenu();
    // event.stopPropagation();
    if (event.shiftKey) {
      // Shift 키를 누르고 있을 때: 범위 선택
      if (shiftBaseIndex === null) {
        // 기준점이 없으면 현재 클릭한 슬라이드를 기준점으로 설정
        setShiftBaseIndex(slideIndex);
        dispatch(sequenceActions.setCurrentItems({ ids: [id] }));
        // setSelectedSlides([slideIndex]);
      } else {
        // 기준점이 설정되어 있으면 기준점에서 현재 슬라이드까지의 범위 선택
        const range = [Math.min(shiftBaseIndex, slideIndex), Math.max(shiftBaseIndex, slideIndex)];
        const newSelection = [];
        for (let i = range[0]; i <= range[1]; i++) {
          if (!newSelection.includes(currentSequenceObject.items[i])) {
            newSelection.push(currentSequenceObject.items[i]);
          }
        }
        dispatch(sequenceActions.setCurrentItems({ ids : newSelection }));
        // setSelectedSlides(newSelection);
      }
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl(또는 Mac에서는 Command) 키를 누르고 있을 때: 멀티 선택
      if (currentItems.includes(id)) {
        dispatch(sequenceActions.setCurrentItems({ ids : currentItems.filter(index => currentItems[index] !== id) }));
        // setSelectedSlides(selectedSlides.filter(index => index !== slideIndex)); // 이미 선택된 슬라이드라면 선택 해제
      } else {
        dispatch(sequenceActions.setCurrentItems({ ids : [...currentItems, id] }));
        // setSelectedSlides([...selectedSlides, slideIndex]); // 새로운 슬라이드를 선택
      }
      setShiftBaseIndex(null); // 기준점 초기화
    } else {
      // 일반 클릭: 단일 선택
      dispatch(sequenceActions.setCurrentItems({ ids : [id] }));
      // setSelectedSlides([slideIndex]);
      setShiftBaseIndex(slideIndex); // 기준점 초기화
    }
  };

  //우클릭

  useEffect(() => {
    window.electronAPI.receiveEditedLyricsData(handleReceiveEditedLyricsData);
    window.electronAPI.receiveNewLyricsData(handleReceiveAddLyricsData);
  }, []);

  const handleReceiveEditedLyricsData = (receivedData) => {
    dispatch(sequenceActions.updateItem({ items: receivedData }));
  };

  const handleReceiveAddLyricsData = (receivedData) => {
    dispatch(sequenceActions.addItem({ item: receivedData }));
  };

  const handleSlideContextMenu = (event, id) => {
    event.preventDefault();    
    let newSelectedSlides = currentItems;

    if (!currentItems.includes(id)) {
      newSelectedSlides = [id];
      dispatch(sequenceActions.setCurrentItems({ ids: newSelectedSlides }));
    }
    const menuItems = [
      { label: 'Edit', 
        onClick: () => window.electronAPI.openLyricsEdit(items.filter((item)=> newSelectedSlides.includes(item.id))),
        shortcut: 'Ctrl+E'
      },
      { label: 'Delete', onClick: () => handleDeleteSlides(newSelectedSlides), shortcut: 'Delete' },
      { label: 'Paste', onClick: () => console.log('Paste Slide clicked'), shortcut: 'Ctrl+V' },
      // { type: 'separator' },
      // { label: 'Properties', onClick: () => console.log('Properties clicked') }
    ];
    showMenu({ x: event.clientX, y: event.clientY }, menuItems);
  };

  // 삭제
  const handleDeleteSlides = (newSelectedSlides) => {
    console.log(newSelectedSlides);
    dispatch(sequenceActions.deleteItems({ ids: newSelectedSlides }));
  };

  const handleWorkspaceContextMenu = (event) => {
    if(!currentSequence) return;
    console.log('workspace context menu');
    const menuItems = [
      { label: 'Add Slide', onClick: () => window.electronAPI.openLyricsAdd(), shortcut: 'Ctrl+N' },
      { label: 'Paste', onClick: () => console.log('Paste Slide clicked'), shortcut: 'Ctrl+V' },
    ];
    showMenu({ x: event.clientX, y: event.clientY }, menuItems);
  };
  

  return (
    <div className={styles.LyricsWorkspace} 
      ref={workspaceRef} 
      tabIndex={0} 
      onClick={(event) => handleWorkspaceClick(event)} 
      onContextMenu={(event) => {event.preventDefault(); handleWorkspaceContextMenu(event)}}>
      <div className={styles.SlideComponent}>
        {currentSequence && currentSequenceObject.items.map((id, slideIndex) => (
          <div
            key={id}
            className={`${styles.slide} ${currentItems.includes(id) ? styles.selected : ''}`}
            onClick={(event) => {
              handleSlideClick(event, slideIndex, id);
            }}
            onContextMenu={(event) => {
              event.preventDefault(); // 우클릭 기본 메뉴 방지
              event.stopPropagation();
              handleSlideContextMenu(event, id); //TODO
            }}
          >
            <SlideComponent
              id={id}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default LyricsWorkspace;
