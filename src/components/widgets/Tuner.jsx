import React, { useRef, useState, useEffect } from "react";
import { Mic, MicOff, Music } from "lucide-react";
import { useAudioDevices } from "../../hooks/useAudioDevices";

// Note names for chromatic scale
const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

// Get note name and octave from frequency
function freqToNote(freq) {
  if (!freq || freq < 20) return { note: "-", octave: "-", cents: 0, freq: 0 };
  const A4 = 440;
  const n = Math.round(12 * Math.log2(freq / A4));
  const noteIndex = (n + 9 + 12 * 100) % 12; // +9 to align A=0 to C=0
  const note = NOTE_NAMES[noteIndex];
  const octave = 4 + Math.floor((n + 9) / 12);
  const refFreq = A4 * Math.pow(2, n / 12);
  const cents = Math.round(1200 * Math.log2(freq / refFreq));
  return { note, octave, cents, freq: freq.toFixed(2) };
}

// Fixed autocorrelation algorithm
function autoCorrelate(buf, sampleRate) {
  const SIZE = buf.length;

  // Calculate RMS to check if signal is strong enough
  let rms = 0;
  for (let i = 0; i < SIZE; i++) {
    rms += buf[i] * buf[i];
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.005) return null; // Adjusted threshold

  // Remove DC offset
  let mean = 0;
  for (let i = 0; i < SIZE; i++) {
    mean += buf[i];
  }
  mean /= SIZE;

  // Copy buffer and remove DC offset
  const normalizedBuf = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i++) {
    normalizedBuf[i] = buf[i] - mean;
  }

  // Define frequency range for musical instruments
  const minFreq = 50; // Hz (E1 is ~41Hz, but we'll be conservative)
  const maxFreq = 2000; // Hz (covers most instruments)
  const maxLag = Math.floor(sampleRate / minFreq);
  const minLag = Math.floor(sampleRate / maxFreq);

  let bestCorr = 0;
  let bestLag = -1;

  // Autocorrelation with normalized values
  for (let lag = minLag; lag < maxLag && lag < SIZE / 2; lag++) {
    let corr = 0;
    let energy = 0;

    for (let i = 0; i < SIZE - lag; i++) {
      corr += normalizedBuf[i] * normalizedBuf[i + lag];
      energy += normalizedBuf[i] * normalizedBuf[i];
    }

    // Normalize correlation
    if (energy > 0) {
      corr = corr / Math.sqrt(energy);
    }

    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  // Require minimum correlation quality
  if (bestCorr < 0.3 || bestLag === -1) return null;

  // Parabolic interpolation for sub-sample accuracy
  if (bestLag > minLag && bestLag < maxLag - 1) {
    // Recalculate correlations around best lag for interpolation
    const correlations = [];
    for (let lag = bestLag - 1; lag <= bestLag + 1; lag++) {
      let corr = 0;
      let energy = 0;
      for (let i = 0; i < SIZE - lag; i++) {
        corr += normalizedBuf[i] * normalizedBuf[i + lag];
        energy += normalizedBuf[i] * normalizedBuf[i];
      }
      if (energy > 0) {
        corr = corr / Math.sqrt(energy);
      }
      correlations.push(corr);
    }

    const y1 = correlations[0]; // lag - 1
    const y2 = correlations[1]; // lag
    const y3 = correlations[2]; // lag + 1

    // Parabolic interpolation
    if (2 * y2 - y1 - y3 !== 0) {
      const a = (y1 - 2 * y2 + y3) / 2;
      const b = (y3 - y1) / 2;
      const shift = -b / (2 * a);
      bestLag = bestLag + shift;
    }
  }

  const freq = sampleRate / bestLag;

  // Validate frequency is in reasonable range
  if (freq < minFreq || freq > maxFreq) return null;

  return freq;
}

