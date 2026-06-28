let audioCtx: AudioContext | null = null;
let oscillator: OscillatorNode | null = null;
let gainNode: GainNode | null = null;
let analyser: AnalyserNode | null = null;

// HTML5 audio elements for real audio streams
let htmlAudio: HTMLAudioElement | null = null;
let onAudioEndedCallback: (() => void) | null = null;
let isAudioLoopEnabled = false;

export function setAudioLoop(loop: boolean) {
  isAudioLoopEnabled = loop;
  if (htmlAudio) {
    htmlAudio.loop = loop;
  }
}

// Global playhead tracking for synth tones
let synthPlayhead = 0;
let synthPlayheadInterval: NodeJS.Timeout | null = null;
let lastSource: string | undefined = undefined;

export function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  
  // Pre-warm the HTML5 Audio element synchronously during user gesture to bypass iOS/Mobile autoplay blocks
  if (!htmlAudio) {
    htmlAudio = new Audio();
    htmlAudio.volume = currentAudioVolume;
    // 1 second of absolute silence in base64 to unlock audio
    htmlAudio.src = "data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
    htmlAudio.play().catch(() => {});
  }
}

let isHtmlAudioConnected = false;
let mediaElementSource: MediaElementAudioSourceNode | null = null;

function connectAudioSource(audioElement: HTMLAudioElement) {
  try {
    initAudio();
    if (!audioCtx) return;
    if (!analyser) {
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
    }
    
    // Only connect once to prevent InvalidStateError
    if (!isHtmlAudioConnected) {
      mediaElementSource = audioCtx.createMediaElementSource(audioElement);
      mediaElementSource.connect(analyser);
      analyser.connect(audioCtx.destination);
      isHtmlAudioConnected = true;
    }
  } catch (e) {
    console.warn("Failed to connect HTML Audio to Web Audio API (CORS/Node limit):", e);
  }
}

let simPhase = 0;
function getSimulatedAnalyserData() {
  const playing = htmlAudio ? !htmlAudio.paused : false;
  if (!playing) {
    simPhase += 0.005;
    return {
      bass: 0.05 + Math.sin(simPhase) * 0.02,
      mid: 0.03 + Math.cos(simPhase * 1.5) * 0.01,
      treble: 0.02 + Math.sin(simPhase * 2.2) * 0.01
    };
  }
  simPhase += 0.03;
  const beat = Math.pow(Math.sin(simPhase * 0.8), 4);
  return {
    bass: 0.15 + beat * 0.45 + Math.sin(simPhase * 2.3) * 0.1,
    mid: 0.12 + Math.sin(simPhase * 1.7) * 0.15 + Math.cos(simPhase * 3.1) * 0.08,
    treble: 0.08 + Math.cos(simPhase * 4.5) * 0.12 + Math.sin(simPhase * 2.9) * 0.06
  };
}

export function getAnalyserData() {
  if (!audioCtx || !analyser) {
    return getSimulatedAnalyserData();
  }
  try {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    let bassSum = 0;
    let midSum = 0;
    let trebleSum = 0;

    for (let i = 0; i < 8; i++) bassSum += dataArray[i];
    for (let i = 8; i < 35; i++) midSum += dataArray[i];
    for (let i = 35; i < 80; i++) trebleSum += dataArray[i];

    return {
      bass: (bassSum / 8) / 255,
      mid: (midSum / 27) / 255,
      treble: (trebleSum / 45) / 255
    };
  } catch (err) {
    return getSimulatedAnalyserData();
  }
}

export async function playAudioStream(url: string, onEnded?: () => void): Promise<void> {
  try {
    const isResuming = (url === lastSource);
    lastSource = url;
    if (!isResuming) {
      synthPlayhead = 0;
    }

    stopSynthTone();
    
    // 1. REUSE OR CREATE HTMLAUDIO SYNCHRONOUSLY
    if (!htmlAudio) {
      htmlAudio = new Audio();
      htmlAudio.volume = currentAudioVolume;
    } else {
      // Pause existing before doing the dummy play
      htmlAudio.pause();
    }
    
    // 2. SYNCHRONOUS GESTURE PLAY
    // This MUST happen synchronously before any 'await' to satisfy Safari/Chrome Autoplay policies
    if (!isResuming) {
      htmlAudio.src = ""; // Clear so it doesn't play the old track
      htmlAudio.load();
    }
    htmlAudio.play().catch(() => {}); // Catch and ignore the NotSupportedError (expected with empty src)
    
    let playUrl = url;
    const rawId = url.replace(/^youtube:|^saavn:/i, '');
    
    // If it's a YouTube video ID (no http), use the proxy endpoint directly
    if (!rawId.startsWith("http://") && !rawId.startsWith("https://")) {
      const API_BASE = import.meta.env ? (import.meta.env.PROD ? "https://retro-959938719772.asia-south1.run.app" : "") : "";
      playUrl = `${API_BASE}/api/proxy/stream/${rawId}`;
    }
    
    // Check if we are just resuming the same track
    if (htmlAudio && (htmlAudio.src === playUrl || htmlAudio.src === encodeURI(playUrl))) {
      return htmlAudio.play();
    }
    
    // Only use CORS on desktop for non-YouTube tracks. Mobile CDNs and direct YouTube streams fail CORS.
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isYouTube = url.startsWith("youtube:") || (!url.startsWith("http://") && !url.startsWith("https://"));

    if (!isMobile && !isYouTube) {
      htmlAudio.crossOrigin = "anonymous";
    } else {
      htmlAudio.removeAttribute("crossOrigin");
    }
    
    htmlAudio.src = playUrl;
    htmlAudio.loop = isAudioLoopEnabled;
    
    // Only connect analyser if we are using crossOrigin to prevent security/tainting blocks
    if (!isMobile && !isYouTube) {
      connectAudioSource(htmlAudio);
    }
    
    if (onEnded) {
      onAudioEndedCallback = onEnded;
      htmlAudio.addEventListener("ended", onAudioEndedCallback);
    }
    
    htmlAudio.addEventListener("error", (e) => {
      console.warn("Audio stream non-fatal error (Possible CORS on CDN):", e);
    });
    
    return htmlAudio.play();
  } catch (e) {
    console.error("HTML Audio play error", e);
    return Promise.reject(e);
  }
}

