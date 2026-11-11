/** Merge paginated/detail/optimistic records without letting an older page win. */
export function newestWorkRecords<T extends {id:string;version:number}>(...groups:ReadonlyArray<ReadonlyArray<T>>):T[]{
 const records=new Map<string,T>();
 for(const group of groups)for(const item of group){const current=records.get(item.id);if(!current||item.version>=current.version)records.set(item.id,item)}
 return [...records.values()];
}
