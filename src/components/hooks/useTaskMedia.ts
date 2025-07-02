import { useEffect, useRef, useState } from 'react';

export function useTaskMedia() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    requestMediaPermissions();
    return () => {
      stopMediaStream();
    };
    // eslint-disable-next-line
  }, []);

  const requestMediaPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error accessing media devices:', err);
    }
  };

  const stopMediaStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      mediaStreamRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };

  const toggleVideo = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !isVideoOn;
      });
      setIsVideoOn((prev) => !prev);
    }
  };

  return {
    videoRef,
    isVideoOn,
    toggleVideo,
    stopMediaStream,
  };
} 