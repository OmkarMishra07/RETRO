import express from "express";
import http from "http";
import https from "https";
import { request as nodeRequest } from "http";
import { request as httpRequest } from "https";
import { Server } from "socket.io";
import cors from "cors";
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import ytSearch from "yt-search";
import { Innertube, UniversalCache, Platform } from "youtubei.js";

// Inject JS evaluator for youtubei.js YTMUSIC deciphering in Node.js
Platform.shim.eval = (data: any) => {
  return vm.runInNewContext('function run() { ' + data.output + ' } run();');
};

dotenv.config();

let ytClient: Innertube | null = null;
async function getYT() {
  if (!ytClient) ytClient = await Innertube.create();
  return ytClient;
}

function isIndianQuery(query: string): boolean {
  const indianLangs = /[\u0900-\u097F]/;
  const indianKeywords = /bollywood|hindi|punjabi|tamil|telugu|saavn|jiosaavn/i;
  return indianLangs.test(query) || indianKeywords.test(query);
}

// Concurrency Queue to prevent CPU spike and YouTube rate limits during multiple parallel decipherings
class ConcurrencyQueue {
  private activeCount = 0;
  private queue: (() => void)[] = [];
  private maxConcurrency: number;

  constructor(maxConcurrency: number) {
    this.maxConcurrency = maxConcurrency;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeCount >= this.maxConcurrency) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.activeCount++;
    try {
      return await fn();
    } finally {
      this.activeCount--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        if (next) next();
      }
    }
  }
}

const ytDecipherQueue = new ConcurrencyQueue(10); // Limit to 10 parallel YouTube decipher operations
const streamCache = new Map<string, { url: string, expiry: number }>();

// API: Dual-Source Direct Stream URL Router
async function getStreamUrlHelper(videoId: string): Promise<string> {
  const isSaavn = videoId.startsWith("saavn:");
  const isYouTube = videoId.startsWith("youtube:");
  const actualId = videoId.replace("saavn:", "").replace("youtube:", "");

  const finalIsSaavn = isSaavn || (!isYouTube && !isSaavn && actualId.length !== 11);

  if (finalIsSaavn) {
    const fetchMod = await import("node-fetch");
    const fetch = fetchMod.default;
    const response = await fetch(`https://jiosavnapi-production.up.railway.app/api/songs?ids=${actualId}`);
    const data = await response.json() as any;
    if (data.success && data.data && data.data.length > 0) {
      const song = data.data[0];
      if (song.downloadUrl && Array.isArray(song.downloadUrl)) {
        const best = song.downloadUrl.sort((a: any, b: any) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0));
        return best[0].url;
      }
    }
    throw new Error("Stream URL not found in JioSaavn");
  } else {
    // Wrap YouTube client calls in the concurrency queue
    return ytDecipherQueue.run(async () => {
      const yt = await getYT();

      // Implement an 8-second timeout to prevent hanging requests from blocking the queue
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("YouTube API request timed out")), 8000)
      );

      const fetchInfoPromise = (async () => {
        // Fallback Client Chain: TV -> TV_SIMPLY -> IOS
        try {
          return await yt.getBasicInfo(actualId, { client: 'TV' });
        } catch (err: any) {
          console.warn(`[decipher] TV client failed for ${actualId}, trying TV_SIMPLY...`, err.message);
          try {
            return await yt.getBasicInfo(actualId, { client: 'TV_SIMPLY' });
          } catch (err2: any) {
            console.warn(`[decipher] TV_SIMPLY client failed for ${actualId}, falling back to IOS...`, err2.message);
            return await yt.getBasicInfo(actualId, { client: 'IOS' });
          }
        }
      })();

      const info = await Promise.race([fetchInfoPromise, timeoutPromise]);

      if (!info.streaming_data) {
        throw new Error(`No streaming_data for ${actualId}`);
      }

      const format = info.chooseFormat({ type: 'audio', quality: 'best' });
      if (!format) {
        throw new Error(`No audio format found for ${actualId}`);
      }

      const streamUrl = format.signature_cipher || format.cipher
        ? await format.decipher(yt.session.player)
        : format.url;

      if (!streamUrl) {
        throw new Error(`Decipher returned empty URL for ${actualId}`);
      }

      return streamUrl;
    });
  }
}

