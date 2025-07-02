export class Player {
  private audioContext: AudioContext | null = null;
  private sampleRate: number = 24000;
  private queue: Float32Array[] = [];
  private isPlaying: boolean = false;

  init(sampleRate: number) {
    this.sampleRate = sampleRate;
    this.audioContext = new AudioContext({ sampleRate });
  }

  play(data: Int16Array | { samples: number[], isG711: boolean }) {
    if (!this.audioContext) return;

    let floatArray: Float32Array;
    
    if (data instanceof Int16Array) {
      // Handle regular PCM16 data
      floatArray = new Float32Array(data.length);
      for (let i = 0; i < data.length; i++) {
        floatArray[i] = data[i] / 0x7fff;
      }
    } else {
      // Handle G.711 or other formatted data
      const samples = data.samples;
      
      if (data.isG711) {
        // G.711 is typically 8kHz, need to upsample to match output sample rate
        const g711SampleRate = 8000;
        const upsampleRatio = this.sampleRate / g711SampleRate;
        const outputLength = Math.floor(samples.length * upsampleRatio);
        
        floatArray = this.upsampleAudio(samples, outputLength);
      } else {
        // Regular samples, convert directly
        floatArray = new Float32Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
          floatArray[i] = samples[i] / 0x7fff;
        }
      }
    }

    this.queue.push(floatArray);
    if (!this.isPlaying) {
      this.playNextBuffer();
    }
  }

  private upsampleAudio(samples: number[], outputLength: number): Float32Array {
    const floatArray = new Float32Array(outputLength);
    const ratio = samples.length / outputLength;
    
    for (let i = 0; i < outputLength; i++) {
      const sourceIndex = i * ratio;
      const lowerIndex = Math.floor(sourceIndex);
      const upperIndex = Math.min(lowerIndex + 1, samples.length - 1);
      const fraction = sourceIndex - lowerIndex;
      
      // Linear interpolation between samples
      const interpolated = samples[lowerIndex] * (1 - fraction) + samples[upperIndex] * fraction;
      floatArray[i] = interpolated / 0x7fff;
    }
    
    return floatArray;
  }

  private async playNextBuffer() {
    if (!this.audioContext || this.queue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const buffer = this.audioContext.createBuffer(1, this.queue[0].length, this.sampleRate);
    buffer.getChannelData(0).set(this.queue[0]);
    this.queue.shift();

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    source.onended = () => this.playNextBuffer();
    source.start();
  }

  clear() {
    this.queue = [];
    this.isPlaying = false;
  }
}