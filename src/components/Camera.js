import React, { useEffect, useRef } from 'react';

function Camera({ visible, cameraId }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (visible) {
      // 카메라 목록에서 cameraId에 맞는 카메라 스트림을 가져옴
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const selectedCamera = devices.find(
          (device) => device.kind === 'videoinput' && device.deviceId === cameraId
        );

        if (selectedCamera) {
          navigator.mediaDevices
            .getUserMedia({ video: { deviceId: { exact: selectedCamera.deviceId } } })
            .then((stream) => {
              if (videoRef.current) {
                videoRef.current.srcObject = stream; // 비디오 엘리먼트에 스트림 연결
              }
            })
            .catch((err) => {
              console.error("Failed to access camera:", err);
            });
        }
      });
    }
  }, [visible, cameraId]);

  if (!visible) {
    return null; // 카메라가 보이지 않을 경우 렌더링하지 않음
  }

  return <video ref={videoRef} autoPlay className="camera-feed" />;
}

export default Camera;