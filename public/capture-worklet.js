// Runs on the dedicated audio thread, so it can't be starved by DOM updates on
// the main thread (which was dropping audio and truncating speech). It buffers
// mic frames into ~64ms PCM16 chunks and posts them to the page, and on stop it
// flushes whatever is left so the tail of your sentence is never cut.

class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.recording = false;
    this.buf = new Float32Array(0);
    this.target = 1024; // samples per chunk (~64ms @ 16kHz)
    this.port.onmessage = (e) => {
      if (e.data.cmd === 'start') {
        this.recording = true;
        this.buf = new Float32Array(0);
      } else if (e.data.cmd === 'stop') {
        this.recording = false;
        this.flush();
        this.port.postMessage({ ended: true });
      }
    };
  }

  postChunk(samples) {
    const pcm = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    this.port.postMessage({ pcm: pcm.buffer }, [pcm.buffer]);
  }

  flush() {
    if (this.buf.length) this.postChunk(this.buf);
    this.buf = new Float32Array(0);
  }

  process(inputs) {
    const input = inputs[0];
    if (this.recording && input && input[0]) {
      const incoming = input[0];
      const merged = new Float32Array(this.buf.length + incoming.length);
      merged.set(this.buf, 0);
      merged.set(incoming, this.buf.length);
      this.buf = merged;

      while (this.buf.length >= this.target) {
        this.postChunk(this.buf.subarray(0, this.target));
        this.buf = this.buf.slice(this.target);
      }
    }
    return true; // keep the processor alive
  }
}

registerProcessor('capture-processor', CaptureProcessor);
