import { useCallback, useEffect, useRef, useState } from 'react';

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type VoiceWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

export function useVoice(
  onTranscript: (text: string) => void,
  voiceURI: string,
  handsFree = false,
) {
  const callbackRef = useRef(onTranscript);
  callbackRef.current = onTranscript;
  const recognitionRef = useRef<Recognition | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const playbackRef = useRef(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const voiceWindow = window as VoiceWindow;
  const RecognitionClass = voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition;
  const recognitionSupported = !!RecognitionClass && window.isSecureContext;
  const synthesisSupported = 'speechSynthesis' in window;

  useEffect(() => {
    if (!synthesisSupported) return;
    const update = () => setVoices(window.speechSynthesis.getVoices());
    update();
    window.speechSynthesis.addEventListener('voiceschanged', update);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update);
  }, [synthesisSupported]);

  const pauseListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognition.onend = null;
    recognition.onerror = null;
    recognition.onresult = null;
    recognitionRef.current = null;
    recognition.abort();
    setListening(false);
    setInterim('');
  }, []);

  const stopSpeaking = useCallback(() => {
    if (synthesisSupported) window.speechSynthesis.cancel();
    utteranceRef.current = null;
    playbackRef.current = false;
    setSpeaking(false);
  }, [synthesisSupported]);

  const speak = useCallback(
    (text: string) => {
      if (!synthesisSupported) return;
      if (!handsFree) pauseListening();
      stopSpeaking();
      const utterance = new SpeechSynthesisUtterance(text);
      const selected = window.speechSynthesis
        .getVoices()
        .find((voice) => voice.voiceURI === voiceURI);
      if (selected) {
        utterance.voice = selected;
        utterance.lang = selected.lang;
      } else {
        utterance.lang = navigator.language || 'en-US';
      }
      utterance.onend = () => {
        if (utteranceRef.current !== utterance) return;
        playbackRef.current = false;
        setSpeaking(false);
      };
      utterance.onerror = (event) => {
        if (utteranceRef.current !== utterance) return;
        playbackRef.current = false;
        setSpeaking(false);
        if (event.error !== 'canceled' && event.error !== 'interrupted') {
          setError('Voice playback was unavailable. Tap Read aloud to try again.');
        }
      };
      utteranceRef.current = utterance;
      playbackRef.current = true;
      setSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [synthesisSupported, stopSpeaking, voiceURI, pauseListening, handsFree],
  );

  const toggleListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    if (!RecognitionClass || !window.isSecureContext) {
      setError(
        window.isSecureContext
          ? 'Speech recognition is unavailable in this browser. You can still type.'
          : 'Open the app over HTTPS to enable the microphone.',
      );
      return;
    }
    if (!handsFree) stopSpeaking();
    setError('');
    setInterim('');
    const recognition = new RecognitionClass();
    recognition.lang = navigator.language || 'en-US';
    recognition.continuous = handsFree;
    recognition.interimResults = true;
    let finalText = '';
    let failed = false;
    let completed = 0;
    let playbackOverlap = playbackRef.current;
    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return;
      const results = Array.from(event.results);
      if (handsFree) {
        playbackOverlap ||= playbackRef.current;
        for (let index = completed; index < results.length; index++) {
          if (!results[index].isFinal) break;
          const transcript = results[index][0].transcript.trim();
          completed = index + 1;
          if (transcript && !playbackOverlap && !playbackRef.current)
            callbackRef.current(transcript);
          playbackOverlap = false;
        }
        setInterim(
          playbackRef.current
            ? ''
            : results
                .slice(completed)
                .filter((result) => !result.isFinal)
                .map((result) => result[0].transcript)
                .join(' '),
        );
        return;
      }
      finalText = results
        .filter((result) => result.isFinal)
        .map((result) => result[0].transcript)
        .join(' ');
      setInterim(
        results
          .filter((result) => !result.isFinal)
          .map((result) => result[0].transcript)
          .join(' '),
      );
      // A final result is ready: ask the browser to finish rather than wait for silence indefinitely.
      if (finalText.trim()) recognition.stop();
    };
    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return;
      failed = true;
      if (event.error === 'aborted' || (handsFree && event.error === 'no-speech')) return;
      const errors: Record<string, string> = {
        'not-allowed': 'Microphone permission was denied. Allow it in Chrome’s site settings.',
        'audio-capture': 'No microphone is available.',
        network: 'Speech recognition could not connect. Try again or type your message.',
        'no-speech': 'No speech was detected. Tap the microphone to try again.',
      };
      setError(errors[event.error] || `Speech recognition failed: ${event.error}`);
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      setListening(false);
      setInterim('');
      if (!handsFree && !failed && finalText.trim()) callbackRef.current(finalText.trim());
      else if (!failed && !handsFree)
        setError('No completed speech was recognized. Try speaking again, or type your message.');
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setError('Could not start the microphone. Try again.');
    }
  }, [RecognitionClass, stopSpeaking, handsFree]);

  useEffect(() => {
    const cancel = () => {
      pauseListening();
      stopSpeaking();
    };
    const onVisibility = () => {
      if (document.hidden) cancel();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      const recognition = recognitionRef.current;
      if (recognition) {
        recognition.onend = null;
        recognition.onerror = null;
        recognition.abort();
      }
      if (synthesisSupported) window.speechSynthesis.cancel();
    };
  }, [stopSpeaking, synthesisSupported, pauseListening]);

  return {
    pauseListening,
    listening,
    speaking,
    interim,
    error,
    voices,
    recognitionSupported,
    synthesisSupported,
    toggleListening,
    speak,
    stopSpeaking,
  };
}
