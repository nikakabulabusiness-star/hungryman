ALTER TABLE `staff_positions` ADD `memberships_json` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
DELETE FROM staff_departments WHERE id IN ('leadership','other');
--> statement-breakpoint
INSERT INTO staff_departments (id,name,sort_order,head_name,director_name,description,updated,updated_by) VALUES ('production','პოსტ ფროდაქშენი','0','დამფუძნებელი','პროდიუსერი','მონტაჟი და ვიდეოს საბოლოო დამუშავება.','1792782579320','migration:department-levels') ON CONFLICT(id) DO UPDATE SET name=excluded.name,sort_order=excluded.sort_order,head_name=excluded.head_name,director_name=excluded.director_name,description=excluded.description,head_user_id=NULL,director_user_id=NULL,updated=excluded.updated,updated_by=excluded.updated_by;
--> statement-breakpoint
INSERT INTO staff_departments (id,name,sort_order,head_name,director_name,description,updated,updated_by) VALUES ('story','სცენარი და ორგანიზება','1','დამფუძნებელი','პროდიუსერი','სცენარი, რეჟისურა და გადაღების ორგანიზება.','1792782579320','migration:department-levels') ON CONFLICT(id) DO UPDATE SET name=excluded.name,sort_order=excluded.sort_order,head_name=excluded.head_name,director_name=excluded.director_name,description=excluded.description,head_user_id=NULL,director_user_id=NULL,updated=excluded.updated,updated_by=excluded.updated_by;
--> statement-breakpoint
INSERT INTO staff_departments (id,name,sort_order,head_name,director_name,description,updated,updated_by) VALUES ('technical','ტექნიკური მართვა','2','დამფუძნებელი','ტექნიკური დირექტორი','ტექნიკური მართვა და მხარდაჭერა.','1792782579320','migration:department-levels') ON CONFLICT(id) DO UPDATE SET name=excluded.name,sort_order=excluded.sort_order,head_name=excluded.head_name,director_name=excluded.director_name,description=excluded.description,head_user_id=NULL,director_user_id=NULL,updated=excluded.updated,updated_by=excluded.updated_by;
--> statement-breakpoint
INSERT INTO staff_departments (id,name,sort_order,head_name,director_name,description,updated,updated_by) VALUES ('preproduction','პრე ფროდაქშენი','3','დამფუძნებელი','პროდიუსერი','გადაღებისთვის მომზადება და დაგეგმვა.','1792782579320','migration:department-levels') ON CONFLICT(id) DO UPDATE SET name=excluded.name,sort_order=excluded.sort_order,head_name=excluded.head_name,director_name=excluded.director_name,description=excluded.description,head_user_id=NULL,director_user_id=NULL,updated=excluded.updated,updated_by=excluded.updated_by;
--> statement-breakpoint
INSERT INTO staff_departments (id,name,sort_order,head_name,director_name,description,updated,updated_by) VALUES ('hr','ადამიანური რესურსები','4','დამფუძნებელი','HR','თანამშრომლები და ადამიანური რესურსების მართვა.','1792782579320','migration:department-levels') ON CONFLICT(id) DO UPDATE SET name=excluded.name,sort_order=excluded.sort_order,head_name=excluded.head_name,director_name=excluded.director_name,description=excluded.description,head_user_id=NULL,director_user_id=NULL,updated=excluded.updated,updated_by=excluded.updated_by;
--> statement-breakpoint
INSERT INTO staff_departments (id,name,sort_order,head_name,director_name,description,updated,updated_by) VALUES ('social','სოც მედია და კონტენტი','5','დამფუძნებელი','','სოციალური ქსელები და კონტენტის შექმნა.','1792782579320','migration:department-levels') ON CONFLICT(id) DO UPDATE SET name=excluded.name,sort_order=excluded.sort_order,head_name=excluded.head_name,director_name=excluded.director_name,description=excluded.description,head_user_id=NULL,director_user_id=NULL,updated=excluded.updated,updated_by=excluded.updated_by;
--> statement-breakpoint
UPDATE staff_positions SET department_id=CASE WHEN name IN ('Owner','Developer') THEN 'leadership' ELSE 'other' END,hierarchy_rank=CASE WHEN name IN ('Owner','Developer') THEN 0 ELSE 1 END,reports_to=CASE WHEN name IN ('Owner','Developer') THEN NULL ELSE 'Owner' END;
--> statement-breakpoint
INSERT OR IGNORE INTO staff_positions (name,is_active,created,updated,updated_by,permissions_json) VALUES ('პროდიუსერის ასისტენტი',1,1792782579320,1792782579320,'migration:department-levels','["workspace.view","cabinet.view","cabinet.notes","cabinet.leave.request","chat.view","chat.send","chat.attach","chat.call","chat.create_group","chat.manage_group","shoots.view","calendar.view","departments.view"]');
--> statement-breakpoint
UPDATE staff_positions SET memberships_json='[{"departmentId":"hr","level":1,"reportsTo":"Owner"}]',department_id='hr',hierarchy_rank=1,reports_to='Owner' WHERE name='HR';
--> statement-breakpoint
UPDATE staff_positions SET memberships_json='[{"departmentId":"story","level":3,"reportsTo":"რეჟისორი"},{"departmentId":"preproduction","level":2,"reportsTo":"პროდიუსერი"}]',department_id='story',hierarchy_rank=3,reports_to='რეჟისორი' WHERE name='კრეატიული დირექტორი';
--> statement-breakpoint
UPDATE staff_positions SET memberships_json='[{"departmentId":"story","level":5,"reportsTo":"პროდიუსერის ასისტენტი"}]',department_id='story',hierarchy_rank=5,reports_to='პროდიუსერის ასისტენტი' WHERE name='სცენარისტი';
--> statement-breakpoint
UPDATE staff_positions SET memberships_json='[{"departmentId":"story","level":2,"reportsTo":"პროდიუსერი"}]',department_id='story',hierarchy_rank=2,reports_to='პროდიუსერი' WHERE name='რეჟისორი';
--> statement-breakpoint
UPDATE staff_positions SET memberships_json='[{"departmentId":"production","level":1,"reportsTo":"Owner"},{"departmentId":"story","level":1,"reportsTo":"Owner"},{"departmentId":"preproduction","level":1,"reportsTo":"Owner"}]',department_id='production',hierarchy_rank=1,reports_to='Owner' WHERE name='პროდიუსერი';
--> statement-breakpoint
UPDATE staff_positions SET memberships_json='[{"departmentId":"story","level":4,"reportsTo":"კრეატიული დირექტორი"},{"departmentId":"preproduction","level":3,"reportsTo":"კრეატიული დირექტორი"}]',department_id='story',hierarchy_rank=4,reports_to='კრეატიული დირექტორი' WHERE name='პროდიუსერის ასისტენტი';
--> statement-breakpoint
UPDATE staff_positions SET memberships_json='[{"departmentId":"production","level":2,"reportsTo":"პროდიუსერი"}]',department_id='production',hierarchy_rank=2,reports_to='პროდიუსერი' WHERE name='Senior Editor';
--> statement-breakpoint
UPDATE staff_positions SET memberships_json='[{"departmentId":"production","level":3,"reportsTo":"Senior Editor"}]',department_id='production',hierarchy_rank=3,reports_to='Senior Editor' WHERE name='Video Editor';
--> statement-breakpoint
UPDATE staff_positions SET memberships_json='[{"departmentId":"production","level":3,"reportsTo":"Senior Editor"}]',department_id='production',hierarchy_rank=3,reports_to='Senior Editor' WHERE name='Shorts Video Editor';
--> statement-breakpoint
UPDATE staff_positions SET memberships_json='[{"departmentId":"social","level":1,"reportsTo":"Owner"}]',department_id='social',hierarchy_rank=1,reports_to='Owner' WHERE name='Content Creator';
--> statement-breakpoint
UPDATE staff_positions SET memberships_json='[{"departmentId":"social","level":1,"reportsTo":"Owner"}]',department_id='social',hierarchy_rank=1,reports_to='Owner' WHERE name='სოციალური მედია';
--> statement-breakpoint
UPDATE staff_positions SET memberships_json='[{"departmentId":"story","level":5,"reportsTo":"პროდიუსერის ასისტენტი"},{"departmentId":"preproduction","level":4,"reportsTo":"პროდიუსერის ასისტენტი"}]',department_id='story',hierarchy_rank=5,reports_to='პროდიუსერის ასისტენტი' WHERE name='ორგანიზატორი';
--> statement-breakpoint
UPDATE staff_positions SET memberships_json='[{"departmentId":"preproduction","level":4,"reportsTo":"პროდიუსერის ასისტენტი"}]',department_id='preproduction',hierarchy_rank=4,reports_to='პროდიუსერის ასისტენტი' WHERE name='ოპერატორი';
--> statement-breakpoint
UPDATE staff_positions SET memberships_json='[{"departmentId":"technical","level":1,"reportsTo":"Owner"}]',department_id='technical',hierarchy_rank=1,reports_to='Owner' WHERE name='ტექნიკური დირექტორი';
