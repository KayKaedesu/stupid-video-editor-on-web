interface VideoClip {
  id: string;
  file: File;
  sourceUrl: string;
  originalDuration: number;
  timelineStart: number;
  timelineEnd: number;
  clipStartOffset: number;
  clipDuration: number;
  hiddenVideoRef: React.RefObject<HTMLVideoElement>;
}

interface AudioClip {
  id: string;
  name: string;
  file: File;
  sourceUrl: string;
  originalDuration: number;
  timelineStart: number;
  timelineEnd: number;
  clipStartOffset: number;
  clipDuration: number;
  audioBuffer: AudioBuffer | null;
  gainNode: GainNode | null;
}
