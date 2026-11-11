-- Reset at migration execution time, including sessions refreshed while deployment was building. Preserve manual modes and sources.
UPDATE staff_attendance SET office_minutes = 0, first_arrival = NULL, last_departure = NULL, open_since = NULL, last_confirmed = NULL;
