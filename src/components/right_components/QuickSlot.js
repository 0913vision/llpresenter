import React from 'react';
import styles from './styles/QuickSlot.module.css';

function QuickSlot () {
  return (
    <div className={styles.quickSlotContainer}>
      <div className={styles.buttonContainer}>
        <button onClick={() => console.log('Button 1 clicked')}>Button 1</button>
        <button onClick={() => console.log('Button 2 clicked')}>Button 2</button>
        <button onClick={() => console.log('Button 3 clicked')}>Button 3</button>
      </div>
      <div className={styles.propertiesContainer}>
      </div>
    </div>
  )
}

export default QuickSlot;