import React from 'react';
import { Platform } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

// expo-speech-recognition gives one API across web (Web Speech API), iOS
// (SFSpeechRecognizer) and Android (SpeechRecognizer). On native it needs a
// dev-client / standalone build because it ships native code — it will not work
// in Expo Go. The config plugin in app.json injects the mic + speech permission
// strings the OS requires.

type AnyEvent = {
  results?: { transcript?: string }[];
  isFinal?: boolean;
  error?: string;
  message?: string;
};

function detectLang(): string {
  if (Platform.OS === 'web') {
    const nav = (globalThis as { navigator?: { language?: string } }).navigator;
    if (nav?.language) return nav.language;
  }
  return 'en-US';
}

export function isVoiceInputSupported(): boolean {
  try {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
}

export type VoiceDictation = {
  /** Whether this platform/device can do speech-to-text at all. */
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
 * Voice dictation for the chat composer, backed by expo-speech-recognition.
 * While listening, partial and final transcripts are streamed to `onText`,
 * which receives the full text the composer should show (whatever was already
 * typed plus the speech so far). Works on web, iOS and Android with the same
 * interface.
 */
export function useVoiceDictation(
  getBaseText: () => string,
  onText: (text: string) => void,
): VoiceDictation {
  const [supported, setSupported] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Snapshot of the draft when dictation started, so speech appends instead of
  // wiping what the user already typed.
  const baseTextRef = React.useRef('');
  const onTextRef = React.useRef(onText);
  const getBaseTextRef = React.useRef(getBaseText);
  onTextRef.current = onText;
  getBaseTextRef.current = getBaseText;

  React.useEffect(() => {
    setSupported(isVoiceInputSupported());
  }, []);

  useSpeechRecognitionEvent('start', () => setListening(true));

  useSpeechRecognitionEvent('result', (event: AnyEvent) => {
    const transcript = event.results?.[0]?.transcript ?? '';
    const base = baseTextRef.current;
    const merged = base ? `${base} ${transcript.trim()}` : transcript.trimStart();
    onTextRef.current(merged);
  });

  useSpeechRecognitionEvent('error', (event: AnyEvent) => {
    const code = event?.error;
    if (code === 'not-allowed' || code === 'service-not-allowed') {
      setError('Microphone permission denied. Allow mic access in settings.');
    } else if (code === 'no-speech') {
      setError(null); // benign — user just didn't say anything
    } else if (code === 'audio-capture') {
      setError('No microphone found.');
    } else if (code && code !== 'aborted') {
      setError('Voice input failed. Try again.');
    }
    setListening(false);
  });

  useSpeechRecognitionEvent('end', () => setListening(false));

  const start = React.useCallback(async () => {
    setError(null);
    baseTextRef.current = getBaseTextRef.current().trim();

    try {
      // Web prompts for mic access on start(); native needs an explicit request.
      if (Platform.OS !== 'web') {
        const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!perm.granted) {
          setError('Microphone permission denied. Allow mic access in settings.');
          return;
        }
      }
      ExpoSpeechRecognitionModule.start({
        lang: detectLang(),
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
      });
      // 'start' event will flip `listening`, but set it eagerly so the UI reacts
      // immediately even if the event is briefly delayed.
      setListening(true);
    } catch {
      setError('Voice input failed. Try again.');
      setListening(false);
    }
  }, []);

  const stop = React.useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // already stopped
    }
    setListening(false);
  }, []);

  const toggle = React.useCallback(() => {
    if (listening) {
      stop();
    } else {
      void start();
    }
  }, [listening, start, stop]);

  // Abort any in-flight recognition if the component unmounts mid-listen.
  React.useEffect(() => {
    return () => {
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // ignore
      }
    };
  }, []);

  return { supported, listening, toggle, stop, error };
}
