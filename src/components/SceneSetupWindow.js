import React, { useState, useEffect, useRef } from 'react';
import styles from './styles/SceneSetupWindow.module.css';
import ColorPickerModal from './ColorPickerModal';
import distinguishArrayTypes from '../utils/distinguishArrayTypes';
import InputAndDropdown from './InputAndDropdown';

//icons

function SceneSetupWindow() {
  const fontOptions = Array.from({ length: (96 - 12) / 4 + 1 }, (_, i) => 12 + i * 4);
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
    letterSpacing: 0,
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
      letterSpacing: textFormat.letterSpacing || 0,
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
        <h2 className={styles.title}>장면 편집</h2>
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
                <div className={styles.topSet}>
                  <span className={`material-symbols-outlined ${styles.materialSymbolsOutlined}`}>text_fields</span>
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
                  <span className={`material-symbols-outlined ${styles.materialSymbolsOutlined}`}>format_size</span>
                  <InputAndDropdown size={formState.size} dropdownOptions={fontOptions} onChange={(e) => handleChange('size', e.target.value)}/>
                </div>
                <div className={styles.bottomSet}>
                  <span className={`material-symbols-outlined ${styles.materialSymbolsOutlined}`}>format_bold</span>
                  <select
                    value={formState.weight}
                    onChange={(e) => handleChange('weight', e.target.value)}
                    className={styles.weightSelect}
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
                  <span className={`material-symbols-outlined ${styles.materialSymbolsOutlined}`}>format_color_text</span>
                  <ColorPickerModal initialColor={formState.color} onColorChange={handleColorChange} />  
                  <div className={styles.styleButtonContainerContainer}>              
                    <div
                      tabIndex={0} 
                      className={`${styles.styleButtonContainer} ${formState.style === 'italic' ? styles.activeButton : ''}`}
                      onClick={() => handleChange('style', formState.style === 'italic' ? 'normal' : 'italic')}
                    ><span className={`material-symbols-outlined ${styles.materialSymbolsOutlined}`}>format_italic</span></div>
                    <div
                      tabIndex={0} 
                      className={`${styles.styleButtonContainer} ${formState.outline ? styles.activeButton : ''}`}
                      onClick={() => handleChange('outline', !formState.outline)}
                    ><span className={`material-symbols-outlined ${styles.materialSymbolsOutlined}`}>border_color</span></div>
                    <div
                      tabIndex={0} 
                      className={`${styles.styleButtonContainer} ${formState.shadow ? styles.activeButton : ''}`}
                      onClick={() => handleChange('shadow', !formState.shadow)}
                    ><span className={`material-symbols-outlined ${styles.materialSymbolsOutlined}`}>shadow</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 자간, 줄높이, 가로여백, 세로여백 */}
              <div className={styles.setGroupContainer}>
                <div className={styles.topSet}>
                  <label className={styles.label}>자간</label>
                  {/* <span className={`material-symbols-outlined ${styles.materialSymbolsOutlined}`}>format_letter_spacing</span> */}
                  <input
                    type="number"
                    value={formState.letterSpacing}
                    onChange={(e) => handleChange('letterSpacing', e.target.value)}
                    className={styles.input}
                  />
                  <label className={styles.label}>줄높이</label>
                  <InputAndDropdown size={formState.lineHeight} dropdownOptions={[0.9,1,1.1,1.5,2]} onChange={(e) => handleChange('lineHeight', e.target.value)}/>
                  {/* <input type="number" value={formState.lineHeight} onChange={(e) => handleChange('lineHeight', e.target.value)} /> */}
                  {/* <span className={`material-symbols-outlined ${styles.materialSymbolsOutlined}`}>format_line_spacing</span> */}
                </div>
                <div className={styles.bottomSet}>
                  <label className={styles.label}>가로여백</label>
                  <InputAndDropdown size={formState.margin.horizontal} dropdownOptions={[0, 10, 20, 30, 40]} onChange={(e) => handleChange('margin', { ...formState.margin, horizontal: e.target.value })}/>
                  {/* <input type="number" value={formState.margin.horizontal} onChange={(e) => handleChange('margin', { ...formState.margin, horizontal: e.target.value })} /> */}
                  <label className={styles.label}>세로여백</label>
                  <InputAndDropdown size={formState.margin.vertical} dropdownOptions={[0, 10, 20, 30, 40]} onChange={(e) => handleChange('margin', { ...formState.margin, vertical: e.target.value })}/>
                  {/* <input type="number" value={formState.margin.vertical} onChange={(e) => handleChange('margin', { ...formState.margin, vertical: e.target.value })} /> */}
                </div>
              </div>

              {/* 정렬 및 위치, 간격 및 여백 */}
              <div className={styles.setGroupContainer}>
                {/* Alignment, Position X, Position Y, 가로정렬, 세로정렬 */}
                <div className={styles.topSet}>
                  <label className={styles.label}>정렬</label>
                  <div className={styles.alignmentButtonGroup}>
                    <div tabIndex={0} className={`${styles.styleButtonContainer} ${formState.alignment.horizontal === 'left' ? styles.activeButton : ''}`} onClick={() => handleChange('alignment', { ...formState.alignment, horizontal: 'left' })}><span className={`material-symbols-outlined ${styles.materialSymbolsOutlined}`}>format_align_left</span></div>
                    <div tabIndex={0} className={`${styles.styleButtonContainer} ${formState.alignment.horizontal === 'center' ? styles.activeButton : ''}`} onClick={() => handleChange('alignment', { ...formState.alignment, horizontal: 'center' })}><span className={`material-symbols-outlined ${styles.materialSymbolsOutlined}`}>format_align_center</span></div>
                    <div tabIndex={0} className={`${styles.styleButtonContainer} ${formState.alignment.horizontal === 'right' ? styles.activeButton : ''}`} onClick={() => handleChange('alignment', { ...formState.alignment, horizontal: 'right' })}><span className={`material-symbols-outlined ${styles.materialSymbolsOutlined}`}>format_align_right</span></div>
                  </div>

                  {/* <label className={styles.label}>세로 정렬</label> */}
                  <div className={styles.alignmentButtonGroup}>
                    <div tabIndex={0} className={`${styles.styleButtonContainer} ${formState.alignment.vertical === 'top' ? styles.activeButton : ''}`} onClick={() => handleChange('alignment', { ...formState.alignment, vertical: 'top' })}><span className={`material-symbols-outlined ${styles.materialSymbolsOutlined}`}>vertical_align_top</span></div>
                    <div tabIndex={0} className={`${styles.styleButtonContainer} ${formState.alignment.vertical === 'center' ? styles.activeButton : ''}`} onClick={() => handleChange('alignment', { ...formState.alignment, vertical: 'center' })}><span className={`material-symbols-outlined ${styles.materialSymbolsOutlined}`}>vertical_align_center</span></div>
                    <div tabIndex={0} className={`${styles.styleButtonContainer} ${formState.alignment.vertical === 'bottom' ? styles.activeButton : ''}`} onClick={() => handleChange('alignment', { ...formState.alignment, vertical: 'bottom' })}><span className={`material-symbols-outlined ${styles.materialSymbolsOutlined}`}>vertical_align_bottom</span></div>
                  </div>
                </div>
                <div className={styles.bottomSet}>
                  <div id={styles.offsets}>
                    <label className={styles.label}>오프셋</label>
                    <div id={styles.offsetInputs}>
                      {/* <label className={styles.label}><span className={`material-symbols-outlined ${styles.materialSymbolsOutlined}`}>width</span></label> */}
                      <span className={`material-symbols-outlined ${styles.materialSymbolsOutlined}`}>width</span>
                      <input
                        type="number"
                        value={formState.position.x}
                        onChange={(e) => handlePositionChange('x', e.target.value)}
                        className={styles.input}
                      />

                      {/* <label className={styles.label}>세로</label> */}
                      <span className={`material-symbols-outlined ${styles.materialSymbolsOutlined}`}>height</span>
                      <input
                        type="number"
                        value={formState.position.y}
                        onChange={(e) => handlePositionChange('y', e.target.value)}
                        className={styles.input}
                      />
                    </div>
                  </div>
                </div>
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
