import React, { useState, useRef, useEffect, useMemo } from "react";
import { Mic, Square, Play, Pause, Download, Trash2 } from "lucide-react";
import { useAudioDevices } from "../../hooks/useAudioDevices";

const Recording = ({ onUpdateWidgetProps }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentRecording, setCurrentRecording] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [stream, setStream] = useState(null);
  const [localRecordings, setLocalRecordings] = useState([]); // Always empty on reload
  const [pendingBlob, setPendingBlob] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [countdownBpm, setCountdownBpm] = useState(90); // Same default as metronome
  const [activeMetronomeBpm, setActiveMetronomeBpm] = useState(null);

  const { devices, refresh: refreshDevices } = useAudioDevices();
  const [selectedDeviceId, setSelectedDeviceId] = useState("");

  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const audioContextRef = useRef(null);

  // Update parent when recordings change (debounced)
  useEffect(() => {
    if (onUpdateWidgetProps) {
      const timeoutId = setTimeout(() => {
        onUpdateWidgetProps({ recordings: localRecordings });
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [localRecordings, onUpdateWidgetProps]);

  // Default selected device
  useEffect(() => {
    if (!selectedDeviceId && devices.length > 0) {
      setSelectedDeviceId(devices[0].deviceId);
    }
  }, [devices, selectedDeviceId]);

  // Format time helper
  const formatTime = useMemo(
    () => (seconds) => {
      if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return "0:00";
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    },
    [],
  );

  // Function to play a tone (normal or distorted)
  const playTone = (frequency = 659.25, duration = 200, distorted = false) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();

    if (distorted) {
      // Create distortion effect for the last count
      const distortion = audioContextRef.current.createWaveShaper();
      const makeDistortionCurve = (amount) => {
        const k = typeof amount === 'number' ? amount : 50;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;

        for (let i = 0; i < n_samples; ++i) {
          const x = i * 2 / n_samples - 1;
          curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
        }
        return curve;
      };

      distortion.curve = makeDistortionCurve(400);
      distortion.oversample = '4x';

      oscillator.connect(distortion);
      distortion.connect(gainNode);
    } else {
      oscillator.connect(gainNode);
    }

    gainNode.connect(audioContextRef.current.destination);

    oscillator.frequency.setValueAtTime(frequency, audioContextRef.current.currentTime);
    oscillator.type = distorted ? 'sawtooth' : 'sine';

    const volume = distorted ? 0.4 : 0.3;
    gainNode.gain.setValueAtTime(volume, audioContextRef.current.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + duration / 1000);

    oscillator.start(audioContextRef.current.currentTime);
    oscillator.stop(audioContextRef.current.currentTime + duration / 1000);
  };

  // Calculate interval using same formula as metronome
  const calculateCountdownInterval = (bpm) => 60000 / bpm; // For quarter notes (subdivision = 1)

  // Countdown function
  const startCountdown = async () => {
    const bpmToUse = activeMetronomeBpm || countdownBpm;
    const interval = calculateCountdownInterval(bpmToUse);

    // 3-count countdown: 3, 2, 1
    for (let i = 3; i > 0; i--) {
      const isLastCount = i === 1;
      playTone(659.25, 200, isLastCount); // Last count (1) is distorted
      setCountdown(i);
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    setCountdown(0);
    // Start recording after countdown
    await startRecording();
  };

  // keyboard shortcut: 'r' toggling record
  React.useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isEditable = document.activeElement?.isContentEditable;
      if (tag === "input" || tag === "textarea" || isEditable) {
        return;
      }
      if (
        e.key &&
        e.key.toLowerCase() === "r" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        if (!isRecording) {
          startCountdown();
        } else {
          stopRecording();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Start recording
  const startRecording = async () => {
    try {
      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100,
      };
      if (selectedDeviceId) {
        audioConstraints.deviceId = { exact: selectedDeviceId };
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });

      const track = mediaStream.getAudioTracks()[0];
      const settings = track?.getSettings?.();
      if (settings?.deviceId) setSelectedDeviceId(settings.deviceId);
      refreshDevices();

      setStream(mediaStream);
      const recorder = new window.MediaRecorder(mediaStream, {
        mimeType: "audio/webm;codecs=opus",
      });

      const chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setPendingBlob(blob); // We'll process this in a useEffect to get duration
        setAudioChunks([]);
      };

      setMediaRecorder(recorder);
      setAudioChunks(chunks);
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  // Handle microphone selection change
  const handleDeviceChange = (e) => {
    setSelectedDeviceId(e.target.value);
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
      timerRef.current = null;

      // Stop all tracks
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
    }
  };

  // When a new blob is ready, get its duration and add to recordings
  useEffect(() => {
    if (!pendingBlob) return;
    const url = URL.createObjectURL(pendingBlob);
    const tempAudio = document.createElement("audio");
    tempAudio.src = url;
    tempAudio.preload = "metadata";
    tempAudio.onloadedmetadata = () => {
      let duration = tempAudio.duration;
      if (!isFinite(duration) || isNaN(duration) || duration === 0) {
        duration = recordingTime;
      }
      const newRecording = {
        id: Date.now(),
        name: `Recording ${localRecordings.length + 1}`,
        url: url,
        blob: pendingBlob,
        duration: duration,
        timestamp: new Date().toISOString(),
      };
      setLocalRecordings((prev) => [...prev, newRecording]);
      setPendingBlob(null);
      tempAudio.remove();
    };
    tempAudio.onerror = () => {
      const newRecording = {
        id: Date.now(),
        name: `Recording ${localRecordings.length + 1}`,
        url: url,
        blob: pendingBlob,
        duration: recordingTime,
        timestamp: new Date().toISOString(),
      };
      setLocalRecordings((prev) => [...prev, newRecording]);
      setPendingBlob(null);
      tempAudio.remove();
    };
    // eslint-disable-next-line
  }, [pendingBlob]);

  // Play/pause logic
  const playRecording = (recording) => {
    if (currentRecording && currentRecording.id === recording.id && isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      setCurrentRecording(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setCurrentRecording(recording);
      setIsPlaying(true);
    }
  };

  // When currentRecording changes, set audio src and play
  useEffect(() => {
    if (!currentRecording || !isPlaying) return;
    if (audioRef.current) {
      audioRef.current.src = currentRecording.url;
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }
  }, [currentRecording, isPlaying]);

  // Handle audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentRecording(null);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);

    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
    };
  }, []);

  // Delete recording
  const deleteRecording = (id) => {
    setLocalRecordings((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      // Revoke URL to free memory
      const recording = prev.find((r) => r.id === id);
      if (recording) {
        URL.revokeObjectURL(recording.url);
      }
      return updated;
    });

    if (currentRecording && currentRecording.id === id) {
      setCurrentRecording(null);
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  };

  // Download recording
  const downloadRecording = (recording) => {
    const a = document.createElement("a");
    a.href = recording.url;
    a.download = `${recording.name}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRecording) {
        stopRecording();
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      // Revoke all object URLs
      localRecordings.forEach((r) => {
        if (r.url) URL.revokeObjectURL(r.url);
      });
    };
    // eslint-disable-next-line
  }, []);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Recording Studio</h3>
        <div className="flex items-center gap-2">
          {isRecording && (
            <div className="flex items-center gap-2 text-red-600">
              <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
              <span className="text-sm font-mono">
                {formatTime(recordingTime)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Microphone selector */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Microphone:
        </label>
        <select
          value={selectedDeviceId}
          onChange={handleDeviceChange}
          disabled={isRecording || countdown > 0}
          className="flex-1 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1.5 disabled:opacity-50"
        >
          {devices.length === 0 && (
            <option value="">No microphones found</option>
          )}
          {devices.map((d, i) => (
            <option key={d.deviceId || i} value={d.deviceId}>
              {d.label || `Microphone ${i + 1}`}
            </option>
          ))}
        </select>
      </div>

      {/* Recording Controls */}
      <div className="flex items-center justify-center gap-3">
        {!isRecording ? (
          <button
            onClick={startCountdown}
            disabled={countdown > 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              countdown > 0
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            <Mic className="w-4 h-4" />
            {countdown > 0 ? `Starting in ${countdown}...` : 'Start Recording'}
            <span className="hidden lg:inline text-xs bg-red-400 px-2 py-1 rounded">
              r
            </span>
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
          >
            <Square className="w-4 h-4" />
            Stop Recording
            <span className="hidden lg:inline text-xs bg-gray-400 px-2 py-1 rounded">
              r
            </span>
          </button>
        )}
      </div>

      {/* Recordings List */}
      {localRecordings.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-gray-700 dark:text-gray-300">
            Recordings ({localRecordings.length})
          </h4>
          <div className="max-h-48 overflow-y-auto space-y-2 custom-scrollbar">
            {localRecordings.map((recording) => (
              <div
                key={recording.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {recording.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTime(recording.duration)} •{" "}
                    {new Date(recording.timestamp).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => playRecording(recording)}
                    className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    title={
                      currentRecording?.id === recording.id && isPlaying
                        ? "Pause"
                        : "Play"
                    }
                  >
                    {currentRecording?.id === recording.id && isPlaying ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => downloadRecording(recording)}
                    className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteRecording(recording.id)}
                    className="p-1.5 hover:bg-red-200 dark:hover:bg-red-900 rounded text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden audio element */}
      <audio ref={audioRef} />
    </div>
  );
};

export default Recording;
