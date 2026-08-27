export function playRevealSound(): void {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  const ctx = new AudioContextClass();
  const now = ctx.currentTime;

  function tone(start: number, frequency: number, duration: number): void {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.08, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  tone(now, 523.25, 0.12);
  tone(now + 0.1, 659.25, 0.18);
  void ctx.resume();
  window.setTimeout(() => void ctx.close(), 600);
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
