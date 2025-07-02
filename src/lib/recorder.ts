export class Recorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private audioWorklet: AudioWorkletNode | null = null;
  private onDataCallback: (data: Buffer) => void;

  constructor(onData: (data: Buffer) => void) {
    this.onDataCallback = onData;
  }

  async start(stream: MediaStream) {
    try {
      this.audioContext = new AudioContext();
      await this.audioContext.audioWorklet.addModule('/audio-worklet-processor.js');
      
      const source = this.audioContext.createMediaStreamSource(stream);
      this.audioWorklet = new AudioWorkletNode(this.audioContext, 'audio-worklet-processor');
      
      this.audioWorklet.port.onmessage = (event) => {
        this.onDataCallback(Buffer.from(event.data.buffer));
      };

      source.connect(this.audioWorklet);
      this.audioWorklet.connect(this.audioContext.destination);
    } catch (error) {
      console.error('Error starting recorder:', error);
    }
  }

  stop() {
    if (this.audioWorklet) {
      this.audioWorklet.disconnect();
      this.audioWorklet = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}