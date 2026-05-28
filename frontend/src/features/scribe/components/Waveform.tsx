/**
 * Animated waveform bars driven by Web Audio AnalyserNode.
 * Accepts a MediaStream; tears down AudioContext on unmount.
 */
import { useEffect, useRef } from "react";

interface WaveformProps {
  stream: MediaStream | null;
  className?: string;
}

const BAR_COUNT = 32;
const BAR_WIDTH = 4;
const BAR_GAP = 2;

export function Waveform({ stream, className }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!stream) {
      // Draw idle flat bars
      const ctx2d = canvas.getContext("2d");
      if (!ctx2d) return;
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < BAR_COUNT; i++) {
        const x = i * (BAR_WIDTH + BAR_GAP);
        const h = 4;
        const y = (canvas.height - h) / 2;
        ctx2d.fillStyle = "rgba(99,102,241,0.2)";
        ctx2d.beginPath();
        ctx2d.roundRect(x, y, BAR_WIDTH, h, 2);
        ctx2d.fill();
      }
      return;
    }

    let destroyed = false;

    (async () => {
      try {
        const audioCtx = new AudioContext();
        ctxRef.current = audioCtx;
        const src = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = BAR_COUNT * 2;
        src.connect(analyser);
        analyserRef.current = analyser;

        const data = new Uint8Array(analyser.frequencyBinCount);

        const draw = () => {
          if (destroyed) return;
          analyser.getByteFrequencyData(data);
          const ctx2d = canvas.getContext("2d");
          if (!ctx2d) return;
          ctx2d.clearRect(0, 0, canvas.width, canvas.height);
          for (let i = 0; i < BAR_COUNT; i++) {
            const val = data[i] / 255;
            const h = Math.max(4, val * canvas.height);
            const x = i * (BAR_WIDTH + BAR_GAP);
            const y = (canvas.height - h) / 2;
            // Gradient: dim at low level, vibrant purple at high
            const alpha = 0.3 + val * 0.7;
            ctx2d.fillStyle = `rgba(99,102,241,${alpha})`;
            ctx2d.beginPath();
            ctx2d.roundRect(x, y, BAR_WIDTH, h, 2);
            ctx2d.fill();
          }
          rafRef.current = requestAnimationFrame(draw);
        };
        rafRef.current = requestAnimationFrame(draw);
      } catch {
        // AudioContext unavailable — non-critical
      }
    })();

    return () => {
      destroyed = true;
      cancelAnimationFrame(rafRef.current);
      analyserRef.current?.disconnect();
      ctxRef.current?.close().catch(() => {});
      analyserRef.current = null;
      ctxRef.current = null;
    };
  }, [stream]);

  const totalWidth = BAR_COUNT * (BAR_WIDTH + BAR_GAP) - BAR_GAP;

  return (
    <canvas
      ref={canvasRef}
      width={totalWidth}
      height={48}
      className={className}
      style={{ display: "block" }}
    />
  );
}
