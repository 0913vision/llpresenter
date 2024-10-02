import React, { useState, useEffect, useRef } from 'react';
import styles from './styles/SceneSetupWindow.module.css';
import ColorPickerModal from './ColorPickerModal';
import distinguishArrayTypes from '../utils/distinguishArrayTypes';

function SceneSetupWindow() {
  const [sceneData, setSceneData] = useState({});
  const [activeTab, setActiveTab] = useState('text'); // Default to 'text' tab
  const [formState, setFormState] = useState({
    alignment: 'center',
    color: '#000000',
    family: 'Arial',
    weight: 'normal',
    style: 'normal',
    position: { x: 0, y: 0 },
    size: 24,
    letterSpacing: 100,
    outline: false,
    shadow: false,
  });
  const [fonts, setFonts] = useState(null); 
  const [fontsType, setFontsType] = useState(false);

  useEffect(() => {
    window.electronAPI.getFontList().then((fonts) => {
      setFonts(fonts);
      setFontsType(distinguishArrayTypes(fonts));
    });
  }, []);

  useEffect(() => {
    window.electronAPI.initialSceneSetup((data) => {
      console.log('SceneEditWindow data:', data);
      setSceneData(data);
      if (data.format && data.format.text) {
        initializeForm(data.format.text);
      }
    });
  }, []);

  const initializeForm = (textFormat) => {
    setFormState({
      alignment: textFormat.alignment || 'center',
      color: textFormat.color || 'white',
      family: textFormat.family || 'Arial',
      weight: textFormat.weight || 'normal',
      style: textFormat.style || 'normal',
      position: textFormat.position || { x: 0, y: 0 },
      size: textFormat.size || 24,
      letterSpacing: textFormat.letterSpacing || 100,
      outline: textFormat.outline || false,
      shadow: textFormat.shadow || false,
    });
  };

  const handleChange = (field, value) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleColorChange = (color) => {
    setFormState((prev) => ({
      ...prev,
      color: color,
    }));  
  };

  const handlePositionChange = (axis, value) => {
    setFormState((prev) => ({
      ...prev,
      position: {
        ...prev.position,
        [axis]: value,
      },
    }));
  };

  const handleSubmit = () => {
    sceneData.format.text = formState;
    window.electronAPI.sendUpdatedSceneData(sceneData);
    window.close();
  };

  return (
    <div className={styles.editwindow}>
      <div className={styles.container}>
        <h2 className={styles.title}>Scene Edit</h2>
        <div className={styles.tabs}>
          <button
            className={activeTab === 'text' ? styles.activeTab : styles.tab}
            onClick={() => setActiveTab('text')}
          >
            Text
          </button>
        </div>

        <div className={styles.tabContent}>
          {activeTab === 'text' && (
            <div className={styles.gridContainer}>
              <label className={styles.label}>Alignment:</label>
              <select
                value={formState.alignment}
                onChange={(e) => handleChange('alignment', e.target.value)}
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>

              <label className={styles.label}>Color:</label>
              <ColorPickerModal initialColor={formState.color} onColorChange={handleColorChange} />
              {/* <input
                type="color"
                value={formState.color}
                onChange={(e) => handleChange('color', e.target.value)}
              /> */}

              <label className={styles.label}>Font:</label>
              <select
                value={formState.family} // formState.font 사용
                onChange={(e) => handleChange('family', e.target.value)} // handleChange로 폰트 변경
              >
                {fonts && fontsType &&
                  fonts.map((font, index) => (
                    <option 
                      key={index} 
                      value={fontsType==='string' ? font : font.family} 
                      style={{ fontFamily: fontsType==='string' ? font : font.family }} // 폰트 스타일을 미리보기를 위해 적용
                    >
                      {fontsType==='string' ? font : font.family}
                    </option>
                  ))
                }
              </select>
              {fonts && fontsType === 'object' && (
                <>
                  <label className={styles.label}>Weight:</label>
                  <select
                    value={formState.weight}
                    onChange={(e) => handleChange('weight', e.target.value)}
                  >
                    {[...new Set(fonts.find(font=>font.family===formState.family).weights)].sort((a, b) => a - b).map((weight, index) => (
                      <option key={index} value={weight}>
                        {weight}
                      </option>
                    ))}
                  </select>
                </>
              )}
                <label className={styles.label}>Style:</label>
                <button
                  className={formState.style === 'italic' ? styles.activeButton : styles.button}
                  onClick={() => handleChange('style', formState.style === 'italic' ? 'normal' : 'italic')}
                >
                  Italic
                </button>

                <label className={styles.label}>Outline:</label>
                <button
                  className={formState.outline ? styles.activeButton : styles.button}
                  onClick={() => handleChange('outline', !formState.outline)}
                >
                  Outline
                </button>

                <label className={styles.label}>Shadow:</label>
                <button
                  className={formState.shadow ? styles.activeButton : styles.button}
                  onClick={() => handleChange('shadow', !formState.shadow)}
                >
                  Shadow
                </button>

              <label className={styles.label}>Position X:</label>
              <input
                type="number"
                value={formState.position.x}
                onChange={(e) => handlePositionChange('x', e.target.value)}
              />

              <label className={styles.label}>Position Y:</label>
              <input
                type="number"
                value={formState.position.y}
                onChange={(e) => handlePositionChange('y', e.target.value)}
              />

              <label className={styles.label}>Size:</label>
              <input
                type="number"
                value={formState.size}
                onChange={(e) => handleChange('size', e.target.value)}
              />

              <label className={styles.label}>자간:</label>
              <input
                type="number"
                value={formState.letterSpacing}
                onChange={(e) => handleChange('letterSpacing', e.target.value)}
              />
            </div>
          )}
        </div>

        <div className={styles.buttonGroup}>
          <button className={styles.applyButton} onClick={handleSubmit}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

export default SceneSetupWindow;
