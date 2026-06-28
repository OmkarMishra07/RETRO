import React, { useState, useEffect, useRef } from "react";
import { Track } from "../types";
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Heart, Music, Sparkles, ListPlus, Tv, Disc3 } from "lucide-react";
import { seekAudio, getAudioCurrentTime } from "../utils/audio";
import YouTube from "react-youtube";

interface TurntableProps {
  currentTrack: Track;
  isPlaying: boolean;
  togglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  isLiked: boolean;
  onToggleLike: () => void;
  isRepeat?: boolean;
  toggleRepeat?: () => void;
  isShuffle?: boolean;
  toggleShuffle?: () => void;
  onTriggerAddToPlaylist?: () => void;
  activeRoomId?: string | null;
}

export const Turntable: React.FC<TurntableProps> = ({
  currentTrack,
  isPlaying,
  togglePlay,
  onNext,
  onPrev,
  isLiked,
  onToggleLike,
  isRepeat = false,
  toggleRepeat = () => {},
  isShuffle = false,
  toggleShuffle = () => {},
  onTriggerAddToPlaylist,
  activeRoomId
}) => {
  // Sync local progress tracker with active playback
  const [progressSecs, setProgressSecs] = useState<number>(0);

  // Parse track duration "MM:SS" -> total seconds
  const durationParts = (currentTrack?.duration || "00:00").split(":");
  const totalSecs = (parseInt(durationParts[0], 10) || 0) * 60 + (parseInt(durationParts[1], 10) || 0);

  const ytPlayerRef = useRef<any>(null);
  const [showVideo, setShowVideo] = useState(false);

  // Sync progress tracker with active playback (both live streams and synth frequency beeps)
  useEffect(() => {
    const updateProgress = () => {
      if (showVideo && ytPlayerRef.current && ytPlayerRef.current.getCurrentTime) {
        setProgressSecs(Math.floor(ytPlayerRef.current.getCurrentTime()));
      } else {
        setProgressSecs(Math.floor(getAudioCurrentTime()));
      }
    };
    updateProgress();
    // Poll every 100ms for high responsiveness (seeking when paused aligns instantly)
    const timer = setInterval(updateProgress, 100);
    return () => {
      clearInterval(timer);
    };
  }, [currentTrack, showVideo]);

  // Reset progress when track changes
  useEffect(() => {
    setProgressSecs(0);
  }, [currentTrack]);

  useEffect(() => {
    if (activeRoomId) {
      ytPlayerRef.current = null;
    }
  }, [activeRoomId]);

  useEffect(() => {
    try {
      if (ytPlayerRef.current && ytPlayerRef.current.playVideo) {
        if (isPlaying) {
          ytPlayerRef.current.unMute();
          ytPlayerRef.current.setVolume(100);
          ytPlayerRef.current.playVideo();
          
          // Anti-scroll hack for iframe focus hijacking
          setTimeout(() => {
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
            const mainWrapper = document.querySelector('main');
            if (mainWrapper) mainWrapper.scrollTop = 0;
            const appRoot = document.getElementById('root');
            if (appRoot) appRoot.scrollTop = 0;
          }, 10);
        } else {
          ytPlayerRef.current.pauseVideo();
        }
      }
    } catch (e) {
      console.warn("YT Turntable Error:", e);
    }
  }, [isPlaying]);

  // Format seconds -> MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = clickX / width;
    const targetSecs = Math.floor(percentage * totalSecs);
    const boundedSecs = Math.max(0, Math.min(targetSecs, totalSecs));
    setProgressSecs(boundedSecs);
    seekAudio(boundedSecs); // Seek actual audio stream so all components stay synced
    if (ytPlayerRef.current && ytPlayerRef.current.seekTo) {
      ytPlayerRef.current.seekTo(boundedSecs, true);
    }
  };

  // Arm rotation angle: when playing, pivot arm onto the vinyl disk's edge (24 degrees), otherwise parked at 0 degrees
  const tonearmRotation = isPlaying ? "rotate-[24deg]" : "rotate-[0deg]";

  return (
    <div className="bg-surface-container border-2 border-text-charcoal p-4 md:p-6 rounded-lg brutalist-shadow-thick flex flex-col items-center justify-center font-mono relative select-none w-full max-w-lg mx-auto">
      
      {/* Top Header details */}
      <div className="w-full flex justify-between items-center border-b border-border-tan pb-3.5 mb-6">
        <div className="flex items-center gap-1.5">
          <Music className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">
            STUDIO_STREAM_PORT_3000
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setShowVideo(!showVideo)}
            className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded hover:bg-primary/20 transition-all cursor-pointer"
          >
            {showVideo ? (
              <><Disc3 className="w-3 h-3 text-primary" /><span className="text-[8px] text-primary font-bold">SHOW DISK</span></>
            ) : (
              <><Tv className="w-3 h-3 text-primary" /><span className="text-[8px] text-primary font-bold">SHOW VIDEO</span></>
            )}
          </button>
          <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
            <Sparkles className="w-3 h-3 text-primary animate-pulse" />
            <span className="text-[8px] text-primary font-bold">LOSSLESS AUDIO</span>
          </div>
        </div>
      </div>

      {/* Main Integrated Deck: vinyl platter and tone-arm hand inside the SAME parent container for perfect overlap */}
      <div className="relative w-72 h-72 rounded-full bg-black border-[6px] border-gray-900 flex items-center justify-center shadow-xl overflow-visible mb-6 group">
        
        {/* Subtle Vinyl grooved rings */}
        <div className="absolute inset-2 rounded-full border border-gray-900 opacity-90" />
        <div className="absolute inset-8 rounded-full border border-gray-950 opacity-95" />
        <div className="absolute inset-16 rounded-full border border-gray-900 opacity-80" />
        <div className="absolute inset-24 rounded-full border border-gray-950 opacity-90" />
        <div className="absolute inset-32 rounded-full border border-gray-900 opacity-60" />

        {/* Vinyl Shiny gloss reflection lines */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none rounded-full transform -rotate-45" />
        <div className="absolute inset-0 bg-gradient-to-bl from-transparent via-white/10 to-transparent pointer-events-none rounded-full transform -rotate-45" />

        {/* Rotating Platter Cover / Label */}
        <div 
          className={`w-[264px] h-[264px] rounded-full flex items-center justify-center transition-transform duration-1000 overflow-hidden relative ${
            isPlaying && !showVideo ? "spinning-vinyl" : ""
          }`}
        >
          {/* Audio background player for YouTube */}
          {currentTrack?.audioUrl && !activeRoomId && (
            <div className={`absolute inset-0 w-full h-full ${showVideo ? 'opacity-100' : 'opacity-[0.001] pointer-events-none'}`}>
              <YouTube
                videoId={currentTrack.audioUrl}
                opts={{
                  width: '100%',
                  height: '100%',
                  playerVars: {
                    autoplay: isPlaying ? 1 : 0,
                    controls: 1,
                    disablekb: 1,
                    fs: 0,
                    rel: 0
                  },
                }}
                onReady={(e) => {
                  ytPlayerRef.current = e.target;
                  e.target.unMute();
                  e.target.setVolume(100);
                  
                  const currentTime = getAudioCurrentTime();
                  if (currentTime > 0) {
                    e.target.seekTo(currentTime, true);
                  }
                  
                  if (isPlaying) e.target.playVideo();
                }}
                onStateChange={(e) => {
                  if (e.target.isMuted()) {
                    e.target.unMute();
                  }
                  if (e.data === 1 && !isPlaying) togglePlay(); // Ensure external state stays synced
                  if (e.data === 2 && isPlaying) togglePlay();
                  if (e.data === 0) onNext();
                }}
                className="w-full h-full scale-[2.2] pointer-events-auto"
              />
            </div>
          )}

          {/* Album Cover Label */}
          <div className={`w-28 h-28 rounded-full bg-gray-950 border-[5px] border-gray-950 flex items-center justify-center overflow-hidden relative shadow-inner transition-opacity duration-300 ${showVideo ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <img 
              src={currentTrack.coverUrl} 
              alt="Vinyl Label"
              fetchPriority="high"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover opacity-90 absolute inset-0"
            />
            {/* Center Spindle Hole */}
            <div className="w-9 h-9 rounded-full bg-surface-container border border-gray-900 z-10 flex items-center justify-center shadow">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-400 border border-gray-600" />
            </div>
          </div>
        </div>

        {/* Elegant Integrated Tonearm pivot base placed inside parent container so hand overlaps perfectly */}
        <div className="absolute top-1 right-1 w-20 h-20 z-30 flex items-center justify-center pointer-events-none">
          <div className="relative w-14 h-14 rounded-full bg-surface-container border border-border-tan flex items-center justify-center shadow-md">
            {/* Pivot ring metal accent */}
            <div className="w-9 h-9 rounded-full bg-gray-200 border border-gray-300 flex items-center justify-center relative">
              <div className="w-4 h-4 rounded-full bg-gray-600 border border-gray-800" />
              
              {/* Metallic arm pole extending onto record */}
              <div 
                className={`absolute top-1/2 left-1/2 -ml-0.5 -mt-0.5 w-1 h-36 bg-gray-400 origin-top transition-transform duration-700 ease-out z-20 shadow-sm ${tonearmRotation}`}
              >
                {/* Arm bend connector */}
                <div className="absolute bottom-0 -left-1.5 w-4 h-6 bg-gray-300 border border-gray-500 rounded-sm flex flex-col items-center">
                  {/* Cartridge headshell needle sitting properly on spinning edge of record disc */}
                  <div className="absolute bottom-0 left-0 w-[14px] h-[8px] bg-primary border border-gray-800 rounded-xs" />
                  <div className="absolute -bottom-1 left-2 w-0.5 h-1.5 bg-gray-600" /> {/* Needle stylus */}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Track info panel with Heart like toggle */}
      <div className="w-full flex items-center justify-between mb-4">
        <div className="min-w-0 pr-4">
          <h3 className="text-sm font-black text-text-charcoal truncate tracking-wide leading-tight">
            {currentTrack.title}
          </h3>
          <p className="text-[11px] text-gray-500 font-bold uppercase tracking-tight truncate mt-0.5">
            {currentTrack.artist}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onTriggerAddToPlaylist && (
            <button 
              onClick={onTriggerAddToPlaylist}
              aria-label="Add to Playlist"
              className="p-2 rounded-full border border-border-tan text-text-charcoal bg-white hover:bg-[#FAF3E0] hover:text-primary transition-all shadow-sm"
              title="Add to Playlist"
            >
              <ListPlus className="w-4 h-4" />
            </button>
          )}
          <button 
            onClick={onToggleLike}
            aria-label={isLiked ? "Unlike Track" : "Like Track"}
            className={`p-2 rounded-full border transition-all shadow-sm ${
              isLiked 
                ? "bg-red-50 border-red-200 text-red-500" 
                : "bg-white border-border-tan text-gray-400 hover:text-red-500 hover:bg-red-50"
            }`}
            title={isLiked ? "Unlike Track" : "Like Track"}
          >
            <Heart className={`w-4 h-4 ${isLiked ? "fill-red-500" : ""}`} />
          </button>
        </div>
      </div>

      {/* Spotify-style Timeline Progress bar */}
      <div className="w-full flex flex-col gap-1.5 mb-6">
        <div 
          onClick={handleProgressBarClick}
          className="w-full h-1.5 bg-gray-200 hover:bg-gray-300 border border-border-tan/40 rounded-full overflow-hidden cursor-pointer relative"
        >
          <div 
            className="h-full bg-primary transition-all duration-100 ease-out"
            style={{ width: `${(progressSecs / totalSecs) * 100}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold">
          <span>{formatTime(progressSecs)}</span>
          <span>{currentTrack.duration}</span>
        </div>
      </div>

      {/* Spotify-style Playback controls */}
      <div className="w-full flex items-center justify-center gap-6">
        <button 
          onClick={toggleShuffle}
          className={`p-2.5 transition-colors cursor-pointer ${isShuffle ? "text-primary" : "text-gray-400 hover:text-text-charcoal"}`}
          title="Shuffle"
          aria-label="Toggle Shuffle"
        >
          <Shuffle className="w-4 h-4" />
        </button>

        <button 
          onClick={onPrev}
          className="p-2.5 text-text-charcoal hover:text-primary transition-colors cursor-pointer"
          title="Previous"
          aria-label="Previous Track"
        >
          <SkipBack className="w-5 h-5 fill-current" />
        </button>

        {/* Big circular Play/Pause button */}
        <button 
          onClick={togglePlay}
          className="w-12 h-12 rounded-full bg-primary hover:bg-opacity-95 text-white flex items-center justify-center shadow brutalist-shadow transition-all border-2 border-text-charcoal cursor-pointer"
          title={isPlaying ? "Pause" : "Play"}
          aria-label={isPlaying ? "Pause Track" : "Play Track"}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 fill-white text-white" />
          ) : (
            <Play className="w-5 h-5 fill-white text-white ml-0.5" />
          )}
        </button>

        <button 
          onClick={onNext}
          className="p-2.5 text-text-charcoal hover:text-primary transition-colors cursor-pointer"
          title="Next"
          aria-label="Next Track"
        >
          <SkipForward className="w-5 h-5 fill-current" />
        </button>

        <button 
          onClick={toggleRepeat}
          className={`p-2.5 transition-colors cursor-pointer ${isRepeat ? "text-primary" : "text-gray-400 hover:text-text-charcoal"}`}
          title="Repeat"
          aria-label="Toggle Repeat"
        >
          <Repeat className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
};
