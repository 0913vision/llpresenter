import React, { useState, useRef, useEffect } from 'react';
import styles from './styles/InputAndDropdown.module.css';  // CSS 파일을 import

const InputAndDropdown = ({size, dropdownOptions, onChange}) => {
  const [isOpen, setIsOpen] = useState(false);
  const options = dropdownOptions || [12, 24, 36, 48, 60];

  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const buttonRef = useRef(null);

  const handleSelect = (value) => {
    onChange({target: {value}});
    setIsOpen(false);
  };

  const toggleDropdown = () => {
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        !inputRef.current.contains(event.target) &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false); // 드롭박스 외부 클릭 시 닫기
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside); // 마우스 클릭 이벤트 리스너 추가
    } else {
      document.removeEventListener('mousedown', handleClickOutside); // 드롭박스가 닫히면 리스너 제거
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside); // 컴포넌트 언마운트 시 리스너 제거
    };
  }, [isOpen]);

  return (
    <div className={styles.fontSizeContainer}>
      <input
        ref={inputRef}
        type="number"
        value={size}
        onChange={onChange}
        className={styles.fontSizeInput}
      />
      <button tabIndex={-1} ref={buttonRef} onClick={toggleDropdown} className={styles.fontSizeButton}>
        ▼
      </button>
      {isOpen && (
        <ul ref={dropdownRef} className={styles.fontSizeDropdown}>
          {options.map((option) => (
            <li
              key={option}
              value={option}
              onMouseDown={() => handleSelect(option)}
              className={size == option ? 'active' : ''}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default InputAndDropdown;