let currentAudioVolume = 1.0;

export function setAudioVolume(volume: number) {
  // volume is 0 to 1
  currentAudioVolume = volume;
  if (htmlAudio) {
    htmlAudio.volume = volume;
  }
}

export function seekAudio(seconds: number) {
  if (htmlAudio && isFinite(seconds)) {
    htmlAudio.currentTime = seconds;
  }
  synthPlayhead = seconds;
}

export function getAudioCurrentTime(): number {
  if (htmlAudio && htmlAudio.src && (htmlAudio.src.startsWith("http://") || htmlAudio.src.startsWith("https://"))) {
    return htmlAudio.currentTime;
  }
  return synthPlayhead;
}

export function playSynthTone(frequencyStr: string | undefined, onEnded?: () => void): Promise<void> | void {
  if (!frequencyStr) return;
  
  // If it's not a purely numeric frequency, it's an audio URL or YouTube Video ID
  const isNumeric = !Number.isNaN(parseFloat(frequencyStr)) && parseFloat(frequencyStr).toString() === frequencyStr;
  
  if (!isNumeric) {
    return playAudioStream(frequencyStr, onEnded);
  }

  try {
    if (htmlAudio) {
      htmlAudio.pause();
    }
    initAudio();
    if (!audioCtx) return;

    // Reset or keep playhead
    const isResuming = (frequencyStr === lastSource);
    lastSource = frequencyStr;
    if (!isResuming) {
      synthPlayhead = 0;
    }

    // Stop existing oscillator first
    stopSynthTone();

    // Start synth playhead tracking interval
    synthPlayheadInterval = setInterval(() => {
      synthPlayhead += 1;
    }, 1000);

    const freq = parseFloat(frequencyStr || "220");
    if (Number.isNaN(freq)) {
      return; // Skip synth if it's a Youtube ID or invalid frequency
    }
    oscillator = audioCtx.createOscillator();
    gainNode = audioCtx.createGain();

    // Warm retro triangle or sine wave
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);

    // Filter to make it warmer
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(800, audioCtx.currentTime);

    // Envelope for soft entry
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.15); // soft warm volume

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    
    // Simulate ended event for synth beep (e.g. after 3 seconds)
    if (onEnded) {
      setTimeout(() => {
        if (oscillator) {
          onEnded();
        }
      }, 3000);
    }
  } catch (e) {
    console.warn("Web Audio is restricted or unsupported", e);
  }
}

export function stopSynthTone() {
  if (htmlAudio) {
    htmlAudio.pause();
  }
  try {
    if (gainNode && audioCtx) {
      // Fade out to avoid clicks
      const currTime = audioCtx.currentTime;
      gainNode.gain.cancelScheduledValues(currTime);
      gainNode.gain.setValueAtTime(gainNode.gain.value, currTime);
      gainNode.gain.linearRampToValueAtTime(0, currTime + 0.1);
      
      const oscToStop = oscillator;
      setTimeout(() => {
        try {
          if (oscToStop) {
            oscToStop.stop();
          }
        } catch (e) {}
      }, 150);
    }
  } catch (e) {}
  if (synthPlayheadInterval) {
    clearInterval(synthPlayheadInterval);
    synthPlayheadInterval = null;
  }
  oscillator = null;
  gainNode = null;
}

export function updateSynthFrequency(frequencyStr: string | undefined) {
  if (frequencyStr && (frequencyStr.startsWith("http://") || frequencyStr.startsWith("https://"))) {
    return; // Streams don't update via synth frequency sweep
  }
  if (oscillator && audioCtx) {
    const freq = parseFloat(frequencyStr || "220");
    if (!Number.isNaN(freq) && freq > 0) {
      try {
        oscillator.frequency.exponentialRampToValueAtTime(freq, audioCtx.currentTime + 0.3);
      } catch (e) {}
    }
  }
}
