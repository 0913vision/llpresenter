import React, { useState, useEffect } from 'react';
import { ColorPicker, useColor } from 'react-color-palette';
import 'react-color-palette/dist/css/rcp.css';
import styles from './styles/ColorModal.module.css';
import { hexToRgba, rgbaToHsva } from './hexToRgba';

const ColorModal = () => {
  // useColor Hook으로 초기 색상 설정
  const [color, setColor] = useColor('#000000');

  useEffect(() => {
    // 기존 색상 값 받아오기
    window.electronAPI.receiveColorToEdit((initialColor) => {
      console.log(initialColor);
      if (initialColor !== '') {
        const rgba = hexToRgba(initialColor);
        const hsva = rgbaToHsva(rgba.r, rgba.g, rgba.b, rgba.a);
        setColor({ hex: initialColor, rgb: rgba, hsv: hsva });
      }
    });
  }, []);

  const handleSubmit = () => {
    window.electronAPI.sendEditedColor(color.hex);
    window.close();
  };

  return (
    <div className={styles.modalContainer}>
      <div className={styles.pickerContainer}>
        <ColorPicker height={150} color={color} onChange={setColor} dark 
        hideInput={["rgb", "hsv"]} />
      </div>
      <button className={styles.submitButton} onClick={handleSubmit}>
        적용
      </button>
    </div>
  );
};

export default ColorModal;
