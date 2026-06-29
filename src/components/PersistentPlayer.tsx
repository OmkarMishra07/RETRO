import React, { useState, useEffect, useRef } from "react";
import { Track } from "../types";
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Shuffle, 
  Repeat, 
  Volume2, 
  ListMusic, 
  AlignLeft,
  X,
  VolumeX,
  Sparkles
} from "lucide-react";
import { seekAudio, setAudioVolume, getAudioCurrentTime, getAnalyserData } from "../utils/audio";
import { saavnImg } from "../utils/image";

// 2D Perlin Noise implementation for organic topographic wave rendering
const PERMUTATION = new Uint8Array([
  151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
  190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,
  136,171,168, 68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,
  46,245,40,244,102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,135,130,116,188,159,
  86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,
  58,17,182,189,28,42,223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,129,22,39,253,
  19,98,108,110,79,113,224,232,178,185, 112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,
  235,249,14,239,107,49,192,214, 31,181,199,106,157,184, 84,204,176,115,121,50,45,127, 4,150,254,138,236,205,93,222,
  114,67,29,24,72,243,141,128,195,78,66,215,61,156,180
]);

const p = new Uint8Array(512);
for (let i = 0; i < 256; i++) {
  p[i] = PERMUTATION[i];
  p[i + 256] = PERMUTATION[i];
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(t: number, a: number, b: number): number {
  return a + t * (b - a);
}

function grad(hash: number, x: number, y: number): number {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

function perlin2D(x: number, y: number): number {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;

  x -= Math.floor(x);
  y -= Math.floor(y);

  const u = fade(x);
  const v = fade(y);

  const A = p[X] + Y;
  const B = p[X + 1] + Y;

  return lerp(v,
    lerp(u, grad(p[A], x, y), grad(p[B], x - 1, y)),
    lerp(u, grad(p[A + 1], x, y - 1), grad(p[B + 1], x - 1, y - 1))
  );
}

interface PersistentPlayerProps {
  currentTrack: Track;
  isPlaying: boolean;
  togglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  queue: Track[];
  removeFromQueue: (idx: number) => void;
  isShuffle: boolean;
  toggleShuffle: () => void;
  isRepeat: boolean;
  toggleRepeat: () => void;
  onRedirectToNowSpinning: () => void;
  autoplayQueue?: Track[];
}

export const PersistentPlayer: React.FC<PersistentPlayerProps> = ({
  currentTrack,
  isPlaying,
  togglePlay,
  onNext,
  onPrev,
  queue,
  removeFromQueue,
  isShuffle,
  toggleShuffle,
  isRepeat,
  toggleRepeat,
  onRedirectToNowSpinning,
  autoplayQueue = []
}) => {
  const handlePlayerClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("canvas")) {
      return;
    }
    onRedirectToNowSpinning();
  };

  // Progress tracker state
  const [progressSecs, setProgressSecs] = useState<number>(0);
  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem("retro_volume");
    return saved ? Number(saved) : 75;
  });
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    return localStorage.getItem("retro_is_muted") === "true";
  });
  const [showQueue, setShowQueue] = useState<boolean>(false);
  const [showLyrics, setShowLyrics] = useState<boolean>(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem("retro_volume", String(volume));
    localStorage.setItem("retro_is_muted", String(isMuted));
  }, [volume, isMuted]);

  // Parse duration ("04:12" -> 252 secs)
  const durationParts = (currentTrack?.duration || "00:00").split(":");
  const totalSecs = (parseInt(durationParts[0], 10) || 0) * 60 + (parseInt(durationParts[1], 10) || 0);

  // WaveSurfer.js-like visualizer state and refs
  const [peaks, setPeaks] = useState<number[]>([]);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const progressSecsRef = useRef(progressSecs);
  const totalSecsRef = useRef(totalSecs);
  const peaksRef = useRef(peaks);

  useEffect(() => {
    progressSecsRef.current = progressSecs;
  }, [progressSecs]);

  useEffect(() => {
    totalSecsRef.current = totalSecs;
  }, [totalSecs]);

  useEffect(() => {
    peaksRef.current = peaks;
  }, [peaks]);

  // Sync volume with audio engine
  useEffect(() => {
    setAudioVolume(isMuted ? 0 : volume / 100);
  }, [volume, isMuted]);

  // Preload Next Track: Triggers background resolution and warm browser cache to make skips instant
  useEffect(() => {
    if (!currentTrack) return;
    const nextTrack = queue[0] || autoplayQueue[0];
    if (nextTrack && nextTrack.id && !nextTrack.id.startsWith("track-")) {
      const trackId = nextTrack.id.replace("youtube:", "").replace("saavn:", "");
      fetch(`/api/proxy/stream/${trackId}`).catch(() => {});
    }
  }, [currentTrack, queue, autoplayQueue]);

  // Timer simulation and playhead synchronization
  useEffect(() => {
    const updateProgress = () => {
      const current = Math.floor(getAudioCurrentTime());
      setProgressSecs(current);
      if (currentTrack) {
        localStorage.setItem("retro_last_time", String(current));
      }
      if (isPlaying && current >= totalSecs && totalSecs > 0) {
        if (isRepeat) {
          seekAudio(0);
          setProgressSecs(0);
        } else {
          onNext();
        }
      }
    };

    updateProgress();
    // Poll every 100ms for high responsiveness (seeking when paused aligns instantly)
    const interval = setInterval(updateProgress, 100);
    return () => {
      clearInterval(interval);
    };
  }, [isPlaying, totalSecs, isRepeat, onNext, currentTrack]);

  // Reset progress when track changes and generate deterministic WaveSurfer-style peaks
  useEffect(() => {
    setProgressSecs(0);

    // Generate 120 deterministic peak values (between 0.15 and 0.85) based on track ID
    const trackId = currentTrack?.id || "default";
    let hash = 0;
    for (let i = 0; i < trackId.length; i++) {
      hash = trackId.charCodeAt(i) + ((hash << 5) - hash);
    }

    const newPeaks: number[] = [];
    for (let i = 0; i < 120; i++) {
      const seed = Math.sin(hash + i * 18.543) * 9999;
      const val = seed - Math.floor(seed);
      // Nice bell curve shape
      const centerFactor = Math.sin((i / 120) * Math.PI);
      const peak = 0.15 + val * 0.70 * centerFactor;
      newPeaks.push(peak);
    }
    setPeaks(newPeaks);
  }, [currentTrack]);

  // WaveSurfer-style visualizer rendering loop
  useEffect(() => {
    let animationFrameId: number;
    let time = 0;
    let lastTime = performance.now();

    // Smooth reactive parameters to filter spikes
    let smoothBass = 0.05;
    let smoothMid = 0.03;
    let smoothTreble = 0.02;

    const render = (now: number) => {
      const deltaTime = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // 1. Fetch Web Audio API frequency bands
      const data = getAnalyserData();

      // 2. Interpolate audio values with responsive easing
      const lerpSpeed = 7.0;
      smoothBass += (data.bass - smoothBass) * lerpSpeed * deltaTime;
      smoothMid += (data.mid - smoothMid) * lerpSpeed * deltaTime;
      smoothTreble += (data.treble - smoothTreble) * lerpSpeed * deltaTime;

      // 3. Dynamic speed controls: waves move faster during intense parts
      const speedFactor = 0.35 + smoothBass * 1.4 + smoothMid * 0.7;
      time += deltaTime * speedFactor;

      // Draw WaveSurfer-style Reactive Waveform Canvas
      const waveCanvas = waveformCanvasRef.current;
      if (waveCanvas) {
        const wCtx = waveCanvas.getContext("2d");
        if (wCtx) {
          const cssWidth = waveCanvas.clientWidth;
          const cssHeight = waveCanvas.clientHeight;
          const dpr = window.devicePixelRatio || 1;
          
          const targetWidth = Math.round(cssWidth * dpr);
          const targetHeight = Math.round(cssHeight * dpr);
          if (waveCanvas.width !== targetWidth || waveCanvas.height !== targetHeight) {
            waveCanvas.width = targetWidth;
            waveCanvas.height = targetHeight;
          }
          
          wCtx.save();
          wCtx.scale(dpr, dpr);
          wCtx.clearRect(0, 0, cssWidth, cssHeight);
          
          const currentPeaks = peaksRef.current;
          const barCount = currentPeaks.length || 120;
          const gap = 2;
          const barWidth = Math.max(0.5, (cssWidth - (barCount - 1) * gap) / barCount);
          const centerY = cssHeight / 2;
          
          // Beat scale multiplier: reacts dynamically to kicks/bass
          const beatScale = 1.0 + smoothBass * 0.95;
          const progress = totalSecsRef.current > 0 ? (progressSecsRef.current / totalSecsRef.current) : 0;
          const activeThreshold = progress * barCount;
          
          for (let i = 0; i < barCount; i++) {
            const peak = currentPeaks[i] || 0.5;
            
            // Add custom dynamic vibration based on real-time audio frequencies
            const kickReaction = smoothBass * 8 * Math.sin(time * 12 + i * 0.15);
            const midReaction = smoothMid * 4 * Math.cos(time * 8 + i * 0.1);
            
            let h = peak * (cssHeight - 6) * beatScale + kickReaction + midReaction;
            h = Math.max(3, Math.min(cssHeight - 2, h)); // ensure height stays within bounds
            
            const x = i * (barWidth + gap);
            const y = centerY - h / 2;
            
            // Decide color: active (brand orange) or inactive (dark gray)
            const isActive = i <= activeThreshold;
            wCtx.fillStyle = isActive ? "#9c3f00" : "#444444";
            
            wCtx.beginPath();
            if (wCtx.roundRect) {
              wCtx.roundRect(x, y, barWidth, h, Math.max(0, barWidth / 2));
            } else {
              wCtx.rect(x, y, barWidth, h);
            }
            wCtx.fill();
          }
          
          wCtx.restore();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Seconds formatter helper
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (totalSecs === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const clickPercent = clickX / width;
    const targetSeconds = Math.floor(clickPercent * totalSecs);
    setProgressSecs(targetSeconds);
    seekAudio(targetSeconds);
    window.dispatchEvent(new CustomEvent("yt-seek", { detail: targetSeconds }));
  };

  // Add mobile seek support for the top absolute progress bar
  const handleMobileTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (totalSecs === 0) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const clickPercent = clickX / width;
    const targetSeconds = Math.floor(clickPercent * totalSecs);
    setProgressSecs(targetSeconds);
    seekAudio(targetSeconds);
    window.dispatchEvent(new CustomEvent("yt-seek", { detail: targetSeconds }));
  };


  // Mock Lyrics DB
  const LYRICS_DATA: Record<string, string[]> = {
    "track-1": [
      "[00:05] Driving through the neon glow...",
      "[00:20] Fading signals on the radio",
      "[00:35] Synthetic echoes call your name",
      "[00:50] Gridlocked dreams, we play the game",
      "[01:10] Analog heart beats on and on",
      "[01:25] Lost inside the retro dawn",
      "[01:40] (Arpeggiator Solo)"
    ],
    "track-2": [
      "[00:05] (Warm tape hiss entry)",
      "[00:15] Saxophone speaks under streetlamp lights",
      "[00:30] Raindrops tap on the glass tonight",
      "[00:45] Smooth blue chords drifting in the breeze",
      "[01:00] Floating between the shadowed trees",
      "[01:20] Chill groove slows down time..."
    ],
    "track-3": [
      "[00:10] Dust from the tape, echo in space",
      "[00:30] Staring at a slow moving face",
      "[00:50] Static bloom, flower of wire",
      "[01:10] Warm tubes burning like golden fire..."
    ],
    "track-4": [
      "[00:05] Just blank canvas in an empty room",
      "[00:25] Minimalist grids, silent loom",
      "[00:45] Zero signal, white space defined",
      "[01:05] Clean frequencies for the mind"
    ]
  };

  const trackLyrics = LYRICS_DATA[currentTrack.id] || [
    "(No transcript available for this high-fidelity selection)",
    "Enjoy the ambient micro-grooves and warm tube acoustics..."
  ];

  return (
    <div 
      onClick={handlePlayerClick}
      className="w-full bg-black text-[#fff9ef] border-t-2 border-border-tan h-20 px-4 md:px-6 flex items-center justify-between font-mono relative select-none z-40 overflow-hidden cursor-pointer"
    >
      {/* Top absolute progress bar for mobile */}
      <div 
        onClick={handleMobileTimelineClick}
        className="absolute top-0 left-0 right-0 h-1.5 bg-gray-800 md:hidden z-20 cursor-pointer"
      >
        <div 
          className="h-full bg-primary transition-all duration-100 ease-out"
          style={{ width: `${(progressSecs / totalSecs) * 100}%` }}
        />
      </div>



      {/* Track info panel */}
      <div className="relative z-10 flex items-center gap-2 md:gap-3 flex-1 md:w-72 min-w-0">
        <div className="relative group w-10 h-10 md:w-12 md:h-12 rounded border border-border-tan overflow-hidden flex-shrink-0">
          <img 
            src={saavnImg(currentTrack.coverUrl, 150)} 
            alt="Track Cover" 
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          {isPlaying && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h5 className="text-xs font-bold truncate tracking-wide text-[#fff9ef]">{currentTrack.title}</h5>
          <span className="text-[10px] text-gray-400 block truncate font-medium uppercase tracking-tighter">
            {currentTrack.artist}
          </span>
        </div>
      </div>

      {/* Playback Controls & Progress Bar (Desktop only) */}
      <div className="relative z-10 hidden md:flex flex-1 max-w-2xl items-center gap-4 mx-4">
        {/* Left Controls: Prev, Play, Next */}
        <div className="flex items-center gap-3">
          <button 
            onClick={onPrev}
            className="p-1 hover:text-[#fff9ef] text-gray-400 transition-colors cursor-pointer"
            title="Previous Track"
            aria-label="Previous Track"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button 
            onClick={togglePlay}
            className="w-8 h-8 rounded bg-[#fff9ef] text-[#1A1A1A] border border-border-tan flex items-center justify-center hover:bg-primary hover:text-[#fff9ef] transition-colors shadow-sm cursor-pointer"
            aria-label={isPlaying ? "Pause Track" : "Play Track"}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <button 
            onClick={onNext}
            className="p-1 hover:text-[#fff9ef] text-gray-400 transition-colors cursor-pointer"
            title="Next Track"
            aria-label="Next Track"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Center: Waveform Timeline */}
        <div className="flex-1 flex items-center gap-3">
          <span className="text-[9px] text-gray-400 font-bold w-10 text-right">{formatTime(progressSecs)}</span>
          
          <div 
            onClick={handleTimelineClick}
            className="flex-1 relative h-9 flex items-center cursor-pointer bg-[#0c0c0c] border border-gray-900 rounded px-2"
            title="Jump to position"
          >
            <div className="relative w-full h-full overflow-hidden">
              <canvas 
                ref={waveformCanvasRef}
                className="absolute inset-0 w-full h-full"
              />
            </div>
          </div>

          <span className="text-[9px] text-gray-400 font-bold w-10 text-left">{currentTrack.duration}</span>
        </div>

        {/* Right Controls: Shuffle, Repeat */}
        <div className="flex items-center gap-3">
          <button 
            onClick={toggleShuffle}
            className={`p-1 hover:text-primary transition-colors cursor-pointer ${isShuffle ? "text-primary" : "text-gray-400"}`}
            title="Toggle Shuffle"
            aria-label="Toggle Shuffle"
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>

          <button 
            onClick={toggleRepeat}
            className={`p-1 hover:text-primary transition-colors cursor-pointer ${isRepeat ? "text-primary" : "text-gray-400"}`}
            title="Toggle Repeat"
            aria-label="Toggle Repeat"
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mobile Playback Controls (Optimized 44x44px and 40x40px touch targets for mobile audits) */}
      <div className="relative z-10 flex md:hidden items-center gap-2 flex-shrink-0">
        <button 
          onClick={onPrev}
          className="p-2.5 text-gray-400 hover:text-[#fff9ef] transition-colors cursor-pointer"
          title="Previous Track"
          aria-label="Previous Track"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        <button 
          onClick={togglePlay}
          className="w-11 h-11 rounded bg-[#fff9ef] text-[#1A1A1A] flex items-center justify-center hover:bg-primary hover:text-white transition-colors shadow-sm cursor-pointer"
          aria-label={isPlaying ? "Pause Track" : "Play Track"}
        >
          {isPlaying ? <Pause className="w-5 h-5 text-black fill-black" /> : <Play className="w-5 h-5 text-black fill-black ml-0.5" />}
        </button>

        <button 
          onClick={onNext}
          className="p-2.5 text-gray-400 hover:text-[#fff9ef] transition-colors cursor-pointer"
          title="Next Track"
          aria-label="Next Track"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {/* Volume & Auxiliary panel */}
      <div className="relative z-10 hidden md:flex items-center justify-end gap-4 w-72">
        {/* Interactive Volume */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className="text-gray-400 hover:text-primary transition-colors p-1"
            title={isMuted ? "Unmute" : "Mute"}
            aria-label={isMuted ? "Unmute Volume" : "Mute Volume"}
          >
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <div className="relative w-20 h-1 bg-gray-800 rounded flex items-center">
            <input 
              type="range"
              aria-label="Volume"
              min="0"
              max="100"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(Number(e.target.value));
                if (isMuted) setIsMuted(false);
              }}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
            />
            <div 
              className="h-full bg-border-tan"
              style={{ width: `${isMuted ? 0 : volume}%` }}
            />
            <div 
              className="absolute w-3 h-3 rounded-full bg-[#fff9ef] border border-border-tan shadow -ml-1.5"
              style={{ left: `${isMuted ? 0 : volume}%` }}
            />
          </div>
        </div>

        {/* Layout Transcripts / Queue Popovers */}
        <div className="flex items-center gap-2 border-l border-gray-800 pl-3">
          <button 
            onClick={() => {
              setShowLyrics(!showLyrics);
              setShowQueue(false);
            }}
            className={`p-1.5 rounded transition-all border ${
              showLyrics 
                ? "bg-primary text-white border-primary" 
                : "bg-transparent text-gray-400 border-transparent hover:border-gray-800 hover:text-[#fff9ef]"
            }`}
            title="Scrolled Lyrics"
            aria-label="Toggle Scrolling Lyrics"
          >
            <AlignLeft className="w-4 h-4" />
          </button>

          <button 
            onClick={() => {
              setShowQueue(!showQueue);
              setShowLyrics(false);
            }}
            className={`p-1.5 rounded transition-all border relative ${
              showQueue 
                ? "bg-primary text-white border-primary" 
                : "bg-transparent text-gray-400 border-transparent hover:border-gray-800 hover:text-[#fff9ef]"
            }`}
            title="Music Queue"
            aria-label="Toggle Queue"
          >
            <ListMusic className="w-4 h-4" />
            {queue.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-border-tan">
                {queue.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Queue Drawer overlay (floating brutalist card) */}
      {showQueue && (
        <div className="absolute bottom-24 right-6 w-80 bg-surface text-text-charcoal border-2 border-[#1A1A1A] brutalist-shadow rounded p-4 font-mono z-50">
          <div className="flex items-center justify-between border-b border-border-tan pb-2 mb-3">
            <div className="flex items-center gap-1.5">
              <ListMusic className="w-4 h-4 text-primary" />
              <h4 className="text-xs font-bold uppercase tracking-wider">UPCOMING_QUEUE</h4>
            </div>
            <button onClick={() => setShowQueue(false)} className="text-gray-400 hover:text-text-charcoal cursor-pointer" aria-label="Close Queue">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col gap-3 max-h-80 overflow-y-auto pr-1 scrollbar-hide">
            {/* Manual Queue Section */}
            {queue.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1">MANUAL QUEUE ({queue.length})</div>
                {queue.map((track, idx) => (
                  <div 
                    key={`${track.id}-${idx}`}
                    className="flex items-center gap-2 p-1.5 border border-border-tan hover:bg-surface-container rounded transition-colors"
                  >
                    <img 
                      src={saavnImg(track.coverUrl, 50)} 
                      alt="Cover" 
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 object-cover rounded-sm border border-border-tan flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h6 className="text-[10px] font-bold truncate leading-tight text-text-charcoal">{track.title}</h6>
                      <span className="text-[8px] text-gray-500 block truncate">{track.artist}</span>
                    </div>
                    <button 
                      onClick={() => removeFromQueue(idx)}
                      className="text-[9px] font-bold text-red-600 hover:bg-red-50 px-1.5 py-0.5 rounded border border-red-200"
                    >
                      DEL
                    </button>
                  </div>
                ))}
              </div>
            )}

            {queue.length === 0 && autoplayQueue.length === 0 && (
              <div className="text-center py-6 text-[10px] text-gray-400">
                QUEUE_EMPTY
                <span className="block mt-1">Add tracks from the catalog explorer</span>
              </div>
            )}

            {/* Autoplay Queue Section */}
            {autoplayQueue.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-dashed border-border-tan/50 pt-2 mt-1">
                <div className="text-[8px] font-black text-primary/80 uppercase tracking-widest mb-1">UPCOMING AUTOPLAY ({autoplayQueue.length})</div>
                {autoplayQueue.map((track, idx) => (
                  <div 
                    key={`autoplay-${track.id}-${idx}`}
                    className="flex items-center gap-2 p-1.5 border border-border-tan bg-surface/50 hover:bg-surface rounded transition-colors opacity-90"
                  >
                    <img 
                      src={saavnImg(track.coverUrl, 50)} 
                      alt="Cover" 
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 object-cover rounded-sm border border-border-tan flex-shrink-0 grayscale-[25%]"
                    />
                    <div className="flex-1 min-w-0">
                      <h6 className="text-[10px] font-bold truncate leading-tight text-text-charcoal">{track.title}</h6>
                      <span className="text-[8px] text-gray-400 block truncate">{track.artist}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lyrics teleprompter overlay */}
      {showLyrics && (
        <div className="absolute bottom-24 right-20 w-80 bg-[#1A1A1A] border-2 border-border-tan rounded-lg p-4 font-mono z-50 text-[#fff9ef] brutalist-shadow">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              <h4 className="text-xs font-bold uppercase tracking-wider">SCROLLING_LYRICS</h4>
            </div>
            <button onClick={() => setShowLyrics(false)} className="text-gray-400 hover:text-white cursor-pointer" aria-label="Close Lyrics">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col gap-3 max-h-60 overflow-y-auto scrollbar-hide text-[11px] leading-relaxed py-2">
            <span className="text-[9px] text-primary font-bold tracking-widest uppercase">
              {currentTrack.title}
            </span>
            {trackLyrics.map((line, idx) => {
              const isFirst = idx === 0;
              return (
                <p 
                  key={idx} 
                  className={`transition-colors duration-300 ${isFirst ? "text-primary font-bold border-l-2 border-primary pl-2" : "text-gray-400"}`}
                >
                  {line}
                </p>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
