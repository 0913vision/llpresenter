// src/components/RightSidebar.js
import React, { useEffect, useState } from 'react';
import styles from './styles/RightSidebar.module.css';
import { useDispatch, useSelector } from 'react-redux';
import { sceneActions } from '../redux/slices/sceneSlice';

function RightSidebar() {
  const [displays, setDisplays] = useState([]); // 모니터 목록

  const scenes = useSelector((state) => state.scene.scenes);
  const dispatch = useDispatch();

  useEffect(() => {
    window.electronAPI.getDisplays().then((result) => {
      setDisplays(result); // 모니터 목록 설정
      
      // 모니터 개수만큼 씬 생성
      for (let i = 0; i < result.length; i++) {
        dispatch(sceneActions.createScene({
          name: `Scene ${i + 1}`,
          objectsVisibility: { camera: true, text: true },
          camera: "camera1",
          format: {
            text: {
              font: 'Arial',
              size: 24,
              position: { x: 0, y: 0 },
              alignment: 'center',
              color: 'white',
            },
          },
        }));
      }
    });
  }, []);

  // 씬을 모니터개수만큼 만들어서 미리 저장.
  
  return (
    <div className={styles.sidebar}>
      <h3>Screen Control part</h3>
    </div>
  );
}

export default RightSidebar;
