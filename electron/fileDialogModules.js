'use strict';
const { dialog } = require('electron');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

const getVideoMetadataWithThumbnails = async (event) => {
  // 파일 선택 창 열기
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Videos', extensions: ['mp4', 'mkv', 'avi'] }],
  });

  if (canceled || filePaths.length === 0) return null; // 취소 시 처리 안함

  const videoPath = filePaths[0];
  const fileName = path.basename(videoPath);
  const outputDir = path.join('/tmp', fileName); // tmp 아래에 파일명 기반 디렉토리 생성

  // 디렉토리 없으면 생성
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  // ffmpeg로 썸네일 추출 및 메타데이터 추출
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        return reject(err);
      }

      const duration = metadata.format.duration; // 재생 시간
      const thumbnailCount = 10; // 고정된 썸네일 개수
      const interval = duration / thumbnailCount; // 썸네일 추출 간격

      // 썸네일 추출
      ffmpeg(videoPath)
        .screenshots({
          timestamps: Array.from({ length: thumbnailCount }, (_, i) => (i * interval).toFixed(2)),
          filename: `${outputDir}/thumbnail-%i.png`,
          folder: outputDir,
        })
        .on('end', () => {
          const metaData = {
            title: fileName,
            duration: duration,
            filePath: videoPath,
            thumbnails: Array.from({ length: thumbnailCount }, (_, i) =>
              path.join(outputDir, `thumbnail-${i + 1}.png`)
            ),
          };
          resolve(metaData); // 메타데이터 반환
        })
        .on('error', (err) => reject(err));
    });
  });
}

const getTxtDataAsync = async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [ { name: 'Text Files', extensions: ['txt'] }]
  });
  if (canceled || filePaths.length === 0) return null;
  
  const filePath = filePaths[0];
  const fileName = path.basename(filePath);

  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      return reject(err);
    }
    resolve([fileName, data]);
    });
  });
}

module.exports = { getVideoMetadataWithThumbnails, getTxtDataAsync };