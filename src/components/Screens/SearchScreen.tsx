import React from "react";
import { Track } from "../../types";
import { Search, Play, Plus, ArrowLeft, ListPlus } from "lucide-react";

interface SearchScreenProps {
  query: string;
  results: Track[];
  albumResults: any[];
  onPlayTrack: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onClearSearch: () => void;
  onOpenAlbum: (albumId: string) => void;
  onTriggerAddToPlaylist: (track: Track) => void;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({
  query,
  results,
  albumResults,
  onPlayTrack,
  onAddToQueue,
  onClearSearch,
  onOpenAlbum,
  onTriggerAddToPlaylist
}) => {
  return (
    <div className="flex-1 min-h-0 flex flex-col gap-6 p-6 font-mono overflow-y-auto scrollbar-hide">
      
      {/* Header Breadcrumb */}
      <div className="flex items-center gap-3">
        <button 
          onClick={onClearSearch}
          aria-label="Back to previous screen"
          className="bg-surface border border-border-tan hover:bg-surface-container-high transition-colors p-1.5 rounded cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </button>
        <div>
          <span className="text-[10px] text-gray-400 font-bold block">SEARCH_RESULTS</span>
          <h2 className="text-sm font-bold text-text-charcoal uppercase leading-none">
            INDEXED ENTRIES FOR &apos;{query}&apos;
          </h2>
        </div>
      </div>

      {/* Albums section */}
      {albumResults && albumResults.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-bold text-text-charcoal uppercase tracking-widest border-b border-border-tan pb-1">
            MATCHING ALBUMS
          </h3>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {albumResults.map((album) => (
              <div 
                key={album.id}
                onClick={() => onOpenAlbum(album.id)}
                className="group w-36 flex-shrink-0 bg-surface border border-border-tan p-2.5 rounded hover:border-primary transition-all cursor-pointer brutalist-shadow"
              >
                <div className="relative w-full aspect-square bg-black rounded border border-gray-400 overflow-hidden jewel-case mb-2 flex items-center justify-center">
                  <img 
                    src={album.coverUrl} 
                    alt="Cover" 
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover rounded-xs"
                  />
                  <div className="absolute w-8 h-8 rounded-full bg-surface-container/60 cd-inner-ring border border-gray-400 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-600" />
                  </div>
                </div>
                <h4 className="text-[9px] font-bold text-text-charcoal truncate group-hover:text-primary transition-colors leading-tight">
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

      <div className="flex justify-between items-center border-b border-border-tan pb-2">
        <span className="text-[10px] text-gray-500 font-bold">
          {results.length} MATCHING TRACKS FOUND
        </span>
        <span className="text-[9px] text-[#ff6b00] font-bold">FILTER: MATCH_CONTAINS</span>
      </div>

      {results.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center gap-2">
          <Search className="w-8 h-8 text-gray-300 animate-bounce" />
          <h3 className="text-xs font-bold text-text-charcoal uppercase">NO_RECORDS_MATCH_CRITERIA</h3>
          <p className="text-[10px] text-gray-400 max-w-xs leading-relaxed">
            Verify typing or attempt searching for active tags like &apos;Synthwave&apos;, &apos;Classic&apos;, or artist name &apos;Satoshi&apos;.
          </p>
          <button 
            onClick={onClearSearch}
            className="mt-2 bg-primary text-white text-[10px] font-bold px-4 py-1.5 rounded hover:bg-opacity-90"
          >
            RESET_CATALOG
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {results.map((track) => (
            <div 
              key={track.id}
              onClick={() => onPlayTrack(track)}
              className="group bg-surface border border-border-tan p-3 rounded hover:border-primary transition-all cursor-pointer brutalist-shadow"
            >
              {/* CD Jewel Case visual */}
              <div className="relative w-full aspect-square bg-black rounded border border-gray-400 overflow-hidden jewel-case mb-2 flex items-center justify-center">
                <img 
                  src={track.coverUrl} 
                  alt="Cover" 
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover rounded-xs opacity-90"
                />
                <div className="absolute w-12 h-12 rounded-full bg-surface-container/60 cd-inner-ring border border-gray-400 flex items-center justify-center">
                  <div className="w-3.5 h-3.5 rounded-full bg-gray-600" />
                </div>

                {/* Direct Play Hover Overlay */}
                <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 text-white">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayTrack(track);
                    }}
                    className="bg-primary hover:bg-opacity-90 text-white text-[9px] font-bold px-3 py-1 rounded border border-primary flex items-center gap-1 cursor-pointer w-24 justify-center"
                  >
                    <Play className="w-3 h-3 fill-white" />
                    <span>SPIN NOW</span>
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToQueue(track);
                    }}
                    className="bg-[#1A1A1A] hover:bg-gray-800 text-[#fff9ef] text-[9px] font-bold px-3 py-1 rounded border border-gray-700 flex items-center gap-1 cursor-pointer w-24 justify-center"
                  >
                    <Plus className="w-3 h-3" />
                    <span>QUEUE</span>
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onTriggerAddToPlaylist(track);
                    }}
                    className="bg-white border border-[#1A1A1A] hover:bg-[#FAF3E0] text-[#1A1A1A] text-[9px] font-bold px-3 py-1 rounded flex items-center gap-1 cursor-pointer w-24 justify-center"
                  >
                    <Plus className="w-3 h-3" />
                    <span>PLAYLIST</span>
                  </button>
                </div>
              </div>

              <h3 className="text-[10px] font-bold text-text-charcoal truncate group-hover:text-primary transition-colors leading-tight">
                {track.title}
              </h3>
              <p className="text-[8px] text-gray-500 truncate uppercase mt-0.5 tracking-tighter leading-none">
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
      )}
    </div>
  );
};
