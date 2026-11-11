import type { Department,DepartmentMembership } from '../../../lib/department-directory';
import type { PermissionKey } from './permissions';
export * from '../../../lib/department-directory';

export type Position = { name:string; active:boolean; system:boolean; departmentId:string; rank:number; reportsTo:string|null; permissions:PermissionKey[];memberships:DepartmentMembership[] };
export type PositionsData = { positions:Position[]; editableNames:string[] };
export type DepartmentsData = {
  departments:Department[];
  positions:Pick<Position,'name'|'active'|'departmentId'|'rank'|'reportsTo'|'memberships'>[];
  people:{userId:string|null;name:string;role:string;departmentId:string}[];
};
