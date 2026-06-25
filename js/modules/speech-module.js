/**
 * SpeechModule - Text-to-speech (browser SpeechSynthesis) + speech recognition
 * powered by Whisper running fully on-device via Transformers.js.
 *
 * Why Whisper instead of the Web Speech API:
 *  - Far more accurate on single, isolated words (the main pain point).
 *  - Audio never leaves the device (privacy).
 *  - Works offline after the model is downloaded once.
 *
 * The model (~40MB for whisper-tiny.en) is fetched from the HuggingFace CDN
 * on first use and cached by the browser afterwards.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 15.1, 15.2
 */

// Transformers.js loaded lazily from CDN so the rest of the app stays light.
// Use the jsDelivr ESM endpoint (/+esm) so dynamic import() returns a real module.
const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/+esm';
// English-only tiny model: smallest + fastest, ideal for single words.
const WHISPER_MODEL = 'Xenova/whisper-tiny.en';
const TARGET_SAMPLE_RATE = 16000;

class SpeechModule {
  constructor() {
    /** @type {'en-US' | 'en-GB'} */
    this._accent = 'en-US';

    // Whisper / recording state
    this._transcriber = null;       // cached ASR pipeline
    this._loadingPromise = null;    // in-flight model load
    this._modelReady = false;
    this._stream = null;            // active mic MediaStream
    this._recorder = null;          // active MediaRecorder
    this._stopRecordingFn = null;   // stops the current VAD recording loop
    this._isRecognizing = false;

    // Real human pronunciation state
    this._audio = null;             // current HTMLAudioElement
    this._audioUrlCache = new Map(); // word -> audio URL (or null if none)
    this._manifest = null;          // local audio manifest { word: filename }
    this._manifestPromise = null;   // in-flight manifest load
    this._audioBase = 'assets/audio/'; // where downloaded files live
  }

  // ---------------------------------------------------------------------------
  // Text-to-speech
  //  Priority 1: locally bundled human pronunciation (assets/audio, OFFLINE).
  //  Priority 2: real human audio from the Free Dictionary API (online).
  //  Priority 3: browser SpeechSynthesis (robotic, but always available).
  // ---------------------------------------------------------------------------

  _isSynthesisSupported() {
    return typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof window.SpeechSynthesisUtterance !== 'undefined';
  }

  /**
   * Lazily load the local audio manifest (downloaded by scripts/fetch-audio.mjs).
   * Returns {} if there is no manifest (feature simply degrades to online/API).
   * @returns {Promise<Object>}
   */
  async _getManifest() {
    if (this._manifest) return this._manifest;
    if (this._manifestPromise) return this._manifestPromise;

    this._manifestPromise = (async () => {
      try {
        const res = await fetch(this._audioBase + 'manifest.json');
        this._manifest = res.ok ? await res.json() : {};
      } catch (_) {
        this._manifest = {};
      }
      return this._manifest;
    })();

    return this._manifestPromise;
  }

