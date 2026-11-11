// Keep network loading separate from AVPlayer: private URLs need authenticated,
// bounded downloads, and the decoder needs a real M4A/WAV file extension.
export function audioExtension(bytes: Uint8Array) {
  const tag = (a: number, b: number) => String.fromCharCode(...bytes.slice(a, b));
  if (bytes.length > 44 && tag(0, 4) === 'RIFF' && tag(8, 12) === 'WAVE') return 'wav';
  if (bytes.length > 24 && tag(4, 8) === 'ftyp') return 'm4a';
  throw new Error('ჩანაწერი დაზიანებულია ან სერვერმა აუდიო არ დააბრუნა.');
}
type Status = {isLoaded: boolean; error?: string | null};
type Player = {replace(source: {uri: string}): void; addListener(event: 'playbackStatusUpdate', listener: (s: Status) => void): {remove(): void}};
export function loadAudio(player: Player, uri: string, signal: AbortSignal, timeout = 12000) {
  return new Promise<void>((resolve, reject) => {
    let done = false;
    let subscription: {remove(): void} | undefined;
    const finish = (error?: Error) => {
      if (done) return;
      done = true; clearTimeout(timer); subscription?.remove(); signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve();
    };
    const abort = () => finish(new Error('დაკვრა გაუქმდა.'));
    const timer = setTimeout(() => finish(new Error('ჩანაწერი ვერ ჩაიტვირთა. სცადე ხელახლა.')), timeout);
    subscription = player.addListener('playbackStatusUpdate', s => {
      if (s.error) finish(new Error('ჩანაწერის დაკვრა ვერ მოხერხდა.'));
      else if (s.isLoaded) finish();
    });
    signal.addEventListener('abort', abort, {once: true});
    if (signal.aborted) { abort(); return; }
    try { player.replace({uri}); } catch (e) { finish(e instanceof Error ? e : new Error('ჩანაწერი ვერ გაიხსნა.')); }
  });
}
