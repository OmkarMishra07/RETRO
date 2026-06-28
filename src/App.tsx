import React, { useState, useEffect, lazy, Suspense } from "react";
import { Screen, Track, UserProfile } from "./types";
import { MOCK_TRACKS, MOCK_PROFILE } from "./data";
import { playSynthTone, stopSynthTone, updateSynthFrequency, getAudioCurrentTime, seekAudio, setAudioLoop, initAudio } from "./utils/audio";
import { toggleLikeTrack, addRecentlyPlayed, joinJamRoom, leaveJamRoom, updateJamRoomTrack, addPlaylist, addTrackToPlaylist, checkRedirectResult, logAnalyticsEvent, auth, onAuthStateChanged, syncUserProfile, signOut, sendJamRoomMessage } from "./firebase";

import { Sidebar } from "./components/Sidebar";
import { PersistentPlayer } from "./components/PersistentPlayer";

// Lazy-loaded Screen Components for Code Splitting (Optimizes initial bundle size, FCP, and LCP)
const LandingPageScreen = lazy(() => import("./components/Screens/LandingPageScreen").then(m => ({ default: m.LandingPageScreen })));
import { NowSpinningScreen } from "./components/Screens/NowSpinningScreen";
const DiscoverScreen = lazy(() => import("./components/Screens/DiscoverScreen").then(m => ({ default: m.DiscoverScreen })));
const SearchScreen = lazy(() => import("./components/Screens/SearchScreen").then(m => ({ default: m.SearchScreen })));
const LikedMusicScreen = lazy(() => import("./components/Screens/LikedMusicScreen").then(m => ({ default: m.LikedMusicScreen })));
const PlaylistScreen = lazy(() => import("./components/Screens/PlaylistScreen").then(m => ({ default: m.PlaylistScreen })));
import { JamTogetherScreen } from "./components/Screens/JamTogetherScreen";
const ProfileScreen = lazy(() => import("./components/Screens/ProfileScreen").then(m => ({ default: m.ProfileScreen })));
const LoginScreen = lazy(() => import("./components/Screens/LoginScreen").then(m => ({ default: m.LoginScreen })));
const RegisterScreen = lazy(() => import("./components/Screens/RegisterScreen").then(m => ({ default: m.RegisterScreen })));

import { Bell, Settings, Menu, Play, Plus, ListMusic, Compass, Radio, Disc, Heart, User } from "lucide-react";
import Cookies from 'js-cookie';

