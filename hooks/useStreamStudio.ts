import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export const useStreamStudio = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const [isLive, setIsLive] = useState(false);
  const [logs, setLogs] = useState<string[]>(['> System initialized.']);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev, `> ${msg}`]);
  }, []);

  useEffect(() => {
    let animationFrameId: number;

    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        addLog('Camera accessed.');

        drawFrame();
      } catch (err: any) {
        addLog(`Camera error: ${err.message}`);
      }
    };

    const drawFrame = () => {
      if (videoRef.current && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');

        if (ctx && videoRef.current.readyState >= 2) {
          ctx.drawImage(
            videoRef.current,
            0,
            0,
            canvasRef.current.width,
            canvasRef.current.height
          );

          ctx.font = 'bold 30px Arial';
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.fillText(
            '@StreamForge',
            canvasRef.current.width - 250,
            canvasRef.current.height - 30
          );

          if (isLive) {
            ctx.fillStyle = 'red';
            ctx.fillRect(20, 20, 100, 40);

            ctx.fillStyle = 'white';
            ctx.font = 'bold 24px Arial';
            ctx.fillText('LIVE', 40, 48);
          }
        }
      }

      animationFrameId = requestAnimationFrame(drawFrame);
    };

    initCamera();

    socketRef.current = io('http://localhost:5000');

    return () => {
      cancelAnimationFrame(animationFrameId);
      socketRef.current?.disconnect();
    };
  }, [isLive, addLog]);

  const toggleStream = useCallback(() => {
    if (!canvasRef.current || !socketRef.current) return;

    if (!isLive) {
      const stream = canvasRef.current.captureStream(30);

      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm'
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          socketRef.current?.emit('video-chunk', e.data);
        }
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsLive(true);
      addLog('Live started.');
    } else {
      mediaRecorderRef.current?.stop();
      setIsLive(false);
      addLog('Live stopped.');
    }
  }, [isLive, addLog]);

  const createReel = useCallback(() => {
    socketRef.current?.emit('make-reel');
    addLog('Reel generation requested...');
  }, [addLog]);

  return {
    videoRef,
    canvasRef,
    isLive,
    logs,
    toggleStream,
    createReel
  };
};
