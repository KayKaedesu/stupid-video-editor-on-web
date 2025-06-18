"use client";

import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";
import Image from "next/image";
import React, { useCallback, useEffect, useRef, useState } from "react";

export default function Home() {
  const [currentTimelineTime, setCurrentTimelineTime] = useState(0);
  const [projectDuration, setProjectDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const [videoTimeline, setVideoTimeline] = useState<VideoClip[]>([]);
  const [audioTimeline, setAudioTimeline] = useState<AudioClip[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  const animationFrameId = useRef<number | null>(null);

  const offscreenCanvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  const pixelsPerSecond = 30;

  const ffmpeg = createFFmpeg({
    corePath: "https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js",
  });

  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
    }

    return () => {
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const offscreenCanvas = document.createElement("canvas");
    const offscreenCtx = offscreenCanvas.getContext("2d");

    if (offscreenCtx) {
      offscreenCanvasRef.current = offscreenCanvas;
      offscreenCtxRef.current = offscreenCtx;
    }
  }, []);

  const handleVideoImportClick = () => {
    videoInputRef.current?.click();
  };

  const handleAudioImportClick = () => {
    audioInputRef.current?.click();
  };

  const handleVideoFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (file && file.type.startsWith("video/")) {
      if (!ffmpeg.isLoaded()) {
        await ffmpeg.load();
      }

      await ffmpeg.FS("writeFile", "original.mp4", await fetchFile(file));

      await ffmpeg.run(
        "-i",
        "original.mp4",
        "-vf",
        "reverse",
        "-af",
        "areverse",
        "reversed.mp4"
      );

      await ffmpeg.run(
        "-i",
        "original.mp4",
        "-i",
        "reversed.mp4",
        "-filter_complex",
        "[0:v][1:v]concat=n=2:v=1[outv]",
        "-map",
        "[outv]",
        "combined.mp4"
      );

      const data = await ffmpeg.FS("readFile", "combined.mp4");
      const combinedBlob = new Blob([data.buffer], { type: "video/mp4" });
      const url = URL.createObjectURL(combinedBlob);
      // const url = URL.createObjectURL(file);
      const tempVideo = document.createElement("video");

      tempVideo.src = url;
      tempVideo.preload = "metadata";
      tempVideo.muted = true;

      tempVideo.onloadedmetadata = () => {
        const newClip: VideoClip = {
          id: `video-${Date.now()}`,
          file: file,
          sourceUrl: url,
          originalDuration: tempVideo.duration,
          timelineStart:
            videoTimeline.length > 0
              ? videoTimeline[videoTimeline.length - 1].timelineEnd
              : 0,
          timelineEnd:
            (videoTimeline.length > 0
              ? videoTimeline[videoTimeline.length - 1].timelineEnd
              : 0) + tempVideo.duration,
          clipStartOffset: 0,
          clipDuration: tempVideo.duration,
          hiddenVideoRef: React.createRef<HTMLVideoElement>(),
        };

        setVideoTimeline((prev) => [...prev, newClip]);
        setProjectDuration(Math.max(projectDuration, newClip.timelineEnd));

        const hiddenVideoEl = document.createElement("video");

        hiddenVideoEl.id = newClip.id;
        hiddenVideoEl.src = newClip.sourceUrl;
        hiddenVideoEl.style.display = "none";
        hiddenVideoEl.muted = true;
        hiddenVideoEl.preload = "auto";
        (
          newClip.hiddenVideoRef as React.MutableRefObject<HTMLVideoElement>
        ).current = hiddenVideoEl;
        document.body.appendChild(hiddenVideoEl);
      };
      tempVideo.load();
    }
  };

  const handleAudioFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (file && file.type.startsWith("audio/") && audioContextRef.current) {
      const audioContext = audioContextRef.current;
      const fileReader = new FileReader();

      fileReader.onload = async () => {
        try {
          const audioBuffer = await audioContext.decodeAudioData(
            fileReader.result as ArrayBuffer
          );
          const newClip: AudioClip = {
            id: `audio-${Date.now()}`,
            name: file.name,
            file: file,
            sourceUrl: URL.createObjectURL(file),
            originalDuration: audioBuffer.duration,
            timelineStart:
              audioTimeline.length > 0
                ? audioTimeline[audioTimeline.length - 1].timelineEnd
                : 0,
            timelineEnd:
              (audioTimeline.length > 0
                ? audioTimeline[audioTimeline.length - 1].timelineEnd
                : 0) + audioBuffer.duration,
            clipStartOffset: 0,
            clipDuration: audioBuffer.duration,
            audioBuffer: audioBuffer,
            gainNode: audioContext.createGain(),
          };

          newClip.gainNode?.connect(audioContext.destination);

          setAudioTimeline((prev) => [...prev, newClip]);
          setProjectDuration(Math.max(projectDuration, newClip.timelineEnd));
        } catch (error) {
          console.error("Error decoding audio data:", error);
        }
      };
      fileReader.readAsArrayBuffer(file);
    }
  };

  const play = async () => {
    if (videoTimeline.length === 0 && audioTimeline.length === 0) {
      return;
    }

    if (isPlaying) {
      if (
        audioContextRef.current &&
        audioContextRef.current.state === "running"
      ) {
        await audioContextRef.current.suspend();
      }
      videoTimeline.forEach((clip) => {
        if (clip.hiddenVideoRef.current) {
          clip.hiddenVideoRef.current.pause();
        }
      });
      audioSourcesRef.current.forEach((source) => source.stop());
      audioSourcesRef.current = [];
      setIsPlaying(false);
    } else {
      if (
        !audioContextRef.current ||
        audioContextRef.current.state === "closed"
      ) {
        audioContextRef.current = new (window.AudioContext ||
          window.webkitAudioContext)();

        audioTimeline.forEach((clip) => {
          if (clip.gainNode) {
            clip.gainNode.disconnect();
          }
          clip.gainNode = audioContextRef.current!.createGain();
          clip.gainNode.connect(audioContextRef.current!.destination);
        });
      }

      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }

      audioSourcesRef.current = [];

      audioTimeline.forEach((clip) => {
        if (clip.audioBuffer && audioContextRef.current) {
          const source = audioContextRef.current.createBufferSource();

          source.buffer = clip.audioBuffer;
          source.connect(clip.gainNode!);

          const startTime = Math.max(
            0,
            clip.timelineStart - currentTimelineTime
          );
          const offset = Math.max(
            0,
            currentTimelineTime - clip.timelineStart + clip.clipStartOffset
          );
          const durationToPlay = Math.max(0, clip.clipDuration - offset);

          if (durationToPlay > 0) {
            source.start(
              audioContextRef.current.currentTime + startTime,
              offset,
              durationToPlay
            );
            audioSourcesRef.current.push(source);
          }
        }
      });

      videoTimeline.forEach((clip) => {
        if (clip.hiddenVideoRef.current) {
          const videoEl = clip.hiddenVideoRef.current;
          const videoTime = Math.max(
            0,
            currentTimelineTime - clip.timelineStart + clip.clipStartOffset
          );

          videoEl.currentTime = videoTime;
          videoEl
            .play()
            .catch((e) => console.error("Error playing hidden video:", e));
        }
      });

      setIsPlaying(true);
    }
  };

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const audioContext = audioContextRef.current;
    const offscreenCanvas = offscreenCanvasRef.current;
    const offscreenCtx = offscreenCtxRef.current;

    if (!canvas || !audioContext || !offscreenCanvas || !offscreenCtx) {
      animationFrameId.current = null;
      return;
    }

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      animationFrameId.current = null;
      return;
    }

    const currentMasterTime = audioContext.currentTime;

    setCurrentTimelineTime(currentMasterTime);

    offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

    const activeVideoClips = videoTimeline.filter(
      (clip) =>
        currentMasterTime >= clip.timelineStart &&
        currentMasterTime < clip.timelineEnd
    );

    if (activeVideoClips.length > 0) {
      const mainClip = activeVideoClips[0];
      const hiddenVideoElement = mainClip.hiddenVideoRef.current;

      if (
        hiddenVideoElement &&
        hiddenVideoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        const timeRelativeToClipStart =
          currentMasterTime - mainClip.timelineStart;
        const loopedVideoContentTime =
          (mainClip.clipStartOffset + timeRelativeToClipStart) %
          mainClip.originalDuration;

        if (
          Math.abs(hiddenVideoElement.currentTime - loopedVideoContentTime) >
          0.05
        ) {
          hiddenVideoElement.currentTime = loopedVideoContentTime;
        }

        if (
          offscreenCanvas.width !== hiddenVideoElement.videoWidth ||
          offscreenCanvas.height !== hiddenVideoElement.videoHeight
        ) {
          offscreenCanvas.width = hiddenVideoElement.videoWidth;
          offscreenCanvas.height = hiddenVideoElement.videoHeight;
        }

        offscreenCtx.drawImage(
          hiddenVideoElement,
          0,
          0,
          offscreenCanvas.width,
          offscreenCanvas.height
        );

        if (
          canvas.width !== offscreenCanvas.width ||
          canvas.height !== offscreenCanvas.height
        ) {
          canvas.width = offscreenCanvas.width;
          canvas.height = offscreenCanvas.height;
        }
        ctx.drawImage(offscreenCanvas, 0, 0);
      }
    } else {
      if (canvas.width === 0 || canvas.height === 0) {
        canvas.width = 1280;
        canvas.height = 720;
        if (offscreenCanvas.width === 0 || offscreenCanvas.height === 0) {
          offscreenCanvas.width = 1280;
          offscreenCanvas.height = 720;
        }
      }
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (currentMasterTime >= projectDuration && projectDuration > 0) {
      setIsPlaying(false);
      setCurrentTimelineTime(0);
      if (audioContext.state === "running") {
        audioContext.suspend();
        audioSourcesRef.current.forEach((source) => source.stop());
        audioSourcesRef.current = [];
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      videoTimeline.forEach((clip) => {
        if (clip.hiddenVideoRef.current) {
          clip.hiddenVideoRef.current.pause();
          clip.hiddenVideoRef.current.currentTime = 0;
        }
      });
      return;
    }

    if (isPlaying) {
      animationFrameId.current = requestAnimationFrame(renderCanvas);
    }
  }, [
    isPlaying,
    videoTimeline,
    audioTimeline,
    currentTimelineTime,
    projectDuration,
  ]);

  const handleTimelineSeek = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    if (!audioContextRef.current) return;

    const timelineElement = event.currentTarget;
    const clickX = event.clientX - timelineElement.getBoundingClientRect().left;

    const newTime = clickX / pixelsPerSecond;

    const clampedTime = Math.max(0, Math.min(newTime, projectDuration));

    if (isPlaying) {
      play();
    }

    setCurrentTimelineTime(clampedTime);

    videoTimeline.forEach((clip) => {
      if (clip.hiddenVideoRef.current) {
        const videoEl = clip.hiddenVideoRef.current;
        const videoTime = Math.max(
          0,
          clampedTime - clip.timelineStart + clip.clipStartOffset
        );

        videoEl.currentTime = videoTime;
        videoEl.pause();
      }
    });

    if (audioContextRef.current) {
      if (audioContextRef.current.state === "running") {
        audioContextRef.current.suspend();
      }
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  useEffect(() => {
    if (isPlaying) {
      animationFrameId.current = requestAnimationFrame(renderCanvas);
    } else {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    }

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isPlaying, renderCanvas]);

  useEffect(() => {
    return () => {
      videoTimeline.forEach((clip) => {
        const hiddenVideoEl = document.getElementById(clip.id);

        if (hiddenVideoEl) {
          if (
            hiddenVideoEl instanceof HTMLVideoElement &&
            hiddenVideoEl.src.startsWith("blob:")
          ) {
            URL.revokeObjectURL(hiddenVideoEl.src);
          }
          hiddenVideoEl.remove();
        }
      });
      audioTimeline.forEach((clip) => {
        if (clip.sourceUrl.startsWith("blob:")) {
          URL.revokeObjectURL(clip.sourceUrl);
        }
      });
    };
  }, [videoTimeline, audioTimeline]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    const paddedMinutes = String(minutes).padStart(2, "0");
    const paddedSeconds = String(remainingSeconds).padStart(2, "0");

    return `${paddedMinutes}:${paddedSeconds}`;
  };

  const TimeRuler = ({ duration }: { duration: number }) => {
    const totalWidth = duration * pixelsPerSecond;
    const marks = [];

    for (let i = 0; i <= Math.ceil(duration); i++) {
      const isMajorMark = i % 5 === 0;
      const position = i * pixelsPerSecond;

      marks.push(
        <div
          key={i}
          className="absolute flex flex-col items-center"
          style={{ left: `${position}px` }}
        >
          <div className={`bg-white w-px ${isMajorMark ? " h-4" : " h-2"}`} />
          {isMajorMark && i != 0 && (
            <span className="text-xs text-white select-none absolute mt-4">
              {formatTime(i)}
            </span>
          )}
        </div>
      );
    }

    return (
      <div
        className="relative h-full cursor-pointer"
        style={{ width: `${totalWidth}px` }}
        onClick={handleTimelineSeek}
      >
        {marks}
      </div>
    );
  };

  return (
    <section className="flex flex-col items-center justify-center gap-2 bg-green-300 w-full min-h-screen p-4">
      <div className="w-full text-white bg-black p-4 flex justify-between items-center rounded-t-lg max-w-6xl">
        <h1 className="text-lg font-bold">Project</h1>
        <div className="flex gap-2">
          <button
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-2"
            onClick={handleVideoImportClick}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
              />
            </svg>
            Import Video
          </button>
          <button
            onClick={handleAudioImportClick}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded flex items-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.59-.63-1.59-1.41V9.91c0-.78.71-1.41 1.59-1.41h2.24Z"
              />
            </svg>
            Import Audio
          </button>
        </div>
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          onChange={handleVideoFileChange}
          className="hidden"
        />
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          onChange={handleAudioFileChange}
          className="hidden"
        />
      </div>

      <div
        className={`relative bg-black flex justify-center items-center w-full max-w-6xl aspect-video ${videoTimeline.length === 0 ? "cursor-default" : "cursor-pointer"}`}
        onClick={play}
      >
        {videoTimeline.length == 0 && audioTimeline.length == 0 && (
          // <p>ajskdhkajgdkasd</p>
          // <img src="/mobile-suit-gundam-gquuuuuux-4.jpg" alt="something" />
          <Image
            src={"/mobile-suit-gundam-gquuuuuux-4.jpg"}
            width={0}
            height={0}
            sizes="100%"
            alt="Picture of the author"
            className="flex items-center justify-center"
          />
        )}
        <canvas ref={canvasRef} className="max-w-full max-h-full" />

        {(videoTimeline.length > 0 || audioTimeline.length > 0) &&
          !isPlaying && (
            <div className="absolute text-white z-10 pointer-events-none">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="size-24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z"
                />
              </svg>
            </div>
          )}
      </div>

      {/* <div className="w-full max-w-6xl bg-black p-4 flex justify-between items-center rounded-b-lg text-white">
        <button
          onClick={play}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
          disabled={videoTimeline.length === 0 && audioTimeline.length === 0}
        >
          {isPlaying ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-6"
            >
              <path
                fillRule="evenodd"
                d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1-.75-.75V5.25Z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-6"
            >
              <path
                fillRule="evenodd"
                d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.561 0 3.273L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>
        <div className="text-sm">
          {formatTime(currentTimelineTime)} / {formatTime(projectDuration)}
        </div>
      </div> */}

      <div className="w-full max-w-6xl h-60 bg-black flex flex-row rounded-lg overflow-hidden">
        <div className="w-[5%] text-white p-2 flex flex-col justify-around items-center border-r border-gray-700">
          <div className="h-[20%]"></div>
          <div className="h-[20%] flex justify-center items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="size-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
              />
            </svg>
          </div>
          <div className="h-[40%] flex justify-center items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="size-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0 1 18 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0 1 18 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 0 1 6 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M19.125 12h1.5m0 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h1.5m14.25 0h1.5"
              />
            </svg>
          </div>
          <div className="h-[20%] flex justify-center items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="size-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z"
              />
            </svg>
          </div>
        </div>
        <div className="w-px bg-gray-600"></div>
        <div className="w-full overflow-x-auto relative overflow-y-hidden">
          <div
            className="absolute top-0 left-0 h-full pointer-events-none z-20"
            style={{ left: `${currentTimelineTime * pixelsPerSecond}px` }}
          >
            <div className="w-0.5 h-full bg-red-500"></div>
          </div>
          <div className="h-[20%] w-full relative border-b border-gray-700">
            <TimeRuler duration={projectDuration} />
          </div>
          <div className="h-[20%] flex items-center w-full relative border-b border-gray-700 box-border">
            asdjaslkjdl
          </div>
          <div className="h-[40%] flex items-center w-full relative border-b border-gray-700 box-border">
            {videoTimeline.map((video) => (
              <div
                key={video.id}
                className="absolute flex items-center text-sm font-medium rounded bg-purple-600 text-white truncate px-2 h-full overflow-hidden"
                style={{
                  left: `${video.timelineStart * pixelsPerSecond}px`,
                  width: `${video.clipDuration * pixelsPerSecond}px`,
                }}
              >
                {video.file.name}
              </div>
            ))}
          </div>
          <div className="h-[20%] flex items-center w-full relative">
            {audioTimeline.map((audio) => (
              <div
                key={audio.id}
                className="absolute flex items-center text-sm font-medium rounded bg-blue-600 text-white truncate px-2 h-full overflow-hidden"
                style={{
                  left: `${audio.timelineStart * pixelsPerSecond}px`,
                  width: `${audio.clipDuration * pixelsPerSecond}px`,
                }}
              >
                {audio.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
