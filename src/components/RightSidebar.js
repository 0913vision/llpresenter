// src/components/RightSidebar.js
import React, { useEffect, useState } from 'react';
import styles from './styles/RightSidebar.module.css';
import { useDispatch, useSelector } from 'react-redux';
import { sceneActions } from '../redux/slices/sceneSlice';

function RightSidebar() {
  const [displays, setDisplays] = useState([]); // 모니터 목록\
  const [cameras, setCameras] = useState([]); // 카메라 목록

  const scenes = useSelector((state) => state.scene.scenes);
  const dispatch = useDispatch();

  useEffect(() => {
    window.electronAPI.getDisplays().then((result) => {
      let firstCameraId = null;
      setDisplays(result); // 모니터 목록 설정
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setCameras(videoDevices);
        console.log(videoDevices[0]);
        firstCameraId = videoDevices.length > 0 ? videoDevices[0].deviceId : null;

        console.log(result.length);
        for (let i = 0; i < result.length; i++) {
          const newScene = { 
            monitorId: result[i].id,
            name: `Scene ${i + 1}`,
            objectsVisibility: { camera: true, text: true },
            camera: firstCameraId,
            format: {
              text: {
                font: 'Arial',
                size: 24,
                position: { x: 0, y: 0 },
                alignment: 'center',
                color: 'white',
              },
            },
          }
          
          dispatch(sceneActions.createScene(newScene));
          window.electronAPI.sendSceneDataToMonitor(result[i].id, newScene);
        }
      });
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
