class PlaybackWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.port.onmessage = this.handleMessage.bind(this);
    this.buffer = [];
    this.isG711 = false;
    this.UPSAMPLE_RATIO = 3.1; // 8kHz → 48kHz
    this.PITCH_SHIFT_RATIO = 2.9; // Shifts pitch up (~1.5 semitones)
  }

  handleMessage(event) {
    if (event.data === null) {
      this.buffer = [];
      this.isG711 = false;
      return;
    }

    if (event.data.isG711 !== undefined) {
      this.isG711 = event.data.isG711;
      this.buffer.push(...event.data.samples);
    } else {
      this.buffer.push(...event.data);
    }
  }

  // Catmull-Rom cubic interpolation for smoother audio quality
  cubicInterpolate(p0, p1, p2, p3, t) {
    const a0 = p3 - p2 - p0 + p1;
    const a1 = p0 - p1 - a0;
    const a2 = p2 - p0;
    const a3 = p1;
    
    return a0 * t * t * t + a1 * t * t + a2 * t + a3;
  }

  // Combined function for better 8kHz audio processing
  upsampleWithPitchShift(samples, outputLength) {
    const upsampled = new Float32Array(outputLength);
    
    // For 8kHz input, we need to account for both upsampling and pitch shift
    // Original logic: compress time domain by PITCH_SHIFT_RATIO, then upsample to 48kHz
    const effectiveInputLength = outputLength / (this.UPSAMPLE_RATIO * this.PITCH_SHIFT_RATIO / this.UPSAMPLE_RATIO);
    const inputNeeded = Math.ceil(outputLength / this.PITCH_SHIFT_RATIO);
    
    if (samples.length < inputNeeded) {
      // Not enough input samples — return silence
      return upsampled;
    }

    // Direct conversion: 8kHz with pitch shift to 48kHz output
    const conversionRatio = inputNeeded / outputLength;

    for (let i = 0; i < outputLength; i++) {
      const sourceIndex = i * conversionRatio;
      const centerIndex = Math.floor(sourceIndex);
      const frac = sourceIndex - centerIndex;

      // Ensure we don't go out of bounds
      if (centerIndex >= samples.length) {
        upsampled[i] = 0;
        continue;
      }

      // Get 4 points for cubic interpolation (with boundary handling)
      const p0 = samples[Math.max(0, centerIndex - 1)] || 0;
      const p1 = samples[centerIndex] || 0;
      const p2 = samples[Math.min(samples.length - 1, centerIndex + 1)] || 0;
      const p3 = samples[Math.min(samples.length - 1, centerIndex + 2)] || 0;

      // Apply cubic interpolation and normalize in one step
      const interpolated = this.cubicInterpolate(p0, p1, p2, p3, frac);
      upsampled[i] = interpolated / 32768;
    }

    return upsampled;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const channel = output[0];

    if (this.buffer.length > 0) {
      if (this.isG711) {
        // Improved buffer calculation for 8kHz G.711 audio
        const inputSamplesNeeded = Math.ceil(channel.length / this.PITCH_SHIFT_RATIO);

        if (this.buffer.length >= inputSamplesNeeded) {
          const toProcess = this.buffer.splice(0, inputSamplesNeeded);
          const upsampled = this.upsampleWithPitchShift(toProcess, channel.length);
          channel.set(upsampled);
        } else {
          // Handle partial buffer processing more gracefully
          if (this.buffer.length > 0) {
            const toProcess = this.buffer.splice(0, this.buffer.length);
            // Calculate expected output length based on available input
            const expectedOutputLength = Math.min(
              Math.floor(toProcess.length * this.PITCH_SHIFT_RATIO),
              channel.length
            );
            
            if (expectedOutputLength > 0) {
              const partialUpsampled = this.upsampleWithPitchShift(toProcess, expectedOutputLength);
              channel.set(partialUpsampled);
              // Fill remaining with silence
              if (expectedOutputLength < channel.length) {
                channel.fill(0, expectedOutputLength);
              }
            } else {
              channel.fill(0);
            }
          } else {
            channel.fill(0);
          }
        }
      } else {
        // PCM16 at 48kHz - no upsampling needed
        if (this.buffer.length >= channel.length) {
          const toProcess = this.buffer.splice(0, channel.length);
          channel.set(toProcess.map(v => v / 32768));
        } else {
          const remaining = this.buffer.map(v => v / 32768);
          channel.set(remaining);
          channel.fill(0, remaining.length);
          this.buffer = [];
        }
      }
    } else {
      channel.fill(0);
    }

    return true;
  }
}

registerProcessor("playback-worklet", PlaybackWorklet);