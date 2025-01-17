// src/components/SceneRenderer.js
import React, { useEffect, useState } from 'react';
import styles from './styles/SceneRenderer.module.css';
import Camera from './renderer_components/Camera';
import TextDisplay from './renderer_components/TextDisplay';

function SceneRenderWindow() {
  const [sceneData, setSceneData] = useState(null);
  const [lyrics, setLyrics] = useState('');

  useEffect(() => {
    // 메인 프로세스로부터 씬 데이터를 받음
    window.electronAPI.receiveSceneData((data) => {
      setSceneData(data);
    });

    window.electronAPI.receiveLyrics((data) => {
      setLyrics(data);
    });
  }, []);

  // 씬 데이터가 없으면 로딩 화면 출력
  if (!sceneData) {
    return <div style={{ color: 'white', backgroundColor: 'black', width: '100%', height: '100vh' }}>
      Loading...
    </div>;
  }

  // console.log(Object.values(sceneData.objectsVisibility).every(value => !value))

  // 씬 데이터를 기반으로 화면 구성
  return (
    <div className={styles.sceneContainer}>
      {/* 기본 배경 컴포넌트 */}
      {Object.values(sceneData.objectsVisibility).every(value => !value) && <div className={styles.backgroundContainer}>
        <img src={undefined} alt="background" className={styles.backgroundImage} />
      </div>}

      {/* 카메라 컴포넌트 */}
      <div className={`${styles.cameraContainer} ${sceneData.objectsVisibility.camera ? `${styles.visible}` : `${styles.hidden}`}`}>
        <Camera cameraId={sceneData.camera}/>
      </div>

      {/* 텍스트 컴포넌트 */}
      <div className={`
        ${styles.textContainer} 
        ${sceneData.objectsVisibility.text ? `${styles.visible}` : `${styles.hidden}`}
        ${sceneData.format.text.alignment.horizontal === 'left' ? `${styles.horizonLeft}` : sceneData.format.text.alignment.horizontal === 'center' ? `${styles.horizonCenter}` : `${styles.horizonRight}`}
        ${sceneData.format.text.alignment.vertical === 'top' ? `${styles.verticalTop}` : sceneData.format.text.alignment.vertical === 'center' ? `${styles.verticalCenter}` : `${styles.verticalBottom}`}
      `} style={sceneData ? {margin: 0} : {margin: `${sceneData.format.text.margin.vertical}em ${sceneData.format.text.margin.horizontal}em`}}>
        <TextDisplay
          textFormat={sceneData.format.text}
          textContent={lyrics}
        />
      </div>
      
      {/* 비디오는 추후 구현 */}
    </div>
  );
}

export default SceneRenderWindow;
