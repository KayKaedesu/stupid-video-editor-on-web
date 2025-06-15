"use client";
import React, { useState, useRef } from "react";

const VideoEditor = () => {
  const [timeline, setTimeline] = useState({
    pixelsPerSecond: 60,
    duration: 90,
    currentTime: 0,
  });

  const [audioClips, setAudioClips] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElements, setAudioElements] = useState({});

  const timelineRef = useRef(null);
  const audioInputRef = useRef(null);
  const animationFrameRef = useRef(null);
  const startTimeRef = useRef(null);

  const handleTimelineClick = (event) => {
    if (!timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const newTime = Math.max(0, clickX / timeline.pixelsPerSecond);

    setTimeline((prev) => ({
      ...prev,
      currentTime: Math.min(newTime, prev.duration),
    }));
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const handleAddAudio = () => {
    audioInputRef.current?.click();
  };

  const handleAudioFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const audio = new Audio(url);

    audio.addEventListener("loadedmetadata", () => {
      // Calculate start time based on existing clips
      let startTime = 0;
      if (audioClips.length > 0) {
        // Find the end time of the last clip
        const lastClip = audioClips[audioClips.length - 1];
        startTime = lastClip.startTime + lastClip.duration;
      }

      const newClip = {
        id: Date.now(),
        name: file.name,
        url: url,
        duration: audio.duration,
        startTime: startTime,
        color: `hsl(${Math.random() * 360}, 70%, 50%)`, // Random color
      };

      setAudioClips((prev) => [...prev, newClip]);

      // Create and store audio element
      setAudioElements((prev) => ({
        ...prev,
        [newClip.id]: audio,
      }));
    });

    audio.load();
  };

  const playAudio = () => {
    if (!isPlaying) {
      setIsPlaying(true);
      startTimeRef.current = performance.now() - timeline.currentTime * 1000;

      // Start all audio clips that should be playing at current time
      audioClips.forEach((clip) => {
        const audio = audioElements[clip.id];
        if (audio) {
          const clipEndTime = clip.startTime + clip.duration;

          if (
            timeline.currentTime >= clip.startTime &&
            timeline.currentTime < clipEndTime
          ) {
            // Calculate where in the audio to start
            const startOffset = timeline.currentTime - clip.startTime;
            audio.currentTime = startOffset;
            audio.play();
          }
        }
      });

      // Start animation loop
      animate();
    } else {
      pauseAudio();
    }
  };

  const pauseAudio = () => {
    setIsPlaying(false);

    // Pause all audio
    Object.values(audioElements).forEach((audio) => {
      audio.pause();
    });

    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  const animate = () => {
    if (!startTimeRef.current) return;

    const currentTime = (performance.now() - startTimeRef.current) / 1000;

    // Update timeline
    setTimeline((prev) => ({
      ...prev,
      currentTime: Math.min(currentTime, prev.duration),
    }));

    // Check if we need to start any audio clips
    audioClips.forEach((clip) => {
      const audio = audioElements[clip.id];
      if (audio && !audio.paused) {
        const clipEndTime = clip.startTime + clip.duration;

        // Stop audio if we've passed its end time
        if (currentTime >= clipEndTime) {
          audio.pause();
          audio.currentTime = 0;
        }
      } else if (audio && audio.paused) {
        // Start audio if we've reached its start time
        if (
          currentTime >= clip.startTime &&
          currentTime < clip.startTime + clip.duration
        ) {
          const startOffset = currentTime - clip.startTime;
          audio.currentTime = startOffset;
          audio.play();
        }
      }
    });

    // Stop if we've reached the end
    if (currentTime >= timeline.duration) {
      pauseAudio();
      setTimeline((prev) => ({
        ...prev,
        currentTime: timeline.duration,
      }));
    } else {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  };

  // Cleanup audio elements on unmount
  React.useEffect(() => {
    return () => {
      Object.values(audioElements).forEach((audio) => {
        audio.pause();
        URL.revokeObjectURL(audio.src);
      });
    };
  }, [audioElements]);

  return (
    <div className="h-screen bg-gray-900 text-white flex">
      {/* Hidden file input */}
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        onChange={handleAudioFileSelect}
        className="hidden"
      />

      {/* Sidebar */}
      <div className="w-64 bg-gray-800 border-r border-gray-700 p-4 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Media</h2>

        <button className="w-full mb-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center justify-center">
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add Video
        </button>

        <button
          onClick={handleAddAudio}
          className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md transition-colors flex items-center justify-center"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add Audio
        </button>

        {/* Audio Clips List */}
        {audioClips.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium mb-2 text-gray-400">
              Audio Clips
            </h3>
            <div className="space-y-2">
              {audioClips.map((clip) => (
                <div key={clip.id} className="text-xs bg-gray-700 p-2 rounded">
                  <div className="font-medium truncate">{clip.name}</div>
                  <div className="text-gray-400">
                    Start: {formatTime(clip.startTime)} | Duration:{" "}
                    {formatTime(clip.duration)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Video Panel - Fixed height, doesn't stretch */}
        <div className="h-[calc(100vh-16rem)] bg-black flex items-center justify-center">
          <video
            className="max-w-full max-h-full"
            controls
            style={{ backgroundColor: "#000" }}
          >
            {/* Mock video element - in real implementation, add src attribute */}
            <source src="" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>

        {/* Timeline Panel - Fixed height with horizontal scroll */}
        <div className="h-64 bg-gray-800 border-t border-gray-700 flex flex-col">
          {/* Playback Controls */}
          <div className="h-12 bg-gray-700 border-b border-gray-600 flex items-center px-4">
            <button
              onClick={playAudio}
              className={`px-4 py-1.5 rounded-md transition-colors flex items-center ${
                isPlaying
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {isPlaying ? (
                <>
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                  Pause
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Play
                </>
              )}
            </button>

            <div className="ml-4 text-sm">
              {formatTime(timeline.currentTime)} /{" "}
              {formatTime(timeline.duration)}
            </div>
          </div>

          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <div
              ref={timelineRef}
              className="relative h-full cursor-pointer"
              onClick={handleTimelineClick}
              style={{
                width: `${timeline.duration * timeline.pixelsPerSecond}px`,
                minWidth: "100%",
              }}
            >
              {/* Time Ruler */}
              <div className="h-8 bg-gray-700 border-b border-gray-600 relative">
                {Array.from(
                  { length: Math.ceil(timeline.duration) + 1 },
                  (_, i) => (
                    <div key={i} className="absolute">
                      {/* Major tick marks (every second) */}
                      <div
                        className="w-0.5 h-8 bg-gray-400"
                        style={{
                          left: `${i * timeline.pixelsPerSecond}px`,
                        }}
                      />
                      {/* Time labels */}
                      <div
                        className="absolute text-xs text-gray-300 mt-1"
                        style={{
                          left: `${i * timeline.pixelsPerSecond + 2}px`,
                          top: "2px",
                        }}
                      >
                        {formatTime(i)}
                      </div>

                      {/* Minor tick marks (every 0.5 seconds) */}
                      {i < timeline.duration && (
                        <div
                          className="w-0.5 h-4 bg-gray-500"
                          style={{
                            left: `${(i + 0.5) * timeline.pixelsPerSecond}px`,
                          }}
                        />
                      )}
                    </div>
                  )
                )}
              </div>

              {/* Video Track */}
              <div className="h-16 border-b border-gray-600 relative bg-gray-800">
                <div className="absolute left-3 top-5 text-sm font-medium z-10 text-blue-400">
                  VIDEO TRACK
                </div>
                {/* Track content area */}
                <div className="w-full h-full bg-gray-800 hover:bg-gray-750 transition-colors" />
              </div>

              {/* Audio Track */}
              <div className="h-16 border-b border-gray-600 relative bg-gray-800">
                <div className="absolute left-3 top-5 text-sm font-medium z-10 text-green-400">
                  AUDIO TRACK
                </div>

                {/* Audio Clips */}
                {audioClips.map((clip) => (
                  <div
                    key={clip.id}
                    className="absolute top-2 bottom-2 rounded flex items-center px-2 text-xs font-medium overflow-hidden transition-all duration-200"
                    style={{
                      left: `${clip.startTime * timeline.pixelsPerSecond}px`,
                      width: `${clip.duration * timeline.pixelsPerSecond}px`,
                      backgroundColor: clip.color,
                      opacity: 0.8,
                      zIndex: 10,
                    }}
                  >
                    <div className="truncate select-none">{clip.name}</div>
                    {/* Audio waveform visualization (mock) */}
                    <div className="absolute inset-0 opacity-20 pointer-events-none">
                      {Array.from(
                        { length: Math.floor(clip.duration * 10) },
                        (_, i) => (
                          <div
                            key={i}
                            className="absolute bg-white"
                            style={{
                              left: `${i * 10}%`,
                              width: "8%",
                              height: `${30 + Math.random() * 40}%`,
                              top: "50%",
                              transform: "translateY(-50%)",
                            }}
                          />
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Playhead */}
              <div
                className="absolute top-0 w-0.5 bg-red-500 z-30 pointer-events-none"
                style={{
                  left: `${timeline.currentTime * timeline.pixelsPerSecond}px`,
                  height: "100%",
                }}
              >
                {/* Playhead handle */}
                <div className="w-3 h-3 bg-red-500 -ml-1.5 -mt-1.5 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoEditor;
