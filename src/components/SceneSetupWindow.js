import React, { useState, useEffect, useRef } from 'react';
import styles from './styles/SceneSetupWindow.module.css';
import ColorPickerModal from './ColorPickerModal';
import distinguishArrayTypes from '../utils/distinguishArrayTypes';

//icons

function SceneSetupWindow() {
  const [sceneData, setSceneData] = useState({});
  const [activeTab, setActiveTab] = useState('text'); // Default to 'text' tab
  const [formState, setFormState] = useState({
    alignment: { horizontal: 'center', vertical: 'center' },
    color: '#000000',
    family: 'Arial',
    weight: 'normal',
    style: 'normal',
    position: { x: 0, y: 0 },
    size: 24,
    letterSpacing: 100,
    outline: false,
    shadow: false,
    lineHeight: 1,
    margin: { horizontal: 0, vertical: 0 },
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
      alignment: textFormat.alignment || { horizontal: 'center', vertical: 'center' },
      color: textFormat.color || 'white',
      family: textFormat.family || 'Arial',
      weight: textFormat.weight || 'normal',
      style: textFormat.style || 'normal',
      position: textFormat.position || { x: 0, y: 0 },
      size: textFormat.size || 24,
      letterSpacing: textFormat.letterSpacing || 100,
      outline: textFormat.outline || false,
      shadow: textFormat.shadow || false,
      lineHeight: textFormat.lineHeight || 1,
      margin: textFormat.margin || { horizontal: 0, vertical: 0 },
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
    <div className={styles.setupWindow}>
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
            <div className={styles.wholeSetContainer}>
              {/* 텍스트 기본 스타일, 텍스트 효과 */}
              <div className={styles.setGroupContainer} id={styles.fontSet}>
                {/* Font, Size, Color, Weight, Style */}
                {/* <label className={styles.label}>폰트</label> */}
                <span className="material-symbols-outlined">text_fields</span>
                <select
                  id={styles.fontFamily}
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
                {/* <label className={styles.label}>크기</label> */}
                <span className="material-symbols-outlined">format_size</span>
                <input
                  type="number"
                  value={formState.size}
                  onChange={(e) => handleChange('size', e.target.value)}
                />
                {/* <label className={styles.label}>굵기</label> */}
                <span className="material-symbols-outlined">format_bold</span>
                <select
                  value={formState.weight}
                  onChange={(e) => handleChange('weight', e.target.value)}
                >
                {fonts && fontsType === 'object' ? 
                  ([...new Set(fonts.find(font=>font.family===formState.family).weights)].sort((a, b) => a - b).map((weight, index) => (
                    <option key={index} value={weight}>
                      {weight}
                    </option>
                ))):(
                  ['normal', 'bold'].map((weight, index) => (
                    <option key={index} value={weight}>
                      {weight}
                    </option>
                  )))}
                </select>
                <span className="material-symbols-outlined">format_color_text</span>
                <ColorPickerModal initialColor={formState.color} onColorChange={handleColorChange} />                
                <div
                  onClick={() => handleChange('style', formState.style === 'italic' ? 'normal' : 'italic')}
                ><span className={"material-symbols-outlined"}>format_italic</span></div>
                <div
                  onClick={() => handleChange('outline', !formState.outline)}
                ><span className={"material-symbols-outlined"}>border_color</span></div>
                {/* <div
                  onClick={() => handleChange('shadow', !formState.shadow)}
                ><span className={"material-symbols-outlined"}>shadow</span></div> */}
                {/* <button
                  className={formState.style === 'italic' ? styles.activeButton : styles.button}
                  onClick={() => handleChange('style', formState.style === 'italic' ? 'normal' : 'italic')}
                >
                  Italic
                </button> */}
                {/* <button
                  className={formState.outline ? styles.activeButton : styles.button}
                  onClick={() => handleChange('outline', !formState.outline)}
                >
                  Outline
                </button> */}
                <div
                  onClick={() => handleChange('shadow', !formState.shadow)}
                ><span className={"material-symbols-outlined"}>shadow</span></div>
                {/* <button
                  className={formState.shadow ? styles.activeButton : styles.button}
                  onClick={() => handleChange('shadow', !formState.shadow)}
                >
                  Shadow
                </button> */}
                {/* <div>
                </div> */}
              </div>
              {/* 정렬 및 위치, 간격 및 여백 */}
              <div className={styles.setGroupContainer}>
                {/* Alignment, Position X, Position Y, 가로정렬, 세로정렬 */}
                <label className={styles.label}>가로 정렬</label>
                <div className={styles.alignmentButtonGroup}>
                  <button className={`${styles.button} ${formState.alignment.horizontal === 'left' ? styles.activeButton : ''}`} onClick={() => handleChange('alignment', { ...formState.alignment, horizontal: 'left' })}><span className="material-symbols-outlined">format_align_left</span></button>
                  <button className={`${styles.button} ${formState.alignment.horizontal === 'center' ? styles.activeButton : ''}`} onClick={() => handleChange('alignment', { ...formState.alignment, horizontal: 'center' })}><span className="material-symbols-outlined">format_align_center</span></button>
                  <button className={`${styles.button} ${formState.alignment.horizontal === 'right' ? styles.activeButton : ''}`} onClick={() => handleChange('alignment', { ...formState.alignment, horizontal: 'right' })}><span className="material-symbols-outlined">format_align_right</span></button>
                </div>

                <label className={styles.label}>세로 정렬</label>
                <div className={styles.alignmentButtonGroup}>
                  <button className={`${styles.button} ${formState.alignment.horizontal === 'top' ? styles.activeButton : ''}`} onClick={() => handleChange('alignment', { ...formState.alignment, vertical: 'top' })}><span className="material-symbols-outlined">vertical_align_top</span></button>
                  <button className={`${styles.button} ${formState.alignment.horizontal === 'center' ? styles.activeButton : ''}`} onClick={() => handleChange('alignment', { ...formState.alignment, vertical: 'center' })}><span className="material-symbols-outlined">vertical_align_center</span></button>
                  <button className={`${styles.button} ${formState.alignment.horizontal === 'buttom' ? styles.activeButton : ''}`} onClick={() => handleChange('alignment', { ...formState.alignment, vertical: 'bottom' })}><span className="material-symbols-outlined">vertical_align_bottom</span></button>
                </div>

                <div id={styles.offsets}>
                  <label className={styles.label}>오프셋</label>
                  <div id={styles.offsetInputs}>
                    {/* <label className={styles.label}><span className="material-symbols-outlined">width</span></label> */}
                    <span className="material-symbols-outlined">width</span>
                    <input
                      type="number"
                      value={formState.position.x}
                      onChange={(e) => handlePositionChange('x', e.target.value)}
                    />

                    {/* <label className={styles.label}>세로</label> */}
                    <span className="material-symbols-outlined">height</span>
                    <input
                      type="number"
                      value={formState.position.y}
                      onChange={(e) => handlePositionChange('y', e.target.value)}
                    />
                  </div>
                </div>

              </div>
              <div className={styles.setGroupContainer}>
                {/* 자간, 줄높이, 가로여백, 세로여백 */}
                <label className={styles.label}>자간</label>
                {/* <span className="material-symbols-outlined">format_letter_spacing</span> */}
                <input
                  type="number"
                  value={formState.letterSpacing}
                  onChange={(e) => handleChange('letterSpacing', e.target.value)}
                />
                <label className={styles.label}>줄높이</label>
                {/* <span className="material-symbols-outlined">format_line_spacing</span> */}
                <input type="number" value={formState.lineHeight} onChange={(e) => handleChange('lineHeight', e.target.value)} />

                <label className={styles.label}>가로여백</label>
                <input type="number" value={formState.margin.horizontal} onChange={(e) => handleChange('margin', { ...formState.margin, horizontal: e.target.value })} />
                <label className={styles.label}>세로여백</label>
                <input type="number" value={formState.margin.vertical} onChange={(e) => handleChange('margin', { ...formState.margin, vertical: e.target.value })} />
              </div>
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
