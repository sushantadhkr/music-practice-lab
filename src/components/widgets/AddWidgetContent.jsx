import React, { useState, useEffect } from "react";
import Modal from "../ui/Modal";
import { Infinity, InfinityIcon, Search, X } from "lucide-react";

import {
  Drum,
  Timer as TimerIcon,
  TimerReset as StopwatchIcon,
  Music,
  Shuffle,
  MousePointerClick,
  Waves,
  Piano,
  Ear,
  StickyNote,
  BookAudio as Tuner,
  List,
  Mic,
  Target,
  Circle,
} from "lucide-react";

const ICONS = {
  Metronome: Drum,
  Timer: TimerIcon,
  Stopwatch: StopwatchIcon,
  "Note Generator": Music,
  "Random Scale Generator": Shuffle,
  "Tap Tempo": MousePointerClick,
  Drone: Waves,
  "Chord Progression": Piano,
  "Interval Trainer": Ear,
  Note: StickyNote,
  Tuner: Tuner,
  Recording: Mic,
  "Circle of Fifths": Circle,
};

const AddWidgetContent = ({ onClose, setWidgets, widgets = [] }) => {
  const [searchTerm, setSearchTerm] = useState("");

  const widgetTypes = [
    "Metronome",
    "Timer",
    "Stopwatch",
    "Note Generator",
    "Random Scale Generator",
    "Tap Tempo",
    "Drone",
    "Chord Progression",
    "Interval Trainer",
    "Note",
    "Tuner",
    "Recording",
    "Circle of Fifths",
  ];

  const DESCRIPTIONS = {
    Metronome: "Precise tempo with accent, visual pulses, and shortcuts.",
    Timer: "Countdown with start/pause/reset for timed reps.",
    Stopwatch: "Track elapsed time across exercises.",
    "Note Generator": "Random notes with combined or separate accidentals.",
    "Random Scale Generator": "Random root and scale type with recent history.",
    "Tap Tempo": "Tap to detect tempo from your rhythm.",
    Drone: "Sustained reference tone with detune and tone control.",
    "Chord Progression": "Generate quick Roman numeral ideas.",
    "Interval Trainer": "Hear intervals sequentially for ear training.",
    Note: "Take notes and save them to your library.",
    Tuner: "Chromatic tuner with microphone input and reference tones.",
    Recording: "Record practice sessions with playback and download.",
    "Circle of Fifths":
      "Interactive circle showing key relationships and progressions.",
  };

  // Filter widgets based on search term
  const filteredWidgets = widgetTypes.filter(
    (widget) =>
      widget.toLowerCase().includes(searchTerm.toLowerCase()) ||
      DESCRIPTIONS[widget].toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const SINGLETON_TYPES = new Set([
    "Metronome",
    "Drone",
    "Note Generator",
    "Random Scale Generator",
    "Chord Progression",
    "Interval Trainer",
    "Tap Tempo",
    "Tuner",
    "Recording",
    "Circle of Fifths",
    "Looper",
  ]);

  const MAX_WIDGET_Z = 9998;
  const getMaxZ = () => widgets.reduce((m, w) => Math.max(m, w.zIndex || 0), 0);

  const rect = () => {
    const headerH = 80;
    const width = window.innerWidth;
    const height = window.innerHeight - headerH;
    return { x: 0, y: 0, width, height };
  };

  const intersects = (a, b) => {
    return !(
      a.x + a.w <= b.x ||
      b.x + b.w <= a.x ||
      a.y + a.h <= b.y ||
      b.y + b.h <= a.y
    );
  };

  const findNonOverlappingPosition = (size) => {
    const r = rect();
    const padding = 12;
    const minX = padding;
    const minY = padding;
    const maxX = Math.max(padding, r.width - size.w - padding);
    const maxY = Math.max(padding, r.height - size.h - padding);
    const step = 24;
    for (let y = minY; y <= maxY; y += step) {
      for (let x = minX; x <= maxX; x += step) {
        const candidate = { x, y, w: size.w, h: size.h };
        const hasCollision = widgets.some((w) =>
          intersects(candidate, {
            x: w.position.x,
            y: w.position.y,
            w: w.size.w,
            h: w.size.h,
          }),
        );
        if (!hasCollision) return { x, y };
      }
    }
    // fallback random within bounds
    return {
      x: Math.min(maxX, Math.max(minX, Math.random() * maxX)),
      y: Math.min(maxY, Math.max(minY, Math.random() * maxY)),
    };
  };

  const onAddWidget = (widget) => {
    if (SINGLETON_TYPES.has(widget) && widgets.some((w) => w.type === widget)) {
      onClose();
      return;
    }
    const defaultSize =
      widget === "Tuner"
        ? { w: 340, h: 520 }
        : widget === "Recording"
          ? { w: 340, h: 420 }
          : { w: 320, h: 240 };
    const pos = findNonOverlappingPosition(defaultSize);
    const newWidget = {
      id: `${widget.toLowerCase()}-${Date.now()}`, // Unique ID
      type: widget,
      position: pos, // computed non-overlapping position
      size: defaultSize, // Default size
      zIndex: Math.min(getMaxZ() + 1, MAX_WIDGET_Z), // bring to front
    };

    setWidgets((prevWidgets) => [...prevWidgets, newWidget]);
    onClose();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);
  return (
    <Modal onClose={onClose} isOpen={true} size="lg" zindex="9999">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Add Widget
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Choose a tool to add to your practice space
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search widgets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border focus:outline-none border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
          />
        </div>

        {/* Widget Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto custom-scrollbar">
          {filteredWidgets.map((widget, idx) => {
            const disabled =
              SINGLETON_TYPES.has(widget) &&
              widgets.some((w) => w.type === widget);
            const Icon = ICONS[widget];
            return (
              <button
                key={idx}
                className={`p-3 border rounded-lg text-left cursor-pointer transition-all duration-200 bg-white dark:bg-gray-900 ${
                  disabled
                    ? "opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-700"
                    : "hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md"
                }`}
                onClick={() => !disabled && onAddWidget(widget)}
                disabled={disabled}
                title={disabled ? `Only one ${widget} allowed` : undefined}
              >
                <div
                  className={`${disabled ? "cursor-not-allowed" : null} flex items-center gap-3`}
                >
                  <div
                    className={`p-2 rounded-lg ${disabled ? "bg-gray-100 dark:bg-gray-800" : "bg-blue-100 dark:bg-blue-900/30"}`}
                  >
                    {Icon && (
                      <Icon
                        className={`w-5 h-5 ${disabled ? "text-gray-400" : "text-blue-600 dark:text-blue-400"}`}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                        {widget}
                      </h3>
                      {disabled && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                          Added
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                      {DESCRIPTIONS[widget]}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* No Results */}
        {filteredWidgets.length === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-400 dark:text-gray-500 mb-2">
              <Search className="w-8 h-8 mx-auto" />
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              No widgets found matching "{searchTerm}"
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {filteredWidgets.length} widget
              {filteredWidgets.length !== 1 ? "s" : ""} available
            </p>

            {/* Keyboard Shortcuts */}
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <details className="group">
                <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                  ⌨️ Keyboard Shortcuts
                </summary>
                <div className="mt-2 text-left bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
                        Ctrl+K
                      </kbd>{" "}
                      Add Widget
                    </div>
                    <div>
                      <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
                        N
                      </kbd>{" "}
                      Next Note
                    </div>
                    <div>
                      <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
                        R
                      </kbd>{" "}
                      Start/Stop Recording
                    </div>
                    <div>
                      <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
                        T
                      </kbd>{" "}
                      Start/Stop Timer
                    </div>
                    <div>
                      <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
                        Space
                      </kbd>{" "}
                      Play/Pause Metronome
                    </div>
                    <div>
                      <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
                        +/-
                      </kbd>{" "}
                      Adjust BPM
                    </div>
                    <div>
                      <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
                        Esc
                      </kbd>{" "}
                      Close Modals
                    </div>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AddWidgetContent;
