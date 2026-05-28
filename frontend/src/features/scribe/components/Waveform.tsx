/**
 * Polished animated waveform bars driven by Web Audio AnalyserNode.
 * 32 mirror bars (top + bottom halves) growing from a center line.
 * Gradient fill, rounded caps, subtle glowing center line.
 * Falls back to a slow pulsing idle state when stream is null.
 */
import { useEffect, useRef } from "react";

interface WaveformProps {
  stream: MediaStream | null;
  className?: string;
}

const BAR_COUNT = 32;
const CANVAS_HEIGHT = 80;
const BAR_GAP = 3;

interface PrimaryHsl {
  h: number;
  s: string;
  l: string;
}

/**
 * The project ships `--primary` as a Tailwind-style HSL triplet
 * (`217 100% 65%`). Concatenating "66" onto `hsl(...)` for a
 * transparent stop produces invalid CSS and the bars don't paint — we
 * have to parse the components ourselves and emit proper hsla().
 */
function parsePrimary(): PrimaryHsl {
  try {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue("--primary")
      .trim();
    if (raw) {
      const parts = raw.split(/[\s,]+/).filter(Boolean);
      if (parts.length >= 3) {
        const h = Number(parts[0].replace("deg", ""));
        if (!Number.isNaN(h)) {
          return { h, s: parts[1], l: parts[2] };
        }
      }
    }
  } catch {
    /* ignore */
  }
  // Fallback brand blue — close to --primary: 217 100% 65%
  return { h: 217, s: "100%", l: "65%" };
}

function hsl(p: PrimaryHsl, alpha = 1): string {
  if (alpha >= 1) return `hsl(${p.h}, ${p.s}, ${p.l})`;
  return `hsla(${p.h}, ${p.s}, ${p.l}, ${alpha})`;
}

function drawMirrorBars(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  data: Uint8Array,
  primary: PrimaryHsl,
  barWidth: number,
) {
  const cy = canvas.height / 2; // center Y

  for (let i = 0; i < BAR_COUNT; i++) {
    const val = Math.min(1, data[i] / 255);
    // Boost the visible response — quiet voices barely move the FFT
    // bars otherwise. The 0.6 power compresses the dynamic range.
    const boosted = Math.pow(val, 0.6);
    // Minimum 3px half-height so bars are always visible
    const halfH = Math.max(3, boosted * (canvas.height / 2 - 4));

    const x = i * (barWidth + BAR_GAP);

    // Vertical gradient: full color in the middle, fades to 30% at the tips
    const grad = ctx.createLinearGradient(0, cy - halfH, 0, cy + halfH);
    grad.addColorStop(0, hsl(primary, 0.3));
    grad.addColorStop(0.5, hsl(primary, 1));
    grad.addColorStop(1, hsl(primary, 0.3));

    ctx.fillStyle = grad;
    const r = Math.min(barWidth / 2, halfH);
    ctx.beginPath();
    ctx.roundRect(x, cy - halfH, barWidth, halfH * 2, r);
    ctx.fill();
  }
}

function drawCenterLine(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  primary: PrimaryHsl,
  alpha: number,
) {
  const cy = canvas.height / 2;
  ctx.fillStyle = hsl(primary, alpha);
  ctx.fillRect(0, cy - 0.75, canvas.width, 1.5);
}

export function Waveform({ stream, className }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Sync canvas pixel resolution with rendered CSS width so the
    // bars look crisp on hi-DPI.
    const syncSize = () => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      if (canvas.width !== w) canvas.width = w;
    };
    syncSize();

    const primary = parsePrimary();
    const barWidth = Math.max(
      4,
      Math.floor((canvas.width - BAR_GAP * (BAR_COUNT - 1)) / BAR_COUNT),
    );

    if (!stream) {
      // Idle: a slow pulse on the center line + tiny stub bars
      let destroyed = false;
      let t = 0;

      const idle = () => {
        if (destroyed) return;
        t += 0.025;
        const pulse = 0.2 + 0.15 * Math.sin(t);
        const ctx2d = canvas.getContext("2d");
        if (!ctx2d) return;
        ctx2d.clearRect(0, 0, canvas.width, canvas.height);

        const cy = canvas.height / 2;
        for (let i = 0; i < BAR_COUNT; i++) {
          const x = i * (barWidth + BAR_GAP);
          const halfH = 3;
          ctx2d.fillStyle = hsl(primary, 0.2);
          ctx2d.beginPath();
          ctx2d.roundRect(x, cy - halfH, barWidth, halfH * 2, 2);
          ctx2d.fill();
        }
        drawCenterLine(ctx2d, canvas, primary, pulse);
        rafRef.current = requestAnimationFrame(idle);
      };
      rafRef.current = requestAnimationFrame(idle);

      return () => {
        destroyed = true;
        cancelAnimationFrame(rafRef.current);
      };
    }

    // Live recording state
    let destroyed = false;

    (async () => {
      try {
        const audioCtx = new AudioContext();
        ctxRef.current = audioCtx;
        // AudioContext is created in "suspended" state when not started
        // by a direct user gesture (we're inside a useEffect that runs
        // after the click → getUserMedia → setState chain has resolved).
        // resume() unblocks AnalyserNode data flow.
        if (audioCtx.state === "suspended") {
          await audioCtx.resume().catch(() => {});
        }

        const src = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128; // 64 bins, we use first 32
        analyser.smoothingTimeConstant = 0.75;
        src.connect(analyser);
        analyserRef.current = analyser;

        const data = new Uint8Array(analyser.frequencyBinCount);

        const draw = () => {
          if (destroyed) return;
          analyser.getByteFrequencyData(data);
          const ctx2d = canvas.getContext("2d");
          if (!ctx2d) return;
          ctx2d.clearRect(0, 0, canvas.width, canvas.height);

          drawMirrorBars(ctx2d, canvas, data, primary, barWidth);
          drawCenterLine(ctx2d, canvas, primary, 0.55);

          rafRef.current = requestAnimationFrame(draw);
        };
        rafRef.current = requestAnimationFrame(draw);
      } catch {
        // AudioContext or createMediaStreamSource failed — show idle
        // animation instead so something is on screen.
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

  return (
    <canvas
      ref={canvasRef}
      height={CANVAS_HEIGHT}
      className={className}
      style={{ display: "block", width: "100%", height: `${CANVAS_HEIGHT}px` }}
    />
  );
}
