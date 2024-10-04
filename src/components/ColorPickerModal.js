import React, { useState, useEffect, useRef } from 'react';
import { ColorPicker, useColor } from 'react-color-palette';
import 'react-color-palette/dist/css/rcp.css';
import styles from './styles/ColorPickerModal.module.css';

const ColorPickerModal = ({ initialColor, onColorChange }) => {
  const [color, setColor] = useColor(initialColor || "#000000");
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    // 바깥을 클릭하면 컬러 피커를 닫는 로직
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [pickerRef]);

  const handleColorChange = (color) => {
    setColor(color);
    onColorChange(color.hex);  // 부모 컴포넌트에 변경된 색상 전달
  };

  return (
    <div  tabIndex={0} className={styles.colorPickerWrapper}>
      {/* 색상 미리보기 div 클릭 시 컬러 피커를 보이도록 함 */}
      <div
        className={styles.colorPreview}
        style={{ backgroundColor: color.hex }}
        onClick={() => setShowPicker(!showPicker)}
      />
      {showPicker && (
        <div className={styles.pickerContainer} ref={pickerRef}>
          <ColorPicker
            height={150}
            color={color}
            onChange={handleColorChange}
            dark
            hideInput={["rgb", "hsv"]}
          />
        </div>
      )}
    </div>
  );
};

export default ColorPickerModal;
