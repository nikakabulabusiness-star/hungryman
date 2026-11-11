export const socialPlatforms=['instagram','facebook','tiktok'] as const;
export type SocialPlatform=typeof socialPlatforms[number];
export const socialLabels={instagram:'Instagram',facebook:'Facebook',tiktok:'TikTok'};
export const socialFields=['followers','views','likes','comments','shares','posts'] as const;
export const socialMetricLabels={followers:'გამომწერები · თვის ბოლოს',views:'ნახვები',likes:'მოწონებები',comments:'კომენტარები',shares:'გაზიარებები',posts:'პოსტები'};
export type SocialMetric={platform:SocialPlatform;month:string;source:string;updated:number}&Record<typeof socialFields[number],number|null>;
export type SocialData={year:number;links:Record<SocialPlatform,string>;metrics:SocialMetric[];connection:'not_connected'};
export function canUseSocial(role:string|null|undefined){return ['Content Creator','სოციალური მედია','Developer'].includes(role||'')}
export function safeSocialLink(value:unknown){if(typeof value!=='string'||value.length>2048)return null;const text=value.trim();if(!text)return '';try{const url=new URL(text);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null}catch{return null}}
