/** Portable personal/assigned task and professional contact API contracts. */
export type WorkTaskScope='private'|'assigned';
export type WorkTaskPriority='low'|'normal'|'high';
export type WorkTaskCheck={id:string;title:string;done:boolean};
export type WorkTaskPerson={userId:string;name:string;role:string;departmentIds:string[]};
export type WorkTask={id:string;title:string;description:string;scope:WorkTaskScope;creatorId:string;creatorName:string;assigneeId:string;assigneeName:string;departmentId:string;priority:WorkTaskPriority;progress:number;checklist:WorkTaskCheck[];dueDate:string|null;created:number;updated:number;version:number;permissions:{edit:boolean;delete:boolean;progress:boolean}};
export type WorkTaskList={tasks:WorkTask[];people:WorkTaskPerson[];canAssign:boolean;viewerId:string;nextCursor:string|null};
export type WorkTaskCreate={id?:string;scope:WorkTaskScope;title:string;description?:string;assigneeId?:string;priority?:WorkTaskPriority;dueDate?:string|null;checklist?:WorkTaskCheck[]};
export type WorkTaskMutation={version:number;title?:string;description?:string;assigneeId?:string;priority?:WorkTaskPriority;dueDate?:string|null;progress?:number;checklist?:WorkTaskCheck[]};
export type WorkContact={id:string;company:string;category:string;firstName:string;lastName:string;position:string;phone:string;email:string;notes:string;created:number;updated:number;createdBy:string;updatedBy:string;version:number};
export type WorkContactInput=Pick<WorkContact,'company'|'category'|'firstName'|'lastName'|'position'|'phone'|'email'|'notes'>;
export type WorkContactList={contacts:WorkContact[];canManage:boolean;nextCursor:string|null};
export type WorkContactMutation=Partial<WorkContactInput>&{version:number};
