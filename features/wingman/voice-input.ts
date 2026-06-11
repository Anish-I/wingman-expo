import React from 'react';
import { Platform } from 'react-native';

// The project's tsconfig doesn't pull in the DOM lib, so the browser speech APIs
// aren't typed. Cast through `any` at the boundary (same pattern as push-web.ts).
type AnyGlobal = any;

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: AnyGlobal) => void) | null;
  onerror: ((event: AnyGlobal) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (Platform.OS !== 'web') return null;
  const w = globalThis as AnyGlobal;
  return w?.SpeechRecognition ?? w?.webkitSpeechRecognition ?? null;
}

export function isVoiceInputSupported(): boolean {
  return getRecognitionCtor() != null;
}

export type VoiceDictation = {
  /** Whether this platform/browser can do speech-to-text at all. */
  supported: boolean;
  /** True while the mic is actively listening. */
  listening: boolean;
  /** Start if idle, stop if listening. */
  toggle(): void;
  /** Force-stop (e.g. when a message is sent). */
  stop(): void;
  /** Last error reason surfaced to the UI, if any. */
  error: string | null;
};

/**
 * Browser voice dictation for the chat composer. While listening, partial and
 * final transcripts are streamed to `onText`, which receives the full text the
 * composer should show (the snapshot of whatever was already typed plus the
 * speech so far). On native this returns `supported: false` and no-ops.
 */
export function useVoiceDictation(
  getBaseText: () => string,
  onText: (text: string) => void,
): VoiceDictation {
  const supported = React.useMemo(isVoiceInputSupported, []);
  const [listening, setListening] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);
  const baseTextRef = React.useRef('');
  const onTextRef = React.useRef(onText);
  const getBaseTextRef = React.useRef(getBaseText);
  onTextRef.current = onText;
  getBaseTextRef.current = getBaseText;

  const stop = React.useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        // already stopped
      }
    }
    setListening(false);
  }, []);

  const start = React.useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    setError(null);

    // Snapshot what's already in the box so dictation appends rather than wipes.
    const base = getBaseTextRef.current().trim();
    baseTextRef.current = base;

    const rec = new Ctor();
    rec.lang =
      (Platform.OS === 'web' && (globalThis as AnyGlobal)?.navigator?.language) || 'en-US';
    rec.continuous = false;
    rec.interimResults = true;

    rec.onresult = (event: AnyGlobal) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      const merged = baseTextRef.current
        ? `${baseTextRef.current} ${transcript.trim()}`
        : transcript.trimStart();
      onTextRef.current(merged);
    };

    rec.onerror = (event: AnyGlobal) => {
      const code = event?.error as string | undefined;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setError('Microphone permission denied. Allow mic access in your browser.');
      } else if (code === 'no-speech') {
        setError(null); // benign — user just didn't say anything
      } else if (code === 'audio-capture') {
        setError('No microphone found.');
      } else if (code && code !== 'aborted') {
        setError('Voice input failed. Try again.');
      }
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      // start() throws if called while already running — ignore.
      setListening(false);
    }
  }, []);

  const toggle = React.useCallback(() => {
    if (listening) {
      stop();
    } else {
      start();
    }
  }, [listening, start, stop]);

  // Clean up if the component unmounts mid-listen.
  React.useEffect(() => {
    return () => {
      const rec = recognitionRef.current;
      if (rec) {
        try {
          rec.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return { supported, listening, toggle, stop, error };
}
