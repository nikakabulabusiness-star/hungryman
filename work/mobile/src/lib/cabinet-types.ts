export type Balance={allowance:number|null;used:number;reserved:number;remaining:number|null};
export type CabinetStats={month:string;year:number;workedDays:number;workedHours:number;overtimeHours:number;remoteDays:number;shootDays:number;leave:Balance;dayOff:Balance;sick:Balance};
export type TimeOff={id:string;user_id:string;email:string;employee_name:string;kind:'leave'|'day_off'|'sick';start_date:string;end_date:string;comment:string;status:'pending'|'approved'|'rejected'|'cancelled';created:number;resolved:number|null;response:string;seen:number|null};
export type TimeOffData={requests:TimeOff[];pending:number;unread:number;canReview:boolean;people?:{email:string;fullName:string}[]};
export const leaveLabels={leave:'შვებულება',day_off:'დეი ოფი',sick:'ბიულეტენი'};
export const decisionLabels={pending:'განხილვის მოლოდინში',approved:'დადასტურებულია',rejected:'უარყოფილია',cancelled:'გაუქმებულია'};
