import {storage} from './storage';
export {mapCoordinates} from './map-coordinates';
export type MapPlace={id:string;name:string;latitude:number;longitude:number;url:string|null;photo_id:string|null;updated:number};
export async function listPlaces(){return (await storage().DB.prepare('SELECT id,name,latitude,longitude,url,photo_id,updated FROM workspace_places ORDER BY name,id LIMIT 100').all<MapPlace>()).results}
