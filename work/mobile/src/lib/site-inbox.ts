export type InboxKind='feedback'|'applications'|'emails';
export const inboxKinds:{id:InboxKind;label:string}[]=[{id:'feedback',label:'შეტყობინებები'},{id:'applications',label:'კასტინგის განაცხადები'},{id:'emails',label:'საქმიანი ფოსტა'}];
export const inboxStatuses=[{value:'new',label:'ახალი'},{value:'reviewed',label:'განხილული'},{value:'archived',label:'დაარქივებული'}];
export type InboxRow={id:string;name?:string;email?:string;phone?:string;sender?:string;subject?:string;message?:string;body?:string;category?:string;casting_title?:string;status:string;created_at?:number;received_at?:number;answers?:{label?:string;value?:string;question?:string}[]};
export type InboxData={rows:InboxRow[];hasMore:boolean;offset:number};
