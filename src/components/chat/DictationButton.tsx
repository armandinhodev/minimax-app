"use client";

/**
 * DictationButton — record a short clip and transcribe it with MiniMax ASR.
 *
 * The browser records WebM/Opus or MP4/AAC; the clip is converted to mono
 * 16 kHz WAV because MiniMax's speech-to-text endpoint accepts containers,
 * not raw WebM. The transcript is handed back to the composer.
 */

import { useEffect, useRef, useState } from "react";
import { Box } from "@chakra-ui/react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { authFetch } from "@/lib/auth-client";
import { recordingToWav } from "./audio-wav";

const MAX_SECONDS = 480;

type Phase = "idle" | "recording" | "transcribing";

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function supportedMime(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return undefined;
  }
  return ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
}

interface DictationButtonProps {
  disabled?: boolean;
  /** Receives the transcript when MiniMax finishes. */
  onTranscript: (text: string) => void;
  /** Receives a user-facing message when dictation cannot run. */
  onError: (message: string) => void;
  /** True while recording or transcribing, so the page can block sending. */
  onBusyChange?: (busy: boolean) => void;
}

export function DictationButton({ disabled = false, onTranscript, onError, onBusyChange }: DictationButtonProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const finish = () => {
    setPhase("idle");
    setElapsed(0);
    onBusyChange?.(false);
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  };

  const startRecording = async () => {
    if (phase !== "idle") return;

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      onError("Dictation needs microphone support in this browser.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      onError("Microphone access was denied. Allow it in the browser and try again.");
      return;
    }

    const mimeType = supportedMime();
    let recorder: MediaRecorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      onError("This browser cannot record audio for dictation.");
      return;
    }
    streamRef.current = stream;
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = async () => {
      stopTracks();
      stopTimer();
      setPhase("transcribing");
      onBusyChange?.(true);

      try {
        const recorded = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        const wav = await recordingToWav(recorded);
        const formData = new FormData();
        formData.append("file", new File([wav], "dictation.wav", { type: "audio/wav" }));
        formData.append("model", "asr-1.0");
        formData.append("response_format", "json");
        formData.append("language", "");

        const response = await authFetch("/api/minimax/asr/transcriptions", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null) as { error?: string } | null;
          onError(body?.error ?? `Dictation failed (HTTP ${response.status}).`);
          return;
        }

        const data = await response.json() as { text?: string };
        const text = data.text?.trim();
        if (text) {
          onTranscript(text);
        } else {
          onError("MiniMax returned an empty transcript.");
        }
      } catch {
        onError("Could not transcribe the recording. Try a shorter clip.");
      } finally {
        recorderRef.current = null;
        chunksRef.current = [];
        finish();
      }
    };

    recorder.start();
    setPhase("recording");
    setElapsed(0);
    onBusyChange?.(true);
    startedAtRef.current = Date.now();

    stopTimer();
    timerRef.current = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsed(seconds);
      if (seconds >= MAX_SECONDS) stopRecording();
    }, 500);
  };

  useEffect(() => {
    return () => {
      stopTimer();
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      stopTracks();
    };
  }, []);

  const label = phase === "recording" ? `Stop ${clock(elapsed)}` : phase === "transcribing" ? "Transcribing..." : "Dictate";

  return (
    <Button
      variant="outline"
      onClick={phase === "recording" ? stopRecording : () => void startRecording()}
      disabled={disabled || phase === "transcribing"}
      aria-label={phase === "recording" ? "Stop dictation" : phase === "transcribing" ? "Transcribing dictation" : "Dictate a message"}
    >
      {phase === "recording" ? (
        <Box aria-hidden="true" w="7px" h="7px" borderRadius="full" bg="state.err" />
      ) : (
        <Icon name="microphone" size={16} />
      )}
      {label}
    </Button>
  );
}