export default function App() {
  // Navigation & Theme
  const [currentScreen, setScreen] = useState<Screen>(Screen.NOW_SPINNING);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return Cookies.get("retro_theme") === "dark";
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  useEffect(() => {
    Cookies.set("retro_theme", isDarkMode ? "dark" : "light", { expires: 365, secure: false, sameSite: 'Lax' });
  }, [isDarkMode]);



  // Authentication State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [recentlyPlayed, setRecentlyPlayed] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [trendingTracks, setTrendingTracks] = useState<Track[]>(MOCK_TRACKS);

  // Master Playback State
  const [currentTrack, setCurrentTrack] = useState<Track>(() => {
    const saved = localStorage.getItem("retro_last_track");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn("Failed to parse last saved track", e);
      }
    }
    return MOCK_TRACKS[0];
  });
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const isInitialPlay = React.useRef(true);

  // We no longer persist isPlaying to localStorage, because browsers block autoplay on refresh anyway.
  const [likedTrackIds, setLikedTrackIds] = useState<string[]>([]);
  const [likedTracks, setLikedTracks] = useState<Track[]>([]);
  const [queue, setQueue] = useState<Track[]>([]);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [isRepeat, setIsRepeat] = useState<boolean>(false);
  const [autoplayQueue, setAutoplayQueue] = useState<Track[]>([]);

  // Search Results State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [albumResults, setAlbumResults] = useState<any[]>([]);
  const [trendingAlbums, setTrendingAlbums] = useState<any[]>([]);
  const [activeAlbumDetails, setActiveAlbumDetails] = useState<any | null>(null);
  const [isAlbumLoading, setIsAlbumLoading] = useState(false);

  // Jam Room Global State
  const [activeRoomId, setActiveRoomId] = useState<string | null>(() => {
    return localStorage.getItem("retro_jam_room_id") || null;
  });
  const [roomInfo, setRoomInfo] = useState<any | null>(null);
  const [activeRoomPasscode, setActiveRoomPasscode] = useState<string | null>(() => {
    return localStorage.getItem("retro_jam_room_passcode") || null;
  });

  useEffect(() => {
    if (activeRoomId) {
      localStorage.setItem("retro_jam_room_id", activeRoomId);
    } else {
      localStorage.removeItem("retro_jam_room_id");
    }
  }, [activeRoomId]);

  useEffect(() => {
    if (activeRoomPasscode) {
      localStorage.setItem("retro_jam_room_passcode", activeRoomPasscode);
    } else {
      localStorage.removeItem("retro_jam_room_passcode");
    }
  }, [activeRoomPasscode]);

  // Playlist State & Handlers
  const [playlistModalTrack, setPlaylistModalTrack] = useState<Track | null>(null);

  // Dynamic SEO Title & Meta Description updates for search engines
  useEffect(() => {
    let title = "Retro - Brutalist Music Player & Live Jam Together Sharing";
    let desc = "Retro is a premium, retro-brutalist music streaming player. Search millions of high-quality tracks, create custom playlists, and stream live jam stations synchronously with your friends.";
    
    switch (currentScreen) {
      case Screen.LANDING:
        title = "Retro - Brutalist Music Player & Live Jam Together Sharing";
        break;
      case Screen.NOW_SPINNING:
        title = `Now Spinning: ${currentTrack ? `${currentTrack.title} - ${currentTrack.artist}` : "Master Console"} | Retro`;
        desc = "View real-time vinyl playback sweeps, visual frequency beeps, scrolling lyrics transcripts, and your manual playback queue.";
        break;
      case Screen.DISCOVER:
        title = "Discover Music Archives & Trending Albums | Retro";
        desc = "Explore rare loops, trending tracks, community selections, and custom music archives by genre.";
        break;
      case Screen.SEARCH:
        title = searchQuery ? `Search Results for "${searchQuery}" | Retro` : "Search Music Catalog | Retro";
        desc = "Index and query high-fidelity songs, artists, and album releases directly from our servers.";
        break;
      case Screen.LIKED_MUSIC:
        title = "Your Liked Collection | Retro";
        desc = "Play and manage your personal saved tracks, retro loops, and vintage sweep frequency ratings.";
        break;
      case Screen.PLAYLIST:
        title = "Your Custom Playlists | Retro";
        desc = "Create, custom-title, and load user-defined audio catalogs and streaming queues.";
        break;
      case Screen.JAM_TOGETHER:
        title = activeRoomId ? `Live Jam Studio: ${roomInfo?.roomName || activeRoomId} | Retro` : "Jam Together Synchronized Stations | Retro";
        desc = "Tune into private streaming vaults, chat live, wave at curators, and sync playback with friends.";
        break;
      case Screen.PROFILE:
        title = `${user ? user.name : "Collector"} Stats & Telemetry | Retro`;
        desc = "Check your listening history stats, curator levels, total playback minutes, and collector credentials.";
        break;
      case Screen.LOGIN:
        title = "Log In to your Console | Retro";
        desc = "Access your verified collector profile, sync liked songs, and launch live jam stations.";
        break;
      case Screen.REGISTER:
        title = "Sign Up for a Collector Account | Retro";
        desc = "Create a new high-fidelity music streaming account and start cataloging your tracks.";
        break;
      default:
        break;
    }
    
    document.title = title;
    
    // Update description meta tag dynamically
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", desc);
    }
  }, [currentScreen, currentTrack, searchQuery, activeRoomId, roomInfo, user]);

  const handleCreatePlaylist = async (name: string, trackToInclude: Track | null = null) => {
    if (!user || !user.uid) return;
    try {
      const tracks = trackToInclude ? [trackToInclude] : [];
      const updatedPlaylists = await addPlaylist(user.uid, name, "", tracks);
      setPlaylists(updatedPlaylists);
      
      // Update local storage session
      const savedSession = localStorage.getItem("retro_user_session");
      if (savedSession) {
        try {
          const userData = JSON.parse(savedSession);
          userData.playlists = updatedPlaylists;
          localStorage.setItem("retro_user_session", JSON.stringify(userData));
        } catch (err) {}
      }
      alert(`Playlist "${name}" created successfully!`);
      if (trackToInclude) {
        setPlaylistModalTrack(null);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to create playlist");
    }
  };

  const handleAddToPlaylist = async (playlistId: string, track: Track) => {
    if (!user || !user.uid) {
      alert("Please log in to add songs to playlists.");
      return;
    }
    try {
      const updatedPlaylists = await addTrackToPlaylist(user.uid, playlistId, track);
      setPlaylists(updatedPlaylists);
      
      // Update local storage session
      const savedSession = localStorage.getItem("retro_user_session");
      if (savedSession) {
        try {
          const userData = JSON.parse(savedSession);
          userData.playlists = updatedPlaylists;
          localStorage.setItem("retro_user_session", JSON.stringify(userData));
        } catch (err) {}
      }
      alert(`"${track.title}" added to playlist!`);
      setPlaylistModalTrack(null); // Close modal
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to add song to playlist.");
    }
  };

  const handlePlayPlaylist = (playlist: any) => {
    if (!playlist || !playlist.tracks || playlist.tracks.length === 0) {
      alert("This playlist has no tracks!");
      return;
    }
    const [firstTrack, ...remainingTracks] = playlist.tracks;
    handlePlayTrack(firstTrack);
    setQueue(remainingTracks);
    alert(`Spinning playlist: "${playlist.name}". Loaded ${remainingTracks.length} tracks into queue.`);
  };

  // Load trending songs from JioSaavn API on mount
  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const response = await fetch("/api/youtube/search?query=trending+music");
        const resData = await response.json();
        if (resData.success && resData.data && resData.data.results) {
          const mapped = resData.data.results;
          setTrendingTracks(mapped);
          const savedLastTrackStr = localStorage.getItem("retro_last_track");
          if (!savedLastTrackStr && mapped.length > 0) {
            setCurrentTrack(mapped[0]);
          }
        }
      } catch (e) {
        console.error("Error loading trending tracks", e);
      }
    };
    const fetchTrendingAlbums = async () => {
      try {
        const response = await fetch("/api/youtube/search?query=latest+music+albums");
        const resData = await response.json();
        if (resData.success && resData.data && resData.data.results) {
          const mapped = resData.data.results;
          setTrendingAlbums(mapped);
        }
      } catch (e) {
        console.error("Error loading trending albums", e);
      }
    };
    fetchTrending();
    fetchTrendingAlbums();
  }, []);

  // Sound Synth Side-Effects
  const handleNextTrackRef = React.useRef<() => void>(() => {});
  const playedHistoryRef = React.useRef<string[]>([]);

  useEffect(() => {
    if (currentTrack && currentTrack.id) {
      playedHistoryRef.current = [
        currentTrack.id,
        ...playedHistoryRef.current.filter(id => id !== currentTrack.id)
      ].slice(0, 10);
    }
  }, [currentTrack]);

  // Analytics tracking for screen changes
  useEffect(() => {
    logAnalyticsEvent("screen_view", { screen_name: currentScreen });
  }, [currentScreen]);

  // Analytics tracking for song playback
  useEffect(() => {
    if (isPlaying && currentTrack) {
      logAnalyticsEvent("play_track", {
        track_id: currentTrack.id,
        track_title: currentTrack.title,
        track_artist: currentTrack.artist,
        track_genre: currentTrack.genre || "UNKNOWN"
      });
    }
  }, [isPlaying, currentTrack]);

  // Removed problematic async playback useEffect. 
  // Playback is now explicitly driven synchronously by user interaction handlers to fix iOS Safari Autoplay blocks.

  useEffect(() => {
    if (isPlaying) {
      updateSynthFrequency(currentTrack.audioUrl);
    }
  }, [currentTrack]);

  // Dynamically prepare 5 upcoming flow tracks when currentTrack changes
  useEffect(() => {
    if (!currentTrack) return;
    let active = true;
    const fetchAutoplay = async () => {
      const tracks = await findFlowTracks(currentTrack, 5);
      if (active) {
        setAutoplayQueue(tracks);
      }
    };
    fetchAutoplay();
    return () => {
      active = false;
    };
  }, [currentTrack]);

  useEffect(() => {
    setAudioLoop(isRepeat);
  }, [isRepeat]);

  // Clean-up on unmount
  useEffect(() => {
    return () => {
      stopSynthTone();
    };
  }, []);

  // Refs for current track and playing state to prevent stale closures in global Firestore listeners
  const currentTrackRef = React.useRef(currentTrack);
  const isPlayingRef = React.useRef(isPlaying);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
    if (currentTrack) {
      localStorage.setItem("retro_last_track", JSON.stringify(currentTrack));
    }
  }, [currentTrack]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Connect and sync with the active Jam room
  useEffect(() => {
    if (!activeRoomId || !user) return;

    let unsubscribeDoc: (() => void) | null = null;

    joinJamRoom(activeRoomId, user, activeRoomPasscode, (updatedRoom) => {
      setRoomInfo(updatedRoom);

      const dbTrack = updatedRoom.currentTrack;
      if (dbTrack) {
        const localTime = getAudioCurrentTime();
        const isDiffTrack = dbTrack.id !== currentTrackRef.current?.id;
        const isDiffPlayState = updatedRoom.isPlaying !== isPlayingRef.current;
        
        // Loop-fix: calculate estimated database progress using lastUpdated timestamp to prevent resets on chat
        const dbLastUpdated = updatedRoom.lastUpdated || Date.now();
        const elapsedSecs = Math.max(0, Math.floor((Date.now() - dbLastUpdated) / 1000));
        const dbEstimatedProgress = updatedRoom.isPlaying ? (updatedRoom.progressSecs + elapsedSecs) : updatedRoom.progressSecs;
        
        const isTimeDrifted = updatedRoom.isPlaying && Math.abs(localTime - dbEstimatedProgress) > 5;

        if (isDiffTrack || isDiffPlayState || isTimeDrifted) {
          // Update local state without writing back to Firestore (skip sync)
          setCurrentTrack(dbTrack);
          setIsPlaying(updatedRoom.isPlaying);
          
          if (updatedRoom.isPlaying) {
            const playPromise = playSynthTone(dbTrack.audioUrl, () => {
              handleNextTrackRef.current();
            });
            if (playPromise) {
              playPromise.catch(() => {
                setIsPlaying(false);
              });
            }
          } else {
            stopSynthTone();
          }
          
          if (isDiffTrack || isTimeDrifted) {
            setTimeout(() => {
              seekAudio(dbEstimatedProgress);
            }, 500);
          }
        }
      }
    }).then((unsub) => {
      unsubscribeDoc = unsub;
    }).catch((e) => {
      console.error("Failed to join Jam room globally", e);
    });

    return () => {
      if (unsubscribeDoc) unsubscribeDoc();
      leaveJamRoom(activeRoomId, user.uid || "guest", user.name);
      setRoomInfo(null);
    };
  }, [activeRoomId, user, activeRoomPasscode]);

  // Host-only periodic playback progress sync (every 8 seconds to prevent db spam)
  useEffect(() => {
    if (!activeRoomId || !roomInfo || roomInfo.hostId !== user?.uid || !isPlaying) return;

    const interval = setInterval(() => {
      updateJamRoomTrack(
        activeRoomId,
        currentTrackRef.current,
        isPlayingRef.current,
        Math.floor(getAudioCurrentTime())
      );
    }, 8000);

    return () => clearInterval(interval);
  }, [activeRoomId, roomInfo, isPlaying, user]);

  // Handle invite links on mount (e.g. ?room=solaris-drift&code=1234)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get("room");
    const urlCode = params.get("code");
    if (urlRoom && user) {
      setActiveRoomId(urlRoom);
      setActiveRoomPasscode(urlCode);
      setScreen(Screen.JAM_TOGETHER);
      // Clean URL params to keep address bar tidy
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [user]);

  // Note: Firestore Jam Room cleanup is now handled efficiently on the backend server via real-time listeners.

  // Restore User Session on mount and listen to Firebase Auth
  useEffect(() => {
    // 1. Fast path: load local cache immediately for instant UI
    const savedSession = localStorage.getItem("retro_user_session");
    if (savedSession) {
      try {
        const userData = JSON.parse(savedSession);
        setUser(userData.profile);
        setLikedTrackIds(userData.likedTrackIds || []);
        setLikedTracks(userData.likedTracks || []);
        setRecentlyPlayed(userData.recentlyPlayed || []);
        setPlaylists(userData.playlists || []);
        setFriends(userData.friends || []);
        if (userData.profile) {
          setScreen(Screen.NOW_SPINNING);
        }
      } catch (e) {
        console.warn("Failed to restore user session cache", e);
      }
    }

    // 2. Reliable path: Subscribe to Firebase Auth to handle fresh logins,
    // cross-device syncing, and proper database fetching.
    if (!auth || !auth.onAuthStateChanged) return;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Fetch the freshest data from Firestore to sync across devices!
          const freshData = await syncUserProfile(
            firebaseUser.uid,
            firebaseUser.displayName || firebaseUser.email || "Curator",
            firebaseUser.email || "",
            firebaseUser.photoURL || undefined
          );
          if (freshData) {
            setUser(freshData.profile);
            setLikedTrackIds(freshData.likedTrackIds || []);
            setLikedTracks(freshData.likedTracks || []);
            setRecentlyPlayed(freshData.recentlyPlayed || []);
            setPlaylists(freshData.playlists || []);
            setFriends(freshData.friends || []);
            localStorage.setItem("retro_user_session", JSON.stringify(freshData));
            setScreen(Screen.NOW_SPINNING);
          }
        } catch (error) {
          console.error("Failed to sync fresh user data from database:", error);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Handle redirect sign-in result (needed for mobile/Capacitor redirect logins)
  useEffect(() => {
    const handleRedirect = async () => {
      try {
        const data = await checkRedirectResult();
        if (data) {
          handleLoginSuccess(data);
        }
      } catch (error) {
        console.error("Redirect login check failed:", error);
      }
    };
    handleRedirect();
  }, []);



  // Auth Callbacks
  const handleLoginSuccess = (userData: any) => {
    setUser(userData.profile);
    setLikedTrackIds(userData.likedTrackIds || []);
    setLikedTracks(userData.likedTracks || []);
    setRecentlyPlayed(userData.recentlyPlayed || []);
    setPlaylists(userData.playlists || []);
    setFriends(userData.friends || []);
    if (userData.recentlyPlayed && userData.recentlyPlayed.length > 0) {
      setCurrentTrack(userData.recentlyPlayed[0]);
    }
    localStorage.setItem("retro_user_session", JSON.stringify(userData));
    setScreen(Screen.NOW_SPINNING);
  };

  const handleRegisterSuccess = (userData: any) => {
    setUser(userData.profile);
    setLikedTrackIds(userData.likedTrackIds || []);
    setLikedTracks(userData.likedTracks || []);
    setRecentlyPlayed(userData.recentlyPlayed || []);
    setPlaylists(userData.playlists || []);
    setFriends(userData.friends || []);
    if (userData.recentlyPlayed && userData.recentlyPlayed.length > 0) {
      setCurrentTrack(userData.recentlyPlayed[0]);
    }
    localStorage.setItem("retro_user_session", JSON.stringify(userData));
    setScreen(Screen.NOW_SPINNING);
  };

  const handleLogout = async () => {
    if (activeRoomId && user) {
      leaveJamRoom(activeRoomId, user.uid || "guest", user.name);
    }
    setActiveRoomId(null);
    setRoomInfo(null);
    setUser(null);
    setLikedTrackIds([]);
    setLikedTracks([]);
    setRecentlyPlayed([]);
    setPlaylists([]);
    setFriends([]);
    setScreen(Screen.LANDING);
    stopSynthTone();
    setIsPlaying(false);
    localStorage.removeItem("retro_user_session");
    
    // Clear Firebase session too
    try {
      if (auth) {
        await signOut(auth);
      }
    } catch (err) {
      console.warn("Failed to sign out from Firebase:", err);
    }
  };

  // Playback Control Handlers
  const handlePlayTrack = async (track: Track, skipFirebaseSync: boolean = false) => {
    initAudio();
    setCurrentTrack(track);
    setIsPlaying(true);
    
    // Explicit synchronous play to bypass Safari Autoplay rules
    const playPromise = playSynthTone(track.audioUrl, () => {
      handleNextTrackRef.current();
    });
    
    // If they explicitly clicked a track, they don't want to resume from an old time!
    isInitialPlay.current = false;
    localStorage.setItem("retro_last_time", "0");
    
    if (playPromise) {
      playPromise.catch(() => {
        console.warn("Autoplay blocked. User gesture might have expired.");
        setIsPlaying(false);
      });
    }
    
    if (activeRoomId && !skipFirebaseSync) {
      updateJamRoomTrack(activeRoomId, track, true, 0);
      if (user) {
        sendJamRoomMessage(activeRoomId, user, `started playing ${track.title}`);
      }
    }
    
    // Save to recently played database
    if (user && user.uid) {
      try {
        const list = await addRecentlyPlayed(user.uid, track);
        setRecentlyPlayed(list);
        
        // Sync locally cached user session
        const savedSession = localStorage.getItem("retro_user_session");
        if (savedSession) {
          try {
            const userData = JSON.parse(savedSession);
            userData.recentlyPlayed = list;
            localStorage.setItem("retro_user_session", JSON.stringify(userData));
          } catch (err) {}
        }
      } catch (e) {
        console.error("Error saving recently played", e);
      }
    }
  };

  const handleTogglePlay = () => {
    initAudio();
    const nextPlaying = !isPlaying;
    setIsPlaying(nextPlaying);
    
    if (nextPlaying && currentTrackRef.current) {
      const playPromise = playSynthTone(currentTrackRef.current.audioUrl, () => {
        handleNextTrackRef.current();
      });
      
      // Auto-resume from previous session if it's the very first play action
      if (isInitialPlay.current) {
        const savedTime = localStorage.getItem("retro_last_time");
        if (savedTime) {
          setTimeout(() => seekAudio(Number(savedTime)), 50);
        }
        isInitialPlay.current = false;
      }
      
      if (playPromise) {
        playPromise.catch(() => {
          setIsPlaying(false);
        });
      }
    } else {
      stopSynthTone();
    }
    
    if (activeRoomId) {
      updateJamRoomTrack(activeRoomId, currentTrackRef.current || currentTrack, nextPlaying, Math.floor(getAudioCurrentTime()));
    }
  };

  const findFlowTracks = async (track: Track, count: number): Promise<Track[]> => {
    // Gather all local candidate tracks
    const allLocalTracks = [
      ...trendingTracks,
      ...likedTracks,
      ...searchResults,
      ...MOCK_TRACKS
    ];
    
    // De-duplicate by id and exclude recently played tracks to avoid loop cycles
    const uniqueTracksMap = new Map<string, Track>();
    const playedHistory = playedHistoryRef.current || [];
    for (const t of allLocalTracks) {
      if (t && t.id && t.id !== track.id && !playedHistory.includes(t.id)) {
        uniqueTracksMap.set(t.id, t);
      }
    }
    const candidates = Array.from(uniqueTracksMap.values());
    
    // Parse target artists (lowercase array)
    const targetArtists = track.artist ? track.artist.split(",").map(a => a.trim().toLowerCase()).filter(Boolean) : [];
    
    let matchedTracks: Track[] = [];

    // 1. Try to find tracks by the same artist first
    if (targetArtists.length > 0) {
      const artistMatches = candidates.filter(t => {
        if (!t.artist) return false;
        const trackArtists = t.artist.split(",").map(a => a.trim().toLowerCase());
        return targetArtists.some(ta => trackArtists.some(tArtist => tArtist.includes(ta) || ta.includes(tArtist)));
      });
      
      // Shuffle matches for variety
      matchedTracks = [...artistMatches].sort(() => Math.random() - 0.5);
    }
    
    // 2. Fetch similar tracks from JioSaavn API using the primary artist's name
    if (matchedTracks.length < count && track.audioUrl && (track.audioUrl.startsWith("http://") || track.audioUrl.startsWith("https://"))) {
      const primaryArtist = targetArtists[0] || track.artist;
      if (primaryArtist) {
        try {
          const response = await fetch(`/api/youtube/search?query=${encodeURIComponent(primaryArtist)}`);
          const resData = await response.json();
          if (resData.success && resData.data && resData.data.results) {
            const mapped = resData.data.results.filter((t: Track) => t.id !== track.id && t.audioUrl && !playedHistory.includes(t.id));
            
            // Append and de-duplicate API results
            for (const t of mapped) {
              if (!matchedTracks.some(mt => mt.id === t.id)) {
                matchedTracks.push(t);
              }
            }
          }
        } catch (apiErr) {
          console.error("Failed to fetch next flow tracks from API", apiErr);
        }
      }
    }

    // 3. Try to find tracks by the same genre next if still not enough
    if (matchedTracks.length < count && track.genre && track.genre !== "UNKNOWN") {
      const genreMatches = candidates.filter(t => t.genre && t.genre.toUpperCase() === track.genre.toUpperCase() && !matchedTracks.some(mt => mt.id === t.id));
      const shuffledGenreMatches = [...genreMatches].sort(() => Math.random() - 0.5);
      matchedTracks = [...matchedTracks, ...shuffledGenreMatches];
    }
    
    // 4. Fallback to trending tracks if still not enough
    if (matchedTracks.length < count) {
      const trendingMatches = trendingTracks.filter(t => t.id !== track.id && !matchedTracks.some(mt => mt.id === t.id));
      matchedTracks = [...matchedTracks, ...trendingMatches];
    }

    return matchedTracks.slice(0, count);
  };

  const handleNextTrack = async () => {
    initAudio();
    if (isRepeat && currentTrackRef.current) {
      seekAudio(0);
      stopSynthTone();
      const playPromise = playSynthTone(currentTrackRef.current.audioUrl, () => {
        handleNextTrackRef.current();
      });
      if (playPromise) {
        playPromise.catch(() => setIsPlaying(false));
      }
      setIsPlaying(true);
      return;
    }

    if (queue.length > 0) {
      const next = queue[0];
      setQueue((prev) => prev.slice(1));
      handlePlayTrack(next);
    } else if (autoplayQueue.length > 0) {
      const next = autoplayQueue[0];
      setAutoplayQueue((prev) => prev.slice(1));
      handlePlayTrack(next);
    } else if (trendingTracks.length > 0) {
      // Fallback fallback
      let nextIndex = trendingTracks.findIndex((t) => t.id === currentTrackRef.current?.id) + 1;
      if (nextIndex >= trendingTracks.length || nextIndex < 0) {
        nextIndex = 0;
      }
      if (trendingTracks.length > 0) {
        handlePlayTrack(trendingTracks[nextIndex]);
      }
    }
  };
  
  useEffect(() => {
    handleNextTrackRef.current = handleNextTrack;
  }, [handleNextTrack]);

  const handlePrevTrack = () => {
    initAudio();
    const currentIndex = trendingTracks.findIndex((t) => t.id === currentTrack.id);
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = trendingTracks.length - 1;
    }
    if (trendingTracks.length > 0 && prevIndex >= 0) {
      handlePlayTrack(trendingTracks[prevIndex]);
    }
  };

  const handleAddToQueue = (track: Track) => {
    setQueue((prev) => [...prev, track]);
    alert(`"${track.title}" ADDED TO QUEUE CONTAINER`);
  };

  const handleRemoveFromQueue = (index: number) => {
    setQueue((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleToggleLike = async (track: Track) => {
    // Optimistic UI update
    setLikedTrackIds((prev) => {
      if (prev.includes(track.id)) {
        return prev.filter((id) => id !== track.id);
      } else {
        return [...prev, track.id];
      }
    });
    setLikedTracks((prev) => {
      if (prev.some((t) => t.id === track.id)) {
        return prev.filter((t) => t.id !== track.id);
      } else {
        return [...prev, track];
      }
    });

    if (user && user.uid) {
      try {
        const result = await toggleLikeTrack(user.uid, track);
        setLikedTrackIds(result.likedTrackIds);
        setLikedTracks(result.likedTracks);
        
        // Sync locally cached user session
        const savedSession = localStorage.getItem("retro_user_session");
        if (savedSession) {
          try {
            const userData = JSON.parse(savedSession);
            userData.likedTrackIds = result.likedTrackIds;
            userData.likedTracks = result.likedTracks;
            localStorage.setItem("retro_user_session", JSON.stringify(userData));
          } catch (err) {}
        }
      } catch (e) {
        console.error("Error saving like", e);
      }
    }
  };

  const handleShuffleAllLiked = () => {
    // Collect liked tracks from trending or recently played or local database if offline
    const allKnownTracks = [...trendingTracks, ...recentlyPlayed, ...searchResults, ...queue];
    // Remove duplicates
    const uniqueKnownTracks = allKnownTracks.filter((t, index, self) => self.findIndex(x => x.id === t.id) === index);
    const liked = uniqueKnownTracks.filter((t) => likedTrackIds.includes(t.id));
    if (liked.length > 0) {
      const shuffled = [...liked].sort(() => Math.random() - 0.5);
      handlePlayTrack(shuffled[0]);
      setQueue(shuffled.slice(1));
    }
  };

  // Searching Catalogs using JioSaavn API
  const handleSearchExecute = async (query: string) => {
    setSearchQuery(query);
    setSearchResults([]);
    setAlbumResults([]);
    try {
      // 1. Songs Search
      const response = await fetch(`/api/youtube/search?query=${encodeURIComponent(query)}`);
      const resData = await response.json();
      if (resData.success && resData.data && resData.data.results) {
        setSearchResults(resData.data.results);
      }

      // 2. Albums Search
      const albResponse = await fetch(`/api/youtube/search?query=${encodeURIComponent(query + ' album')}`);
      const albData = await albResponse.json();
      if (albData.success && albData.data && albData.data.results) {
        setAlbumResults(albData.data.results);
      }
    } catch (e) {
      console.error("Search API error", e);
    }
    setScreen(Screen.SEARCH);
  };

  const handleOpenAlbum = async (albumId: string) => {
    setIsAlbumLoading(true);
    try {
      const response = await fetch(`/api/youtube/search?query=${encodeURIComponent(albumId)}`);
      const resData = await response.json();
      if (resData.success && resData.data && resData.data.results) {
        const mappedSongs = resData.data.results;
        const firstSong = mappedSongs[0] || {};
        
        setActiveAlbumDetails({
          id: albumId,
          name: albumId,
          artist: firstSong.artist || "Various Artists",
          coverUrl: firstSong.coverUrl || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17",
          year: "2024",
          songs: mappedSongs
        });
      }
    } catch (e) {
      console.error("Error opening album", e);
    } finally {
      setIsAlbumLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setScreen(Screen.DISCOVER);
  };

  // Profile triggers
  const handleShareID = () => {
    const urlCode = `m2d://collector/${user?.idCode || "GUEST"}`;
    navigator.clipboard.writeText(urlCode);
    alert(`COLLECTOR SECURITY CODE COPIED TO CLIPBOARD:\n${urlCode}`);
  };

  // Render Public Gatekeeper Flow when user is not logged in
  if (!user) {
    return (
      <div className={`h-screen flex flex-col font-mono relative overflow-hidden transition-colors duration-300 ${
        isDarkMode ? "dark bg-[#121212] text-[#fff9ef]" : "bg-[#fff9ef] text-[#1A1A1A]"
      }`}>
        {/* Public Header */}
        <header className="px-6 py-4 border-b border-border-tan flex items-center justify-between select-none bg-surface z-20">
          <div 
            className="flex items-center cursor-pointer"
            onClick={() => setScreen(Screen.LANDING)}
          >
            <span className="text-sm font-black tracking-widest uppercase animate-retro-glow-red">
              RETRO
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="text-xs font-bold text-gray-500 hover:text-primary transition-colors cursor-pointer"
            >
              {isDarkMode ? "LIGHT_MODE" : "DARK_MODE"}
            </button>
            
            {currentScreen !== Screen.LANDING && (
              <button 
                onClick={() => setScreen(Screen.LANDING)}
                className="text-xs font-bold text-gray-500 hover:text-primary transition-colors cursor-pointer"
              >
                HOME
              </button>
            )}

            {currentScreen !== Screen.LOGIN && (
              <button 
                onClick={() => setScreen(Screen.LOGIN)}
                className="bg-white border border-border-tan hover:bg-surface-container px-3 py-1.5 rounded text-[11px] font-bold text-text-charcoal cursor-pointer"
              >
                LOG IN
              </button>
            )}

            {currentScreen !== Screen.REGISTER && (
              <button 
                onClick={() => setScreen(Screen.REGISTER)}
                className="bg-primary text-white text-[11px] font-bold px-3 py-1.5 rounded hover:bg-opacity-90 cursor-pointer"
              >
                SIGN UP
              </button>
            )}
          </div>
        </header>

        {/* Public Views content wrapper */}
        <div className="flex-1 overflow-hidden relative flex flex-col min-h-0">
          <Suspense fallback={<div className="flex-1 flex items-center justify-center font-mono text-xs text-gray-500 bg-surface">LOADING_TERMINAL...</div>}>
            {(currentScreen === Screen.LANDING || (currentScreen !== Screen.LOGIN && currentScreen !== Screen.REGISTER)) && (
              <LandingPageScreen 
                setScreen={setScreen}
                isLoggedIn={false}
              />
            )}
            {currentScreen === Screen.LOGIN && (
              <LoginScreen 
                onLoginSuccess={handleLoginSuccess}
                onGoToRegister={() => setScreen(Screen.REGISTER)}
              />
            )}
            {currentScreen === Screen.REGISTER && (
              <RegisterScreen 
                onRegisterSuccess={handleRegisterSuccess}
                onGoToLogin={() => setScreen(Screen.LOGIN)}
              />
            )}
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col font-mono relative overflow-hidden transition-colors duration-300 ${
      isDarkMode ? "dark bg-[#121212] text-[#fff9ef]" : "bg-[#fff9ef] text-[#1A1A1A]"
    }`}>
      
      {/* Upper Main workspace layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Drawer rail */}
        <Sidebar 
          currentScreen={currentScreen}
          setScreen={setScreen}
          user={user}
          logout={handleLogout}
          isDarkMode={isDarkMode}
          toggleTheme={() => setIsDarkMode(!isDarkMode)}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Core content viewport */}
        <main className="flex-grow flex flex-col overflow-hidden relative min-w-0">
          
          {/* Global Tiny header telemetry */}
          <div className="px-4 md:px-6 py-2.5 border-b border-border-tan flex items-center justify-between select-none bg-surface">
            <div className="flex items-center gap-2">
              <span className="md:hidden font-black italic tracking-widest text-lg animate-retro-glow-red select-none">RETRO</span>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Notification bell bell */}
              <button 
                onClick={() => alert("Notification log container cleared. No active errors.")}
                className="text-gray-400 hover:text-primary transition-colors cursor-pointer"
                title="System Bulletins"
              >
                <Bell className="w-3.5 h-3.5" />
              </button>

              <button 
                onClick={() => alert("M2D Retro Core Configuration: Web Audio direct-coupling active. High impedance headphones recommended.")}
                className="text-gray-400 hover:text-primary transition-colors cursor-pointer"
                title="Hardware Properties"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Render Views dynamically */}
          <div className="flex-1 overflow-hidden relative flex flex-col min-h-0">
            <div 
              className={currentScreen === Screen.NOW_SPINNING ? "flex-1 flex flex-col relative z-0 min-h-0 overflow-hidden w-full" : "absolute inset-0 pointer-events-none -z-50"}
              style={{ opacity: 1 }}
            >
              <NowSpinningScreen
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                togglePlay={handleTogglePlay}
                allTracks={trendingTracks}
                onPlayTrack={handlePlayTrack}
                onNext={handleNextTrack}
                onPrev={handlePrevTrack}
                queue={queue}
                removeFromQueue={handleRemoveFromQueue}
                likedTracks={likedTracks}
                onToggleLike={handleToggleLike}
                playlists={playlists}
                onAddToQueue={handleAddToQueue}
                onTriggerAddToPlaylist={(track) => setPlaylistModalTrack(track)}
                onPlayPlaylist={handlePlayPlaylist}
                isRepeat={isRepeat}
                toggleRepeat={() => setIsRepeat(!isRepeat)}
                isShuffle={isShuffle}
                toggleShuffle={() => setIsShuffle(!isShuffle)}
                autoplayQueue={autoplayQueue}
                activeRoomId={activeRoomId}
              />
            </div>
            
            <div 
              className={currentScreen === Screen.JAM_TOGETHER ? "flex-1 flex flex-col relative z-0 min-h-0 overflow-hidden w-full" : "absolute inset-0 pointer-events-none -z-50"}
              style={{ opacity: 1 }}
            >
              <JamTogetherScreen 
                onPlayTrack={handlePlayTrack}
                allTracks={trendingTracks}
                user={user}
                currentTrack={currentTrack || MOCK_TRACKS[0]}
                isPlaying={isPlaying}
                setIsPlaying={setIsPlaying}
                setCurrentTrack={setCurrentTrack}
                activeRoomId={activeRoomId}
                setActiveRoomId={setActiveRoomId}
                roomInfo={roomInfo}
                setActiveRoomPasscode={setActiveRoomPasscode}
                onTriggerAddToPlaylist={(track) => setPlaylistModalTrack(track)}
                onTrackEnded={() => handleNextTrackRef.current()}
              />
            </div>

            <Suspense fallback={<div className="flex-1 flex items-center justify-center font-mono text-xs text-gray-500 bg-surface">LOADING_TERMINAL...</div>}>
              {currentScreen === Screen.DISCOVER && (
                <DiscoverScreen 
                  allTracks={trendingTracks}
                  trendingAlbums={trendingAlbums}
                  onPlayTrack={handlePlayTrack}
                  onAddToQueue={handleAddToQueue}
                  onSelectGenre={handleSearchExecute}
                  onSearch={handleSearchExecute}
                  onOpenAlbum={handleOpenAlbum}
                  onTriggerAddToPlaylist={(track) => setPlaylistModalTrack(track)}
                />
              )}
              {currentScreen === Screen.SEARCH && (
                <SearchScreen 
                  query={searchQuery}
                  results={searchResults}
                  albumResults={albumResults}
                  onPlayTrack={handlePlayTrack}
                  onAddToQueue={handleAddToQueue}
                  onClearSearch={handleClearSearch}
                  onOpenAlbum={handleOpenAlbum}
                  onTriggerAddToPlaylist={(track) => setPlaylistModalTrack(track)}
                />
              )}
              {currentScreen === Screen.LIKED_MUSIC && (
                <LikedMusicScreen 
                  likedTrackIds={likedTrackIds}
                  allTracks={likedTracks}
                  onPlayTrack={handlePlayTrack}
                  onShuffleAll={handleShuffleAllLiked}
                  onToggleLike={handleToggleLike}
                  onTriggerAddToPlaylist={(track) => setPlaylistModalTrack(track)}
                />
              )}
              {currentScreen === Screen.PLAYLIST && (
                <PlaylistScreen 
                  playlists={playlists}
                  onPlayTrack={handlePlayTrack}
                  onAddToQueue={handleAddToQueue}
                  onPlayPlaylist={handlePlayPlaylist}
                  onTriggerAddToPlaylist={(track) => setPlaylistModalTrack(track)}
                  user={user}
                  onCreatePlaylist={(name) => handleCreatePlaylist(name)}
                />
              )}
              {currentScreen === Screen.PROFILE && (
                <ProfileScreen 
                  user={user}
                  onShareID={handleShareID}
                  isDarkMode={isDarkMode}
                  toggleTheme={() => setIsDarkMode(!isDarkMode)}
                  logout={handleLogout}
                />
              )}
            </Suspense>
          </div>
        </main>
      </div>

      {/* Persistent Bottom HiFi deck */}
      <PersistentPlayer 
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        togglePlay={handleTogglePlay}
        onNext={handleNextTrack}
        onPrev={handlePrevTrack}
        queue={queue}
        removeFromQueue={handleRemoveFromQueue}
        isShuffle={isShuffle}
        toggleShuffle={() => setIsShuffle(!isShuffle)}
        isRepeat={isRepeat}
        toggleRepeat={() => setIsRepeat(!isRepeat)}
        onRedirectToNowSpinning={() => setScreen(Screen.NOW_SPINNING)}
        autoplayQueue={autoplayQueue}
      />

      {/* Bottom Navigation Bar for Mobile Devices */}
      <nav className="md:hidden w-full bg-surface border-t-2 border-border-tan h-16 flex items-center justify-around font-mono z-40 select-none flex-shrink-0">
        {[
          { screen: Screen.DISCOVER, label: "DISCOVER", icon: Compass },
          { screen: Screen.JAM_TOGETHER, label: "JAM ROOM", icon: Radio, badge: true },
          { screen: Screen.NOW_SPINNING, label: "SPINNING", icon: Disc },
          { screen: Screen.PLAYLIST, label: "PLAYLISTS", icon: ListMusic },
          { screen: Screen.LIKED_MUSIC, label: "LIKED", icon: Heart },
          { screen: Screen.PROFILE, label: "PROFILE", icon: User }
        ].map((item) => {
          const Icon = item.icon;
          const isActive = currentScreen === item.screen;
          return (
            <button
              key={item.screen}
              onClick={() => setScreen(item.screen)}
              className={`flex-1 h-full flex flex-col items-center justify-center gap-1 transition-all cursor-pointer relative ${
                isActive 
                  ? "text-primary dark:text-primary-fixed" 
                  : "text-gray-500 hover:text-text-charcoal"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[8px] font-black tracking-tight">{item.label}</span>
              {item.badge && item.screen === Screen.JAM_TOGETHER && (
                <span className="absolute top-2 right-3 w-1.5 h-1.5 bg-primary rounded-full animate-ping" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Global Album Details Modal */}
      {activeAlbumDetails && (
        <div className="fixed inset-0 bg-black/75 z-[999] flex items-center justify-center p-4 font-mono">
          <div className="w-full max-w-2xl bg-[#FAF3E0] border-2 border-[#1A1A1A] rounded-lg brutalist-shadow-thick p-5 max-h-[90vh] overflow-y-auto flex flex-col gap-4 text-text-charcoal relative">
            <button 
              onClick={() => setActiveAlbumDetails(null)}
              className="absolute top-4 right-4 bg-surface border border-border-tan hover:bg-[#1A1A1A] hover:text-white transition-colors px-2.5 py-1 rounded text-xs font-bold cursor-pointer"
            >
              CLOSE [X]
            </button>

            {/* Album Info Row */}
            <div className="flex flex-col md:flex-row gap-4 items-center border-b border-border-tan pb-4">
              <div className="w-28 h-28 border border-border-tan bg-black rounded overflow-hidden flex-shrink-0 relative shadow-md">
                <img 
                  src={activeAlbumDetails.coverUrl} 
                  alt="Album cover" 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover" 
                />
              </div>
              <div className="flex-1 text-center md:text-left min-w-0">
                <span className="text-[9px] text-[#C8B89A] font-bold block uppercase tracking-widest">ALBUM_FREQUENCY</span>
                <h3 className="text-lg md:text-xl font-black truncate tracking-wide leading-tight">{activeAlbumDetails.name}</h3>
                <p className="text-xs text-gray-500 font-bold uppercase truncate mt-1">BY: {activeAlbumDetails.artist}</p>
                <span className="inline-block bg-primary/10 border border-primary/20 text-primary text-[8px] font-black px-2 py-0.5 rounded mt-2">
                  RELEASE YEAR: {activeAlbumDetails.year} // {activeAlbumDetails.songs?.length || 0} TRACKS
                </span>
              </div>
            </div>

            {/* Album Songs List */}
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[50vh] pr-1 scrollbar-hide">
              {activeAlbumDetails.songs?.map((track: Track, idx: number) => {
                const isCurrent = track.id === currentTrack.id;
                return (
                  <div 
                    key={track.id}
                    className={`flex items-center justify-between p-2.5 rounded border transition-all ${
                      isCurrent
                        ? "bg-[#FCF3DE] border-primary brutalist-shadow"
                        : "bg-surface border-border-tan hover:bg-surface-container"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-black text-gray-400 w-5 text-right">{idx + 1}.</span>
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-text-charcoal truncate">{track.title}</h4>
                        <p className="text-[9px] text-gray-500 font-bold uppercase truncate">{track.artist}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[9px] text-gray-400 font-bold">{track.duration}</span>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => {
                            handlePlayTrack(track);
                          }}
                          className="p-1 rounded bg-[#fff9ef] border border-border-tan hover:bg-[#1A1A1A] hover:text-white transition-colors cursor-pointer"
                          title="Spin Song"
                        >
                          <Play className="w-3.5 h-3.5 text-primary" />
                        </button>
                        <button
                          onClick={() => handleAddToQueue(track)}
                          className="p-1 rounded bg-[#fff9ef] border border-border-tan hover:bg-primary hover:text-white transition-colors cursor-pointer"
                          title="Add to queue"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setPlaylistModalTrack(track)}
                          className="p-1 rounded bg-[#fff9ef] border border-border-tan hover:bg-[#1A1A1A] hover:text-white transition-colors cursor-pointer"
                          title="Add to playlist"
                        >
                          <ListMusic className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Playlist Selector Modal */}
      {playlistModalTrack && (
        <div className="fixed inset-0 bg-black/75 z-[9999] flex items-center justify-center p-4 font-mono text-text-charcoal animate-fadeIn">
          <div className="w-full max-w-md bg-[#FAF3E0] border-2 border-[#1A1A1A] rounded-lg p-5 brutalist-shadow-thick flex flex-col gap-4 relative">
            <button 
              onClick={() => setPlaylistModalTrack(null)}
              className="absolute top-4 right-4 text-xs font-bold text-gray-500 hover:text-black cursor-pointer"
            >
              CLOSE [X]
            </button>
            
            <div>
              <span className="text-[9px] text-primary font-bold block uppercase tracking-widest font-black">ADD_TO_PLAYLIST_COLLECTION</span>
              <h3 className="text-sm font-black uppercase truncate mt-0.5">{playlistModalTrack.title}</h3>
              <p className="text-[9px] text-gray-400 font-bold uppercase truncate">{playlistModalTrack.artist}</p>
            </div>

            <div className="flex flex-col gap-3 max-h-60 overflow-y-auto pr-1">
              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">SELECT ACTIVE PLAYLIST:</span>
              
              {playlists.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-border-tan rounded bg-surface text-gray-400 text-xs">
                  NO ACTIVE PLAYLISTS
                </div>
              ) : (
                playlists.map((pl) => {
                  const isAlreadyAdded = pl.tracks && pl.tracks.some((t: any) => t.id === playlistModalTrack.id);
                  return (
                    <div 
                      key={pl.id}
                      className="flex items-center justify-between p-2 rounded border border-border-tan bg-surface hover:border-primary transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img 
                          src={pl.coverUrl || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=150&q=75"} 
                          alt="Cover" 
                          className="w-9 h-9 object-cover rounded border border-border-tan flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-text-charcoal uppercase truncate">{pl.name}</h4>
                          <span className="text-[8px] text-gray-400 font-bold block">{pl.tracks?.length || 0} TRACKS</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddToPlaylist(pl.id, playlistModalTrack)}
                        disabled={isAlreadyAdded}
                        className={`text-[9px] font-black px-3 py-1.5 rounded border transition-colors cursor-pointer disabled:opacity-50 ${
                          isAlreadyAdded
                            ? "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed"
                            : "bg-[#fff9ef] border-border-tan hover:bg-[#1A1A1A] hover:text-white text-[#1A1A1A]"
                        }`}
                      >
                        {isAlreadyAdded ? "ADDED ✓" : "ADD"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Create Playlist Form on the fly */}
            <div className="border-t border-border-tan pt-3 mt-1 flex flex-col gap-2">
              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">OR CREATE NEW PLAYLIST:</span>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const nameInput = form.elements.namedItem("playlistName") as HTMLInputElement;
                  const name = nameInput.value.trim();
                  if (name) {
                    handleCreatePlaylist(name, playlistModalTrack);
                    nameInput.value = "";
                  }
                }}
                className="flex gap-2"
              >
                <input 
                  type="text"
                  name="playlistName"
                  placeholder="NEW PLAYLIST NAME..."
                  required
                  className="flex-1 bg-surface border border-border-tan text-xs px-2.5 py-1.5 rounded focus:outline-none focus:border-primary text-text-charcoal placeholder-gray-400 font-bold font-mono"
                />
                <button 
                  type="submit"
                  className="bg-primary text-white border border-primary text-[10px] px-3 font-bold rounded hover:bg-opacity-95 shadow cursor-pointer uppercase"
                >
                  CREATE & ADD
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
