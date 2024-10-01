import React, { useState, useEffect, useRef, useContext  } from 'react';
import SlideComponent from './SlideComponent';
import styles from './styles/LyricsWorkspace.module.css';
import { ContextMenuContext } from './ContextMenuProvider';
import { useSelector, useDispatch } from 'react-redux';
import { sequenceActions } from '../redux/slices/sequenceSlice';

function LyricsWorkspace({editMode}) {
  const [shiftBaseIndex, setShiftBaseIndex] = useState(null);

  const { showMenu, hideMenu, getMenuState } = useContext(ContextMenuContext);
  const workspaceRef = useRef(null);

  const currentSequence = useSelector((state) => state.sequence.currentSequence);
  const currentItems = useSelector((state) => state.sequence.currentItems);
  const currentSequenceObject = useSelector((state) => state.sequence.sequences.find(sequence => sequence.id === currentSequence));
  const items = useSelector((state) => state.sequence.items);
  const dispatch = useDispatch();

  const [cursorState, setCursorState] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [cursorIndex, setCursorIndex] = useState({index: 0, position: 'left'});
  const cursorIndexRef = useRef(cursorIndex);

  const [previousModeCurrrentItems, setPreviousModeCurrentItems] = useState([]);

  useEffect(() => {
    if (editMode) {
      console.log(currentItems, "currentItems");
      setPreviousModeCurrentItems(currentItems);
    } else {
      dispatch(sequenceActions.setCurrentItems({ids:previousModeCurrrentItems}));
    }
  }, [editMode]);

  useEffect(() => {
    dispatch(sequenceActions.setCurrentItems({ ids: [] }));
  }, [currentSequence]);

  useEffect(() => {
    if(currentItems.length !== 0) {
      setCursorState(false);
    }
  }, [currentItems]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (getMenuState().visible === false && event.key === 'Escape' && workspaceRef.current === document.activeElement) {
        dispatch(sequenceActions.setCurrentItems({ ids: [] }));
        // setSelectedSlides([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 워크스페이스 클릭 핸들러
  const handleWorkspaceClick = (event) => {
    if(!editMode) return;
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
  
    // 한 행에 몇 개의 슬라이드가 들어가는지 계산
    const slidesPerRow = (gridWidth+gridGap)/(gridGap+slideWidth)  // 슬라이드 너비 + 간격
  
    // 세로(행) 계산: 클릭한 Y 좌표를 기준으로 행 번호 계산
    const originY = slideRects[0].top;  // 첫 번째 슬라이드의 Y 좌표
    const originX = slideRects[0].left;
    let rowIndex = Math.floor((clickY-originY)/(slideHeight+gridGap));

    // 첫 번째 케이스 - 1 : 행의 범위를 벗어난 경우
    if(rowIndex < 0 || (slideRects.length%slidesPerRow == 0 && rowIndex >= slideRects.length/slidesPerRow) || (slideRects.length%slidesPerRow != 0 && rowIndex > slideRects.length/slidesPerRow)) {
      // console.log('invalid 0');
      // rowIndex = -1; // 의미는 없음.
      return;
    }

    // 첫 번째 케이스 - 2 : 행과 행 사이를 클릭한 경우
    if(!(originY + rowIndex*(slideHeight+gridGap) <= clickY && clickY <= originY + rowIndex*(slideHeight+gridGap)+ slideHeight)) {
      // console.log('invalid 1');
      // rowIndex = -1; // 의미는 없음.
      return;
    }
    // 즉, -1이면 행과 행 사이를 클릭한 것이다.

     // 이제 행과 행 사이를 누른 경우는 제외 되었다.
    // console.log(`클릭한 좌표: (${clickX}, ${clickY}), 클릭한 행: ${rowIndex}`);

    console.log(rowIndex, Math.floor(slideRects.length/slidesPerRow))

    // 두 번째 케이스: 행의 제일 앞 슬라이드보다 앞을 누른 경우
    if(originX > clickX) {
      // console.log('맨 앞에 커서 배치');
      setCursorIndex({index: (rowIndex)*slidesPerRow, position: 'left'});
      // setCursorPosition({ x: originX-Math.floor(gridGap/2), y: originY + rowIndex*(slideHeight+gridGap)});
      // setCursorState(true);
      return;
    }

    // 세 번째 케이스 예외: 단, 마지막 행이 가득 채워지지 않았다면, 마지막 행은 그 행의 마지막 슬라이드보다 오른쪽으로 대신 처리한다. (먼저적용)
    if(rowIndex === Math.floor(slideRects.length/slidesPerRow) && slideRects.length % slidesPerRow !== 0 && slideRects[slideRects.length-1].right < clickX) {
      console.log('부족한 맨 뒤에 커서 배치');
      setCursorIndex({index: (slideRects.length-1), position: 'right'});
      // setCursorPosition({ x: slideRects[slideRects.length-1].right + Math.floor(gridGap/2), y: originY + rowIndex*(slideHeight+gridGap)});
      // setCursorState(true);
      return;
    }

    // 세 번째 케이스: 행의 제일 뒤 슬라이드보다 뒤를 누른 경우
    if(originX + slideWidth*slidesPerRow + gridGap*(slidesPerRow-1) <= clickX) {
      // console.log('맨 뒤에 커서 배치', (rowIndex+1)*slidesPerRow);
      setCursorIndex({index: (rowIndex+1)*slidesPerRow-1, position: 'right'});
      // setCursorPosition({ x: originX + slideWidth*slidesPerRow + gridGap*(slidesPerRow-1) + Math.floor(gridGap/2), y: originY + rowIndex*(slideHeight+gridGap)});
      // setCursorState(true);
      return;
    }

    // 네 번째 케이스: 맨 앞과 맨 뒤가 아니라면, 슬라이드의 사이를 눌렀을 때 유효한 커서의 위치가 된다.
    // 따라서, 슬라이드를 누른 경우는 제외를 해줘야한다.
    // event.stopPropagation();으로 해결 가능하므로 사실상 필요 없음.
    let colIndex = Math.floor((clickX-originX)/(slideWidth+gridGap));
    if(originX + colIndex*(slideWidth+gridGap) <= clickX && clickX <= originX + colIndex*(slideWidth+gridGap)+ slideWidth) {
      // console.log('invalid 2');
      // colIndex = -1; // 의미는 없음.
      return;
    }

    // console.log(`클릭한 열: ${colIndex}`);
    setCursorIndex({index: colIndex, position: 'right'});
    // setCursorPosition({ x: originX + colIndex*(slideWidth+gridGap) + slideWidth + Math.floor(gridGap/2), y: originY + rowIndex*(slideHeight+gridGap)});
    // setCursorState(true);
  };

  useEffect(() => {
    cursorIndexRef.current = cursorIndex;
    handleCursorPosition(cursorIndexRef.current);
  }, [cursorIndex]);
  
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      handleCursorPosition(cursorIndexRef.current); // 최신 cursorIndex 값 전달
    });
  
    if (workspaceRef.current) {
      resizeObserver.observe(workspaceRef.current);
    }
  
    return () => {
      if (workspaceRef.current) {
        resizeObserver.unobserve(workspaceRef.current);
      }
    };
  }, []);

  const handleCursorPosition = (currentCursorIndex) => {
    // 슬라이드 DOM 요소와 관련된 정보 가져오기
    const slideElements = document.getElementsByClassName(styles.slide); // 슬라이드들의 DOM 요소들
    const slideRects = Array.from(slideElements).map(slide => slide.getBoundingClientRect());
    const gridGap = Math.floor(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--grid-gap').trim()));  // 그리드 간격

    if (slideRects.length === 0) return;  // 슬라이드가 없는 경우 처리
  
    // 첫 번째 슬라이드 위치 정보 (기준점)
    const originX = slideRects[0].left;
    const originY = slideRects[0].top;

    // console.log(originX, originY);
    
    // 슬라이드 하나의 크기
    const slideWidth = slideRects[0].width;  // 슬라이드의 가로 길이
    const slideHeight = slideRects[0].height;  // 슬라이드의 높이

    // 슬라이드 컨테이너 너비 (한 행에 몇 개의 슬라이드가 들어가는지 계산하기 위함)
    const slideContainer = document.getElementsByClassName(styles.SlideComponent);
    const gridWidth = slideContainer[0].clientWidth;
  
    // 한 행에 들어가는 슬라이드의 개수 계산
    const slidesPerRow = Math.floor((gridWidth + gridGap) / (slideWidth + gridGap));
  
    // 커서 인덱스가 범위 내에 있을 경우
    const rowIndex = Math.floor(currentCursorIndex.index / slidesPerRow); // 행 계산
    const colIndex = currentCursorIndex.index % slidesPerRow; // 열 계산
  
    // 커서가 슬라이드의 왼쪽 혹은 오른쪽에 배치되는지에 따라 위치 결정
    let newPositionX;
    if (currentCursorIndex.position === 'left') {
      // 슬라이드의 왼쪽에 배치
      newPositionX = originX + colIndex * (slideWidth + gridGap) - Math.floor(gridGap / 2)-1; //cursor width 2px
    } else if (currentCursorIndex.position === 'right') {
      // 슬라이드의 오른쪽에 배치
      newPositionX = originX + colIndex * (slideWidth + gridGap) + slideWidth + Math.floor(gridGap / 2)-1; //cursor width 2px
    }

    // 커서의 Y 좌표는 행에 따라 결정
    const newPositionY = originY + rowIndex * (slideHeight + gridGap);

    console.log(newPositionX, newPositionY, currentCursorIndex);

    // 커서 상태 및 위치 업데이트
    setCursorPosition({ x: newPositionX, y: newPositionY });
    setCursorState(true);
  };
  
  // 슬라이드 클릭 핸들러
  const handleSlideClick = (event, slideIndex, id) => {
    hideMenu();
    event.stopPropagation();
    if (editMode && event.shiftKey) {
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
    } else if (editMode && (event.ctrlKey || event.metaKey)) {
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

  useEffect(() => {
    if(editMode) return;
    if (currentItems.length <= 1) {
      window.electronAPI.sendLyrics(currentItems.length === 1 ? items.find((item) => item.id === currentItems[0]).content : '');
    }
  }, [currentItems]);

  //우클릭

  useEffect(() => {
    window.electronAPI.receiveEditedLyricsData(handleReceiveEditedLyricsData);
    window.electronAPI.receiveNewLyricsData(handleReceiveAddLyricsData);
  }, []);

  const handleReceiveEditedLyricsData = (receivedData) => {
    dispatch(sequenceActions.updateItem({ items: receivedData }));
  };

  const handleReceiveAddLyricsData = (receivedData) => {
    dispatch(sequenceActions.addItem({ item: receivedData, index: cursorIndexRef.current.position === "left" ? cursorIndexRef.current.index : cursorIndexRef.current.index + 1 }));
    setCursorIndex((prevIndex) => ({ ...prevIndex, index: prevIndex.index + 1 }));
  };

  const handleSlideContextMenu = (event, id) => {
    if(!editMode) return;
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
      // { label: 'Paste', onClick: () => console.log('Paste Slide clicked'), shortcut: 'Ctrl+V' },
      // { type: 'separator' },
      // { label: 'Properties', onClick: () => console.log('Properties clicked') }
    ];
    showMenu({ x: event.clientX, y: event.clientY }, menuItems);
  };

  // 삭제
  const handleDeleteSlides = (newSelectedSlides) => {
    // console.log(newSelectedSlides);
    dispatch(sequenceActions.deleteItems({ ids: newSelectedSlides }));
    setCursorState(false);
  };

  const handleWorkspaceContextMenu = (event) => {
    if(!currentSequence) return;
    if(!editMode) return;
    handleWorkspaceClick(event);
    console.log('workspace context menu');
    const menuItems = [
      { label: 'Add Slide', onClick: () => window.electronAPI.openLyricsAdd(), shortcut: 'Ctrl+N' },
      // { label: 'Paste', onClick: () => console.log('Paste Slide clicked'), shortcut: 'Ctrl+V' },
    ];
    showMenu({ x: event.clientX, y: event.clientY }, menuItems);
  };
  

  return (
    <div className={styles.LyricsWorkspace} 
      ref={workspaceRef} 
      tabIndex={0} 
      onClick={(event) => handleWorkspaceClick(event)} 
      onContextMenu={(event) => {event.preventDefault(); handleWorkspaceContextMenu(event)}}>
      {cursorState && <div className={styles.cursor} style={{ left: cursorPosition.x, top: cursorPosition.y }} />}
      <div className={styles.SlideComponent}>
        {currentSequence && currentSequenceObject.items.map((id, slideIndex) => (
          <div
            key={id}
            className={`${styles.slide} ${currentItems.includes(id) ? (editMode ? styles.edit_selected : styles.show_selected) : ''}`}
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
