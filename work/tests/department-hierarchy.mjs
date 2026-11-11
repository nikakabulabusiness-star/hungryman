import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
const sql=new DatabaseSync(':memory:');
const migrations=fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort();
for(const f of migrations.filter(f=>!f.startsWith('0022_')))sql.exec(fs.readFileSync('drizzle/'+f,'utf8').replaceAll('--> statement-breakpoint',''));
// Existing permissions, tombstones and account identities must survive the structural migration.
sql.exec("UPDATE staff_positions SET is_active=0,permissions_json='[\"workspace.view\"]' WHERE name='Video Editor'; UPDATE staff_positions SET is_deleted=1 WHERE name='Shorts Video Editor'; INSERT INTO admin_users(email,role,status,created,created_by) VALUES ('editor@example.test','Video Editor','approved',1,'fixture');");
const before=sql.prepare('SELECT name,is_active,is_deleted,permissions_json FROM staff_positions ORDER BY name').all();
sql.exec(fs.readFileSync('drizzle/0022_department_levels.sql','utf8').replaceAll('--> statement-breakpoint',''));
for(const row of before)assert.deepEqual(sql.prepare('SELECT name,is_active,is_deleted,permissions_json FROM staff_positions WHERE name=?').get(row.name),row);
assert.equal(sql.prepare('SELECT role FROM admin_users').get().role,'Video Editor');
assert.equal(sql.prepare('SELECT count(*) n FROM staff_departments').get().n,6);
assert.deepEqual(sql.prepare('SELECT name FROM staff_departments ORDER BY sort_order').all().map(r=>r.name),['პოსტ ფროდაქშენი','სცენარი და ორგანიზება','ტექნიკური მართვა','პრე ფროდაქშენი','ადამიანური რესურსები','სოც მედია და კონტენტი']);
assert.ok(sql.prepare('SELECT head_name FROM staff_departments').all().every(r=>r.head_name==='დამფუძნებელი'));
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/department-directory.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
const rows=sql.prepare('SELECT * FROM staff_positions').all().map(r=>({name:r.name,active:!!r.is_active,departmentId:r.department_id,rank:r.hierarchy_rank,reportsTo:r.reports_to,memberships:JSON.parse(r.memberships_json)}));
const expected={production:[['პროდიუსერი'],['Senior Editor'],['Shorts Video Editor','Video Editor']],story:[['პროდიუსერი'],['რეჟისორი'],['კრეატიული დირექტორი'],['პროდიუსერის ასისტენტი'],['ორგანიზატორი','სცენარისტი']],technical:[['ტექნიკური დირექტორი']],preproduction:[['პროდიუსერი'],['კრეატიული დირექტორი'],['პროდიუსერის ასისტენტი'],['ოპერატორი','ორგანიზატორი']],hr:[['HR']],social:[['Content Creator','სოციალური მედია']]};
for(const [id,levels] of Object.entries(expected)){
 const actual=exports.hierarchyInDepartment(rows,id);
 assert.equal(actual.length,levels.flat().length,id);
 levels.forEach((roles,index)=>assert.deepEqual(Array.from(actual.filter(r=>r.displayLevel===index+1),r=>r.name).sort(),roles.sort(),id+' level '+(index+1)));
 for(const r of actual){assert.equal(r.level,r.displayLevel);if(r.level===1)assert.equal(r.reportsTo,'Owner');else assert.equal(actual.find(p=>p.name===r.reportsTo).level,r.level-1)}
}
assert.ok(JSON.parse(sql.prepare('SELECT permissions_json FROM staff_positions WHERE name=?').get('პროდიუსერის ასისტენტი').permissions_json).includes('workspace.view'));
assert.equal(rows.find(r=>r.name==='პროდიუსერი').memberships.length,3);
assert.equal(rows.find(r=>r.name==='პროდიუსერის ასისტენტი').memberships.length,2);
assert.equal(exports.roleLabel('Owner'),'დამფუძნებელი');
assert.equal(exports.levelColor(0,5),'hsl(0, 72%, 62%)');assert.equal(exports.levelColor(5,5),'hsl(145, 72%, 62%)');
assert.equal(exports.isSubordinateRole('კრეატიული დირექტორი','პროდიუსერი'),false);
assert.equal(exports.isSubordinateRole('კრეატიული დირექტორი','პროდიუსერის ასისტენტი'),true);
assert.equal(exports.isSubordinateRole('ტექნიკური დირექტორი','Video Editor'),false);
console.log('PASS six-department migration: preserved accounts/permissions/statuses, exact parallel tiers, founder parents, multi-department roles, level colors and reporting boundaries.');
