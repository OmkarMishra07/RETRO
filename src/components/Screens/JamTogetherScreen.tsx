import React, { useState, useEffect, useRef } from "react";
import { Track, Listener, ChatMessage } from "../../types";
import { Radio, Users, Sparkles, Send, Plus, Volume2, Globe, MessageSquare, DoorOpen, Search } from "lucide-react";
import { seekAudio, getAudioCurrentTime } from "../../utils/audio";
import { 
  listenToJamRooms, 
  joinJamRoom, 
  leaveJamRoom, 
  updateJamRoomTrack, 
  sendJamRoomMessage, 
  sendJamRoomWave,
  verifyRoomCredentials,
  createJamRoom
} from "../../firebase";
import YouTube from "react-youtube";

interface JamTogetherScreenProps {
  onPlayTrack: (track: Track) => void;
  allTracks: Track[];
  user: any;
  currentTrack: Track;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTrack: (track: Track) => void;
  activeRoomId: string | null;
  setActiveRoomId: (id: string | null) => void;
  roomInfo: any | null;
  setActiveRoomPasscode: (code: string | null) => void;
  onTriggerAddToPlaylist: (track: Track) => void;
  onTrackEnded?: () => void;
}

export const JamTogetherScreen: React.FC<JamTogetherScreenProps> = ({
  onPlayTrack,
  allTracks,
  user,
  currentTrack,
  isPlaying,
  setIsPlaying,
  setCurrentTrack,
  activeRoomId,
  setActiveRoomId,
  roomInfo,
  setActiveRoomPasscode,
  onTriggerAddToPlaylist,
  onTrackEnded
}) => {
  const [newMsg, setNewMsg] = useState<string>("");
  const [createRoomName, setCreateRoomName] = useState<string>("");
  const [createPasscode, setCreatePasscode] = useState<string>("");
  const ytPlayerRef = useRef<any>(null);

  useEffect(() => {
    if (!activeRoomId) {
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
      console.warn("YT Jam Error:", e);
    }
  }, [isPlaying]);
  
  // Global listener for seek sync from PersistentPlayer
  useEffect(() => {
    const handleGlobalSeek = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (ytPlayerRef.current && ytPlayerRef.current.seekTo) {
        ytPlayerRef.current.seekTo(customEvent.detail, true);
      }
    };
    window.addEventListener("yt-seek", handleGlobalSeek);
    return () => window.removeEventListener("yt-seek", handleGlobalSeek);
  }, []);
  
  // Song search inside active room
  const [jamSearchQuery, setJamSearchQuery] = useState<string>("");
  const [jamSuggestions, setJamSuggestions] = useState<Track[]>([]);
  const [showJamSuggestions, setShowJamSuggestions] = useState<boolean>(false);
  const jamSearchRef = useRef<HTMLDivElement | null>(null);

  // Suggestions Click-away handler
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (jamSearchRef.current && !jamSearchRef.current.contains(e.target as Node)) {
        setShowJamSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Debounced search suggestions fetch
  useEffect(() => {
    if (!jamSearchQuery.trim() || jamSearchQuery.trim().length < 2) {
      setJamSuggestions([]);
      setShowJamSuggestions(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/youtube/search?query=${encodeURIComponent(jamSearchQuery.trim())}`);
        const resData = await response.json();
        if (resData.success && resData.data && resData.data.results) {
          const mapped = resData.data.results;
          setJamSuggestions(mapped);
          setShowJamSuggestions(true);
        } else {
          setJamSuggestions([]);
        }
      } catch (err) {
        console.error("Error fetching jam search suggestions:", err);
        setJamSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [jamSearchQuery]);
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string>("");
  const [isCreating, setIsCreating] = useState<boolean>(false);
  
  // Join private station states
  const [joinRoomId, setJoinRoomId] = useState<string>("");
  const [joinPasscode, setJoinPasscode] = useState<string>("");
  const [joinError, setJoinError] = useState<string>("");
  const [isJoining, setIsJoining] = useState<boolean>(false);
  
  // Share modal trigger state
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  // Scroll chat to bottom without scrolling the whole page
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [roomInfo?.messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsg.trim() || !activeRoomId || !user) return;

    sendJamRoomMessage(activeRoomId, user, newMsg.trim());
    setNewMsg("");
  };

  const handleWave = (listenerName: string) => {
    if (!activeRoomId || !user) return;
    sendJamRoomWave(activeRoomId, user.name, listenerName);
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createRoomName.trim()) return;

    setCreateError("");
    setIsCreating(true);
    try {
      const code = createPasscode.trim() || null;
      const roomId = await createJamRoom(createRoomName.trim(), code, user);
      
      setActiveRoomPasscode(code);
      setActiveRoomId(roomId);
      setShowCreateForm(false);
      setCreateRoomName("");
      setCreatePasscode("");
    } catch (err: any) {
      console.error(err);
      setCreateError(err.message || "Failed to create station.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinRoomId.trim()) return;

    setJoinError("");
    setIsJoining(true);
    try {
      const res = await verifyRoomCredentials(joinRoomId.trim(), joinPasscode.trim());
      if (res.success && res.roomId) {
        setActiveRoomPasscode(joinPasscode.trim());
        setActiveRoomId(res.roomId);
        setJoinRoomId("");
        setJoinPasscode("");
        setJoinError("");
      } else {
        if (res.error === "STATION_NOT_FOUND") {
          setJoinError("STATION NOT FOUND. VERIFY CODE.");
        } else if (res.error === "INCORRECT_PASSCODE") {
          setJoinError("INCORRECT VAULT PASSCODE. VERIFY VALUE.");
        } else {
          setJoinError("DATABASE ERROR. ATTEMPT RECONNECT.");
        }
      }
    } catch (err) {
      console.error(err);
      setJoinError("DATABASE CONNECTION FAILED.");
    } finally {
      setIsJoining(false);
    }
  };

  const syncLocalHeadset = () => {
    if (roomInfo?.currentTrack) {
      onPlayTrack(roomInfo.currentTrack);
      setIsPlaying(roomInfo.isPlaying);
      setTimeout(() => {
        seekAudio(roomInfo.progressSecs);
      }, 300);
    }
  };

  // If not in a room, render Lobby
  if (!activeRoomId) {
    return (
      <div className="flex-1 flex flex-col gap-6 p-6 font-mono overflow-y-auto scrollbar-hide h-full justify-center items-center">
        {/* Header */}
        <div className="flex flex-col items-center gap-2 text-center max-w-md select-none">
          <div className="w-12 h-12 rounded-full border border-border-tan bg-primary flex items-center justify-center animate-pulse">
            <Radio className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold tracking-widest block">FIRESTORE_CHANNELS</span>
            <h2 className="text-lg font-black text-text-charcoal uppercase tracking-wider">JAM TOGETHER</h2>
            <p className="text-[10px] text-gray-500 mt-1 max-w-sm leading-normal">
              Listen to music together with friends online in real time. Create a free virtual listening party and sync playback instantly. No account needed to join. Stream Bollywood, Hindi, and Global music together.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl mt-4">
          {/* Card A: Join Private Station */}
          <div className="bg-[#FAF3E0] border-2 border-[#1A1A1A] p-5 rounded-lg brutalist-shadow-thick flex flex-col gap-4">
            <div>
              <span className="text-[9px] text-[#ff6b00] font-bold block uppercase tracking-widest">ACCESS_STATION</span>
              <h3 className="text-sm font-black text-text-charcoal uppercase">TUNE IN TO FRIENDS</h3>
            </div>

            <form onSubmit={handleJoinRoomSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">STATION CODE / ID</label>
                <input 
                  type="text" 
                  placeholder="e.g. lofi-retreat"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  className="w-full bg-surface border border-border-tan text-xs px-2.5 py-2 rounded focus:outline-none focus:border-primary text-text-charcoal font-bold"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">STATION PASSCODE</label>
                <input 
                  type="password" 
                  placeholder="ENTER PASSCODE..."
                  value={joinPasscode}
                  onChange={(e) => setJoinPasscode(e.target.value)}
                  className="w-full bg-surface border border-border-tan text-xs px-2.5 py-2 rounded focus:outline-none focus:border-primary text-text-charcoal font-bold tracking-wider"
                />
              </div>

              {joinError && (
                <span className="text-[9px] text-red-600 font-bold bg-red-50 p-2 rounded border border-red-200">
                  DIAGNOSTIC_ERR: {joinError}
                </span>
              )}

              <button 
                type="submit"
                disabled={isJoining}
                className="w-full bg-[#1A1A1A] hover:bg-primary text-white text-xs font-black tracking-widest py-3 rounded transition-colors cursor-pointer disabled:opacity-50 mt-2 uppercase"
              >
                {isJoining ? "CONNECTING..." : "TUNE IN SIGNAL →"}
              </button>
            </form>
          </div>

          {/* Card B: Create Station */}
          <div className="bg-[#FAF3E0] border-2 border-[#1A1A1A] p-5 rounded-lg brutalist-shadow-thick flex flex-col gap-4">
            <div>
              <span className="text-[9px] text-primary font-bold block uppercase tracking-widest font-black">LAUNCH_BROADCAST</span>
              <h3 className="text-sm font-black text-text-charcoal uppercase">CREATE NEW STATION</h3>
            </div>

            <form onSubmit={handleCreateRoom} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">STATION NAME</label>
                <input 
                  type="text" 
                  placeholder="e.g. BEATS WORKSHOP"
                  value={createRoomName}
                  onChange={(e) => setCreateRoomName(e.target.value)}
                  className="w-full bg-surface border border-border-tan text-xs px-2.5 py-2 rounded focus:outline-none focus:border-primary text-text-charcoal font-bold"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">STATION PASSCODE (OPTIONAL)</label>
                <input 
                  type="text" 
                  placeholder="e.g. 1234"
                  maxLength={10}
                  value={createPasscode}
                  onChange={(e) => setCreatePasscode(e.target.value)}
                  className="w-full bg-surface border border-border-tan text-xs px-2.5 py-2 rounded focus:outline-none focus:border-primary text-text-charcoal font-bold"
                />
              </div>

              {createError && (
                <span className="text-[9px] text-red-600 font-bold bg-red-50 p-2 rounded border border-red-200">
                  DIAGNOSTIC_ERR: {createError}
                </span>
              )}

              <button 
                type="submit"
                disabled={isCreating}
                className="w-full bg-primary hover:bg-opacity-95 text-white text-xs font-black tracking-widest py-3 rounded transition-all cursor-pointer mt-2 uppercase disabled:opacity-50"
              >
                {isCreating ? "CREATING..." : "LAUNCH BROADCAST →"}
              </button>
            </form>
          </div>
        </div>
        
        {/* Help Tip */}
        <span className="text-[8px] text-gray-400 font-bold tracking-wider select-none uppercase">
          TIP: Use default station code &apos;solaris-drift&apos; (leave passcode blank) for public server testing.
        </span>
      </div>
    );
  }

  // Room view
  const activeRoomTrack = roomInfo?.currentTrack;
  const roomListeners = roomInfo?.listeners || [];
  const messages = roomInfo?.messages || [];
  const vibe = roomInfo?.vibe || 50;

  return (
    <div className="flex-1 flex flex-col gap-4 p-4 md:p-6 font-mono lg:overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-tan pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border border-border-tan bg-primary flex items-center justify-center animate-pulse">
            <Radio className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold tracking-widest block">STATION // ACTIVE</span>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-text-charcoal leading-none uppercase">{roomInfo?.roomName || "STATION"}</h2>
              <span className="bg-[#FFEAEA] border border-red-300 text-red-600 text-[9px] font-bold px-1.5 py-0.2 rounded animate-pulse">
                ● LIVE
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => setShowShareModal(true)}
            className="bg-primary text-white border border-primary text-[10px] font-bold px-3 py-1.5 rounded hover:bg-opacity-95 shadow cursor-pointer"
          >
            SHARE STATION
          </button>
          <button 
            onClick={() => setActiveRoomId(null)}
            className="bg-surface border border-border-tan hover:bg-red-50 hover:text-red-600 transition-colors text-[10px] font-bold px-3 py-1.5 rounded text-text-charcoal cursor-pointer flex items-center gap-1"
          >
            <DoorOpen className="w-3.5 h-3.5" />
            <span>LEAVE LOBBY</span>
          </button>
        </div>
      </div>

      {/* Main Grid Splitting */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch min-h-0 overflow-y-auto lg:overflow-hidden pb-4">
        {/* Left Column (8 units): Live Audio Center & Queue */}
        <div className="lg:col-span-8 flex flex-col gap-6 lg:h-full lg:overflow-y-auto pr-1 scrollbar-hide pb-4">
          
          {/* Jam Room Song Search */}
          <div ref={jamSearchRef} className="relative w-full">
            <div className="bg-[#FAF3E0] border-2 border-[#1A1A1A] p-4 rounded-lg brutalist-shadow flex flex-col gap-2">
              <span className="text-[9px] text-[#ff6b00] font-bold block uppercase tracking-widest">
                STATION_PLAY_SELECTOR
              </span>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="SEARCH SONGS TO INSTANTLY PLAY IN THE STATION..." 
                  value={jamSearchQuery}
                  onChange={(e) => setJamSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (jamSuggestions.length > 0) setShowJamSuggestions(true);
                  }}
                  className="w-full bg-surface border-2 border-border-tan py-2.5 pl-9 pr-4 rounded text-xs text-text-charcoal placeholder-gray-400 focus:outline-none focus:border-primary font-bold font-mono"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>

            {/* Jam Suggestions Autocomplete Dropdown */}
            {showJamSuggestions && jamSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-[100] mt-1.5 bg-[#FAF3E0] border-2 border-[#1A1A1A] rounded brutalist-shadow-thick max-h-64 overflow-y-auto font-mono text-text-charcoal flex flex-col animate-fadeIn">
                <div className="text-[8px] text-gray-500 font-bold border-b border-border-tan px-3 py-1.5 bg-surface-container">
                  CLICK A SONG TO PLAY IMMEDIATELY IN THIS ROOM
                </div>
                {jamSuggestions.map((track) => (
                  <div
                    key={track.id}
                    className="flex items-center justify-between p-2.5 hover:bg-[#1A1A1A] hover:text-white transition-colors cursor-pointer border-b border-border-tan last:border-b-0 text-[11px]"
                  >
                    <div 
                      className="flex items-center gap-2.5 min-w-0 flex-1"
                      onClick={() => {
                        onPlayTrack(track);
                        setShowJamSuggestions(false);
                        setJamSearchQuery("");
                      }}
                    >
                      <img 
                        src={track.coverUrl} 
                        alt="Cover" 
                        className="w-8 h-8 object-cover rounded border border-border-tan flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold truncate">{track.title}</div>
                        <div className="text-[9px] text-gray-400 truncate">{track.artist}</div>
                      </div>
                    </div>
                    
                    {/* Action buttons on the suggestion card */}
                    <div className="flex items-center gap-1.5 ml-2">
                      <button
                        onClick={() => {
                          onPlayTrack(track);
                          setShowJamSuggestions(false);
                          setJamSearchQuery("");
                        }}
                        className="bg-primary text-white text-[9px] font-black px-2.5 py-1 rounded hover:bg-opacity-95 cursor-pointer"
                        title="Play in Room"
                      >
                        PLAY
                      </button>
                      <button
                        onClick={() => {
                          onTriggerAddToPlaylist(track);
                        }}
                        className="bg-white border border-[#1A1A1A] text-[#1A1A1A] text-[9px] font-black px-2.5 py-1 rounded hover:bg-gray-100 cursor-pointer"
                        title="Add to Playlist"
                      >
                        + PL
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Retro TV Player */}
          <div className="bg-[#5c4033] border-8 border-[#3b2a21] rounded-2xl p-4 flex flex-col items-center relative brutalist-shadow shadow-2xl">
            {/* TV Antennas */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex gap-4">
              <div className="w-1 h-16 bg-gray-400 rotate-[-30deg] border border-gray-600 rounded"></div>
              <div className="w-1 h-16 bg-gray-400 rotate-[30deg] border border-gray-600 rounded"></div>
            </div>

            {/* TV Screen Enclosure */}
            <div className="w-full bg-[#111] p-3 rounded-xl border-4 border-gray-800 shadow-inner relative overflow-hidden flex flex-col md:flex-row gap-4">
              {/* Actual Screen */}
              <div className="flex-1 bg-black rounded-lg border-2 border-gray-700 relative overflow-hidden flex items-center justify-center aspect-[16/10] pointer-events-auto">
                <div className="absolute inset-0 pointer-events-none rounded-lg shadow-[inset_0_0_100px_rgba(0,0,0,0.9)] z-20"></div>
                
                {currentTrack?.audioUrl && (
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
                      if (e.data === 1 && !isPlaying) setIsPlaying(true);
                      if (e.data === 2 && isPlaying) setIsPlaying(false);
                      if (e.data === 0) {
                        if (onTrackEnded) onTrackEnded();
                        else setIsPlaying(false);
                      }
                    }}
                    className="absolute inset-0 w-full h-full scale-105"
                  />
                )}
                {!currentTrack?.audioUrl && (
                  <div className="text-gray-500 font-mono text-xs flex flex-col items-center gap-2">
                    <Radio className="w-6 h-6 animate-pulse" />
                    <span>NO SIGNAL</span>
                  </div>
                )}
              </div>

              {/* TV Dials Panel */}
              <div className="w-full md:w-24 bg-[#2a2a2a] rounded-lg border-2 border-gray-800 p-2 flex flex-row md:flex-col items-center justify-between gap-4 shadow-inner">
                {/* Speaker Grill */}
                <div className="w-full h-12 md:h-24 border-2 border-gray-900 bg-black rounded flex flex-wrap gap-1 p-1 overflow-hidden opacity-80">
                  {Array.from({ length: 40 }).map((_, i) => (
                    <div key={i} className="w-1.5 h-1.5 bg-gray-800 rounded-full"></div>
                  ))}
                </div>
                
                <div className="flex flex-row md:flex-col gap-3 items-center">
                  <div className="w-10 h-10 rounded-full bg-gray-300 border-b-4 border-gray-500 shadow flex items-center justify-center cursor-pointer active:border-b-0 active:translate-y-1">
                    <div className="w-1 h-4 bg-gray-800 rounded"></div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-400 border-b-4 border-gray-600 shadow flex items-center justify-center cursor-pointer active:border-b-0 active:translate-y-1 text-[8px] font-bold">
                    UHF
                  </div>
                </div>
              </div>
            </div>
            
            {/* Song Meta Information Below TV */}
            <div className="w-full mt-4 flex items-center justify-between text-[#FAF3E0] px-2">
              <div className="flex flex-col">
                <span className="text-[10px] text-[#C8B89A] font-bold tracking-widest uppercase">
                  {roomInfo?.hostId === user?.uid ? "YOU ARE HOST / DJ" : "LISTENING SYNC"}
                </span>
                <h3 className="text-sm font-bold truncate max-w-[200px] tracking-wide leading-none">
                  {activeRoomTrack?.title || "NO TRACK SPINNING"}
                </h3>
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter">
                  {activeRoomTrack?.artist || "The host is choosing a frequency"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="bg-[#a04100]/50 border border-primary text-white text-[8px] font-bold px-2 py-0.5 rounded shadow">
                  FIRESTORE SYNC
                </span>
              </div>
            </div>
          </div>

          {/* Current Listeners Avatars list */}
          <div className="bg-surface border border-border-tan rounded-lg p-4 brutalist-shadow">
            <h3 className="text-xs font-bold text-text-charcoal uppercase tracking-widest flex items-center gap-1.5 mb-3">
              <Users className="w-4 h-4 text-primary" />
              CURRENT LISTENERS ({roomListeners.length})
            </h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {roomListeners.map((lst) => (
                <div 
                  key={lst.id}
                  onClick={() => lst.name !== user.name && handleWave(lst.name)}
                  className="group flex flex-col items-center bg-surface-container border border-border-tan rounded p-2 text-center relative hover:border-primary transition-all cursor-pointer"
                  title={lst.name !== user.name ? `Tap to wave at ${lst.name}` : ""}
                >
                  <div className="relative">
                    <img 
                      src={lst.avatarUrl} 
                      alt="Listener avatar" 
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded border border-border-tan object-cover"
                    />
                    {lst.isDj && (
                      <span className="absolute -top-1 -right-1 bg-primary text-white text-[8px] font-bold px-1 rounded border border-border-tan">
                        DJ
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-text-charcoal truncate w-full mt-2 group-hover:text-primary">
                    {lst.name}
                  </span>
                  {lst.name !== user.name && <span className="text-[7px] text-gray-400 block mt-0.5">WAVE 👋</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (4 units): Feed and telemetry */}
        <div className="lg:col-span-4 bg-[#FAF3E0] border border-border-tan p-4 rounded-lg brutalist-shadow flex flex-col gap-4 lg:h-full min-h-[400px] lg:min-h-0 overflow-hidden">
          
          {/* Metadata gauges */}
          <div className="border-b border-border-tan pb-3 flex flex-col gap-2">
            <span className="text-[9px] text-gray-400 font-bold tracking-widest block uppercase">
              ROOM_METADATA
            </span>
            <div className="flex justify-between items-center text-[10px] font-bold">
              <span className="text-gray-500">STATION_ID:</span>
              <span className="text-primary truncate max-w-[150px]">{activeRoomId}</span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-bold">
              <span className="text-gray-500">SYNC_STATUS:</span>
              <span className="text-text-charcoal bg-white border border-border-tan px-1 rounded text-[8px]">
                {roomInfo?.isPlaying ? "STREAMING" : "PAUSED"}
              </span>
            </div>

            {/* Vibe-O-Meter gauge */}
            <div className="mt-2 flex flex-col gap-1">
              <div className="flex justify-between text-[8px] font-bold">
                <span className="text-gray-500 uppercase">VIBE-O-METER</span>
                <span className="text-primary">{vibe}% HIGH</span>
              </div>
              <div className="w-full bg-gray-200 h-2 rounded border border-border-tan relative overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${vibe}%` }}
                />
              </div>
            </div>
          </div>

          {/* Activity Chat Feed */}
          <div className="flex-1 flex flex-col justify-between min-h-0">
            {/* Scroll messages box */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 min-h-0 scrollbar-hide">
              {messages.map((m) => {
                let textCol = "text-text-charcoal";
                let bgCol = "bg-surface";
                let borderCol = "border-border-tan";
                
                if (m.isDj) {
                  textCol = "text-primary font-bold";
                  bgCol = "bg-[#FCF3DE]";
                  borderCol = "border-primary/40";
                } else if (m.isSystem) {
                  textCol = "text-gray-500 italic";
                  bgCol = "bg-transparent";
                  borderCol = "border-transparent";
                }

                return (
                  <div 
                    key={m.id}
                    className={`p-2 rounded border text-[10px] leading-relaxed transition-all ${bgCol} ${borderCol}`}
                  >
                    <div className="flex items-center justify-between mb-1 text-[8px] text-gray-400 font-bold">
                      <span className={m.isDj ? "text-primary" : "text-text-charcoal"}>
                        {m.user}
                      </span>
                      <span>{m.timestamp}</span>
                    </div>
                    <p className={textCol}>{m.text}</p>
                  </div>
                );
              })}
            </div>

            {/* Input message form */}
            <form onSubmit={handleSendMessage} className="mt-3 pt-2 border-t border-border-tan flex gap-2">
              <input 
                type="text"
                placeholder="Broadcast a frequency..."
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                className="flex-1 bg-surface border border-border-tan text-xs px-2.5 py-1.5 rounded focus:outline-none focus:border-primary text-text-charcoal placeholder-gray-400 font-bold"
              />
              <button 
                type="submit"
                aria-label="Send message"
                className="bg-primary text-white border border-primary p-2 rounded hover:bg-opacity-95 shadow cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>

    {/* Share Station Invite Link & QR Modal */}
    {showShareModal && (
      <div className="fixed inset-0 bg-black/75 z-[999] flex items-center justify-center p-4 font-mono text-text-charcoal">
        <div className="w-full max-w-md bg-[#FAF3E0] border-2 border-[#1A1A1A] rounded-lg p-5 brutalist-shadow-thick flex flex-col gap-4 relative">
          <button 
            onClick={() => setShowShareModal(false)}
            className="absolute top-4 right-4 text-xs font-bold text-gray-500 hover:text-black cursor-pointer"
          >
            CLOSE [X]
          </button>
          
          <div>
            <span className="text-[9px] text-primary font-bold block uppercase tracking-widest font-black">SHARE_BROADCAST_SIGNAL</span>
            <h3 className="text-sm font-black uppercase truncate mt-0.5">{roomInfo?.roomName}</h3>
          </div>

          {/* QR Code section */}
          <div className="flex flex-col items-center gap-3 bg-surface p-4 rounded border border-border-tan shadow-inner">
            <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">SCAN TO LISTEN IN</span>
            <div className="w-40 h-40 border border-gray-400 bg-white p-2 rounded flex items-center justify-center relative shadow-sm">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&color=1A1A1A&bgcolor=FAF3E0&data=${encodeURIComponent(
                  `${window.location.origin}/?room=${activeRoomId}${roomInfo?.passcode ? `&code=${roomInfo.passcode}` : ""}`
                )}`} 
                alt="Station QR Code" 
                className="w-full h-full object-contain"
              />
            </div>
            <p className="text-[8px] text-gray-500 text-center leading-normal">
              Point any mobile camera to this QR code to join this session immediately.
            </p>
          </div>

          {/* Code / Link Copy */}
          <div className="flex flex-col gap-3">
            {roomInfo?.passcode && (
              <div className="flex items-center justify-between text-xs font-bold bg-[#FCF3DE] p-2 rounded border border-primary/20">
                <span className="text-gray-500 uppercase text-[9px]">JOIN PASSCODE:</span>
                <span className="text-primary tracking-widest select-all">{roomInfo.passcode}</span>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">DIRECT LINK</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  readOnly
                  value={`${window.location.origin}/?room=${activeRoomId}${roomInfo?.passcode ? `&code=${roomInfo.passcode}` : ""}`}
                  className="flex-1 bg-surface border border-border-tan text-[9px] px-2 py-1.5 rounded text-gray-600 select-all font-bold focus:outline-none"
                />
                <button 
                  onClick={() => {
                    const link = `${window.location.origin}/?room=${activeRoomId}${roomInfo?.passcode ? `&code=${roomInfo.passcode}` : ""}`;
                    navigator.clipboard.writeText(link);
                    alert("INVITE LINK COPIED TO CLIPBOARD!");
                  }}
                  className="bg-primary text-white text-[10px] px-3 font-bold rounded border border-primary hover:bg-opacity-90 cursor-pointer flex-shrink-0"
                >
                  COPY LINK
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
);
};
