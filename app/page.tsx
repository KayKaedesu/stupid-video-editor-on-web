"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const { createFFmpeg, fetchFile } = require("@ffmpeg/ffmpeg");

export default function Home() {
  const [timer, setTimer] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videos, setVideos] = useState<HTMLVideoElement[]>([]);
  const [audios, setAudios] = useState<HTMLAudioElement[]>([]);
  // const [audioElements, setAudioElements] = useState({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const ffmpeg = createFFmpeg({
    corePath: "https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js",
    log: true,
  });
  const pixelsPerSecond = 60;

  function play() {
    if (videoRef.current && videos.length != 0) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }

  function handleVideoImport() {
    videoInputRef.current?.click();
  }

  function handleAudioImport() {
    audioInputRef.current?.click();
  }

  function handleAudioFileChange(event) {
    const file = event.target.files[0];

    if (file && file.type.startsWith("audio/")) {
      const url = URL.createObjectURL(file);
      const audio = new Audio(url);

      audio.onloadedmetadata = () => {
        const audioData = {
          id: Date.now(),
          name: file.name,
          url: url,
          duration: audio.duration,
          startTime:
            audios.length == 0 ? 0 : audios[audios.length - 1].stopTime,
          stopTime:
            audios.length == 0
              ? audio.duration
              : audios[audios.length - 1].stopTime + audio.duration,
          file: file,
        };

        setAudios((prev) => [...prev, audioData]);

        setDuration(() => {
          let duration = 0;

          audios.forEach((a) => {
            duration += a.duration;
          });
          if (duration + audio.duration > (videoRef.current?.duration || 0)) {
            return duration + audio.duration;
          }

          return videoRef.current?.duration;
        });
        // setAudioElements((prev) => ({
        //   ...prev,
        //   [audioData.id]: audio,
        // }));
        URL.revokeObjectURL(url);
      };
    }
  }
  async function handleVideoFileChange(event) {
    const file = event.target.files[0];

    if (file && file.type.startsWith("video/") && videoRef.current) {
      try {
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
          "[0:v][0:a][1:v][1:a][0:v][0:a][1:v][1:a]concat=n=4:v=1:a=1[outv][outa]",
          "-map",
          "[outv]",
          "-map",
          "[outa]",
          "combined.mp4"
        );

        const data = await ffmpeg.FS("readFile", "combined.mp4");
        const combinedBlob = new Blob([data.buffer], { type: "video/mp4" });
        const url = URL.createObjectURL(combinedBlob);

        videoRef.current.src = url;
        const videoData = {
          id: Date.now(),
          name: url.name,
          url: url,
          duration: url.duration,
          file: file,
        };

        setVideos((prev) => [...prev, videoData]);
        setIsPlaying(false);

        await ffmpeg.FS("unlink", "original.mp4");
        await ffmpeg.FS("unlink", "reversed.mp4");
        await ffmpeg.FS("unlink", "combined.mp4");
      } catch (error) {
        console.error("Error processing video:", error);
      }
    }
  }

  function handleVideoLoadedMetadata() {
    if (videoRef.current) {
      let audioDur = 0;

      audios.forEach((a) => {
        audioDur += a.duration;
      });
      if (videoRef.current.duration > audioDur) {
        setDuration(videoRef.current.duration);
      } else {
        setDuration(audioDur);
      }
    }
  }

  function handleVideoEnded() {
    setIsPlaying(false);
  }

  const TimeRuler = ({ duration }) => {
    const totalWidth = Math.max(duration * pixelsPerSecond, 1000);
    const marks = [];

    // Generate time marks
    for (let i = 0; i <= Math.ceil(duration); i++) {
      const isMajorMark = i % 5 === 0;
      const position = (i / duration) * totalWidth;

      marks.push(
        <div
          key={i}
          className="absolute flex flex-col items-center"
          style={{ left: `${position}px` }}
        >
          <div
            className={`bg-white ${isMajorMark ? "w-0.5 h-4" : "w-px h-2"}`}
          />
          {isMajorMark && (
            <span className="text-xs text-white mt-1 select-none">
              {Math.floor(i / 60)}:{(i % 60).toString().padStart(2, "0")}
            </span>
          )}
        </div>
      );
    }

    return (
      <div className="relative h-full" style={{ width: `${totalWidth}px` }}>
        {marks}
      </div>
    );
  };

  return (
    <section className="flex flex-col items-center justify-center gap-2 bg-green-300 w-full h-full">
      <div className="w-full text-white bg-black p-4 flex justify-between items-center">
        <h1>Projekt</h1>
        <div className="flex gap-2">
          <button
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-2"
            onClick={handleVideoImport}
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
            onClick={handleAudioImport}
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
          {videos.length == 0 && audios.length == 0}
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
        className=" bg-black flex justify-center items-center"
        onClick={play}
      >
        {videos.length == 0 && audios.length == 0 && (
          <Image
            src={"/mobile-suit-gundam-gquuuuuux-4.jpg"}
            width={1280}
            height={720}
            alt="Picture of the author"
          />
        )}

        {(videos.length > 0 || audios.length > 0) && !isPlaying && (
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
        <video
          ref={videoRef}
          width="1280"
          height="720"
          preload="metadata"
          onLoadedMetadata={handleVideoLoadedMetadata}
          onEnded={handleVideoEnded}
          className={videos ? "block" : "hidden"}
          muted
        />
      </div>

      <div className="w-full h-60 bg-black flex flex-row">
        <div className="w-[5%] text-white">
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
        <div
          className="w-full overflow-x-auto relative overflow-y-hidden"
          // onWheel={(e) => {
          //   e.preventDefault();
          //   e.currentTarget.scrollLeft += e.deltaY;
          // }}
        >
          <div className="absolute h-20 pointer-events-none z-10">
            <div className="w-0.5 h-full bg-red-500"></div>
          </div>
          <div className="h-[20%] w-full relative border-b border-gray-600">
            <TimeRuler duration={duration} />
          </div>
          <div className="h-[20%] flex text-white items-center">
            <p>a</p>
          </div>
          <div className="h-[40%] flex text-white items-center">
            {videos.map((video) => (
              <div
                key={video.id}
                className=" flex items-center text-xs font-medium rounded-sm bg-blue-400 cursor-pointer"
                style={{
                  width: `${Math.max(video.duration * pixelsPerSecond, 1000)}px`,
                }}
              >
                {video.name}
              </div>
            ))}
          </div>
          <div className="h-[20%] flex items-center w-auto">
            {audios.map((audio) => (
              <div
                key={audio.id}
                className=" flex items-center text-xs font-medium rounded-sm bg-blue-400 cursor-pointer"
                style={{
                  width: `${Math.max(audio.duration * pixelsPerSecond, 1000)}px`,
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
