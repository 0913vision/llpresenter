// src/components/LyricsEditWindow.js
import React, { useState, useEffect } from 'react';
import styles from './styles/LyricsEditWindow.module.css';

function LyricsEditWindow() {
  const [lyricsData, setLyricsData] = useState([]);
  const [initialFormState, setInitialFormState] = useState({});
  const [formState, setFormState] = useState({
    content: '',
    isLabeled: false,
    labelColor: '',
    subtitle: '',
  });
  const [isModified, setIsModified] = useState({
    content: false,
    isLabeled: false,
    labelColor: false,
    subtitle: false,
  });

  useEffect(() => {
    window.electronAPI.receiveLyricsToEdit((data) => {
      console.log('LyricsEditWindow data:', data);
      setLyricsData(data);
      initializeForm(data);
    });
    window.electronAPI.receiveEditedColor((color) => {
      handleChange('labelColor', color);
    });
  }, []);

  // data 초기화 및 formState 설정
  const initializeForm = (data) => {
    if (data.length === 1) {
      const formData = {
        content: data[0].content,
        isLabeled: data[0].isLabeled,
        labelColor: data[0].labelColor,
        subtitle: data[0].subtitle,
      };
      setFormState(formData);
      setInitialFormState(formData); // 초기 상태 저장
    } else if (data.length > 1) {
      const allSameLabeled = data.every(
        (slide) => slide.isLabeled === data[0].isLabeled
      );
      const allSameLabelColor = data.every(
        (slide) => slide.labelColor === data[0].labelColor
      );
      const allSameSubtitle = data.every(
        (slide) => slide.subtitle === data[0].subtitle
      );
      const formData = {
        content: '',
        isLabeled: allSameLabeled ? data[0].isLabeled : false,
        labelColor: allSameLabelColor ? data[0].labelColor : '',
        subtitle: allSameSubtitle ? data[0].subtitle : '',
      };
      setFormState(formData);
      setInitialFormState(formData); // 초기 상태 저장
    }
  };

  // 폼 입력 처리
  const handleChange = (field, value) => {
    if (!isModified[field]) {
      console.log('Field modified:', field);
      setIsModified((prev) => ({
        ...prev,
        [field]: true,
      }));
    }

    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleResetField = (field) => {
    setFormState((prev) => ({
      ...prev,
      [field]: initialFormState[field],
    }));
    setIsModified((prev) => ({
      ...prev,
      [field]: false,
    }));
  };

  const handleResetAll = () => {
    setFormState(initialFormState);
    setIsModified({
      content: false,
      isLabeled: false,
      labelColor: false,
      subtitle: false,
    });
  };

  const openColorModal = () => {
    window.electronAPI.openColorModal(formState.labelColor);
  };

  // 수정 완료 버튼 클릭 시 데이터 업데이트
  const handleUpdate = () => {
    const updatedData = lyricsData.map((slide) => {
      let updatedSlide = { ...slide };
  
      if (
        isModified.isLabeled && // 레이블을 고쳤는데
        formState.isLabeled && // 레이블이 true로 설정되어 있음에도
        !(isModified.subtitle && isModified.labelColor) // 부제목과 색깔 중 하나라도 고치지 않았다면
      ) {
        // 올바른 레이블 변경이 아니다. 그러므로,
        // 부제목과 색깔을 원래 슬라이드의 것으로 유지해야한다.
        updatedSlide.subtitle = slide.subtitle;
        updatedSlide.labelColor = slide.labelColor;
        updatedSlide.isLabeled = slide.isLabeled;
      } else {
        // 아니라면, 레이블을 고치지않았거나, 레이블을 고쳤는데 false로 고쳤거나, 부제목과 색깔을 모두 고친 것이다.
        // 그렇다는 것은 각각의 수정사항에 맞게 업데이트해주면된다.

        // 1) 레이블 수정사항은 그대로 반영한다.
        updatedSlide.isLabeled = isModified.isLabeled ? formState.isLabeled : slide.isLabeled;

        // 2) 레이블이 false라는 것은 부제목과 색깔을 원래것으로 유지해야한다.
        if(!formState.isLabeled) {
          updatedSlide.labelColor = slide.labelColor;
          updatedSlide.subtitle = slide.subtitle;
        }
        // 3) 레이블이 true인데 수정된 것이라면, 부제목과 색깔은 모두 수정된 것이다.
        else if(isModified.isLabeled) {
          updatedSlide.labelColor = formState.labelColor;
          updatedSlide.subtitle = formState.subtitle;
        }
        else {
          // 4) 레이블이 true이지만 수정된 것이 없다면, 부제목과 색깔은 원래것으로 유지해야한다.
          updatedSlide.labelColor = slide.labelColor;
          updatedSlide.subtitle = slide.subtitle;
        }
      }
  
      updatedSlide.content = isModified.content ? formState.content : slide.content;
      
  
      return updatedSlide;
    });
  
    setLyricsData(updatedData);
    console.log('Updated Data:', updatedData);
  };
  

  return (
    <div className={styles.editwindow}>
      <div className={styles.container}>
        <h2 className={styles.title}>Edit Slides</h2>
        <div classNAme={styles.content}>
          <div className={styles.gridContainer}>
            {lyricsData.length === 1 && (
              <>
                <label className={styles.label}>Content:</label>
                <div></div>
                <button className={styles.resetButton} onClick={() => handleResetField('content')}>Reset</button>
                <div className={styles.inputBoxWrapper}>
                  <input
                    className={styles.inputBox}
                    type="text"
                    value={formState.content}
                    onChange={(e) => handleChange('content', e.target.value)}
                  />
                </div>
              </>
            )}
            <div className={styles.labelGroup}>
              <label className={styles.label}>레이블</label>
              <input
                type="checkbox"
                checked={formState.isLabeled}
                onChange={(e) => handleChange('isLabeled', e.target.checked)}
              />
            </div>
            <div></div>
            <button className={styles.resetButton} onClick={() => handleResetField('isLabeled')}>Reset</button>
            
            {formState.isLabeled && (
              <>
                <div className={styles.labelGroup}>
                  <label className={styles.label}>부제목</label>
                </div>
                <div></div>
                <button className={styles.resetButton} onClick={() => handleResetField('subtitle')}>Reset</button>
                <div className={styles.inputBoxWrapper}>
                  <input
                    className={styles.inputBox}
                    type="text"
                    value={formState.subtitle}
                    onChange={(e) => handleChange('subtitle', e.target.value)}
                  />
                </div>
                
                <div className={styles.labelGroup}>
                  <label className={styles.label}>색깔</label>
                  <div
                    className={styles.colorButton}
                    style={{ backgroundColor: formState.labelColor }}
                    onClick={openColorModal}
                  />
                </div>
                <div></div>
                <button className={styles.resetButton} onClick={() => handleResetField('labelColor')}>Reset</button>
              </>
            )}
          </div>
        </div>
        <div className={styles.buttonGroup}>
          <button className={styles.resetAllButton} onClick={handleResetAll}>전체 되돌리기</button>
          <button className={styles.applyButton} onClick={handleUpdate}>수정 완료</button>
        </div>
      </div>
    </div>
  );
}

export default LyricsEditWindow;
