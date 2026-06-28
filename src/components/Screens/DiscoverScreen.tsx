import React, { useState, useEffect, useRef } from "react";
import { Track } from "../../types";
import { POPULAR_ARTISTS } from "../../data";
import { Search, Compass, Play, Plus, Sparkles, TrendingUp, ListPlus } from "lucide-react";

interface DiscoverScreenProps {
  allTracks: Track[];
  trendingAlbums: any[];
  onPlayTrack: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onSelectGenre: (genre: string) => void;
  onSearch: (query: string) => void;
  onOpenAlbum: (albumId: string) => void;
  onTriggerAddToPlaylist: (track: Track) => void;
}

export const DiscoverScreen: React.FC<DiscoverScreenProps> = ({
  allTracks,
  trendingAlbums,
  onPlayTrack,
  onAddToQueue,
  onSelectGenre,
  onSearch,
  onOpenAlbum,
  onTriggerAddToPlaylist
}) => {
  const [searchVal, setSearchVal] = useState<string>("");
  const [suggestions, setSuggestions] = useState<Track[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchVal.trim()) {
      setShowSuggestions(false);
      onSearch(searchVal.trim());
    }
  };

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch debounced search suggestions
  useEffect(() => {
    if (searchVal.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      try {
        const response = await fetch(`/api/youtube/search?query=${encodeURIComponent(searchVal.trim())}`);
        const resData = await response.json();
        if (resData.success && resData.data && resData.data.results) {
          const mapped = resData.data.results;
          setSuggestions(mapped);
          setShowSuggestions(true);
        }
      } catch (e) {
        console.error("Suggestions fetch error", e);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchVal]);

  // Find ANALOG WAVES track to use for the hero slot
  const heroTrack = allTracks.find(t => t.id === "track-5") || allTracks[0];

  return (
    <div className="flex-1 flex flex-col gap-4 p-4 md:p-6 font-mono lg:overflow-hidden min-h-0">
      {/* Search Header Input bar */}
      <div className="relative w-full" ref={containerRef}>
        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <input 
            type="text"
            placeholder="SEARCH MUSIC CATALOG (e.g., 'Analog', 'Jazz', 'Ambient')..."
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            className="w-full bg-surface border-2 border-border-tan py-3 pl-11 pr-4 rounded text-xs text-text-charcoal placeholder-gray-400 focus:outline-none focus:border-primary font-mono brutalist-shadow"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <button 
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-primary text-white text-[10px] font-bold px-3 py-1.5 rounded hover:bg-opacity-90"
          >
            EXECUTE
          </button>
        </form>

        {/* Autocomplete Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-[#FAF3E0] border-2 border-[#1A1A1A] rounded-lg p-2 brutalist-shadow z-50 flex flex-col gap-1.5 max-h-64 overflow-y-auto">
            {suggestions.map((song) => (
              <div 
                key={song.id}
                className="flex items-center justify-between p-2 hover:bg-[#FCF3DE] border border-transparent hover:border-border-tan rounded transition-all cursor-pointer"
                onClick={() => {
                  setSearchVal(song.title);
                  setShowSuggestions(false);
                  onSearch(song.title);
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img 
                    src={song.coverUrl} 
                    alt="Cover" 
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded border border-border-tan object-cover flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <h5 className="text-[11px] font-black text-text-charcoal truncate">{song.title}</h5>
                    <p className="text-[9px] text-gray-500 font-bold uppercase truncate">{song.artist}</p>
                  </div>
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSuggestions(false);
                    onPlayTrack(song);
                  }}
                  className="bg-primary hover:bg-opacity-90 text-white text-[8px] font-black px-2 py-1 rounded flex items-center gap-1 cursor-pointer"
                >
                  <Play className="w-2.5 h-2.5 fill-white" />
                  <span>PLAY</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-b border-border-tan pb-1.5 flex-shrink-0">
        <h2 className="text-base font-bold text-text-charcoal flex items-center gap-1.5">
          <Compass className="w-5 h-5 text-primary" />
          DISCOVER_ARCHIVES
        </h2>
        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">WAVE_SELECTOR_V_03</span>
      </div>

      {/* Main Column Breakdown */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch min-h-0 overflow-y-auto lg:overflow-hidden pb-4">
        {/* Left 8 Columns */}
        <div className="lg:col-span-8 flex flex-col gap-6 lg:h-full lg:overflow-y-auto pr-1 scrollbar-hide pb-4">
          
          {/* Hero playlist of the week card */}
          <div className="relative bg-[#FAF3E0] border border-border-tan rounded-lg p-5 flex flex-col md:flex-row gap-5 items-center brutalist-shadow">
            {/* Corner Badge */}
            <span className="absolute -top-2.5 left-4 bg-primary text-white text-[8px] font-bold px-2 py-0.5 border border-border-tan rounded animate-bounce">
              PLAYLIST_OF_THE_WEEK
            </span>

            {/* Album Visual */}
            <div className="w-32 h-32 rounded-sm border border-border-tan overflow-hidden relative shadow-md flex-shrink-0">
              <img 
                src={heroTrack.coverUrl} 
                alt="Hero Cover" 
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/10 hover:bg-transparent transition-all" />
            </div>

            {/* Description Details */}
            <div className="flex-1 flex flex-col gap-2">
              <span className="text-[9px] text-[#C8B89A] font-bold tracking-widest uppercase">
                VOL. IV // SELECTIONS
              </span>
              <h3 className="text-base font-bold text-text-charcoal tracking-wide leading-none">
                {heroTrack.title}
              </h3>
              <p className="text-[10px] text-gray-600 font-medium leading-relaxed">
                An archival selection of original 12-inch cassettes and direct-drive analog master recordings. 
                Sourced from underground Tokyo stations and late 70s electronic research units.
              </p>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 mt-2">
                <button 
                  onClick={() => onPlayTrack(heroTrack)}
                  className="bg-primary text-white border border-primary px-4 py-2 rounded text-xs font-bold flex items-center gap-1.5 shadow hover:bg-opacity-90 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>PLAY NOW</span>
                </button>
                <button 
                  onClick={() => onAddToQueue(heroTrack)}
                  className="bg-surface border border-border-tan hover:bg-surface-container transition-colors px-4 py-2 rounded text-xs font-bold flex items-center gap-1.5 text-text-charcoal cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>ADD TO QUEUE</span>
                </button>
              </div>
            </div>
          </div>

          {/* Trending Albums Section */}
          {trendingAlbums && trendingAlbums.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-text-charcoal uppercase tracking-widest">
                  TRENDING_ALBUMS
                </h3>
                <span className="text-[9px] text-gray-400 font-bold">CLICK_TO_EXPLORE</span>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                {trendingAlbums.map((album) => (
                  <div 
                    key={album.id}
                    onClick={() => onOpenAlbum(album.id)}
                    className="group w-40 flex-shrink-0 bg-surface border border-border-tan p-3 rounded hover:border-primary transition-all cursor-pointer brutalist-shadow"
                  >
                    {/* CD Jewel Case visual */}
                    <div className="relative w-full h-32 bg-black rounded border border-gray-400 overflow-hidden jewel-case mb-2 flex items-center justify-center">
                      <img 
                        src={album.coverUrl} 
                        alt="Cover" 
                        referrerPolicy="no-referrer"
                        className="w-28 h-28 object-cover rounded-xs"
                      />
                      <div className="absolute w-10 h-10 rounded-full bg-surface-container/60 cd-inner-ring border border-gray-400 flex items-center justify-center">
                        <div className="w-3 h-3 rounded-full bg-gray-600" />
                      </div>
                    </div>

                    <h4 className="text-[10px] font-bold text-text-charcoal truncate group-hover:text-primary transition-colors">
                      {album.title}
                    </h4>
                    <p className="text-[8px] text-gray-500 truncate uppercase mt-0.5 tracking-tighter">
                      {album.artist}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Releases Section */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-text-charcoal uppercase tracking-widest">
                NEW_RELEASES
              </h3>
              <span className="text-[9px] text-gray-400 font-bold">HORIZONTAL_INDEX_SCROLL</span>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {allTracks.slice(0, 5).map((track) => (
                <div 
                  key={track.id}
                  onClick={() => onPlayTrack(track)}
                  className="group w-40 flex-shrink-0 bg-surface border border-border-tan p-3 rounded hover:border-primary transition-all cursor-pointer brutalist-shadow"
                >
                  {/* CD Jewel Case visual */}
                  <div className="relative w-full h-32 bg-black rounded border border-gray-400 overflow-hidden jewel-case mb-2 flex items-center justify-center">
                    <img 
                      src={track.coverUrl} 
                      alt="Cover" 
                      referrerPolicy="no-referrer"
                      className="w-28 h-28 object-cover rounded-xs"
                    />
                    <div className="absolute w-10 h-10 rounded-full bg-surface-container/60 cd-inner-ring border border-gray-400 flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-gray-600" />
                    </div>

                    {/* Direct Play Hover Overlay */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayTrack(track);
                      }}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-[10px] font-bold"
                    >
                      <Play className="w-4 h-4 fill-white text-white" />
                      <span>SPIN LP</span>
                    </button>
                  </div>

                  <h4 className="text-[10px] font-bold text-text-charcoal truncate group-hover:text-primary transition-colors">
                    {track.title}
                  </h4>
                  <p className="text-[8px] text-gray-500 truncate uppercase mt-0.5 tracking-tighter">
                    {track.artist}
                  </p>

                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[7px] text-primary font-bold border border-primary/20 px-1 py-0.2 rounded inline-block">
                      {track.genre}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); onTriggerAddToPlaylist(track); }}
                        className="p-1 rounded bg-[#FAF3E0] border border-border-tan hover:bg-primary hover:text-white transition-colors cursor-pointer"
                        title="Add to Playlist"
                      >
                        <ListPlus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onAddToQueue(track); }}
                        className="p-1 rounded bg-[#FAF3E0] border border-border-tan hover:bg-text-charcoal hover:text-white transition-colors cursor-pointer"
                        title="Add to Queue"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 4 Columns */}
        <div className="lg:col-span-4 flex flex-col gap-5 bg-[#FAF3E0] border border-border-tan p-4 rounded-lg brutalist-shadow lg:h-full lg:overflow-y-auto scrollbar-hide pb-4">
          
          {/* Genre tags exploration */}
          <div className="flex flex-col gap-2">
            <span className="text-[9px] text-gray-400 font-bold tracking-widest block uppercase">
              GENRE_EXPLORATION
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { name: "SYNTHWAVE", color: "hover:bg-red-500" },
                { name: "CLASSIC", color: "hover:bg-amber-600" },
                { name: "AMBIENT", color: "hover:bg-blue-600" },
                { name: "90S_RETRO", color: "hover:bg-purple-600" },
                { name: "INSTRUMENTAL", color: "hover:bg-green-600" },
                { name: "NEW_WAVE", color: "hover:bg-yellow-600" }
              ].map((g) => (
                <button
                  key={g.name}
                  onClick={() => onSelectGenre(g.name)}
                  className={`text-[9px] font-bold bg-surface border border-border-tan px-2 py-1 rounded hover:text-white transition-colors cursor-pointer ${g.color}`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          {/* Popular Artists */}
          <div className="flex flex-col gap-3">
            <span className="text-[9px] text-gray-400 font-bold tracking-widest block uppercase">
              POPULAR_ARTISTS
            </span>
            <div className="flex flex-col gap-3">
              {POPULAR_ARTISTS.map((art, idx) => (
                <div 
                  key={idx}
                  onClick={() => onSearch(art.name)}
                  className="flex items-center gap-3 p-1.5 rounded border border-transparent hover:bg-surface-container hover:border-border-tan cursor-pointer transition-colors"
                >
                  <img 
                    src={art.avatarUrl} 
                    alt="Artist Profile" 
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 object-cover rounded-full border border-border-tan shadow-sm"
                  />
                  <div className="flex-1 min-w-0">
                    <h5 className="text-[10px] font-bold text-text-charcoal leading-none">{art.name}</h5>
                    <span className="text-[8px] text-gray-500 block truncate mt-1">{art.listeners}</span>
                  </div>
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                </div>
              ))}
            </div>
          </div>

          {/* Trending tags */}
          <div className="flex flex-col gap-2">
            <span className="text-[9px] text-gray-400 font-bold tracking-widest block uppercase">
              TRENDING_SEARCHES
            </span>
            <div className="flex flex-col gap-1 text-[10px] font-bold text-primary underline">
              <span onClick={() => onSearch("Tokyo")} className="cursor-pointer hover:text-opacity-80">#rare_groove_tokyo</span>
              <span onClick={() => onSearch("Ambient")} className="cursor-pointer hover:text-opacity-80">#brutalist_ambient</span>
              <span onClick={() => onSearch("Synthwave")} className="cursor-pointer hover:text-opacity-80">#tape_hiss_lofi</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
