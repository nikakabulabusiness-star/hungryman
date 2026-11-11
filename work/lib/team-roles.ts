export const teamRoles=['HR','კრეატიული დირექტორი','სცენარისტი','რეჟისორი','პროდიუსერი','პროდიუსერის ასისტენტი','Senior Editor','Video Editor','Thumbnail Designer','Shorts Video Editor','Content Creator','სოციალური მედია','ორგანიზატორი','ოპერატორი','ხმის რეჟისორი','ხმის ოპერატორი','ტექნიკური დირექტორი','ადმინისტრატორი'] as const;
export type TeamRole=string;
export const teamStatuses=['pending','approved','suspended'] as const;
export type TeamStatus=typeof teamStatuses[number];
export type TeamMember={user_id:string;email:string;full_name:string;phone:string;role:string|null;status:TeamStatus;created:number;updated:number;approved_by:string|null;avatar_key?:string|null;last_seen?:number};
