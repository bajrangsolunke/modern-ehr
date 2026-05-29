/**
 * Browser Web Speech API adapter for dev-mode transcription.
 *
 * Why this exists: Daily.co's `startTranscription()` (Deepgram-backed)
 * requires a Scale/HIPAA plan. On the free plan we still want to
 * exercise the full transcript → SOAP pipeline, so we drive it from
 * the browser's built-in `SpeechRecognition` instead.
 *
 * Limitations vs. Daily-Deepgram:
 *   - Only captures the LOCAL mic, so the patient's audio (heard
 *     through speakers) may or may not be picked up depending on echo
 *     leak. We tag everything as `unknown` so the LLM doesn't trust
 *     the speaker labels.
 *   - Chrome/Edge only — Firefox doesn't ship it, Safari is flaky.
 *   - The API auto-stops after ~60s of silence; we restart it.
 *
 * For production, set VITE_TRANSCRIPTION_MODE=daily once on a Daily
 * plan with the Transcription add-on.
 */

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((evt: SpeechRecognitionEventLike) => void) | null;
  onerror: ((evt: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isWebSpeechSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

interface StartOptions {
  /** BCP-47 tag, e.g. "en-US". */
  lang?: string;
  /** Called for every finalized utterance. */
  onFinal: (text: string) => void;
  /** Called when the API errors out for good (not transient end events). */
  onError?: (message: string) => void;
}

interface Controller {
  stop: () => void;
}

/**
 * Start continuous transcription. Returns a controller whose `stop()`
 * tears it down idempotently.
 *
 * Auto-restart behavior: `onend` fires on the natural silence timeout
 * — we restart unless the caller explicitly called `stop()`. That way
 * a 30-minute visit doesn't silently lose transcription after the
 * first long pause.
 */
export function startWebSpeechTranscription(opts: StartOptions): Controller {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    opts.onError?.(
      "This browser doesn't support speech recognition. Use Chrome or Edge.",
    );
    return { stop: () => {} };
  }

  let stopped = false;
  let recognition: SpeechRecognitionLike | null = null;

  const spawn = () => {
    if (stopped) return;
    const rec = new Ctor();
    rec.lang = opts.lang ?? "en-US";
    rec.continuous = true;
    rec.interimResults = false;

    rec.onresult = (evt) => {
      for (let i = evt.resultIndex; i < evt.results.length; i++) {
        const r = evt.results[i];
        if (!r.isFinal) continue;
        const text = r[0]?.transcript?.trim();
        if (text) opts.onFinal(text);
      }
    };

    rec.onerror = (evt) => {
      // `no-speech` / `aborted` fire frequently and aren't real errors —
      // the `onend` restart loop handles them. Bubble only the rest.
      const ignorable = new Set(["no-speech", "aborted", "audio-capture"]);
      if (!ignorable.has(evt.error)) {
        opts.onError?.(evt.error);
      }
    };

    rec.onend = () => {
      // Auto-restart unless the caller stopped us.
      if (!stopped) {
        // A microtask delay avoids tight-loop restarts when the
        // browser ends and immediately re-ends.
        setTimeout(spawn, 100);
      }
    };

    try {
      rec.start();
      recognition = rec;
    } catch (e) {
      opts.onError?.(e instanceof Error ? e.message : "Failed to start");
    }
  };

  spawn();

  return {
    stop: () => {
      stopped = true;
      try {
        recognition?.stop();
      } catch {
        /* swallow */
      }
      recognition = null;
    },
  };
}
