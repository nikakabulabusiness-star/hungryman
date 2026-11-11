import {File, Paths} from 'expo-file-system';
import {fetch} from 'expo/fetch';
import * as Crypto from 'expo-crypto';
import {chatImageSource} from './api';
import {audioExtension} from './voice-playback';

export async function downloadVoice(id: string, signal: AbortSignal): Promise<File> {
  const source = chatImageSource(id), controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, {once: true});
  if (signal.aborted) controller.abort();
  const timer = setTimeout(abort, 25000);
  try {
    const response = await fetch(source.uri, {headers: source.headers, signal: controller.signal});
    if (!response.ok) throw new Error(response.status === 403 || response.status === 401 ? 'ჩანაწერზე წვდომა ვერ დადასტურდა. შედი ანგარიშში ხელახლა.' : 'ჩანაწერი ვერ ჩამოიტვირთა. სცადე ხელახლა.');
    const max = 10 * 1024 * 1024;
    if (Number(response.headers.get('content-length') || 0) > max) throw new Error('ჩანაწერი ზედმეტად დიდია.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (controller.signal.aborted) throw new Error('ჩატვირთვა შეწყდა.');
    if (bytes.length > max) throw new Error('ჩანაწერი ზედმეტად დიდია.');
    const file = new File(Paths.cache, `hmw-voice-${Crypto.randomUUID()}.${audioExtension(bytes)}`);
    try { file.create(); file.write(bytes); return file; }
    catch (e) { if (file.exists) file.delete(); throw e; }
  } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
}
