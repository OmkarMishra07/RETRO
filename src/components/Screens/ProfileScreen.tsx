import React, { useState } from "react";
import { UserProfile } from "../../types";
import { TOP_ARTISTS_CIRCLES, HEAVY_ROTATION_CDS, FRIEND_ACTIVITIES } from "../../data";
import { Award, ShieldAlert, Share2, Plus, ArrowUpRight, Zap } from "lucide-react";

interface ProfileScreenProps {
  user: UserProfile | null;
  onShareID: () => void;
  isDarkMode?: boolean;
  toggleTheme?: () => void;
  logout?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  onShareID,
  isDarkMode,
  toggleTheme,
  logout
}) => {
  // Tilt angles for the 3D Membership card
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const box = card.getBoundingClientRect();
    const x = e.clientX - box.left - box.width / 2;
    const y = e.clientY - box.top - box.height / 2;
    
    // Divide to get a soft angle
    setTilt({
      x: -y / 10,
      y: x / 10
    });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 text-center gap-3 font-mono">
        <ShieldAlert className="w-10 h-10 text-primary animate-bounce" />
        <h3 className="text-sm font-bold text-text-charcoal uppercase">SECURE_PROFILE_CONTAINER_LOCKED</h3>
        <p className="text-[10px] text-gray-400 max-w-sm leading-relaxed">
          Accessing collector profiles requires authentication. Please log in using the ACCESS TERMINAL or initialize a new registration passkey.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-6 p-6 font-mono overflow-y-auto scrollbar-hide">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-tan pb-3">
        <div>
          <span className="text-[10px] text-primary font-bold tracking-widest block">SECURE_CARD_VAULT</span>
          <h2 className="text-lg font-bold text-text-charcoal uppercase leading-none">
            COLLECTOR STATS
          </h2>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 font-bold block uppercase">VERIFICATION_OK</span>
          <span className="text-[11px] text-[#ff6b00] font-bold">LEVEL_{user.level}_VERIFIED</span>
        </div>
      </div>

      {/* Main Grid splitting */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: 3D Membership Card, Stats, heavy rotation grids */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* 3D Membership Card container */}
          <div className="perspective-1000">
            <div 
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              style={{
                transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                transition: "transform 0.1s ease-out"
              }}
              className="membership-card p-6 rounded-lg relative overflow-hidden flex flex-col justify-between h-48 max-w-md mx-auto cursor-pointer"
            >
              {/* Card Hologram stripes */}
              <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-[#a04100]/5 to-transparent skew-x-12 pointer-events-none" />

              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1 bg-primary text-white border border-primary text-[8px] font-bold px-2 py-0.5 rounded">
                    <Zap className="w-2.5 h-2.5 animate-pulse" />
                    <span>PREMIUM MEMBER</span>
                  </div>
                  <h3 className="text-base font-bold text-text-charcoal mt-2 tracking-widest leading-none">
                    {user.name}
                  </h3>
                  <span className="text-[9px] text-gray-500 font-bold">{user.idCode}</span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block leading-none">LEVEL</span>
                  <span className="text-3xl font-extrabold text-primary tracking-tighter">
                    {user.level}
                  </span>
                </div>
              </div>

              {/* Bottom Card stamp details */}
              <div className="flex items-end justify-between border-t border-[#C8B89A]/40 pt-4">
                <div className="flex gap-4 text-[8px] text-gray-500 font-bold">
                  <div>
                    <span className="block uppercase text-gray-400">LOCATION</span>
                    <span>{user.location}</span>
                  </div>
                  <div>
                    <span className="block uppercase text-gray-400">MEMBER_SINCE</span>
                    <span>{user.memberSince}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={onShareID}
                    className="bg-surface border border-border-tan hover:bg-surface-container py-1 px-2.5 rounded text-[9px] font-bold text-text-charcoal flex items-center gap-1"
                  >
                    <Share2 className="w-3 h-3" />
                    <span>SHARE ID</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Core Metrics Row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "TOTAL_MINUTES", val: user.minutesCount.toLocaleString() },
              { label: "DISCOVERED_TRACKS", val: user.tracksCount.toLocaleString() },
              { label: "COLLECTION_SIZE", val: `${user.collectionCount} LPs` }
            ].map((stat, idx) => (
              <div 
                key={idx}
                className="bg-surface border border-border-tan p-3 rounded text-center brutalist-shadow"
              >
                <span className="text-[8px] text-gray-500 font-bold block leading-none mb-1">
                  {stat.label}
                </span>
                <span className="text-sm font-bold text-primary">{stat.val}</span>
              </div>
            ))}
          </div>

          {/* Top Artists Circular Mini-Discs */}
          <div>
            <h3 className="text-xs font-bold text-text-charcoal uppercase tracking-widest mb-3">
              TOP_ARTISTS_DISCS
            </h3>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {TOP_ARTISTS_CIRCLES.map((art, idx) => (
                <div key={idx} className="flex flex-col items-center flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-black border-2 border-gray-800 flex items-center justify-center relative overflow-hidden group shadow cursor-pointer">
                    <img 
                      src={art.avatarUrl} 
                      alt={art.name} 
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-full object-cover group-hover:scale-105 transition-transform"
                    />
                    {/* Vinyl Center Hole */}
                    <div className="absolute w-3.5 h-3.5 rounded-full bg-surface-container border border-gray-950 flex items-center justify-center">
                      <div className="w-1 h-1 rounded-full bg-gray-500" />
                    </div>
                  </div>
                  <span className="text-[8px] font-extrabold text-gray-600 mt-1.5 uppercase">
                    {art.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Heavy Rotation CD Rack */}
          <div>
            <h3 className="text-xs font-bold text-text-charcoal uppercase tracking-widest mb-3">
              HEAVY_ROTATION_RACK
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {HEAVY_ROTATION_CDS.map((cd, idx) => (
                <div 
                  key={idx}
                  className="group bg-surface border border-border-tan p-2.5 rounded hover:border-primary transition-all cursor-pointer brutalist-shadow"
                >
                  <div className="relative aspect-square rounded overflow-hidden mb-2 border border-gray-300 jewel-case flex items-center justify-center bg-black">
                    <img 
                      src={cd.coverUrl} 
                      alt={cd.title} 
                      referrerPolicy="no-referrer"
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-11/12 h-11/12 object-cover rounded-xs opacity-95 group-hover:scale-105 transition-all"
                    />
                    <div className="absolute w-6 h-6 rounded-full bg-surface-container/60 cd-inner-ring border border-gray-400 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                    </div>
                  </div>
                  <h4 className="text-[8px] font-bold text-text-charcoal truncate">{cd.title}</h4>
                  <span className="text-[7px] text-gray-400 uppercase tracking-tighter truncate block">
                    {cd.artist}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Genres bars, Friend activity feed */}
        <div className="lg:col-span-4 bg-[#FAF3E0] border border-border-tan p-4 rounded-lg brutalist-shadow flex flex-col gap-5">
          
          {/* Top genres indicators */}
          <div>
            <span className="text-[9px] text-gray-400 font-bold block uppercase mb-3">
              TOP_GENRES_PREFERENCES
            </span>
            <div className="flex flex-col gap-2.5">
              {[
                { name: "SYNTHWAVE", val: "88%" },
                { name: "AMBIENT", val: "72%" },
                { name: "90S_RETRO", val: "45%" },
                { name: "CLASSIC_JAZZ", val: "30%" }
              ].map((g, idx) => (
                <div key={idx} className="flex flex-col gap-1 text-[9px] font-bold">
                  <div className="flex justify-between">
                    <span className="text-text-charcoal">{g.name}</span>
                    <span className="text-primary">{g.val}</span>
                  </div>
                  <div className="w-full bg-gray-200 h-1.5 rounded-sm relative overflow-hidden border border-border-tan">
                    <div 
                      className="h-full bg-primary"
                      style={{ width: g.val }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Friend activity log list */}
          <div>
            <span className="text-[9px] text-gray-400 font-bold block uppercase mb-3">
              FRIEND_ACTIVITY_FEED
            </span>
            <div className="flex flex-col gap-3">
              {FRIEND_ACTIVITIES.map((fr, idx) => (
                <div key={idx} className="flex items-center gap-3 border-b border-[#C8B89A]/30 pb-2.5 last:border-0">
                  <div className="relative">
                    <img 
                      src={fr.avatarUrl} 
                      alt={fr.name} 
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded border border-border-tan object-cover"
                    />
                    {fr.active && (
                      <span className="absolute -bottom-0.5 -right-0.5 bg-green-500 w-2 h-2 rounded-full border border-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="text-[10px] font-bold text-text-charcoal truncate leading-none">
                      {fr.name}
                    </h5>
                    <p className="text-[8px] text-gray-500 block truncate mt-1">
                      {fr.status} <span className="text-primary font-bold">{fr.detail}</span>
                    </p>
                  </div>
                  <span className="text-[7px] text-gray-400 font-bold">{fr.timeAgo}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tips card */}
          <div className="p-3 border border-[#C8B89A] rounded bg-surface">
            <span className="text-[8px] text-gray-400 font-bold block mb-1">COLLECTOR_TIP #28</span>
            <p className="text-[9px] text-gray-500 leading-relaxed">
              Maintain turntable direct-drive quartz locks clean. A 3% pitch fader adjustment can enhance warm tape-hiss lo-fi harmonics on older pressings.
            </p>
          </div>

          {/* Mobile-only Action Bar (Theme + Logout) */}
          <div className="flex flex-col gap-3 md:hidden border-t border-border-tan pt-4 mt-2">
            <h3 className="text-xs font-bold text-text-charcoal uppercase tracking-widest">
              SYSTEM_CONTROLS
            </h3>
            <div className="flex gap-2">
              {toggleTheme && (
                <button 
                  onClick={toggleTheme}
                  className="flex-1 bg-surface border border-border-tan hover:bg-surface-container py-2.5 px-3 rounded text-[10px] font-bold text-text-charcoal flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>THEME: {isDarkMode ? "DARK" : "WARM"}</span>
                </button>
              )}
              {logout && (
                <button 
                  onClick={logout}
                  className="flex-1 bg-[#FFEAEA] border border-red-200 hover:bg-red-100 py-2.5 px-3 rounded text-[10px] font-bold text-red-700 text-center cursor-pointer"
                >
                  LOGOUT
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
