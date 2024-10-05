// src/components/LyricsEditWindow.js
import React, { useState, useEffect } from 'react';
import styles from './styles/LyricsEditWindow.module.css';
import ColorPickerModal from '@/components/ColorPickerModal';

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

  const handleColorChange = (color) => {
    if (!isModified['labelColor']) {
      setIsModified((prev) => ({
        ...prev,
        labelColor: true,
      }));  
    }
    setFormState((prev) => ({
      ...prev,
      labelColor: color,
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

  // 수정 완료 버튼 클릭 시 데이터 업데이트
  const handleUpdate = () => {
    const isLabelChangedValidly = isModified.isLabeled && lyricsData.some(slide => !slide.isLabeled) && formState.isLabeled && formState.labelColor === '';
    const updatedLyricsData = lyricsData.map((slide) => {
      let updatedSlide = { ...slide };
  
      if (isLabelChangedValidly) {
        updatedSlide.labelColor = slide.labelColor;
        updatedSlide.subtitle = slide.subtitle;
        updatedSlide.isLabeled = slide.isLabeled;
      } else {
        updatedSlide.labelColor = isModified.labelColor ? formState.labelColor : slide.labelColor;
        updatedSlide.subtitle = isModified.subtitle ? formState.subtitle : slide.subtitle;
        updatedSlide.isLabeled = isModified.isLabeled ? formState.isLabeled : slide.isLabeled;
      }

      updatedSlide.content = isModified.content ? formState.content : slide.content;
      
      return updatedSlide;
    });
  
    setLyricsData(updatedLyricsData);
    // console.log('Updated lyrics data:', updatedLyricsData);
    window.electronAPI.sendEditedLyricsData(updatedLyricsData)
    window.close();
  };
  

  return (
    <div className={styles.editwindow}>
      <div className={styles.container}>
        <h2 className={styles.title}>Edit Slides</h2>
        <div className={styles.content}>
          <div className={styles.gridContainer}>
            {lyricsData.length === 1 && (
              <>
                <label className={`${styles.label} ${styles.longLabel}`}>슬라이드 내용</label>
                <div></div>
                <button className={styles.resetButton} onClick={() => handleResetField('content')}><span className="material-symbols-outlined">restart_alt</span></button>
                <div className={styles.inputBoxWrapper}>
                  <textarea
                    className={styles.inputBox}
                    type="text"
                    value={formState.content}
                    onChange={(e) => handleChange('content', e.target.value)}
                  />
                </div>
              </>
            )}
            <label className={styles.label}>레이블</label>
            <div className={styles.labelGroup}>
              <input
                className={styles.checkbox}
                type="checkbox"
                checked={formState.isLabeled}
                onChange={(e) => handleChange('isLabeled', e.target.checked)}
              />
            </div>
            <div></div>
            <button className={styles.resetButton} onClick={() => handleResetField('isLabeled')}><span className="material-symbols-outlined">restart_alt</span></button>
            
            {formState.isLabeled && (
              <>
                <label className={styles.label}>색깔</label>
                <ColorPickerModal initialColor={formState.labelColor} onColorChange={handleColorChange} />
                <div></div>
                <button className={styles.resetButton} onClick={() => handleResetField('labelColor')}><span className="material-symbols-outlined">restart_alt</span></button>
                
                <label className={styles.label}>내용</label>
                <div></div>
                <div></div>
                <button className={styles.resetButton} onClick={() => handleResetField('subtitle')}><span className="material-symbols-outlined">restart_alt</span></button>
                <div className={styles.inputBoxWrapper}>
                  <textarea
                    className={styles.inputBox}
                    type="text"
                    value={formState.subtitle}
                    onChange={(e) => handleChange('subtitle', e.target.value)}
                  />
                </div>
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