const Tuner = ({ showVisualizer = false, onUpdateWidgetProps }) => {
  const [isListening, setIsListening] = useState(false);
  const [detected, setDetected] = useState({
    note: "-",
    octave: "-",
    cents: 0,
    freq: 0,
  });
  const [lastDetected, setLastDetected] = useState({
    note: "-",
    octave: "-",
    cents: 0,
    freq: 0,
  });
  const [error, setError] = useState("");
  const [visualizerData, setVisualizerData] = useState(new Array(64).fill(0));
  const [localShowVisualizer, setLocalShowVisualizer] =
    useState(showVisualizer);

  const { devices, refresh: refreshDevices } = useAudioDevices();
  const [selectedDeviceId, setSelectedDeviceId] = useState("");

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);
  const fadeTimeoutRef = useRef(null);
  const frequencyHistoryRef = useRef([]);

  // Initialize from props
  useEffect(() => {
    setLocalShowVisualizer(showVisualizer);
  }, [showVisualizer]);

  // Default selected device
  useEffect(() => {
    if (!selectedDeviceId && devices.length > 0) {
      setSelectedDeviceId(devices[0].deviceId);
    }
  }, [devices, selectedDeviceId]);

  // Start microphone
  const startMic = async (deviceIdOverride) => {
    setError("");
    const deviceId = deviceIdOverride ?? selectedDeviceId;
    try {
      const audioConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 44100,
      };
      if (deviceId) {
        audioConstraints.deviceId = { exact: deviceId };
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
        });
      } catch (e) {
        // If the chosen device id is stale/unavailable, fall back to default mic
        if (deviceId && e && e.name === "OverconstrainedError") {
          delete audioConstraints.deviceId;
          stream = await navigator.mediaDevices.getUserMedia({
            audio: audioConstraints,
          });
        } else {
          throw e;
        }
      }

      streamRef.current = stream;
      const track = stream.getAudioTracks()[0];
      const settings = track?.getSettings?.();
      if (settings?.deviceId) setSelectedDeviceId(settings.deviceId);
      refreshDevices();
      audioCtxRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();

      // Ensure proper sample rate
      if (audioCtxRef.current.sampleRate < 44100) {
        console.warn(
          "Low sample rate detected, tuning accuracy may be reduced",
        );
      }

      const source = audioCtxRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 8192; // Good balance of resolution and performance
      analyserRef.current.smoothingTimeConstant = 0;
      source.connect(analyserRef.current);

      setIsListening(true);
      frequencyHistoryRef.current = [];
      listen();
    } catch (e) {
      setError("Microphone access denied or unavailable.");
    }
  };

  // Stop microphone
  const stopMic = () => {
    setIsListening(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (audioCtxRef.current) audioCtxRef.current.close();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setDetected({ note: "-", octave: "-", cents: 0, freq: 0 });
    setLastDetected({ note: "-", octave: "-", cents: 0, freq: 0 });
    frequencyHistoryRef.current = [];
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }
  };

  // Handle microphone selection change
  const handleDeviceChange = async (e) => {
    const newId = e.target.value;
    setSelectedDeviceId(newId);
    if (isListening) {
      stopMic();
      // Small delay to release previous device
      setTimeout(() => {
        startMic(newId);
      }, 50);
    }
  };

  // Frequency smoothing with history
  const smoothFrequency = (newFreq) => {
    if (!newFreq) return null;

    const history = frequencyHistoryRef.current;
    history.push(newFreq);

    // Keep last 5 readings for smoothing
    if (history.length > 5) {
      history.shift();
    }

    // If we have enough samples, use median for stability
    if (history.length >= 3) {
      const sorted = [...history].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];

      // Only use median if it's close to recent values (within 10 cents)
      const recent = history[history.length - 1];
      const centsDiff = Math.abs(1200 * Math.log2(median / recent));

      if (centsDiff < 20) {
        return median;
      }
    }

    return newFreq;
  };

  // Listen and detect pitch
  const listen = () => {
    const analyser = analyserRef.current;
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);

    // Update visualizer data
    if (localShowVisualizer) {
      const freqData = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(freqData);
      setVisualizerData(Array.from(freqData.slice(0, 64)));
    }

    const rawFreq = autoCorrelate(buf, audioCtxRef.current.sampleRate);
    const smoothedFreq = smoothFrequency(rawFreq);

    if (smoothedFreq) {
      const noteObj = freqToNote(smoothedFreq);
      setDetected(noteObj);
      setLastDetected(noteObj);

      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
        fadeTimeoutRef.current = null;
      }
    } else {
      setDetected({ note: "-", octave: "-", cents: 0, freq: 0 });

      if (!fadeTimeoutRef.current) {
        fadeTimeoutRef.current = setTimeout(() => {
          setLastDetected({ note: "-", octave: "-", cents: 0, freq: 0 });
          frequencyHistoryRef.current = [];
          fadeTimeoutRef.current = null;
        }, 1000);
      }
    }

    rafRef.current = requestAnimationFrame(listen);
  };

  // Play reference tone
  const playTone = (freq) => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = freq;
    gainNode.gain.value = 0.1; // Reduce volume

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.8);
    osc.onended = () => ctx.close();
  };

  // Chromatic notes for reference (4th octave)
  const chromatic = Array.from({ length: 12 }, (_, i) => {
    const note = NOTE_NAMES[i];
    const freq = 440 * Math.pow(2, (i - 9) / 12); // A4=440, relative to C
    return { note, freq: freq.toFixed(2) };
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMic();
    };
  }, []);

  // Keyboard shortcut: 't' for toggling tuner
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isEditable = document.activeElement?.isContentEditable;
      if (tag === "input" || tag === "textarea" || isEditable) {
        return;
      }
      if (
        e.key &&
        e.key.toLowerCase() === "t" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        if (isListening) {
          stopMic();
        } else {
          startMic();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isListening]);

  return (
    <div className="max-w-sm p-6 rounded-xl shadow-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 flex flex-col gap-4">
      <h2 className="text-2xl font-semibold flex items-center gap-2 mb-2">
        <Music className="w-6 h-6 text-blue-500" /> Chromatic Tuner
      </h2>

      <div className="flex items-center gap-3">
        <button
          className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition ${
            isListening
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-green-600 hover:bg-green-700 text-white"
          }`}
          onClick={isListening ? stopMic : startMic}
        >
          {isListening ? (
            <MicOff className="w-4 h-4" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
          {isListening ? "Stop" : "Start Tuner"}
          <span
            className={`hidden lg:inline text-xs px-2 py-1 rounded ${
              isListening ? "bg-red-400" : "bg-green-400"
            }`}
          >
            t
          </span>
        </button>
        <span className="text-xs text-gray-500">
          {isListening ? "Listening..." : ""}
        </span>
      </div>

      {/* Microphone selector */}
      <div className="flex flex-col gap-1 min-w-0">
        <label className="text-sm font-medium text-gray-600 dark:text-gray-300">
          Microphone
        </label>
        <select
          value={selectedDeviceId}
          onChange={handleDeviceChange}
          className="w-full min-w-0 truncate text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1.5"
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

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {/* Main display */}
      <div className="flex flex-col items-center my-4">
        <div className="text-6xl font-bold tracking-wider mb-2">
          {lastDetected.note}
          <span className="text-3xl font-normal ml-1">
            {lastDetected.octave}
          </span>
        </div>
        <div className="text-lg mb-2">
          {lastDetected.freq > 0 ? `${lastDetected.freq} Hz` : "—"}
        </div>

        {/* Cents indicator */}
        <div className="text-base">
          {lastDetected.note !== "-" && (
            <div className="flex flex-col items-center">
              <span
                className={`font-semibold ${
                  Math.abs(lastDetected.cents) < 5
                    ? "text-green-600"
                    : lastDetected.cents < 0
                      ? "text-blue-600"
                      : "text-red-600"
                }`}
              >
                {lastDetected.cents > 0 ? "+" : ""}
                {lastDetected.cents} cents
              </span>
              <span
                className={`text-sm ${
                  Math.abs(lastDetected.cents) < 5
                    ? "text-green-600"
                    : lastDetected.cents < 0
                      ? "text-blue-600"
                      : "text-red-600"
                }`}
              >
                {Math.abs(lastDetected.cents) < 5
                  ? "In Tune!"
                  : lastDetected.cents < 0
                    ? "Flat"
                    : "Sharp"}
              </span>

              {/* Visual cents indicator */}
              <div className="w-48 h-2 bg-gray-300 rounded-full mt-2 relative">
                <div className="absolute top-1/2 left-1/2 w-0.5 h-4 bg-gray-600 -translate-x-1/2 -translate-y-1/2"></div>
                {lastDetected.cents !== 0 && (
                  <div
                    className={`absolute top-0 h-2 w-2 rounded-full -translate-x-1/2 ${
                      Math.abs(lastDetected.cents) < 5
                        ? "bg-green-500"
                        : lastDetected.cents < 0
                          ? "bg-blue-500"
                          : "bg-red-500"
                    }`}
                    style={{
                      left: `${50 + (lastDetected.cents / 50) * 25}%`,
                    }}
                  ></div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reference tones */}
      <div className="mt-2">
        <div className="font-semibold mb-2 text-sm">
          Reference Tones (A4=440Hz):
        </div>
        <div className="grid grid-cols-6 gap-2">
          {chromatic.map((n, i) => (
            <button
              key={i}
              className="px-2 py-2 rounded bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900 text-xs font-mono transition-colors"
              onClick={() => playTone(Number(n.freq))}
              title={`${n.freq} Hz`}
            >
              {n.note}
            </button>
          ))}
        </div>
      </div>

      {/* Audio Visualizer */}
      {localShowVisualizer && isListening && (
        <div className="w-full mt-4">
          <div className="text-sm font-medium mb-2">Audio Visualizer</div>
          <div className="h-20 bg-gray-100 dark:bg-gray-700 rounded-lg p-2 flex items-end gap-0.5">
            {visualizerData.map((value, index) => (
              <div
                key={index}
                className="bg-gradient-to-t from-blue-600 to-blue-400 rounded-sm transition-all duration-100"
                style={{
                  width: "3px",
                  height: `${Math.max(2, (value / 255) * 100)}%`,
                  minHeight: "2px",
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500 mt-2">
        Play a note on your instrument. The tuner will show the detected pitch
        and how many cents sharp or flat you are.
      </div>
    </div>
  );
};

export default Tuner;
