// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export class Player {
  private playbackNode: AudioWorkletNode | null = null;

  async init(sampleRate: number) {
    const audioContext = new AudioContext({ sampleRate });
    await audioContext.audioWorklet.addModule("/playback-worklet.js");

    this.playbackNode = new AudioWorkletNode(audioContext, "playback-worklet");
    this.playbackNode.connect(audioContext.destination);
  }

  play(buffer: Int16Array | { samples: Int16Array, isG711?: boolean }) {
    if (this.playbackNode) {
      if (typeof (buffer as any).samples !== 'undefined') {
        this.playbackNode.port.postMessage(buffer);
      } else {
        this.playbackNode.port.postMessage(buffer);
      }
    }
  }

  clear() {
    if (this.playbackNode) {
      this.playbackNode.port.postMessage(null);
    }
  }
}