// Get from cache, or decipher and cache for 4 hours
async function getOrDecipherStreamUrl(videoId: string): Promise<string> {
  const now = Date.now();
  const cached = streamCache.get(videoId);
  if (cached && cached.expiry > now) {
    return cached.url;
  }
  const streamUrl = await getStreamUrlHelper(videoId);
  streamCache.set(videoId, { url: streamUrl, expiry: now + 4 * 60 * 60 * 1000 });
  return streamUrl;
}

// Periodic garbage collection to prevent memory leaks from old cached links
setInterval(() => {
  const now = Date.now();
  let deletedCount = 0;
  for (const [key, val] of streamCache.entries()) {
    if (val.expiry <= now) {
      streamCache.delete(key);
      deletedCount++;
    }
  }
  if (deletedCount > 0) {
    console.log(`[cache-gc] Cleaned up ${deletedCount} expired stream cache entries.`);
  }
}, 30 * 60 * 1000); // Run cleanup every 30 minutes

import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteDoc, query, where, onSnapshot } from "firebase/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Firebase Auth Custom Domain Reverse Proxy
// Proxies all /__/auth/* requests to Firebase to keep cookies and session storage first-party
app.all("/__/auth/*", (req, res) => {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || "retro-341c2";
  const targetHost = `${projectId}.firebaseapp.com`;
  const options = {
    hostname: targetHost,
    port: 443,
    path: req.originalUrl,
    method: req.method,
    headers: {
      ...req.headers,
      host: targetHost
    }
  };

  const proxyReq = https.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode || 500);
    Object.keys(proxyRes.headers).forEach((key) => {
      if (proxyRes.headers[key]) {
        res.setHeader(key, proxyRes.headers[key]!);
      }
    });
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", (err) => {
    console.error("Firebase Auth Proxy Error:", err);
    res.status(500).send("Authentication proxy error");
  });

  req.pipe(proxyReq, { end: true });
});

const PORT = process.env.PORT || 3001;

// Initialize Firebase & Firestore
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const firebaseApp = initializeApp(firebaseConfig);
const firestoreDb = getFirestore(firebaseApp);

// In-Memory Jam Rooms Store
interface Listener {
  id: string;
  name: string;
  avatarUrl: string;
  isDj?: boolean;
}

interface ChatMessage {
  id: string;
  user: string;
  text: string;
  timestamp: string;
  isDj?: boolean;
  isSystem?: boolean;
}

interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  coverUrl: string;
  genre: string;
  listeners?: string;
  audioUrl?: string;
}

interface JamRoom {
  roomId: string;
  roomName: string;
  hostId: string;
  currentTrack: Track | null;
  isPlaying: boolean;
  progressSecs: number;
  lastUpdated: number;
  listeners: Listener[];
  messages: ChatMessage[];
  vibe: number;
}

