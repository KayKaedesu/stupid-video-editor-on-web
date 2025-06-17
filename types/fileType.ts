interface VideoClip {
  id: string;
  file: File;
  sourceUrl: string;
  originalDuration: number;
  timelineStart: number;
  timelineEnd: number;
  clipStartOffset: number;
  clipDuration: number;
}
