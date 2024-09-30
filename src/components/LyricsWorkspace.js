import React, { useState, useEffect, useRef, useContext  } from 'react';
import SlideComponent from './SlideComponent';
import styles from './styles/LyricsWorkspace.module.css';
import { ContextMenuContext } from './ContextMenuProvider';
import { useSelector, useDispatch } from 'react-redux';
import { sequenceActions } from '../redux/slices/sequenceSlice';

function LyricsWorkspace() {
  const [shiftBaseIndex, setShiftBaseIndex] = useState(null);

  const [cursorIndex, setCursorIndex] = useState(null); // 커서 위치 관리
  const Cursor = () => <div className={styles.cursor}></div>;

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

  // 슬라이드 클릭 핸들러
  const handleSlideClick = (event, slideIndex, id) => {
    hideMenu();
    event.stopPropagation();
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
      onClick={() => dispatch(sequenceActions.setCurrentItems({ids: []}))} 
      onContextMenu={(event) => {event.preventDefault(); handleWorkspaceContextMenu(event)}}>
      <div className={styles.SlideComponent}>
        {currentSequence && currentSequenceObject.items.map((id, slideIndex) => (
          <React.Fragment key={`slide-cursor-${id}`}>
            {cursorIndex === slideIndex && <Cursor />} 
            <div
              key={id}
              className={`${styles.slide} ${currentItems.includes(id) ? styles.selected : ''}`}
              onClick={(event) => {
                handleSlideClick(event, slideIndex, id);
                setCursorIndex(slideIndex);
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
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export default LyricsWorkspace;
