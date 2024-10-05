import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import styles from './styles/VideoItem.module.css';

const VideoItem = ({ id, onClickHandler }) => {
    const video = useSelector((state) => state.video.videos.find((vid) => vid.id === id));
    const [currentThumbnail, setCurrentThumbnail] = useState(0);
    const [isHovering, setIsHovering] = useState(false);

    useEffect(() => {
        let interval;
        if (isHovering) {
            interval = setInterval(() => {
                setCurrentThumbnail((prev) => (prev + 1) % video.thumbnails.length);
            }, 500); // 0.5초마다 썸네일 변경
        } else {
            setCurrentThumbnail(0); // 마우스를 떼면 첫 번째 썸네일로 초기화
        }

        return () => {
            clearInterval(interval);
        };
    }, [isHovering, video.thumbnails.length]);

    const formatDuration = (duration) => {
        const hours = Math.floor(duration / 3600);
        const minutes = Math.floor((duration % 3600) / 60);
        const seconds = duration % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    };

    return (
        <div
            className={styles.videoItem}
            onClick={onClickHandler} // 클릭 핸들러 할당
            onContextMenu={() => {
                // 우클릭 핸들러 (플레이스홀더)
                console.log("Right click detected. Show context menu.");
            }}
        >
            <div
                className={styles.thumbnailWrapper}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
            >
                <img src={video.thumbnails[currentThumbnail]} alt={video.title} className={styles.thumbnail} />
                <div className={styles.duration}>{formatDuration(video.duration)}</div>
            </div>
            <div className={styles.title}>{video.title}</div>
        </div>
    );
};

export default VideoItem;
