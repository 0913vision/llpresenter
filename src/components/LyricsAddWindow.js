// src/components/LyricsAddWindow.js
import React, { useState } from 'react';
import styles from './styles/LyricsAddWindow.module.css';

function LyricsAddWindow() {
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
      [field]: '',
    }));
    setIsModified((prev) => ({
      ...prev,
      [field]: false,
    }));
  };

  const handleResetAll = () => {
    setFormState({
      content: '',
      isLabeled: false,
      labelColor: '',
      subtitle: '',
    });
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

  // 추가 완료 버튼 클릭 시 데이터 생성 및 전송
  const handleAdd = () => {
    const newLyricsData = {
      content: formState.content,
      isLabeled: formState.isLabeled,
      labelColor: formState.labelColor,
      subtitle: formState.subtitle,
    };

    // 새로운 슬라이드 데이터 전송
    window.electronAPI.sendNewLyricsData(newLyricsData);
    window.close();
  };

  return (
    <div className={styles.addWindow}>
      <div className={styles.container}>
        <h2 className={styles.title}>Add Slides</h2>
        <div className={styles.content}>
          <div className={styles.gridContainer}>
            <label className={styles.label}>Content:</label>
            <div></div>
            <button className={styles.resetButton} onClick={() => handleResetField('content')}>Reset</button>
            <div className={styles.inputBoxWrapper}>
              <textarea
                className={styles.inputBox}
                type="text"
                value={formState.content}
                onChange={(e) => handleChange('content', e.target.value)}
              />
            </div>

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
                  <label className={styles.label}>색깔</label>
                  <div
                    className={styles.colorButton}
                    style={{ backgroundColor: formState.labelColor }}
                    onClick={openColorModal}
                  />
                </div>
                <div></div>
                <button className={styles.resetButton} onClick={() => handleResetField('labelColor')}>Reset</button>

                <div className={styles.labelGroup}>
                  <label className={styles.label}>내용</label>
                </div>
                <div></div>
                <button className={styles.resetButton} onClick={() => handleResetField('subtitle')}>Reset</button>
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
          <button className={styles.applyButton} onClick={handleAdd}>추가 완료</button>
        </div>
      </div>
    </div>
  );
}

export default LyricsAddWindow;
