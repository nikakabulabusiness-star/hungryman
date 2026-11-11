CREATE TABLE `staff_departments` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`head_name` text DEFAULT '' NOT NULL,
	`director_name` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`head_user_id` text,
	`director_user_id` text,
	`updated` integer NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `staff_positions` ADD `department_id` text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE `staff_positions` ADD `hierarchy_rank` integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `staff_positions` ADD `reports_to` text;--> statement-breakpoint
ALTER TABLE `staff_positions` ADD `permissions_json` text;--> statement-breakpoint
ALTER TABLE `staff_positions` ADD `is_deleted` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
INSERT INTO staff_departments (id,name,sort_order,head_name,director_name,description,updated,updated_by) VALUES ('leadership','ხელმძღვანელობა',0,'გუგა ჭყონია · ნიკოლოზ ვასაძე','','Owner-ები მართავენ გუნდს და თავიანთ დეპარტამენტებს.',1792775677642,'migration:role-permissions');
--> statement-breakpoint
INSERT INTO staff_departments (id,name,sort_order,head_name,director_name,description,updated,updated_by) VALUES ('hr','ადამიანური რესურსები',1,'HR','','გუნდის მიღება, ანგარიშები, შვებულება და თანამშრომლების მართვა — Owner-ის შემდეგ.',1792775677642,'migration:role-permissions');
--> statement-breakpoint
INSERT INTO staff_departments (id,name,sort_order,head_name,director_name,description,updated,updated_by) VALUES ('story','სცენარი / ორგანიზება',2,'ნიკოლოზ ვასაძე (ვასა)','კონსტანტინე კარანაძე','კრეატიული დირექტორი ხელმძღვანელობს სცენარისტების, პროდიუსერებისა და ორგანიზატორების მუშაობას.',1792775677642,'migration:role-permissions');
--> statement-breakpoint
INSERT INTO staff_departments (id,name,sort_order,head_name,director_name,description,updated,updated_by) VALUES ('production','გადაღება / მონტაჟი',3,'გუგა ჭყონია','შოთა დვალიშვილი','ტექნიკური დირექტორი ხელმძღვანელობს გადაღების ტექნიკურ გუნდს. მონტაჟის გუნდი პირდაპირ გუგა ჭყონიას ექვემდებარება.',1792775677642,'migration:role-permissions');
--> statement-breakpoint
INSERT INTO staff_departments (id,name,sort_order,head_name,director_name,description,updated,updated_by) VALUES ('social','სოციალური მედია',4,'ნიკოლოზ ვასაძე','','კონტენტ კრეატორი და სოციალური მედიის გუნდი პირდაპირ ნიკოლოზ ვასაძეს ექვემდებარება.',1792775677642,'migration:role-permissions');
--> statement-breakpoint
INSERT INTO staff_departments (id,name,sort_order,head_name,director_name,description,updated,updated_by) VALUES ('other','სხვა პოზიციები',5,'','','ახალი ან საერთო ფუნქციის პოზიციები.',1792775677642,'migration:role-permissions');
--> statement-breakpoint
INSERT INTO staff_positions (name,is_active,created,updated,updated_by,department_id,hierarchy_rank,reports_to) VALUES ('Owner',1,1792775677642,1792775677642,'migration:role-permissions','leadership',0,NULL) ON CONFLICT(name) DO UPDATE SET department_id=excluded.department_id,hierarchy_rank=excluded.hierarchy_rank,reports_to=excluded.reports_to;
--> statement-breakpoint
INSERT INTO staff_positions (name,is_active,created,updated,updated_by,department_id,hierarchy_rank,reports_to) VALUES ('HR',1,1792775677642,1792775677642,'migration:role-permissions','hr',5,'Owner') ON CONFLICT(name) DO UPDATE SET department_id=excluded.department_id,hierarchy_rank=excluded.hierarchy_rank,reports_to=excluded.reports_to;
--> statement-breakpoint
INSERT INTO staff_positions (name,is_active,created,updated,updated_by,department_id,hierarchy_rank,reports_to) VALUES ('კრეატიული დირექტორი',1,1792775677642,1792775677642,'migration:role-permissions','story',10,'ნიკოლოზ ვასაძე') ON CONFLICT(name) DO UPDATE SET department_id=excluded.department_id,hierarchy_rank=excluded.hierarchy_rank,reports_to=excluded.reports_to;
--> statement-breakpoint
INSERT INTO staff_positions (name,is_active,created,updated,updated_by,department_id,hierarchy_rank,reports_to) VALUES ('სცენარისტი',1,1792775677642,1792775677642,'migration:role-permissions','story',50,'კრეატიული დირექტორი') ON CONFLICT(name) DO UPDATE SET department_id=excluded.department_id,hierarchy_rank=excluded.hierarchy_rank,reports_to=excluded.reports_to;
--> statement-breakpoint
INSERT INTO staff_positions (name,is_active,created,updated,updated_by,department_id,hierarchy_rank,reports_to) VALUES ('რეჟისორი',1,1792775677642,1792775677642,'migration:role-permissions','production',25,'ტექნიკური დირექტორი') ON CONFLICT(name) DO UPDATE SET department_id=excluded.department_id,hierarchy_rank=excluded.hierarchy_rank,reports_to=excluded.reports_to;
--> statement-breakpoint
INSERT INTO staff_positions (name,is_active,created,updated,updated_by,department_id,hierarchy_rank,reports_to) VALUES ('პროდიუსერი',1,1792775677642,1792775677642,'migration:role-permissions','story',25,'კრეატიული დირექტორი') ON CONFLICT(name) DO UPDATE SET department_id=excluded.department_id,hierarchy_rank=excluded.hierarchy_rank,reports_to=excluded.reports_to;
--> statement-breakpoint
INSERT INTO staff_positions (name,is_active,created,updated,updated_by,department_id,hierarchy_rank,reports_to) VALUES ('Senior Editor',1,1792775677644,1792775677644,'migration:role-permissions','production',20,'გუგა ჭყონია') ON CONFLICT(name) DO UPDATE SET department_id=excluded.department_id,hierarchy_rank=excluded.hierarchy_rank,reports_to=excluded.reports_to;
--> statement-breakpoint
INSERT INTO staff_positions (name,is_active,created,updated,updated_by,department_id,hierarchy_rank,reports_to) VALUES ('Video Editor',1,1792775677644,1792775677644,'migration:role-permissions','production',30,'გუგა ჭყონია') ON CONFLICT(name) DO UPDATE SET department_id=excluded.department_id,hierarchy_rank=excluded.hierarchy_rank,reports_to=excluded.reports_to;
--> statement-breakpoint
INSERT INTO staff_positions (name,is_active,created,updated,updated_by,department_id,hierarchy_rank,reports_to) VALUES ('Thumbnail Designer',1,1792775677644,1792775677644,'migration:role-permissions','production',50,'გუგა ჭყონია') ON CONFLICT(name) DO UPDATE SET department_id=excluded.department_id,hierarchy_rank=excluded.hierarchy_rank,reports_to=excluded.reports_to;
--> statement-breakpoint
INSERT INTO staff_positions (name,is_active,created,updated,updated_by,department_id,hierarchy_rank,reports_to) VALUES ('Shorts Video Editor',1,1792775677644,1792775677644,'migration:role-permissions','production',35,'გუგა ჭყონია') ON CONFLICT(name) DO UPDATE SET department_id=excluded.department_id,hierarchy_rank=excluded.hierarchy_rank,reports_to=excluded.reports_to;
--> statement-breakpoint
INSERT INTO staff_positions (name,is_active,created,updated,updated_by,department_id,hierarchy_rank,reports_to) VALUES ('Content Creator',1,1792775677644,1792775677644,'migration:role-permissions','social',50,'ნიკოლოზ ვასაძე') ON CONFLICT(name) DO UPDATE SET department_id=excluded.department_id,hierarchy_rank=excluded.hierarchy_rank,reports_to=excluded.reports_to;
--> statement-breakpoint
INSERT INTO staff_positions (name,is_active,created,updated,updated_by,department_id,hierarchy_rank,reports_to) VALUES ('სოციალური მედია',1,1792775677644,1792775677644,'migration:role-permissions','social',50,'ნიკოლოზ ვასაძე') ON CONFLICT(name) DO UPDATE SET department_id=excluded.department_id,hierarchy_rank=excluded.hierarchy_rank,reports_to=excluded.reports_to;
--> statement-breakpoint
INSERT INTO staff_positions (name,is_active,created,updated,updated_by,department_id,hierarchy_rank,reports_to) VALUES ('ორგანიზატორი',1,1792775677644,1792775677644,'migration:role-permissions','story',50,'კრეატიული დირექტორი') ON CONFLICT(name) DO UPDATE SET department_id=excluded.department_id,hierarchy_rank=excluded.hierarchy_rank,reports_to=excluded.reports_to;
--> statement-breakpoint
INSERT INTO staff_positions (name,is_active,created,updated,updated_by,department_id,hierarchy_rank,reports_to) VALUES ('ოპერატორი',1,1792775677644,1792775677644,'migration:role-permissions','production',50,'ტექნიკური დირექტორი') ON CONFLICT(name) DO UPDATE SET department_id=excluded.department_id,hierarchy_rank=excluded.hierarchy_rank,reports_to=excluded.reports_to;
--> statement-breakpoint
INSERT INTO staff_positions (name,is_active,created,updated,updated_by,department_id,hierarchy_rank,reports_to) VALUES ('ხმის რეჟისორი',1,1792775677644,1792775677644,'migration:role-permissions','production',50,'ტექნიკური დირექტორი') ON CONFLICT(name) DO UPDATE SET department_id=excluded.department_id,hierarchy_rank=excluded.hierarchy_rank,reports_to=excluded.reports_to;
--> statement-breakpoint
INSERT INTO staff_positions (name,is_active,created,updated,updated_by,department_id,hierarchy_rank,reports_to) VALUES ('ხმის ოპერატორი',1,1792775677644,1792775677644,'migration:role-permissions','production',50,'ტექნიკური დირექტორი') ON CONFLICT(name) DO UPDATE SET department_id=excluded.department_id,hierarchy_rank=excluded.hierarchy_rank,reports_to=excluded.reports_to;
--> statement-breakpoint
INSERT INTO staff_positions (name,is_active,created,updated,updated_by,department_id,hierarchy_rank,reports_to) VALUES ('ტექნიკური დირექტორი',1,1792775677644,1792775677644,'migration:role-permissions','production',10,NULL) ON CONFLICT(name) DO UPDATE SET department_id=excluded.department_id,hierarchy_rank=excluded.hierarchy_rank,reports_to=excluded.reports_to;
--> statement-breakpoint
INSERT INTO staff_positions (name,is_active,created,updated,updated_by,department_id,hierarchy_rank,reports_to) VALUES ('ადმინისტრატორი',1,1792775677644,1792775677644,'migration:role-permissions','other',50,NULL) ON CONFLICT(name) DO UPDATE SET department_id=excluded.department_id,hierarchy_rank=excluded.hierarchy_rank,reports_to=excluded.reports_to;
--> statement-breakpoint
INSERT OR IGNORE INTO staff_positions (name,is_active,created,updated,updated_by) SELECT DISTINCT role,1,1792775677644,1792775677644,'migration:existing-role' FROM admin_users WHERE role IS NOT NULL AND role<>'' AND role<>'Developer';
