import React from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  AudioLines,
  Camera,
  ChevronDown,
  Hand,
  Headphones,
  LockKeyhole,
  Maximize2,
  Minimize2,
  Music2,
  Pause,
  Play,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  Upload,
  Volume2,
  Waves,
  Zap,
} from "lucide-react";

export const iconMap = {
  filter: Waves,
  pitch: AudioLines,
  effect: Sparkles,
  sync: RotateCcw,
  crossfader: ArrowLeftRight,
  airhorn: Zap,
  arrowRight: ArrowRight,
  camera: Camera,
  hand: Hand,
  headphones: Headphones,
  lock: LockKeyhole,
  maximize: Maximize2,
  minimize: Minimize2,
  music: Music2,
  pause: Pause,
  play: Play,
  sliders: SlidersHorizontal,
  search: Search,
  target: Target,
  upload: Upload,
  volume: Volume2,
  chevron: ChevronDown,
};

export function Icon({ name, size = 16, strokeWidth = 1.8, ...props }) {
  const Component = iconMap[name] || Music2;
  return (
    <Component
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      {...props}
    />
  );
}
