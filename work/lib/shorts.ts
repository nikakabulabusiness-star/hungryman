export const DEFAULT_SHORTS={youtube:'hungrymantv',instagram:'hungrymantv',tiktok:'hungryman.ge'};
export type ShortsHandles=typeof DEFAULT_SHORTS;
export function shortsHandles(input:unknown):ShortsHandles|null{
  if(!input||typeof input!=='object')return null;
  const source=input as Record<string,unknown>,result={...DEFAULT_SHORTS};
  for(const platform of ['youtube','instagram','tiktok'] as const){
    const value=typeof source[platform]==='string'?source[platform].trim().replace(/^@/,''):'';
    if(!/^[a-zA-Z0-9_.-]{2,30}$/.test(value)||value.startsWith('.')||value.endsWith('.'))return null;
    result[platform]=value;
  }
  return result;
}
export function shortsSources(handles:ShortsHandles){return {
  youtube:{handle:handles.youtube,url:`https://www.youtube.com/@${handles.youtube}/shorts`},
  instagram:{handle:handles.instagram,url:`https://www.instagram.com/${handles.instagram}/reels/`},
  tiktok:{handle:handles.tiktok,url:`https://www.tiktok.com/@${handles.tiktok}`},
}}
