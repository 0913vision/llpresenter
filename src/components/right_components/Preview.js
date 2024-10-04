// src/components/right_components/Preview.js
import React, { useEffect, useState, useRef } from 'react';
import styles from './styles/Preview.module.css';
import { useDispatch, useSelector } from 'react-redux';
import { sceneActions } from '../../redux/slices/sceneSlice';
import { current } from '@reduxjs/toolkit';

function RightSidebar() {
  const [cameras, setCameras] = useState([]); // 카메라 목록

  const videoRefs = useRef({});
  const [windows, setWindows] = useState([]); // exportWindows에 저장된 창 목록
  const [sources, setSources] = useState([]); // desktopCapturer에서 가져온 소스 목록
  const [streams, setStreams] = useState({});
  const [visibleWindow, setVisibleWindow] = useState(null);
  const [areScenesInitialized, setAreScenesInitialized] = useState(false);
  const [currentScene, setCurrentScene] = useState(null);

  const scenes = useSelector((state) => state.scene.scenes);
  const dispatch = useDispatch();

  const identifiers = ["message","text","media","camera"];

  useEffect(() => {
    window.electronAPI.getDisplays().then((result) => {
      // console.log(result);
      let firstCameraId = null;
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setCameras(videoDevices);
        // console.log(videoDevices[0]);
        firstCameraId = videoDevices.length > 0 ? videoDevices[0].deviceId : null;

        // console.log(result.length);
        for (let i = 0; i < result.length; i++) {
          const newScene = { 
            monitorId: result[i].id,
            name: `Scene ${i + 1}`,
            objectsVisibility: { message: false, text: false, media: false, camera: false },
            camera: firstCameraId,
            format: {
              text: {
                family: 'Arial',
                size: 18,
                weight: 'normal',
                style: 'normal',
                position: { x: 0, y: 0 },
                alignment: { horizontal: 'center', vertical: 'center' },
                color: '#ffffff',
                letterSpacing: 100,
                outline: false,
                shadow: false,
                lineHeight: 1,
                margin: { horizontal: 0, vertical: 0 },
              },
            },
          }
          
          dispatch(sceneActions.createScene(newScene));
          window.electronAPI.sendSceneDataToMonitor(result[i].id, newScene);
        }
        setAreScenesInitialized(true);
      });
    });
  }, []);

  useEffect(() => {
    // 창 목록 가져오기
    const fetchWindows = async () => {
      const exportWindows = await window.electronAPI.getExportWindows();
      setWindows(exportWindows); // 창 목록 설정
    };
    fetchWindows();
  }, []);

  useEffect(() => {
    // desktopCapturer로부터 소스 가져오기
    const fetchSources = async () => {
      const availableSources = await window.electronAPI.desktopCaptureGetSources();
      setSources(availableSources); // 소스 목록 설정
    };
    fetchSources();
  }, [windows]);

  useEffect(() => {
    windows.forEach((window) => {
      if (videoRefs.current[window.id] && streams[window.title]) {
        videoRefs.current[window.id].srcObject = streams[window.title];
      }
    });
  }, [streams, windows]);
  
  useEffect(() => {
    return () => {
      Object.values(streams).forEach(stream => {
        stream.getTracks().forEach(track => track.stop());
      });
    };
  }, [streams]);

  useEffect(() => {
    // Initialize streams for all sources
    const initializeStreams = async () => {
      const newStreams = {};
    
      // windows의 각 창에 대해 해당하는 소스를 찾고 스트림을 생성
      for (const window of windows) {
        const matchedSource = sources.find(source => source.name === window.title);
        
        if (matchedSource) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: matchedSource.id,
                },
              },
            });
            newStreams[matchedSource.name] = stream;
          } catch (error) {
            console.error(`소스 ${matchedSource.name} 접근 오류:`, error);
          }
        } else {
          console.warn(`창 제목 "${window.title}"에 해당하는 소스를 찾을 수 없습니다.`);
        }
      }
    
      setStreams(newStreams);
    };
    
    if (sources.length > 0) {
      initializeStreams();
    }
  }, [windows, sources]);

  useEffect(() => {
    return () => {
      Object.values(streams).forEach(stream => {
        stream.getTracks().forEach(track => track.stop());
      });
    };
  }, []);
  
  const handleIdentifierClick = (index) => {
    if(!visibleWindow) return;
    if(!currentScene) return;
    const newSceneState = {
      ...currentScene,
      objectsVisibility: {...currentScene.objectsVisibility, [identifiers[index]]: !currentScene.objectsVisibility[identifiers[index]]}
    };
    // console.log(newSceneState);
    dispatch(sceneActions.updateScene(newSceneState));
    window.electronAPI.sendSceneDataToMonitor(currentScene.monitorId, newSceneState);
    return;
  }

  const handleDeselectButtonClick = () => {
    scenes.forEach(scene => {
      const newSceneState = {
        ...scene,
        objectsVisibility: { message: false, text: false, media: false, camera: false }
      };
      dispatch(sceneActions.updateScene(newSceneState));
      window.electronAPI.sendSceneDataToMonitor(scene.monitorId, newSceneState);
    });
  }

  const handleSceneSetupButton = () => {
    if(!currentScene) return;
    console.log(currentScene);
    window.electronAPI.openSceneSetup(currentScene);
  }

  useEffect(() => {
    window.electronAPI.receiveUpdatedSceneData((data) => {
      dispatch(sceneActions.updateScene(data));
    });
  }, [])

  useEffect(() => {
    if(!currentScene) return;
    window.electronAPI.sendSceneDataToMonitor(currentScene.monitorId, currentScene);
  }, [currentScene])

  useEffect(() => {
    if(!areScenesInitialized) return;
    if(!scenes) return;
    if(!visibleWindow) return;
    setCurrentScene(scenes.find(scene => scene.name.split(' ')[1] === visibleWindow.split(' ')[1]));
  }, [areScenesInitialized, scenes, visibleWindow])

  return (
    <div className={styles.container}>
      {/* 여러 비디오 요소를 각 창에 대해 표시 */}
      <div className={styles.previewContainer}>
        <div className={styles.videoContainer}>
          {windows.map((window) => (
            <video
              key={window.id}
              ref={(el) => (videoRefs.current[window.id] = el)}
              autoPlay
              muted
              className={`${styles.previewVideo} ${visibleWindow===window.title ? `${styles.show}` : `${styles.hide}`}`}
            />
          ))}
        </div>
        <div className={styles.deselectButtonContainer}>
          <div className={styles.deselectButton} onClick={() => handleDeselectButtonClick()}>X</div>
          {/* <button onClick={() => handleDeselectButtonClick()}>X</button> */}
        </div>
        <div className={styles.identifiersContainer}>
          {identifiers.map((value, index) => (
            <div key={index} onClick={() => handleIdentifierClick(index)} className={`${styles.identifier} ${currentScene && currentScene.objectsVisibility[value] ? `${styles.turnedOn}` : `${styles.turnedOff}`}`}> {/**/}
              {value.slice(0,3)}
            </div>
            // <button key={index} onClick={() => handleIdentifierClick(index)}>
            //   {value}
            // </button>
          ))}
        </div>
      </div>
  
      {/* 창 목록 */}
      <div className={styles.windowSetupContainer}>
        <select onChange={(e) => setVisibleWindow(e.target.value)} defaultValue="">
          {!visibleWindow && <option value="" disabled>창 선택</option>}
          {areScenesInitialized && windows.map((window) => (
            <option key={window.id} value={window.title}>
              {window.title}
            </option>
          ))}
        </select>
        {visibleWindow && <div className={styles.sceneSetupButton} onClick={()=>handleSceneSetupButton()}>설정</div>}
      </div>
    </div>
  );
}

export default RightSidebar;
