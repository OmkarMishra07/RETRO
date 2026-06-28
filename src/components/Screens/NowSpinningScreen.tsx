import React, { useState, useEffect, useRef } from "react";
import { Track } from "../../types";
import { API_BASE } from "../../config";
import { Turntable } from "../Turntable";
import { Sparkles, ListMusic, Heart, Music, Search, Plus, Play, Trash2, ListPlus } from "lucide-react";

interface NowSpinningScreenProps {
  currentTrack: Track;
  isPlaying: boolean;
  togglePlay: () => void;
  allTracks: Track[];
  onPlayTrack: (track: Track) => void;
  onNext: () => void;
  onPrev: () => void;
  queue: Track[];
  removeFromQueue: (index: number) => void;
  likedTracks: Track[];
  onToggleLike: (track: Track) => void;
  playlists: any[];
  onAddToQueue: (track: Track) => void;
  onTriggerAddToPlaylist: (track: Track) => void;
  onPlayPlaylist: (playlist: any) => void;
  isRepeat?: boolean;
  toggleRepeat?: () => void;
  isShuffle?: boolean;
  toggleShuffle?: () => void;
  autoplayQueue?: Track[];
  activeRoomId?: string | null;
}

type Tab = "queue" | "liked" | "playlist" | "search";

export const NowSpinningScreen: React.FC<NowSpinningScreenProps> = ({
  currentTrack,
  isPlaying,
  togglePlay,
  allTracks,
  onPlayTrack,
  onNext,
  onPrev,
  queue,
  removeFromQueue,
  likedTracks,
  onToggleLike,
  playlists,
  onAddToQueue,
  onTriggerAddToPlaylist,
  onPlayPlaylist,
  isRepeat = false,
  toggleRepeat = () => {},
  isShuffle = false,
  toggleShuffle = () => {},
  autoplayQueue = [],
  activeRoomId = null
}) => {
  const [activeTab, setActiveTab] = useState<Tab>("queue");
  const [spinningSearchQuery, setSpinningSearchQuery] = useState("");
  const [spinningSearchResults, setSpinningSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedPlaylists, setExpandedPlaylists] = useState<Record<string, boolean>>({});

  const togglePlaylistExpanded = (id: string) => {
    setExpandedPlaylists((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Suggestions state
  const [suggestions, setSuggestions] = useState<Track[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Suggestions Click-away handler
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Debounced search suggestions fetch
  useEffect(() => {
    if (!spinningSearchQuery.trim() || spinningSearchQuery.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const response = await fetch(`${API_BASE}/api/youtube/search?query=${encodeURIComponent(spinningSearchQuery.trim())}`);
        const resData = await response.json();
        if (resData.success && resData.data && resData.data.results) {
          const mapped = resData.data.results;
          setSuggestions(mapped);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
        }
      } catch (err) {
        console.error("Error fetching search suggestions:", err);
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [spinningSearchQuery]);

  const handleLocalSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spinningSearchQuery.trim()) return;

    setActiveTab("search");
    setIsSearching(true);
    try {
      const response = await fetch(`${API_BASE}/api/youtube/search?query=${encodeURIComponent(spinningSearchQuery.trim())}`);
      const resData = await response.json();
      if (resData.success && resData.data && resData.data.results) {
        const mapped = resData.data.results;
        setSpinningSearchResults(mapped);
      } else {
        setSpinningSearchResults([]);
      }
    } catch (e) {
      console.error("Local search error in now spinning", e);
      setSpinningSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-4 p-4 md:p-6 font-mono overflow-y-auto">
      {/* Top Header details */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border-tan pb-3 gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1">
          <div>
            <span className="text-[10px] text-primary font-bold tracking-widest block">DECK_OUT_V_02</span>
            <h2 className="text-sm md:text-lg font-bold text-text-charcoal flex items-center gap-2">
              NOW SPINNING <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            </h2>
          </div>

          {/* Convenient Search Bar next to heading */}
          <div ref={searchContainerRef} className="relative max-w-xs w-full flex-grow">
            <form onSubmit={handleLocalSearchSubmit} className="relative w-full">
              <input 
                type="text" 
                placeholder="Search songs to queue..." 
                value={spinningSearchQuery}
                onChange={(e) => setSpinningSearchQuery(e.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                className="w-full bg-surface border border-border-tan py-1.5 pl-8 pr-16 rounded text-[11px] text-text-charcoal focus:outline-none focus:border-primary font-bold"
              />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <button 
                type="submit"
                aria-label="Search"
                className="absolute right-1 top-1/2 -translate-y-1/2 bg-primary text-white text-xs font-black min-h-[24px] px-2 py-1 rounded hover:bg-opacity-90 cursor-pointer"
              >
                SEARCH
              </button>
            </form>

            {/* Suggestions Autocomplete Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-[100] mt-1.5 bg-[#FAF3E0] border-2 border-[#1A1A1A] rounded brutalist-shadow-thick max-h-60 overflow-y-auto font-mono text-text-charcoal flex flex-col animate-fadeIn">
                <div className="text-[8px] text-gray-500 font-bold border-b border-border-tan px-2 py-1 bg-surface-container">
                  QUICK SUGGESTIONS (CLICK TO PLAY)
                </div>
                {suggestions.map((track) => (
                  <div
                    key={track.id}
                    onClick={() => {
                      onPlayTrack(track);
                      setShowSuggestions(false);
                      setSpinningSearchQuery("");
                    }}
                    className="flex items-center gap-2 p-2 hover:bg-[#1A1A1A] hover:text-white transition-colors cursor-pointer border-b border-border-tan last:border-b-0 text-[10px]"
                  >
                    <img 
                      src={track.coverUrl} 
                      alt="Cover" 
                      className="w-7 h-7 object-cover rounded border border-border-tan"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold truncate">{track.title}</div>
                      <div className="text-[8px] text-gray-400 truncate">{track.artist}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="text-right text-xs md:text-xs text-gray-700 font-bold flex flex-row md:flex-col justify-between md:justify-start items-center md:items-end gap-1.5">
          <span className="hidden sm:inline">ACTIVE SOURCE: INTERNAL_OSC</span>
          <span className="block text-primary">STATUS: {isPlaying ? "SPINNING" : "STOPPED"}</span>
        </div>
      </div>

      {/* Main Content Splitting */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start min-h-0 pb-4">
        {/* Left 7 Columns: Turntable & Wave visualizers */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <Turntable 
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            togglePlay={togglePlay}
            onNext={onNext}
            onPrev={onPrev}
            isLiked={likedTracks.some((t) => t.id === currentTrack.id)}
            onToggleLike={() => onToggleLike(currentTrack)}
            isRepeat={isRepeat}
            toggleRepeat={toggleRepeat}
            isShuffle={isShuffle}
            toggleShuffle={toggleShuffle}
            onTriggerAddToPlaylist={() => onTriggerAddToPlaylist(currentTrack)}
            activeRoomId={activeRoomId}
          />
        </div>

        {/* Right 5 Columns: Interactive Multi-Tab Console */}
        <div className="lg:col-span-5 bg-[#FAF3E0] border-2 border-[#1A1A1A] p-4 rounded-lg brutalist-shadow flex flex-col gap-4 h-[500px] lg:h-[650px] overflow-hidden">
          {/* Tab Navigation header */}
          <div className="flex border-b-2 border-[#1A1A1A]">
            {(["queue", "liked", "playlist", "search"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 text-[10px] md:text-xs font-black uppercase tracking-wider py-2 border-r last:border-r-0 border-[#1A1A1A] transition-colors cursor-pointer ${
                  activeTab === tab
                    ? "bg-[#1A1A1A] text-white"
                    : "bg-[#fff9ef] text-[#1A1A1A] hover:bg-[#FCF3DE]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* TAB CONTENTS */}
          <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-hidden">
            {activeTab === "queue" && (
              <div className="flex-1 flex flex-col gap-3 min-h-0">
                <div className="flex justify-between items-center text-[10px] font-bold text-gray-500">
                  <span>QUEUE CONTROLS</span>
                  <span>{queue.length} TRACKS LOADED</span>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 scrollbar-hide">
                  {queue.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-border-tan rounded bg-surface text-gray-400 text-xs">
                      QUEUE_EMPTY
                      <span className="block mt-1 text-[10px]">Add songs from other tabs to start a session</span>
                    </div>
                  ) : (
                    queue.map((track, idx) => (
                      <div
                        key={`${track.id}-${idx}`}
                        className="flex items-center justify-between p-2 rounded border border-border-tan bg-surface hover:border-primary transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img 
                            src={track.coverUrl} 
                            alt="Cover" 
                            className="w-9 h-9 object-cover rounded border border-border-tan flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <h4 className="text-xs font-black text-text-charcoal truncate">{track.title}</h4>
                            <p className="text-[9px] text-gray-500 font-bold uppercase truncate">{track.artist}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onPlayTrack(track)}
                            className="p-1 rounded bg-[#fff9ef] border border-border-tan hover:bg-[#1A1A1A] hover:text-white transition-colors cursor-pointer"
                          >
                            <Play className="w-3 h-3 text-primary" />
                          </button>
                          <button
                            onClick={() => onTriggerAddToPlaylist(track)}
                            className="p-1.5 rounded bg-[#fff9ef] border border-border-tan hover:bg-primary hover:text-white transition-colors cursor-pointer"
                            title="Add to playlist"
                          >
                            <ListPlus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => removeFromQueue(idx)}
                            className="p-1 rounded bg-red-50 border border-red-200 text-red-600 hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}

                  {/* Autoplay Flow section */}
                  {autoplayQueue && autoplayQueue.length > 0 && (
                    <div className="flex flex-col gap-2 mt-2 pt-2 border-t-2 border-dashed border-border-tan/40">
                      <div className="flex justify-between items-center text-[9px] font-black text-primary/80 tracking-wider mb-1">
                        <span>UPCOMING FLOW (SAME ARTIST/GENRE)</span>
                        <span>{autoplayQueue.length} SONGS</span>
                      </div>
                      {autoplayQueue.map((track, idx) => (
                        <div
                          key={`autoplay-${track.id}-${idx}`}
                          className="flex items-center justify-between p-2 rounded border border-border-tan bg-surface/50 hover:border-primary hover:bg-surface transition-all opacity-85 hover:opacity-100"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img 
                              src={track.coverUrl} 
                              alt="Cover" 
                              className="w-9 h-9 object-cover rounded border border-border-tan flex-shrink-0 grayscale-[30%] hover:grayscale-0 transition-all"
                            />
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-text-charcoal truncate">{track.title}</h4>
                              <p className="text-[9px] text-gray-400 font-bold uppercase truncate">{track.artist}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => onPlayTrack(track)}
                              className="p-1 rounded bg-[#fff9ef] border border-border-tan hover:bg-[#1A1A1A] hover:text-white transition-colors cursor-pointer"
                            >
                              <Play className="w-3 h-3 text-primary" />
                            </button>
                            <button
                              onClick={() => onAddToQueue(track)}
                              className="p-1.5 rounded bg-[#fff9ef] border border-border-tan hover:bg-primary hover:text-white transition-colors cursor-pointer text-[9px] font-black leading-none"
                              title="Add to queue"
                            >
                              + QUEUE
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "liked" && (
              <div className="flex-1 flex flex-col gap-3 min-h-0">
                <div className="flex justify-between items-center text-[10px] font-bold text-gray-500">
                  <span>LIKED SELECTIONS</span>
                  <span>{likedTracks.length} SONGS</span>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 scrollbar-hide">
                  {likedTracks.length === 0 ? (
                    <div className="text-center py-16 border-2 border-dashed border-border-tan rounded bg-surface text-gray-400 text-xs">
                      NO LIKED SONGS YET
                      <span className="block mt-1 text-[10px]">Like songs on the turntable to see them here</span>
                    </div>
                  ) : (
                    likedTracks.map((track) => (
                      <div
                        key={track.id}
                        className="flex items-center justify-between p-2 rounded border border-border-tan bg-surface hover:border-primary transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img 
                            src={track.coverUrl} 
                            alt="Cover" 
                            className="w-9 h-9 object-cover rounded border border-border-tan flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <h4 className="text-xs font-black text-text-charcoal truncate">{track.title}</h4>
                            <p className="text-[9px] text-gray-500 font-bold uppercase truncate">{track.artist}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onPlayTrack(track)}
                            className="p-1 rounded bg-[#fff9ef] border border-border-tan hover:bg-[#1A1A1A] hover:text-white transition-colors cursor-pointer"
                            title="Play song"
                          >
                            <Play className="w-3 h-3 text-primary" />
                          </button>
                          <button
                            onClick={() => onAddToQueue(track)}
                            className="p-1 rounded bg-[#fff9ef] border border-border-tan hover:bg-primary hover:text-white transition-colors cursor-pointer text-[9px] font-black px-1.5 py-0.5"
                            title="Add to queue"
                          >
                            + Q
                          </button>
                          <button
                            onClick={() => onTriggerAddToPlaylist(track)}
                            className="p-1.5 rounded bg-[#fff9ef] border border-border-tan hover:bg-primary hover:text-white transition-colors cursor-pointer"
                            title="Add to playlist"
                          >
                            <ListPlus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === "playlist" && (
              <div className="flex-1 flex flex-col gap-3 min-h-0">
                <div className="flex justify-between items-center text-[10px] font-bold text-gray-500">
                  <span>PLAYLIST ARCHIVES</span>
                  <span>{playlists.length} PLAYLISTS</span>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 scrollbar-hide">
                  {playlists.length === 0 ? (
                    <div className="text-center py-16 border-2 border-dashed border-border-tan rounded bg-surface text-gray-400 text-xs">
                      NO PLAYLISTS AVAILABLE
                      <span className="block mt-1 text-[10px]">Create playlists in the profile tab</span>
                    </div>
                  ) : (
                    playlists.map((pl) => (
                      <div
                        key={pl.id}
                        className="p-2.5 rounded border border-border-tan bg-surface flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <img 
                              src={pl.coverUrl} 
                              alt="Cover" 
                              className="w-8 h-8 object-cover rounded border border-border-tan"
                            />
                            <div>
                              <h4 className="text-xs font-black text-text-charcoal uppercase leading-none">{pl.name}</h4>
                              <span className="text-[8px] text-gray-400 font-bold block mt-1">{pl.tracks?.length || 0} TRACKS</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {pl.tracks && pl.tracks.length > 0 && (
                              <button
                                onClick={() => onPlayPlaylist(pl)}
                                className="p-1 rounded bg-[#fff9ef] border border-border-tan hover:bg-[#1A1A1A] hover:text-white transition-colors cursor-pointer"
                                title="Play Playlist"
                              >
                                <Play className="w-2.5 h-2.5 text-primary" />
                              </button>
                            )}
                            <button
                              onClick={() => togglePlaylistExpanded(pl.id)}
                              className="bg-[#fff9ef] border border-border-tan px-2 py-0.5 rounded text-[8px] font-bold text-text-charcoal hover:bg-gray-100 cursor-pointer"
                            >
                              {expandedPlaylists[pl.id] ? "HIDE SONGS ▲" : "SHOW SONGS ▼"}
                            </button>
                          </div>
                        </div>
                        {expandedPlaylists[pl.id] && pl.tracks && pl.tracks.length > 0 && (
                          <div className="flex flex-col gap-1 border-t border-border-tan pt-1.5 mt-1 animate-fadeIn">
                            {pl.tracks.map((track: Track) => (
                              <div key={track.id} className="flex justify-between items-center text-[9px] text-gray-600 font-bold py-0.5 hover:text-primary cursor-pointer" onClick={() => onPlayTrack(track)}>
                                <span className="truncate max-w-[180px]">{track.title} - {track.artist}</span>
                                <span className="text-[8px] text-gray-400">{track.duration}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === "search" && (
              <div className="flex-1 flex flex-col gap-3 min-h-0">
                {/* Local search results list */}
                <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 scrollbar-hide">
                  {isSearching ? (
                    <div className="text-center py-12 text-[10px] text-gray-400 animate-pulse">
                      Searching music archive...
                    </div>
                  ) : spinningSearchResults.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-[10px] border border-dashed border-border-tan rounded p-4 bg-surface">
                      {spinningSearchQuery.trim() ? "No matching records found" : "Enter a search term in the search bar next to the header"}
                    </div>
                  ) : (
                    spinningSearchResults.map((track) => (
                      <div
                        key={track.id}
                        className="flex items-center justify-between p-2 rounded border border-border-tan bg-surface hover:border-primary transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img 
                            src={track.coverUrl} 
                            alt="Cover" 
                            className="w-9 h-9 object-cover rounded border border-border-tan flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <h4 className="text-xs font-black text-text-charcoal truncate">{track.title}</h4>
                            <p className="text-[9px] text-gray-500 font-bold uppercase truncate">{track.artist}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onPlayTrack(track)}
                            className="p-1 rounded bg-[#fff9ef] border border-border-tan hover:bg-[#1A1A1A] hover:text-white transition-colors cursor-pointer"
                            title="Play song"
                          >
                            <Play className="w-3 h-3 text-primary" />
                          </button>
                          <button
                            onClick={() => onAddToQueue(track)}
                            className="p-1 rounded bg-[#fff9ef] border border-border-tan hover:bg-primary hover:text-white transition-colors cursor-pointer text-[9px] font-black px-1.5 py-0.5"
                            title="Add to queue"
                          >
                            + Q
                          </button>
                          <button
                            onClick={() => onTriggerAddToPlaylist(track)}
                            className="p-1 rounded bg-[#fff9ef] border border-border-tan hover:bg-primary hover:text-white transition-colors cursor-pointer text-[9px] font-black px-1.5 py-0.5"
                            title="Add to playlist"
                          >
                            + PL
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
