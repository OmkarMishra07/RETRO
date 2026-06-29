import React, { useState } from "react";
import { Track } from "../../types";
import { ListMusic, Play, Plus, Trash2, Disc, ArrowLeft, ArrowUpDown } from "lucide-react";

interface PlaylistScreenProps {
  playlists: any[];
  onPlayTrack: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onPlayPlaylist: (playlist: any) => void;
  onTriggerAddToPlaylist: (track: Track) => void;
  user: any;
  onCreatePlaylist: (name: string) => void;
}

export const PlaylistScreen: React.FC<PlaylistScreenProps> = ({
  playlists,
  onPlayTrack,
  onAddToQueue,
  onPlayPlaylist,
  onTriggerAddToPlaylist,
  user,
  onCreatePlaylist
}) => {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState<string>("");
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);

  const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    onCreatePlaylist(newPlaylistName.trim());
    setNewPlaylistName("");
    setShowCreateForm(false);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-6 p-6 font-mono overflow-y-auto scrollbar-hide">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-tan pb-3">
        <div className="flex items-center gap-3">
          {selectedPlaylistId && (
            <button 
              onClick={() => setSelectedPlaylistId(null)}
              aria-label="Back to playlists list"
              className="bg-surface border border-border-tan hover:bg-surface-container-high transition-colors p-1.5 rounded cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-gray-500" />
            </button>
          )}
          <div>
            <span className="text-[10px] text-primary font-bold tracking-widest block">ARCHIVAL_REGISTRY</span>
            <h2 className="text-lg font-bold text-text-charcoal flex items-center gap-2">
              PLAYLIST ARCHIVES <ListMusic className="w-5 h-5 text-primary animate-pulse" />
            </h2>
          </div>
        </div>
        <div className="flex gap-2">
          {!showCreateForm ? (
            <button 
              onClick={() => setShowCreateForm(true)}
              className="bg-primary text-white border border-primary text-[10px] font-bold px-3 py-1.5 rounded hover:bg-opacity-95 shadow cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>NEW PLAYLIST</span>
            </button>
          ) : (
            <button 
              onClick={() => setShowCreateForm(false)}
              className="bg-surface border border-border-tan text-[10px] font-bold px-3 py-1.5 rounded text-text-charcoal hover:bg-gray-100 cursor-pointer"
            >
              CANCEL
            </button>
          )}
        </div>
      </div>

      {/* Create New Playlist Inline Form */}
      {showCreateForm && (
        <form onSubmit={handleCreateSubmit} className="bg-[#FAF3E0] border-2 border-[#1A1A1A] p-4 rounded-lg brutalist-shadow-thick flex flex-col gap-3 max-w-md animate-fadeIn">
          <span className="text-[9px] text-[#ff6b00] font-bold block uppercase tracking-widest">
            CREATE_STATION_PLAYLIST
          </span>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="ENTER PLAYLIST NAME..."
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              className="flex-1 bg-surface border border-border-tan text-xs px-2.5 py-2 rounded focus:outline-none focus:border-primary text-text-charcoal font-bold"
              required
            />
            <button 
              type="submit"
              className="bg-primary hover:bg-opacity-95 text-white text-xs font-black px-4 rounded transition-all cursor-pointer uppercase"
            >
              CREATE
            </button>
          </div>
        </form>
      )}

      {/* Main Content Layout */}
      {!selectedPlaylistId ? (
        // Grid View of Playlist Albums
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-border-tan pb-1">
            <span>INDEXED PLAYLIST ALBUMS</span>
            <span>{playlists.length} RECORDS</span>
          </div>

          {playlists.length === 0 ? (
            <div className="text-center py-24 border border-dashed border-border-tan bg-surface rounded-lg flex flex-col items-center justify-center gap-3">
              <ListMusic className="w-8 h-8 text-gray-300" />
              <h3 className="text-xs font-bold text-text-charcoal uppercase">NO PLAYLISTS REGISTERED</h3>
              <p className="text-[10px] text-gray-400 max-w-xs leading-normal text-center">
                Add songs to playlists by clicking "+ PL" on any track card, or launch a new blank playlist registry above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {playlists.map((pl) => (
                <div 
                  key={pl.id}
                  onClick={() => setSelectedPlaylistId(pl.id)}
                  className="group bg-surface border border-border-tan p-3 rounded hover:border-primary transition-all cursor-pointer brutalist-shadow flex flex-col"
                >
                  {/* CD Jewel Case Cover */}
                  <div className="relative w-full aspect-square bg-black rounded border border-gray-400 overflow-hidden jewel-case mb-3 flex items-center justify-center">
                    <img 
                      src={pl.coverUrl || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=250&q=75"} 
                      alt={pl.name} 
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 w-full h-full object-cover rounded-xs"
                    />
                    <div className="absolute w-12 h-12 rounded-full bg-surface-container/60 cd-inner-ring border border-gray-400 flex items-center justify-center">
                      <div className="w-3.5 h-3.5 rounded-full bg-gray-600" />
                    </div>

                    {/* Direct Play Hover Overlay */}
                    <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 text-white">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlayPlaylist(pl);
                        }}
                        disabled={!pl.tracks || pl.tracks.length === 0}
                        className="bg-primary hover:bg-opacity-90 text-white text-[9px] font-bold px-3 py-1 rounded border border-primary flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Play className="w-3 h-3 fill-white" />
                        <span>PLAY ALL</span>
                      </button>
                    </div>
                  </div>

                  <h3 className="text-[11px] font-black text-text-charcoal truncate group-hover:text-primary transition-colors leading-tight uppercase">
                    {pl.name}
                  </h3>
                  <p className="text-[8px] text-gray-400 uppercase mt-1 tracking-widest leading-none font-bold">
                    {pl.tracks?.length || 0} TRACKS
                  </p>

                  {/* play all floating helper icon */}
                  {pl.tracks && pl.tracks.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayPlaylist(pl);
                      }}
                      className="mt-2.5 self-start bg-primary text-white text-[8px] font-black px-2 py-1 rounded border border-primary hover:bg-opacity-95 flex items-center gap-1"
                    >
                      <Play className="w-2.5 h-2.5 fill-white" />
                      <span>PLAY</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Detailed Expanded Playlist View
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fadeIn">
          {/* Left Column (4 units): Playlist Info Album Card */}
          <div className="lg:col-span-4 bg-[#FAF3E0] border-2 border-[#1A1A1A] p-4 rounded-lg brutalist-shadow flex flex-col gap-4">
            <div className="relative w-full aspect-square bg-black rounded border border-gray-400 overflow-hidden jewel-case flex items-center justify-center">
              <img 
                src={selectedPlaylist.coverUrl || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=300&q=75"} 
                alt={selectedPlaylist.name} 
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover rounded-xs"
              />
              <div className="absolute w-16 h-16 rounded-full bg-surface-container/60 cd-inner-ring border border-gray-400 flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-gray-600" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[9px] text-[#C8B89A] font-bold tracking-widest block uppercase">PLAYLIST_CONTAINER</span>
              <h3 className="text-sm font-black text-text-charcoal uppercase leading-none">{selectedPlaylist.name}</h3>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                REGISTRY ID: {selectedPlaylist.id}
              </p>
              
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => onPlayPlaylist(selectedPlaylist)}
                  disabled={!selectedPlaylist.tracks || selectedPlaylist.tracks.length === 0}
                  className="flex-1 bg-primary text-white border border-primary py-2 rounded text-[10px] font-black tracking-widest flex items-center justify-center gap-1 hover:bg-opacity-95 shadow cursor-pointer disabled:opacity-50 uppercase"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>PLAY ALL SONGS</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column (8 units): Songs List */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-border-tan pb-1">
              <span>SONGS INDEXED ({selectedPlaylist.tracks?.length || 0})</span>
              <span>PLAYBACK CONTROLS</span>
            </div>

            <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {!selectedPlaylist.tracks || selectedPlaylist.tracks.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-border-tan rounded bg-surface text-gray-400 text-xs">
                  PLAYLIST IS EMPTY
                  <span className="block mt-1 text-[9px] font-bold">Find songs to add using search or discover terminals</span>
                </div>
              ) : (
                selectedPlaylist.tracks.map((track: Track, idx: number) => (
                  <div
                    key={track.id}
                    onClick={() => onPlayTrack(track)}
                    className="flex items-center justify-between p-3 rounded border border-border-tan bg-surface hover:border-primary transition-all brutalist-shadow cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-black text-gray-400 w-5 text-right">{idx + 1}.</span>
                      <img 
                        src={track.coverUrl} 
                        alt="Cover" 
                        className="w-10 h-10 object-cover rounded border border-border-tan flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-text-charcoal truncate group-hover:text-primary transition-colors">{track.title}</h4>
                        <p className="text-[9px] text-gray-500 font-bold uppercase truncate">{track.artist}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-[10px] text-gray-400 font-bold">{track.duration}</span>
                      <div className="flex gap-1.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); onPlayTrack(track); }}
                          className="p-1.5 rounded bg-[#fff9ef] border border-border-tan hover:bg-[#1A1A1A] hover:text-white transition-colors hidden lg:block"
                          title="Spin Song"
                        >
                          <Play className="w-3.5 h-3.5 text-primary hover:text-white" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onAddToQueue(track); }}
                          className="p-1.5 rounded bg-[#fff9ef] border border-border-tan hover:bg-primary hover:text-white transition-colors"
                          title="Add to queue"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onTriggerAddToPlaylist(track); }}
                          className="p-1.5 rounded bg-[#fff9ef] border border-border-tan hover:bg-primary hover:text-white transition-colors"
                          title="Add to another playlist"
                        >
                          <ListMusic className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
