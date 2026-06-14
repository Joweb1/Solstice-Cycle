/**
 * Gemini Live 3.1 Flash voice real-time transceiver client utilities.
 * Handles microphone recording (PCM 16kHz) and response playback (PCM 24kHz with accurate scheduled queuing).
 */

export interface LiveVoiceClientCallbacks {
  onStatusChange?: (status: 'disconnected' | 'connecting' | 'connected' | 'error', errorMsg?: string) => void;
  onAudioStreamState?: (isSpeaking: boolean) => void;
  onUserSpeechVolume?: (vol: number) => void;
}

export class LiveVoiceClient {
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  
  private nextStartTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private callbacks: LiveVoiceClientCallbacks;

  public status: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';

  constructor(callbacks: LiveVoiceClientCallbacks) {
    this.callbacks = callbacks;
  }

  private updateStatus(newStatus: typeof this.status, error?: string) {
    this.status = newStatus;
    if (this.callbacks.onStatusChange) {
      this.callbacks.onStatusChange(newStatus, error);
    }
  }

  public async connect(): Promise<boolean> {
    if (this.status === 'connected' || this.status === 'connecting') {
      return true;
    }

    this.updateStatus('connecting');

    try {
      // 1. Get microphone stream permission
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // 2. Initialize Audio Contexts
      // Input capture at 16000Hz as required by Gemini Live
      this.inputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });

      // Output playback at 24000Hz as received from Gemini Flash Live
      this.outputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });

      this.nextStartTime = this.outputAudioCtx.currentTime;

      // 3. Connect WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live-voice`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('Gemini Live Voice Connection Open');
        this.updateStatus('connected');
        this.startMicProcessing();
      };

      this.ws.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          
          if (payload.error) {
            console.error('Gemini Live API Server Error:', payload.error);
            this.updateStatus('error', payload.error);
            this.disconnect();
            return;
          }

          if (payload.audio) {
            this.playAudioChunk(payload.audio);
          }

          if (payload.interrupted) {
            this.handleInterruption();
          }
        } catch (err) {
          console.error('Failed to parse incoming live voice message:', err);
        }
      };

      this.ws.onerror = (e) => {
        console.error('Live Voice WebSocket Error:', e);
        this.updateStatus('error', 'WebSocket connection failed.');
      };

      this.ws.onclose = (event) => {
        console.log('Live Voice WebSocket Closed:', event.reason);
        if (this.status !== 'error') {
          this.updateStatus('disconnected');
        }
        this.disconnect();
      };

      return true;
    } catch (err: any) {
      console.error('Mic or audio connection setup failed:', err);
      this.updateStatus('error', err.message || 'Microphone access denied or connection block.');
      this.disconnect();
      return false;
    }
  }

  private startMicProcessing() {
    if (!this.inputAudioCtx || !this.micStream) return;

    try {
      this.micNode = this.inputAudioCtx.createMediaStreamSource(this.micStream);
      // Create structural processing link (4096 buffer size, 1 input, 1 output)
      this.processorNode = this.inputAudioCtx.createScriptProcessor(4096, 1, 1);

      this.micNode.connect(this.processorNode);
      this.processorNode.connect(this.inputAudioCtx.destination);

      this.processorNode.onaudioprocess = (e) => {
        if (this.status !== 'connected' || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const inputChannel = e.inputBuffer.getChannelData(0);

        // Compute volume level for UI visuals
        let sum = 0;
        for (let i = 0; i < inputChannel.length; i++) {
          sum += inputChannel[i] * inputChannel[i];
        }
        const rms = Math.sqrt(sum / inputChannel.length);
        if (this.callbacks.onUserSpeechVolume) {
          this.callbacks.onUserSpeechVolume(rms);
        }

        // Convert the input float channel to 16-bit PCM & Base64 encode
        const pcmBuffer = this.floatTo16BitPCM(inputChannel);
        const base64Audio = this.arrayBufferToBase64(pcmBuffer);

        this.ws.send(JSON.stringify({ audio: base64Audio }));
      };
    } catch (e) {
      console.error('Failed to start mic processor node:', e);
    }
  }

  public sendTextPrompt(text: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ text }));
    }
  }

  private playAudioChunk(base64Data: string) {
    if (!this.outputAudioCtx) return;

    try {
      const pcm16Data = this.base64ToArrayBuffer(base64Data);
      const float32Data = this.pcm16ToFloat32(pcm16Data);

      // Create an AudioBuffer at 24000Hz (which is what Gemini Flash Live produces)
      const audioBuffer = this.outputAudioCtx.createBuffer(1, float32Data.length, 24000);
      audioBuffer.copyToChannel(float32Data, 0);

      const sourceNode = this.outputAudioCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(this.outputAudioCtx.destination);

      // Schedule exact delivery timing to bypass jitter
      let playTime = this.nextStartTime;
      const curTime = this.outputAudioCtx.currentTime;
      if (playTime < curTime) {
        // Enforce a small padding on audio reset
        playTime = curTime + 0.04;
      }

      sourceNode.start(playTime);
      this.nextStartTime = playTime + audioBuffer.duration;

      this.activeSources.push(sourceNode);
      if (this.callbacks.onAudioStreamState) {
        this.callbacks.onAudioStreamState(true);
      }

      sourceNode.onended = () => {
        this.activeSources = this.activeSources.filter(s => s !== sourceNode);
        if (this.activeSources.length === 0 && this.callbacks.onAudioStreamState) {
          this.callbacks.onAudioStreamState(false);
        }
      };
    } catch (err) {
      console.error('Error playing voice chunk:', err);
    }
  }

  private handleInterruption() {
    console.log('Gemini Live Interrupted - purging audio queue.');
    this.activeSources.forEach((src) => {
      try {
        src.stop();
      } catch (e) {
        // Already stopped
      }
    });
    this.activeSources = [];
    if (this.outputAudioCtx) {
      this.nextStartTime = this.outputAudioCtx.currentTime;
    }
    if (this.callbacks.onAudioStreamState) {
      this.callbacks.onAudioStreamState(false);
    }
  }

  public disconnect() {
    // Stop all audio playback
    this.handleInterruption();

    // Close WebSocket
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }

    // Stop mic stream track sessions
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }

    // Disconnect processors
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.micNode) {
      this.micNode.disconnect();
      this.micNode = null;
    }

    // Close audio contexts
    if (this.inputAudioCtx) {
      this.inputAudioCtx.close();
      this.inputAudioCtx = null;
    }
    if (this.outputAudioCtx) {
      this.outputAudioCtx.close();
      this.outputAudioCtx = null;
    }

    console.log('Gemini Live Voice Client fully disconnected and cleaned up.');
  }

  // --- AUDIO DATA TYPE UTILITIES ---

  private floatTo16BitPCM(input: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private pcm16ToFloat32(buffer: ArrayBuffer): Float32Array {
    const view = new DataView(buffer);
    const len = buffer.byteLength / 2;
    const result = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const int16 = view.getInt16(i * 2, true);
      result[i] = int16 / 32768;
    }
    return result;
  }
}
