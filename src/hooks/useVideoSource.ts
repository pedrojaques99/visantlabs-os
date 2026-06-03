import { useRef, useEffect, useCallback, useState } from 'react';
import { useImageLabStore } from '@/stores/imageLabStore';

export interface UseVideoSourceOptions {
  url: string | undefined;
  mediaType: 'image' | 'video';
  onFrame: (source: TexImageSource) => void;
}

export interface UseVideoSourceResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isVideo: boolean;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
}

export function useVideoSource({
  url,
  mediaType,
  onFrame,
}: UseVideoSourceOptions): UseVideoSourceResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const setVideoState = useImageLabStore((s) => s.setVideoState);

  const isVideo = mediaType === 'video';

  useEffect(() => {
    if (!url || !isVideo) return;

    let video = videoRef.current;
    if (!video) {
      video = document.createElement('video');
      video.playsInline = true;
      video.muted = true;
      video.loop = true;
      videoRef.current = video;
    }

    video.src = url;

    const onLoaded = () => {
      setDuration(video!.duration);
      setVideoState(false, video!.duration, 0);
      video!.play();
    };

    const onPlay = () => {
      setIsPlaying(true);
      setVideoState(true, video!.duration, video!.currentTime);
    };
    const onPause = () => {
      setIsPlaying(false);
      setVideoState(false, video!.duration, video!.currentTime);
    };
    const onTimeUpdate = () => {
      setCurrentTime(video!.currentTime);
      setVideoState(!video!.paused, video!.duration, video!.currentTime);
    };

    video.addEventListener('loadeddata', onLoaded);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);

    const loop = () => {
      if (video && !video.paused && !video.ended) {
        onFrameRef.current(video);
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };

    video.addEventListener('loadeddata', () => loop(), { once: true });

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      video!.pause();
      video!.removeEventListener('loadeddata', onLoaded);
      video!.removeEventListener('play', onPlay);
      video!.removeEventListener('pause', onPause);
      video!.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, [url, isVideo]);

  useEffect(() => {
    if (!isVideo && videoRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      videoRef.current.pause();
      setIsPlaying(false);
      setDuration(0);
      setCurrentTime(0);
    }
  }, [isVideo]);

  const play = useCallback(() => videoRef.current?.play(), []);
  const pause = useCallback(() => videoRef.current?.pause(), []);
  const seek = useCallback((time: number) => {
    if (videoRef.current) videoRef.current.currentTime = time;
  }, []);

  return { videoRef, isVideo, isPlaying, duration, currentTime, play, pause, seek };
}
