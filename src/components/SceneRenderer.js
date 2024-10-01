// src/components/SceneRenderer.js
import React, { useEffect, useState } from 'react';
import styles from './styles/SceneRenderer.module.css';
import Camera from './Camera';
import TextDisplay from './TextDisplay';

function SceneRenderer() {
  const [sceneData, setSceneData] = useState(null);

  useEffect(() => {
    // 메인 프로세스로부터 씬 데이터를 받음
    window.electronAPI.receiveSceneData((data) => {
      setSceneData(data);
      console.log(data.name);
    });
  }, []);

  if (!sceneData) {
    return <div style={{ color: 'white', backgroundColor: 'black', width: '100%', height: '100vh' }}>
      Loading...
    </div>;
  }

  // 씬 데이터를 기반으로 화면 구성
  return (
    <div className={styles.sceneContainer}>
      {/* 카메라 컴포넌트 */}
      <Camera visible={sceneData.objectsVisibility.camera} cameraId={sceneData.camera}/>

      {/* 텍스트 컴포넌트 */}
      <TextDisplay
        visible={sceneData.objectsVisibility.text}
        textFormat={sceneData.format.text}
        textContent={sceneData.name}
      />
      
      {/* 비디오는 추후 구현 */}
    </div>
  );
}

export default SceneRenderer;
