/**
 * MediaRecorder hook that emits separable audio chunks by stop-restart cycling.
 * Each chunk is independently decodable (no timeslice fragmentation).
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "recording" | "stopped" | "error";

interface UseRecorderOptions {
  /** Length of each audio chunk in milliseconds. Default: 4000 */
  chunkMs?: number;
  /** Called for each completed audio blob and its duration in ms */
  onChunk: (blob: Blob, durationMs: number) => void | Promise<void>;
}

interface UseRecorderReturn {
  state: RecorderState;
  error: string | null;
  level: number; // 0..1 audio level for Waveform
  stream: MediaStream | null;
  start: () => Promise<void>;
  stop: () => void;
}

const MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg",
  "",
];

function getSupportedMime(): string {
  for (const mime of MIME_TYPES) {
    if (!mime || MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "";
}

export function useRecorder({
  chunkMs = 4000,
  onChunk,
}: UseRecorderOptions): UseRecorderReturn {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isRecordingRef = useRef(false);
  const chunkStartRef = useRef(0);
  const rafRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const onChunkRef = useRef(onChunk);
  onChunkRef.current = onChunk;

  const startAnalyser = useCallback((s: MediaStream) => {
    try {
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(s);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const max = data.reduce((a, b) => Math.max(a, b), 0);
        setLevel(max / 255);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      // Analyser is non-critical; fail silently
    }
  }, []);

  const stopAnalyser = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setLevel(0);
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  const buildRecorder = useCallback(
    (s: MediaStream): MediaRecorder => {
      const mime = getSupportedMime();
      const recorder = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        const duration = Date.now() - chunkStartRef.current;
        if (blob.size > 0) {
          void onChunkRef.current(blob, duration);
        }

        // Restart for next chunk if still recording
        if (isRecordingRef.current && streamRef.current) {
          try {
            const next = buildRecorder(streamRef.current);
            recorderRef.current = next;
            chunksRef.current = [];
            chunkStartRef.current = Date.now();
            next.start();
            setTimeout(() => {
              if (isRecordingRef.current && next.state === "recording") {
                next.stop();
              }
            }, chunkMs);
          } catch {
            // ignore
          }
        }
      };

      return recorder;
    },
    [chunkMs]
  );

  const start = useCallback(async () => {
    if (state === "recording") return;

    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = s;
      setStream(s);
      isRecordingRef.current = true;
      setState("recording");
      setError(null);

      startAnalyser(s);

      const recorder = buildRecorder(s);
      recorderRef.current = recorder;
      chunksRef.current = [];
      chunkStartRef.current = Date.now();
      recorder.start();

      setTimeout(() => {
        if (isRecordingRef.current && recorder.state === "recording") {
          recorder.stop();
        }
      }, chunkMs);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Microphone access denied";
      setError(msg);
      setState("error");
    }
  }, [state, chunkMs, buildRecorder, startAnalyser]);

  const stop = useCallback(() => {
    isRecordingRef.current = false;
    stopAnalyser();

    if (
      recorderRef.current &&
      recorderRef.current.state !== "inactive"
    ) {
      recorderRef.current.stop();
    }

    // Give onstop a tick to fire, then close the mic
    setTimeout(() => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
      setState("stopped");
    }, 200);
  }, [stopAnalyser]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      stopAnalyser();
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [stopAnalyser]);

  return { state, error, level, stream, start, stop };
}
