// src/components/RightSidebar.js
import React, { useEffect, useState, useRef } from 'react';
import styles from './styles/RightSidebar.module.css';
import Preview from './Preview';
import QuickSlot from './QuickSlot';

function RightSidebar() {
  return (
    <div className={styles.sidebar}>
      <Preview />
      <QuickSlot />
    </div>
  );
}

export default RightSidebar;
