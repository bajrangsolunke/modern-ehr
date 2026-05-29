/**
 * Thin wrapper around the Jitsi Meet External API.
 *
 * The script lives on the same Jitsi domain we're calling into, so
 * we load it dynamically (no npm dep, no bundle bloat). We cache the
 * loader Promise so concurrent mounts share one fetch.
 *
 * The External API is itself a singleton-per-iframe — every
 * `new JitsiMeetExternalAPI(...)` creates a fresh iframe and is
 * independent of any prior one. That's the opposite of Daily's
 * global singleton, so the StrictMode/HMR race we fought on Daily
 * doesn't apply here.
 */

type JitsiEvent =
  | "videoConferenceJoined"
  | "videoConferenceLeft"
  | "readyToClose"
  | "participantJoined"
  | "participantLeft";

export interface JitsiMeetApi {
  dispose(): void;
  // The External API exposes addListener but `on` is the documented
  // alias; both work.
  on(event: JitsiEvent, handler: (data: unknown) => void): void;
  off(event: JitsiEvent, handler: (data: unknown) => void): void;
  executeCommand(cmd: string, ...args: unknown[]): void;
}

interface JitsiCtorOptions {
  roomName: string;
  parentNode: HTMLElement;
  width?: string | number;
  height?: string | number;
  userInfo?: { displayName?: string; email?: string };
  configOverwrite?: Record<string, unknown>;
  interfaceConfigOverwrite?: Record<string, unknown>;
}

type JitsiCtor = new (domain: string, options: JitsiCtorOptions) => JitsiMeetApi;

declare global {
  interface Window {
    JitsiMeetExternalAPI?: JitsiCtor;
  }
}

let loaderPromise: Promise<JitsiCtor> | null = null;

/**
 * Load the External API script from the configured Jitsi domain.
 * Resolves with the constructor once it's available on `window`.
 */
export function loadJitsi(domain = "meet.jit.si"): Promise<JitsiCtor> {
  if (window.JitsiMeetExternalAPI) {
    return Promise.resolve(window.JitsiMeetExternalAPI);
  }
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<JitsiCtor>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-jitsi-loader="true"]',
    );
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.JitsiMeetExternalAPI) {
          resolve(window.JitsiMeetExternalAPI);
        } else {
          reject(new Error("Jitsi script loaded but constructor missing"));
        }
      });
      existing.addEventListener("error", () => {
        reject(new Error("Failed to load Jitsi script"));
      });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://${domain}/external_api.js`;
    script.async = true;
    script.dataset.jitsiLoader = "true";
    script.onload = () => {
      if (window.JitsiMeetExternalAPI) {
        resolve(window.JitsiMeetExternalAPI);
      } else {
        reject(new Error("Jitsi script loaded but constructor missing"));
      }
    };
    script.onerror = () => reject(new Error("Failed to load Jitsi script"));
    document.head.appendChild(script);
  }).catch((err) => {
    // Reset the cache so the next call can retry — otherwise a
    // transient network blip locks us out for the page lifetime.
    loaderPromise = null;
    throw err;
  });

  return loaderPromise;
}

/**
 * Extract the Jitsi `(domain, roomName)` pair from a full room URL
 * like `https://meet.jit.si/mehr-abc123`.
 */
export function parseJitsiUrl(roomUrl: string): {
  domain: string;
  roomName: string;
} {
  const u = new URL(roomUrl);
  return {
    domain: u.hostname,
    roomName: u.pathname.replace(/^\//, ""),
  };
}