const jamRooms: Record<string, JamRoom> = {
  "solaris-drift": {
    roomId: "solaris-drift",
    roomName: "SOLARIS DRIFT REC",
    hostId: "STITCH_DJ",
    currentTrack: {
      id: "track-room",
      title: "SOLARIS DRIFT",
      artist: "MONO ECHO & THE CURATORS",
      album: "SPACE SHIFT SELECTIONS",
      duration: "04:45",
      coverUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuCmDcABelGW7FvSoaw5aZxCeVtTEFBRCv0dvPINsKgsPwVAZva5kjSwW-zx0Mgv-7a4i-q-r5lTxb6bEO3Y1jypc03Yk2kM3kG6Qqwxl9qBT1u8WZ3yZCC-bQWl2oDLuPBcpATGf1ZXIJ70ghbzEpGVbhFq9XTZ_yiwSYT6ZcNMsQYnw-ED8DbFc05uKgZ5AwWE01QzJYD2juCq69mytTavIYLReuE6OR3b1FOnTqK5r7u9ezncIH_0jsgTQqAsu04QP1um1NOMYJ4",
      genre: "AMBIENT",
      audioUrl: "https://aac.saavncdn.com/392/8ab72e5058ec1438fa910f135b5bb27d_160.mp4"
    },
    isPlaying: true,
    progressSecs: 45,
    lastUpdated: Date.now(),
    listeners: [
      { id: "STITCH_DJ", name: "Stitch (DJ)", avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuCGmeCkoVquhy-m8Wte3R2DcLiclHPKOGO5VuMEqxBYIAruLB_zTodjOPmN7JU5OIrPHAhbjwk8cY7Kp0THzcdmgaNVbyG9oIj_yl2T5cSuv94aQiUjVPw_3jpEVTnnj_BHZrOepyIrINdGNknlshROqesC3brDrNfi2sB7dJQ8E4mCj2PETuYzDpkKIAWWECH_xhVPb-5bNTJa2GqvvSIQ4sTIZ9somhHC5NY-beOV6zEY0TYqMqyfE9V8liqrbhEx4CezJ5Yclms", isDj: true },
      { id: "lst-2", name: "User_129", avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBf_UscxCp7jrRXEPSpxJeTnlXrNfDf9LhSdM-PLmJYRqmjSruUK8XD8Yt7UbB5KVI7lCK3fbzjXJNXTfH00_KpUdTRxeuLb9MCxd2iFvGIUEAIEAGu6nT45nseHKupQ088fD_SMXMMML8Dyp_fD3jMRrB9iqJou-2v-xSDLv7V3aH2QvFgjRFY_V-OnebhXb7usxT8FTwTyqUNZrRxnnPCQpRVOAIsIZMaueoSVidvWmdpcwk5B72kssLT4rmoMTbJ4a8S9ZCZGR0" },
      { id: "lst-3", name: "Luna_Vibe", avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuDA6V3H-FAEGM7WAowvEkbHyj4RKRzFhi74shnT2J9KlbgO1vOzeHxa42AQa8f5wF3bo0MxKH_-AO-OqTYQJaghtxEYnugiugvWGMySDauj866R0NBZmbITdsGZJRHE-25_Vl2p4Vjht98gRdes9fn_5AfrnnWaKQ0yK_rmDYInPOI9R147CTdq7RS2Uk4Luh482I2Z5eL0HQXeXngr-0w_N2LK2oamoepaZIb50W52QBOENzx4GGlJhpVa3QsdeeBrtXDITlKwoAg" }
    ],
    messages: [
      { id: "msg-1", user: "Stitch (DJ)", text: "Welcome to the drift session. Turning up the bass for this next one.", timestamp: "12:45 PM", isDj: true },
      { id: "msg-2", user: "Luna_Vibe", text: "That transition was smooth!", timestamp: "12:46 PM" }
    ],
    vibe: 85
  }
};

// Periodic progress update in memory
setInterval(() => {
  Object.keys(jamRooms).forEach(id => {
    const room = jamRooms[id];
    if (room.isPlaying && room.currentTrack) {
      const parts = (room.currentTrack.duration || "00:00").split(":");
      const totalSecs = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      
      const deltaSecs = Math.floor((Date.now() - room.lastUpdated) / 1000);
      if (deltaSecs > 0) {
        room.progressSecs = room.progressSecs + deltaSecs;
        room.lastUpdated = Date.now();
        if (room.progressSecs >= totalSecs) {
          room.progressSecs = 0;
          room.isPlaying = false; // pause on finish
        }
      }
    }
  });
}, 5000);

// API: Sync/Fetch User data (create if new)
app.post("/api/auth/sync", async (req, res) => {
  const { uid, name, email, avatarUrl } = req.body;
  if (!uid) {
    return res.status(400).json({ error: "Missing uid" });
  }

  try {
    const userDocRef = doc(firestoreDb, "users", uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      const newUser = {
        profile: {
          uid,
          name: name || "NEW_COLLECTOR",
          email: email || "",
          idCode: `CURATOR_ID: ${Math.floor(1000 + Math.random() * 9000)}-XP`,
          isPremium: true,
          location: "TOKYO_SUB",
          memberSince: new Date().toLocaleString("en-US", { month: "short", year: "numeric" }).toUpperCase(),
          level: 1,
          minutesCount: 0,
          tracksCount: 0,
          collectionCount: 0,
          avatarUrl: avatarUrl || "https://lh3.googleusercontent.com/aida-public/AB6AXuCuiYmL89VIWmay1zAOcQoTq8QGw980tcVWW3XmHLcaThUeBAjwtjBVn3zRynpuYkS0r3drGdS4iqPoo1EgCRPtE8-vH7N--o8up0B-NHY9MDWgarI6-nguFRxXcoF-UUyYPupvGFJO7ugI9Qr2PUJkgPOeRCL5MQJdkNWzqj1317kthel5aERuhct1J5CBVhN-Q7Q5zvwLwoOGeh0gBjvTNcNwk2dyMGnyzcx7xzM08AUL5Izd1E19659zyEgCUiVRfK9crKSlmU8"
        },
        recentlyPlayed: [],
        likedTrackIds: [],
        playlists: [],
        friends: [
          { name: "ISOMETRIC_GIRL", status: "Listening to:", detail: "ORBITAL_PATH", timeAgo: "2M_AGO", avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuCKOy4iNXQNlHhKL9ABmdT8BFOEk-IKV8e22OnD0bwUqH45y1XDA3LyypfiS7EQjDdnfGjaU-whTD8aEyUz5_fIOM-pceNPgcr8RHkU1RLc-JkRY2601_xu6DEnoxEGQqvoVSxeiOcE0Xey_beLUp-ba-8lMfAfyNABJU8qBKRoO9VQk7Zi4KxYegOQynYtORSl-sjvGgI5kuCttPu9_kES5l9FO_SrZvANvptYdxA2WfMV7ldYTIP7PL4Xj3iFRoNprN7pZk0iCxo", active: true },
          { name: "LOW_PASS_FILTER", status: "Saved:", detail: "ANALOG_DREAMS", timeAgo: "15M_AGO", avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuDrIHIprdKs-SxteKgTU2sWOkyu51TswExd1BZvxNdFGbLTtMapKNZ1_FXQIHrI8wvBe9nPVvbMb6uTS86Rm59MiOXgEEsyMPeBHWSEV4H6JN2v8kc8lJPHPv27wG1Td7ywH5U8P1Kw55s4QAAUCDp5X2GTp5DsFPqrEMKzl2DQ-P_wg6IQzZ4sKbC8pb_XCvSFohmaeSY2rc77Ib--EDG5t4CFTp8cME-RKZOfAuiPPKQs_DgbPlo9I-fu3WWuBcx7TK8NDrkjjbY", active: false }
        ]
      };
      await setDoc(userDocRef, newUser);
      res.json({ success: true, user: newUser });
    } else {
      res.json({ success: true, user: userDoc.data() });
    }
  } catch (err) {
    console.error("Firestore auth sync error:", err);
    res.status(500).json({ error: "Firestore auth sync error" });
  }
});

// API: Toggle Like Song
app.post("/api/user/:uid/like", async (req, res) => {
  const { uid } = req.params;
  const { trackId } = req.body;

  try {
    const userDocRef = doc(firestoreDb, "users", uid);
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = userDoc.data();
    const liked = userData.likedTrackIds || [];
    let index = liked.indexOf(trackId);
    if (index > -1) {
      liked.splice(index, 1);
    } else {
      liked.push(trackId);
    }

    await updateDoc(userDocRef, {
      likedTrackIds: liked,
      "profile.collectionCount": liked.length
    });

    res.json({ success: true, likedTrackIds: liked });
  } catch (err) {
    console.error("Firestore toggle like error:", err);
    res.status(500).json({ error: "Firestore toggle like error" });
  }
});

// API: Dual-Source Search (JioSaavn + YouTube)
app.get("/api/youtube/search", async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: "Missing query parameter" });

  try {
    const fetchMod = await import("node-fetch");
    const fetch = fetchMod.default;
    const qStr = query as string;
    
    let tracks: any[] = [];
    const preferSaavn = isIndianQuery(qStr);

    // 1. Try JioSaavn if Indian music preferred
    if (preferSaavn) {
      try {
        const r = await fetch(`https://jiosavnapi-production.up.railway.app/api/search/songs?query=${encodeURIComponent(qStr)}&limit=15`);
        const data = await r.json() as any;
        
        if (data.success && data.data && data.data.results) {
          tracks = data.data.results.map((song: any) => {
            let artists = "Unknown Artist";
            if (typeof song.primaryArtists === "string") artists = song.primaryArtists;
            else if (song.artists && typeof song.artists === "string") artists = song.artists;
            else if (song.artists?.primary && Array.isArray(song.artists.primary) && song.artists.primary.length > 0) {
              artists = song.artists.primary.map((a: any) => a.name).join(", ");
            } else if (song.artists?.all && Array.isArray(song.artists.all) && song.artists.all.length > 0) {
              artists = song.artists.all.map((a: any) => a.name).join(", ");
            }
            
            let cover = "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17";
            if (song.image && Array.isArray(song.image) && song.image.length > 0) {
              cover = song.image[song.image.length - 1].url; // highest res
            }

            const dur = parseInt(song.duration, 10) || 0;
            const mm = Math.floor(dur / 60).toString().padStart(2, "0");
            const ss = (dur % 60).toString().padStart(2, "0");

            return {
              id: song.id,
              title: song.name ? song.name.replace(/&quot;/g, '"').replace(/&#039;/g, "'") : "Unknown Title",
              artist: artists,
              album: song.album?.name ? song.album.name.replace(/&quot;/g, '"').replace(/&#039;/g, "'") : "Unknown Album",
              duration: `${mm}:${ss}`,
              coverUrl: cover,
              genre: song.language ? song.language.toUpperCase() : "SAAVN",
              audioUrl: song.id // No prefix needed, fallback logic handles routing
            };
          });
        }
      } catch (err) {
        console.warn("Saavn search failed", err);
      }
    }

    // 2. Try YouTube Music if Saavn failed or was not preferred
    if (tracks.length === 0) {
      try {
        const yt = await getYT();
        const results = await yt.music.search(qStr, { type: 'song' });
        
        tracks = (results.songs?.contents ?? []).slice(0, 15).map((item: any) => {
          const dur = item.duration?.seconds ?? 0;
          const mm = Math.floor(dur / 60).toString().padStart(2, "0");
          const ss = (dur % 60).toString().padStart(2, "0");
          return {
            id: item.id,
            title: item.title || "Unknown Title",
            artist: item.artists?.[0]?.name ?? 'Unknown',
            album: item.album?.name ?? 'YouTube Music',
            duration: `${mm}:${ss}`,
            coverUrl: item.thumbnail?.[0]?.url ?? "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17",
            genre: "YT_MUSIC",
            audioUrl: item.id // No prefix needed, fallback logic handles routing
          };
        });
      } catch (err) {
        console.error("YouTube search failed", err);
      }
    }

    // Asynchronously pre-decipher the top 3 YouTube results in the background to warm the cache
    const ytTracks = tracks.filter(t => t.genre === "YT_MUSIC").slice(0, 3);
    for (const track of ytTracks) {
      getOrDecipherStreamUrl(track.id).catch((err: any) => {
        console.warn(`[search-predecipher] Failed to pre-decipher ${track.id}:`, err.message);
      });
    }

    res.json({ success: true, data: { results: tracks } });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search error" });
  }
});

// API: Dual-Source Direct Stream URL Router (For direct JSON url responses)
app.get("/api/youtube/stream/:videoId", async (req, res) => {
  const { videoId } = req.params;
  if (!videoId) return res.status(400).json({ error: "Missing videoId" });

  try {
    const streamUrl = await getOrDecipherStreamUrl(videoId);
    res.json({ success: true, url: streamUrl });
  } catch (err: any) {
    console.error("Stream fetch error:", err.message);
    res.status(500).json({ error: "Stream fetch error: " + err.message });
  }
});

// API: Redirect the browser directly to YouTube's CDN (shifts 100% of bandwidth and streaming IPs to user)
app.get('/api/proxy/stream/:videoId', async (req, res) => {
  const { videoId } = req.params;
  try {
    const streamUrl = await getOrDecipherStreamUrl(videoId);
    res.redirect(302, streamUrl);
  } catch (err: any) {
    console.error(`[proxy] FAILED to get stream URL for ${videoId}:`, err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// API: Save Recently Played Song
app.post("/api/user/:uid/recently-played", async (req, res) => {
  const { uid } = req.params;
  const { track } = req.body;

  try {
    const userDocRef = doc(firestoreDb, "users", uid);
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = userDoc.data();
    let list: Track[] = userData.recentlyPlayed || [];
    // Remove duplicate
    list = list.filter(t => t.id !== track.id);
    // Add to start
    list.unshift(track);
    // Cap at 20
    if (list.length > 20) list.pop();

    await updateDoc(userDocRef, {
      recentlyPlayed: list,
      "profile.tracksCount": list.length
    });

    res.json({ success: true, recentlyPlayed: list });
  } catch (err) {
    console.error("Firestore save recently played error:", err);
    res.status(500).json({ error: "Firestore save recently played error" });
  }
});

// API: Create Playlist
app.post("/api/user/:uid/playlist", async (req, res) => {
  const { uid } = req.params;
  const { name, coverUrl, tracks } = req.body;

  try {
    const userDocRef = doc(firestoreDb, "users", uid);
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = userDoc.data();
    const playlists = userData.playlists || [];
    const newPlaylist = {
      id: `playlist-${Date.now()}`,
      name,
      coverUrl: coverUrl || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17",
      tracks: tracks || []
    };

    playlists.push(newPlaylist);
    await updateDoc(userDocRef, { playlists });

    res.json({ success: true, playlists });
  } catch (err) {
    console.error("Firestore create playlist error:", err);
    res.status(500).json({ error: "Firestore create playlist error" });
  }
});

// API: Get active Jam rooms list
app.get("/api/rooms", (req, res) => {
  res.json({ success: true, rooms: Object.values(jamRooms) });
});

// Socket.io for Realtime sync
io.on("connection", (socket) => {
  console.log("Client connected", socket.id);

  socket.on("join-room", ({ roomId, user }) => {
    socket.join(roomId);
    console.log(`User ${user.name} joined room ${roomId}`);

    if (!jamRooms[roomId]) {
      // Create new room if it doesn't exist
      jamRooms[roomId] = {
        roomId,
        roomName: `${user.name.toUpperCase()}'s SELECTION`,
        hostId: user.uid || socket.id,
        currentTrack: null,
        isPlaying: false,
        progressSecs: 0,
        lastUpdated: Date.now(),
        listeners: [],
        messages: [],
        vibe: 50
      };
    }

    const room = jamRooms[roomId];
    
    // Add to listener list if not already there
    if (!room.listeners.some(l => l.id === (user.uid || socket.id))) {
      room.listeners.push({
        id: user.uid || socket.id,
        name: user.name,
        avatarUrl: user.avatarUrl || "https://lh3.googleusercontent.com/aida-public/AB6AXuBf_UscxCp7jrRXEPSpxJeTnlXrNfDf9LhSdM-PLmJYRqmjSruUK8XD8Yt7UbB5KVI7lCK3fbzjXJNXTfH00_KpUdTRxeuLb9MCxd2iFvGIUEAIEAGu6nT45nseHKupQ088fD_SMXMMML8Dyp_fD3jMRrB9iqJou-2v-xSDLv7V3aH2QvFgjRFY_V-OnebhXb7usxT8FTwTyqUNZrRxnnPCQpRVOAIsIZMaueoSVidvWmdpcwk5B72kssLT4rmoMTbJ4a8S9ZCZGR0",
        isDj: room.hostId === (user.uid || socket.id)
      });
    }

    // Send welcome system message
    const joinMessage: ChatMessage = {
      id: `msg-system-${Date.now()}`,
      user: "SYSTEM",
      text: `${user.name} joined the room.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSystem: true
    };
    room.messages.push(joinMessage);

    // Broadcast room status to everyone
    io.to(roomId).emit("room-update", room);
  });

  socket.on("leave-room", ({ roomId, userId }) => {
    socket.leave(roomId);
    console.log(`User ${userId} left room ${roomId}`);
    
    const room = jamRooms[roomId];
    if (room) {
      room.listeners = room.listeners.filter(l => l.id !== userId);
      const leaveMessage: ChatMessage = {
        id: `msg-system-${Date.now()}`,
        user: "SYSTEM",
        text: `${room.listeners.find(l => l.id === userId)?.name || "User"} left the room.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSystem: true
      };
      room.messages.push(leaveMessage);
      
      // If room is empty and not default static room, clean up
      if (room.listeners.length === 0 && roomId !== "solaris-drift") {
        delete jamRooms[roomId];
      } else {
        io.to(roomId).emit("room-update", room);
      }
    }
  });

  // Track Update: Play, Pause, Seek, or Track Change
  socket.on("track-update", ({ roomId, currentTrack, isPlaying, progressSecs }) => {
    const room = jamRooms[roomId];
    if (room) {
      room.currentTrack = currentTrack;
      room.isPlaying = isPlaying;
      room.progressSecs = progressSecs;
      room.lastUpdated = Date.now();
      
      // Broadcast to other room members
      socket.to(roomId).emit("room-track-sync", {
        currentTrack,
        isPlaying,
        progressSecs,
        senderId: socket.id
      });
      
      io.to(roomId).emit("room-update", room);
    }
  });

  // Chat message sending
  socket.on("send-message", ({ roomId, user, text }) => {
    const room = jamRooms[roomId];
    if (room) {
      const isDj = room.hostId === user.uid;
      const newMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        user: user.name,
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isDj
      };
      room.messages.push(newMsg);
      room.vibe = Math.min(room.vibe + 3, 100); // boost vibe
      
      io.to(roomId).emit("room-update", room);
    }
  });

  socket.on("wave", ({ roomId, senderName, targetName }) => {
    const room = jamRooms[roomId];
    if (room) {
      const waveMsg: ChatMessage = {
        id: `msg-wave-${Date.now()}`,
        user: "SYSTEM",
        text: `${senderName} waved 👋 at ${targetName}!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSystem: true
      };
      room.messages.push(waveMsg);
      io.to(roomId).emit("room-update", room);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected", socket.id);
    // Find rooms user was in and clean up
    Object.keys(jamRooms).forEach(roomId => {
      const room = jamRooms[roomId];
      const listenerIndex = room.listeners.findIndex(l => l.id === socket.id);
      if (listenerIndex > -1) {
        const listener = room.listeners[listenerIndex];
        room.listeners.splice(listenerIndex, 1);
        
        room.messages.push({
          id: `msg-system-${Date.now()}`,
          user: "SYSTEM",
          text: `${listener.name} disconnected.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isSystem: true
        });

        if (room.listeners.length === 0 && roomId !== "solaris-drift") {
          delete jamRooms[roomId];
        } else {
          io.to(roomId).emit("room-update", room);
        }
      }
    });
  });
});

// Active track of scheduled deletions to avoid duplicate timers
const scheduledDeletions: Record<string, NodeJS.Timeout> = {};

// Event-driven Firestore Room Cleanup
function startFirestoreCleanupListener() {
  try {
    const roomsCol = collection(firestoreDb, "rooms");
    const emptyRoomsQuery = query(roomsCol, where("emptySince", ">", 0));
    
    onSnapshot(emptyRoomsQuery, (snapshot) => {
      const activeEmptyIds = new Set<string>();
      
      snapshot.forEach((roomDoc) => {
        const roomId = roomDoc.id;
        const data = roomDoc.data();
        const emptySince = data.emptySince;
        
        activeEmptyIds.add(roomId);
        
        if (emptySince && !scheduledDeletions[roomId]) {
          const now = Date.now();
          const elapsed = now - emptySince;
          const delay = Math.max(0, 60000 - elapsed);
          
          console.log(`[Firestore Cleanup] Room ${roomId} has been empty for ${Math.round(elapsed / 1000)}s. Scheduling deletion in ${Math.round(delay / 1000)}s.`);
          
          scheduledDeletions[roomId] = setTimeout(async () => {
            try {
              // Double check if still empty before deleting
              const docSnap = await getDoc(doc(firestoreDb, "rooms", roomId));
              if (docSnap.exists()) {
                const docData = docSnap.data();
                const listeners = docData.listeners || [];
                if (listeners.length === 0 && docData.emptySince) {
                  await deleteDoc(doc(firestoreDb, "rooms", roomId));
                  console.log(`[Firestore Cleanup] Deleted inactive room: ${roomId}`);
                }
              }
            } catch (err) {
              console.error(`[Firestore Cleanup] Error deleting room ${roomId}:`, err);
            }
            delete scheduledDeletions[roomId];
          }, delay);
        }
      });
      
      // Clean up any scheduled timeouts for rooms that are no longer empty (i.e. not in the snapshot anymore)
      Object.keys(scheduledDeletions).forEach((roomId) => {
        if (!activeEmptyIds.has(roomId)) {
          console.log(`[Firestore Cleanup] Room ${roomId} is no longer empty. Cancelling scheduled deletion.`);
          clearTimeout(scheduledDeletions[roomId]);
          delete scheduledDeletions[roomId];
        }
      });
    }, (err) => {
      console.error("[Firestore Cleanup] onSnapshot listener error:", err);
    });
  } catch (err) {
    console.error("[Firestore Cleanup] Error starting listener:", err);
  }
}

// Start the listener
startFirestoreCleanupListener();

server.listen(PORT, () => {
  console.log(`Music2D Backend server running on port ${PORT}`);
});
