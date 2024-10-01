// src/components/RightSidebar.js
import React, { useEffect, useState, useRef } from 'react';
import styles from './styles/RightSidebar.module.css';
import Preview from './right_components/Preview';
import QuickSlot from './right_components/QuickSlot';

function RightSidebar() {
  return (
    <div className={styles.sidebar}>
      <Preview />
      <QuickSlot />
    </div>
  );
}

export default RightSidebar;
