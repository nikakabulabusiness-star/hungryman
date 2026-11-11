export const applicationStatuses={new:'ახალი',reviewing:'განხილვაში',interview:'გასაუბრება',task:'პრაქტიკული დავალება',accepted:'მიღებული',rejected:'უარყოფილი'} as const;
export type ApplicationStatus=keyof typeof applicationStatuses;
