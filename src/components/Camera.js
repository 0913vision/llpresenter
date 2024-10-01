import React, { useEffect, useRef } from 'react';

function Camera({ cameraId }) {
  const videoRef = useRef(null);

  useEffect(() => {
    // 카메라 목록에서 cameraId에 맞는 카메라 스트림을 가져옴
    // navigator.mediaDevices.enumerateDevices().then((devices) => {
    //   const selectedCamera = devices.find(
    //     (device) => device.kind === 'videoinput' && device.deviceId === cameraId
    //   );

    //   if (selectedCamera) {
    //     navigator.mediaDevices
    //       .getUserMedia({ video: { deviceId: { exact: selectedCamera.deviceId } } })
    //       .then((stream) => {
    //         if (videoRef.current) {
    //           videoRef.current.srcObject = stream; // 비디오 엘리먼트에 스트림 연결
    //         }
    //       })
    //       .catch((err) => {
    //         console.error("Failed to access camera:", err);
    //       });
    //   }
    // });
    navigator.mediaDevices
    .getUserMedia({ video: { 
      deviceId: { exact: cameraId },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30 } 
    } }).then((stream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream; // 비디오 엘리먼트에 스트림 연결
        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        // console.log('실제 해상도:', settings.width, 'x', settings.height);
        // console.log('실제 프레임 레이트:', settings.frameRate);
      }
    })
    .catch((err) => {
      console.error("Failed to access camera:", err);
    });
  }, [cameraId]);

  return <video ref={videoRef} autoPlay className="camera-feed" />;
}

export default Camera;