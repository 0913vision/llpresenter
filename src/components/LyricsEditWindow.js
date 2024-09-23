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
    window.electronAPI.sendLyricsDataToEditWindow((data) => {
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
    // window.electronAPI.openColorModal("#123456");
  };

  // 수정 완료 버튼 클릭 시 데이터 업데이트
  const handleUpdate = () => {
    const updatedData = lyricsData.map((slide) => {
      let updatedSlide = { ...slide };
  
      // isLabeled 상태가 true로 변경되었고, subtitle 또는 labelColor가 변경되지 않은 경우 원래 상태로 유지
      if (
        isModified.isLabeled &&
        formState.isLabeled &&
        !isModified.subtitle &&
        !isModified.labelColor
      ) {
        updatedSlide.isLabeled = slide.isLabeled; // 원래 상태로 되돌림
      } else {
        updatedSlide.isLabeled = isModified.isLabeled
          ? formState.isLabeled
          : slide.isLabeled;
      }
  
      // 다른 필드 업데이트 처리
      updatedSlide.content = isModified.content ? formState.content : slide.content;
      updatedSlide.labelColor = isModified.labelColor ? formState.labelColor : slide.labelColor;
      updatedSlide.subtitle = isModified.subtitle ? formState.subtitle : slide.subtitle;
  
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
