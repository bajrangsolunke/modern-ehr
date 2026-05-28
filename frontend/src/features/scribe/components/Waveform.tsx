/**
 * Polished animated waveform bars driven by Web Audio AnalyserNode.
 * 64 mirror bars (32 top + mirror bottom) growing from a center line.
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

/** Read CSS var --primary (hsl values) off the document root and return
 *  a usable CSS color string. Falls back to a brand blue. */
function getPrimaryColor(canvas: HTMLCanvasElement): string {
  try {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue("--primary")
      .trim();
    if (raw) return `hsl(${raw})`;
  } catch {
    // ignore
  }
  // Check the canvas element's computed color property as an alternative
  try {
    const col = getComputedStyle(canvas).color;
    if (col && col !== "rgba(0, 0, 0, 0)") return col;
  } catch {
    // ignore
  }
  return "#4D9FFF"; // fallback brand blue matching --primary: 217 100% 65%
}

function drawMirrorBars(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  data: Float32Array | Uint8Array,
  primaryColor: string,
  barWidth: number
) {
  const cx = canvas.height / 2; // center Y

  for (let i = 0; i < BAR_COUNT; i++) {
    const raw =
      data instanceof Uint8Array ? data[i] / 255 : Math.max(0, data[i]);
    const val = Math.min(1, raw);
    // Minimum 2px half-height so bars are always visible
    const halfH = Math.max(2, val * (canvas.height / 2 - 2));

    const x = i * (barWidth + BAR_GAP);

    // Gradient: full color at center line, fades to 40% opacity at tips
    const grad = ctx.createLinearGradient(0, cx - halfH, 0, cx + halfH);
    grad.addColorStop(0, `${primaryColor}66`); // 40% at top tip
    grad.addColorStop(0.4, primaryColor); // full at 40% from center
    grad.addColorStop(0.5, primaryColor); // full at center
    grad.addColorStop(0.6, primaryColor); // full at 60% from top
    grad.addColorStop(1, `${primaryColor}66`); // 40% at bottom tip

    ctx.fillStyle = grad;
    ctx.beginPath();
    const r = Math.min(barWidth / 2, halfH, 3);
    // top half bar (rounded top cap)
    const topY = cx - halfH;
    ctx.moveTo(x + r, topY);
    ctx.lineTo(x + barWidth - r, topY);
    ctx.arcTo(x + barWidth, topY, x + barWidth, topY + r, r);
    ctx.lineTo(x + barWidth, cx + halfH - r);
    ctx.arcTo(x + barWidth, cx + halfH, x + barWidth - r, cx + halfH, r);
    ctx.lineTo(x + r, cx + halfH);
    ctx.arcTo(x, cx + halfH, x, cx + halfH - r, r);
    ctx.lineTo(x, topY + r);
    ctx.arcTo(x, topY, x + r, topY, r);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCenterLine(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  primaryColor: string,
  glowAlpha: number
) {
  const cx = canvas.height / 2;
  ctx.fillStyle = `${primaryColor}${Math.round(glowAlpha * 255)
    .toString(16)
    .padStart(2, "0")}`;
  ctx.fillRect(0, cx - 0.75, canvas.width, 1.5);
}

export function Waveform({ stream, className }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Sync canvas resolution with rendered size
    const syncSize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && canvas.width !== Math.round(rect.width)) {
        canvas.width = Math.round(rect.width);
      }
    };
    syncSize();

    const primaryColor = getPrimaryColor(canvas);
    const barWidth = Math.max(
      4,
      Math.floor((canvas.width - BAR_GAP * (BAR_COUNT - 1)) / BAR_COUNT)
    );

    if (!stream) {
      // Idle state: slow pulsing glow on center line + flat stub bars
      let destroyed = false;
      let t = 0;

      const idle = () => {
        if (destroyed) return;
        t += 0.02;
        const pulse = 0.15 + 0.1 * Math.sin(t); // 0.05 .. 0.25 glow
        const ctx2d = canvas.getContext("2d");
        if (!ctx2d) return;
        ctx2d.clearRect(0, 0, canvas.width, canvas.height);

        const cx = canvas.height / 2;
        // Tiny stub bars
        for (let i = 0; i < BAR_COUNT; i++) {
          const x = i * (barWidth + BAR_GAP);
          const halfH = 2;
          ctx2d.fillStyle = `${primaryColor}33`;
          ctx2d.beginPath();
          ctx2d.roundRect(x, cx - halfH, barWidth, halfH * 2, 2);
          ctx2d.fill();
        }
        drawCenterLine(ctx2d, canvas, primaryColor, pulse);
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
        const src = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = BAR_COUNT * 4; // 128 bins → use first 32
        analyser.smoothingTimeConstant = 0.8;
        src.connect(analyser);
        analyserRef.current = analyser;

        const data = new Uint8Array(analyser.frequencyBinCount);

        const draw = () => {
          if (destroyed) return;
          analyser.getByteFrequencyData(data);
          const ctx2d = canvas.getContext("2d");
          if (!ctx2d) return;
          ctx2d.clearRect(0, 0, canvas.width, canvas.height);

          // Use first BAR_COUNT bins
          const slice = data.slice(0, BAR_COUNT);
          drawMirrorBars(ctx2d, canvas, slice, primaryColor, barWidth);
          drawCenterLine(ctx2d, canvas, primaryColor, 0.45);

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

  return (
    <canvas
      ref={canvasRef}
      height={CANVAS_HEIGHT}
      className={className}
      style={{ display: "block", width: "100%", height: `${CANVAS_HEIGHT}px` }}
    />
  );
}