  /**
   * Resolve a playable audio URL for a word.
   * Checks the local bundle first, then the online dictionary API.
   * Results are cached (including misses).
   * @param {string} word
   * @param {'en-US'|'en-GB'} accent - preferred accent (-us / -uk audio)
   * @returns {Promise<string|null>} audio URL or null if none available
   */
  async _getHumanAudioUrl(word, accent) {
    const key = (word || '').trim().toLowerCase();
    if (!key) return null;
    if (this._audioUrlCache.has(key)) return this._audioUrlCache.get(key);

    // 1. Locally bundled file (works offline).
    const manifest = await this._getManifest();
    const localFile = manifest[key];
    if (localFile) {
      const localUrl = this._audioBase + localFile;
      this._audioUrlCache.set(key, localUrl);
      return localUrl;
    }
    // manifest[key] === null means "confirmed no audio" -> skip the API too.
    if (Object.prototype.hasOwnProperty.call(manifest, key) && localFile === null) {
      this._audioUrlCache.set(key, null);
      return null;
    }

    // 2. Online lookup (word not in the local bundle).
    let url = null;
    try {
      const res = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`
      );
      if (res.ok) {
        const data = await res.json();
        const phonetics = [];
        for (const entry of data) {
          if (Array.isArray(entry.phonetics)) phonetics.push(...entry.phonetics);
        }
        const withAudio = phonetics.filter(p => p.audio && p.audio.trim());

        if (withAudio.length) {
          const wantUk = accent === 'en-GB';
          const preferred =
            withAudio.find(p => p.audio.includes(wantUk ? '-uk.' : '-us.')) ||
            withAudio.find(p => p.audio.includes(wantUk ? '-us.' : '-uk.')) ||
            withAudio[0];
          url = preferred.audio;
          if (url.startsWith('//')) url = 'https:' + url;
        }
      }
    } catch (_) {
      url = null;
    }

    this._audioUrlCache.set(key, url);
    return url;
  }

  /**
   * Play a word's pronunciation.
   * Tries real human audio first, then falls back to the browser voice.
   * @param {string} word
   * @param {'en-US'|'en-GB'} [accent]
   * @returns {Promise<void>}
   */
  async speak(word, accent) {
    const lang = accent || this._accent;

    // Stop anything currently playing/speaking.
    this._stopAudio();
    if (this._isSynthesisSupported()) window.speechSynthesis.cancel();

    // 1. Try real human pronunciation.
    const url = await this._getHumanAudioUrl(word, lang);
    if (url) {
      try {
        await this._playUrl(url);
        return;
      } catch (_) {
        // Fall through to synthesis if playback fails.
      }
    }

    // 2. Fallback: browser SpeechSynthesis.
    return this._speakWithSynthesis(word, lang);
  }

  /**
   * Play an audio URL to completion.
   * @param {string} url
   * @returns {Promise<void>}
   */
  _playUrl(url) {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      this._audio = audio;
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error('audio playback failed'));
      const p = audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => reject(new Error('audio play rejected')));
      }
    });
  }

  _stopAudio() {
    if (this._audio) {
      try { this._audio.pause(); } catch (_) {}
      this._audio = null;
    }
  }

  /**
   * Speak a word with the browser's built-in voice.
   * @param {string} word
   * @param {'en-US'|'en-GB'} lang
   * @returns {Promise<void>}
   */
  _speakWithSynthesis(word, lang) {
    return new Promise((resolve, reject) => {
      if (!this._isSynthesisSupported()) {
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = lang;

      const voices = window.speechSynthesis.getVoices();
      // Prefer higher-quality "natural/online" voices when present.
      const langVoices = voices.filter(v =>
        v.lang === lang || v.lang.startsWith(lang.split('-')[0]));
      const naturalVoice = langVoices.find(v =>
        /natural|online|google|aria|guy|libby|sonia/i.test(v.name));
      const matchingVoice = naturalVoice || langVoices[0];
      if (matchingVoice) utterance.voice = matchingVoice;

      utterance.onend = () => resolve();
      utterance.onerror = (event) => {
        if (event.error === 'canceled' || event.error === 'interrupted') {
          resolve();
        } else {
          reject(new Error(`Lỗi phát âm: ${event.error}`));
        }
      };

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }

  setAccent(accent) {
    if (accent === 'en-US' || accent === 'en-GB') {
      this._accent = accent;
    }
  }

  getAvailableVoices() {
    if (!this._isSynthesisSupported()) return [];
    return window.speechSynthesis.getVoices();
  }

  // ---------------------------------------------------------------------------
  // Capability checks
  // ---------------------------------------------------------------------------

  /**
   * Recognition needs microphone access (getUserMedia), MediaRecorder and
   * an AudioContext. These all require a secure context (https or localhost).
   * @returns {boolean}
   */
  isRecognitionSupported() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    const hasMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const hasRecorder = typeof window.MediaRecorder !== 'undefined';
    const hasAudioCtx = !!(window.AudioContext || window.webkitAudioContext);
    return hasMedia && hasRecorder && hasAudioCtx;
  }

  isSecureContext() {
    if (typeof window === 'undefined') return false;
    const host = window.location && window.location.hostname;
    const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
    return window.isSecureContext === true || isLocalhost;
  }

  isOnline() {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  isModelReady() {
    return this._modelReady;
  }

  getCapabilities() {
    return {
      synthesis: {
        supported: this._isSynthesisSupported(),
        voices: this.getAvailableVoices().length
      },
      recognition: {
        supported: this.isRecognitionSupported(),
        secure: this.isSecureContext(),
        modelReady: this._modelReady
      },
      currentAccent: this._accent
    };
  }

  // ---------------------------------------------------------------------------
  // Whisper model loading
  // ---------------------------------------------------------------------------

  /**
   * Load (and cache) the Whisper ASR pipeline. Safe to call repeatedly.
   * @param {(info: object) => void} [onProgress] - download/progress callback
   * @returns {Promise<Function>} the transcriber pipeline
   */
  async loadModel(onProgress) {
    if (this._transcriber) return this._transcriber;
    if (this._loadingPromise) return this._loadingPromise;

    this._loadingPromise = (async () => {
      const transformers = await import(/* @vite-ignore */ TRANSFORMERS_CDN);
      const { pipeline } = transformers;
      // Always pull weights from the HuggingFace hub (no local model files).
      if (transformers.env) {
        transformers.env.allowLocalModels = false;
      }

      const transcriber = await pipeline(
        'automatic-speech-recognition',
        WHISPER_MODEL,
        {
          // quantized weights keep the download small (~40MB)
          dtype: 'q8',
          progress_callback: (info) => {
            if (typeof onProgress === 'function') onProgress(info);
          }
        }
      );

      this._transcriber = transcriber;
      this._modelReady = true;
      return transcriber;
    })();

    try {
      return await this._loadingPromise;
    } catch (err) {
      // Reset so a later attempt can retry.
      this._loadingPromise = null;
      throw new Error('Không tải được mô hình nhận diện. Kiểm tra kết nối internet rồi thử lại.');
    }
  }

  // ---------------------------------------------------------------------------
  // Speech recognition
  // ---------------------------------------------------------------------------

  /**
   * Record a short clip from the microphone and transcribe it with Whisper.
   * Resolves with the recognized lowercase text.
   *
   * @param {object} [options]
   * @param {(status: string) => void} [options.onStatus] - lifecycle updates:
   *        'loading-model' | 'listening' | 'processing'
   * @param {number} [options.maxMs=7000] - hard cap on recording length
   * @param {number} [options.silenceMs=900] - stop after this much trailing silence
   * @returns {Promise<string>}
   */
  async startRecognition(options = {}) {
    const { onStatus, maxMs = 7000, silenceMs = 900 } = options;
    const status = (s) => { if (typeof onStatus === 'function') onStatus(s); };

    if (!this.isRecognitionSupported()) {
      throw new Error('Trình duyệt không hỗ trợ ghi âm. Hãy dùng Chrome hoặc Edge mới.');
    }
    if (!this.isSecureContext()) {
      throw new Error('Cần chạy trên https hoặc localhost. Hãy mở web bằng Live Server, đừng mở file trực tiếp.');
    }

    // 1. Make sure the model is ready (downloads once, then cached).
    if (!this._modelReady) {
      status('loading-model');
      await this.loadModel();
    }

    // 2. Get microphone access.
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
        throw new Error('Quyền micro bị chặn. Bấm biểu tượng 🔒 trên thanh địa chỉ và cho phép Microphone.');
      }
      if (err && err.name === 'NotFoundError') {
        throw new Error('Không tìm thấy micro. Kiểm tra micro đã cắm/đã bật chưa.');
      }
      throw new Error('Không thể truy cập micro. Vui lòng thử lại.');
    }

    this._stream = stream;
    this._isRecognizing = true;

    try {
      // 3. Capture raw PCM samples until silence (or max duration).
      status('listening');
      const samples = await this._capturePcmUntilSilence(stream, { maxMs, silenceMs });

      status('processing');

      if (!samples || samples.length < TARGET_SAMPLE_RATE * 0.2) {
        throw new Error('Không nghe được gì. Hãy nói to, rõ ngay sau khi bấm micro.');
      }

      // 4. Transcribe. (whisper-tiny.en is English-only: do NOT pass
      // language/task options or it will throw.)
      const output = await this._transcriber(samples);

      let text = (output && output.text ? output.text : '').trim();
      // Whisper emits bracketed tags like [BLANK_AUDIO], (silence), etc. for
      // non-speech. Strip them; if nothing is left, treat as "heard nothing".
      text = text.replace(/[\[(][^\])]*[\])]/g, '').trim();
      if (!text) {
        throw new Error('Không nghe được gì. Hãy nói to, rõ ngay sau khi bấm micro.');
      }
      return text.toLowerCase();
    } finally {
      this._cleanupStream();
      this._isRecognizing = false;
    }
  }

  /**
   * Capture raw mono PCM from the mic using a ScriptProcessor, running VAD on
   * the same samples. Returns Float32 PCM resampled to 16kHz.
   * This avoids the MediaRecorder->webm->decode path that can yield silent audio.
   * @param {MediaStream} stream
   * @param {{maxMs:number, silenceMs:number}} opts
   * @returns {Promise<Float32Array>}
   */
  _capturePcmUntilSilence(stream, { maxMs, silenceMs }) {
    return new Promise((resolve, reject) => {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      const inputRate = audioCtx.sampleRate; // usually 44100 or 48000
      const source = audioCtx.createMediaStreamSource(stream);

      const BUFFER_SIZE = 4096;
      const processor = audioCtx.createScriptProcessor(BUFFER_SIZE, 1, 1);

      const chunks = [];
      let totalLen = 0;

      const startedAt = Date.now();
      let speechStarted = false;
      let lastVoiceAt = startedAt;
      let stopped = false;
      let maxTimer = null;

      const VOICE_THRESHOLD = 0.01;   // RMS amplitude considered "speech"
      const NO_SPEECH_TIMEOUT = 4000; // give up if nothing is said at all

      const finish = () => {
        if (stopped) return;
        stopped = true;
        if (maxTimer) clearTimeout(maxTimer);
        try { processor.disconnect(); } catch (_) {}
        try { source.disconnect(); } catch (_) {}
        try { audioCtx.close(); } catch (_) {}

        // Merge chunks into a single Float32Array at the input rate.
        const merged = new Float32Array(totalLen);
        let offset = 0;
        for (const c of chunks) { merged.set(c, offset); offset += c.length; }

        // Resample to 16kHz.
        const resampled = this._resample(merged, inputRate, TARGET_SAMPLE_RATE);
        resolve(resampled);
      };
      this._stopRecordingFn = finish;

      processor.onaudioprocess = (e) => {
        if (stopped) return;
        const input = e.inputBuffer.getChannelData(0);
        // Copy (the underlying buffer is reused by the engine).
        const copy = new Float32Array(input.length);
        copy.set(input);
        chunks.push(copy);
        totalLen += copy.length;

        // VAD on this block.
        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
        const rms = Math.sqrt(sum / input.length);
        const now = Date.now();

        if (rms > VOICE_THRESHOLD) {
          speechStarted = true;
          lastVoiceAt = now;
        }

        if (speechStarted && now - lastVoiceAt > silenceMs) { finish(); return; }
        if (!speechStarted && now - startedAt > NO_SPEECH_TIMEOUT) { finish(); return; }
      };

      source.connect(processor);
      // ScriptProcessor needs a destination connection to run in some browsers.
      processor.connect(audioCtx.destination);

      // Hard cap on total duration.
      maxTimer = setTimeout(finish, maxMs);

      // Resume in case the context starts suspended (autoplay policies).
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
    });
  }

  /**
   * Linear resample a mono Float32 signal from one sample rate to another.
   * @param {Float32Array} input
   * @param {number} fromRate
   * @param {number} toRate
   * @returns {Float32Array}
   */
  _resample(input, fromRate, toRate) {
    if (fromRate === toRate) return input;
    const ratio = fromRate / toRate;
    const newLen = Math.floor(input.length / ratio);
    const out = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) {
      const pos = i * ratio;
      const idx = Math.floor(pos);
      const frac = pos - idx;
      const a = input[idx] || 0;
      const b = input[idx + 1] || a;
      out[i] = a + (b - a) * frac;
    }
    return out;
  }

  /**
   * Record from a stream, stopping after trailing silence or a max duration.
   * Uses an AnalyserNode for lightweight voice-activity detection.
   * @param {MediaStream} stream
   * @param {{maxMs:number, silenceMs:number}} opts
   * @returns {Promise<Blob>}
   */
  _recordUntilSilence(stream, { maxMs, silenceMs }) {
    return new Promise((resolve, reject) => {
      let recorder;
      try {
        recorder = new MediaRecorder(stream);
      } catch (err) {
        reject(new Error('Không khởi động được ghi âm. Vui lòng thử lại.'));
        return;
      }
      this._recorder = recorder;

      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      recorder.onerror = () => reject(new Error('Lỗi khi ghi âm. Vui lòng thử lại.'));
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
      };

      // Voice-activity detection
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);

      const startedAt = Date.now();
      let speechStarted = false;
      let lastVoiceAt = startedAt;
      let stopped = false;

      const stop = () => {
        if (stopped) return;
        stopped = true;
        try { audioCtx.close(); } catch (_) { /* ignore */ }
        if (recorder.state !== 'inactive') {
          try { recorder.stop(); } catch (_) { /* ignore */ }
        }
      };
      this._stopRecordingFn = stop;

      const VOICE_THRESHOLD = 0.012; // RMS amplitude considered "speech"
      const NO_SPEECH_TIMEOUT = 3500; // give up if nothing is said

      const tick = () => {
        if (stopped) return;
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        const now = Date.now();

        if (rms > VOICE_THRESHOLD) {
          speechStarted = true;
          lastVoiceAt = now;
        }

        if (speechStarted && now - lastVoiceAt > silenceMs) { stop(); return; }
        if (now - startedAt > maxMs) { stop(); return; }
        if (!speechStarted && now - startedAt > NO_SPEECH_TIMEOUT) { stop(); return; }

        requestAnimationFrame(tick);
      };

      recorder.start();
      requestAnimationFrame(tick);
    });
  }

  /**
   * Decode a recorded audio Blob into a mono Float32Array at 16kHz.
   * @param {Blob} blob
   * @returns {Promise<Float32Array>}
   */
  async _blobToMono16k(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const AudioCtx = window.AudioContext || window.webkitAudioContext;

    // Decode at the source rate first (broad browser support).
    const decodeCtx = new AudioCtx();
    let decoded;
    try {
      decoded = await decodeCtx.decodeAudioData(arrayBuffer);
    } finally {
      try { decodeCtx.close(); } catch (_) { /* ignore */ }
    }

    // Already mono 16k? return directly.
    if (decoded.sampleRate === TARGET_SAMPLE_RATE && decoded.numberOfChannels === 1) {
      return decoded.getChannelData(0).slice();
    }

    // Resample (and downmix to mono) using an OfflineAudioContext.
    const durationSamples = Math.ceil(decoded.duration * TARGET_SAMPLE_RATE);
    const offline = new OfflineAudioContext(1, durationSamples, TARGET_SAMPLE_RATE);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start(0);
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0).slice();
  }

  _cleanupStream() {
    if (this._stopRecordingFn) {
      try { this._stopRecordingFn(); } catch (_) { /* ignore */ }
      this._stopRecordingFn = null;
    }
    if (this._stream) {
      this._stream.getTracks().forEach(t => { try { t.stop(); } catch (_) {} });
      this._stream = null;
    }
    this._recorder = null;
  }

  /**
   * Stop any ongoing recording immediately.
   */
  stopRecognition() {
    if (this._isRecognizing) {
      this._cleanupStream();
      this._isRecognizing = false;
    }
  }
}

// Export as singleton instance
const speechModule = new SpeechModule();
export default speechModule;
export { SpeechModule };
