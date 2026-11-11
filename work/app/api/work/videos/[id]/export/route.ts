import { getWorkContext, workRouteError, WorkError } from '@/lib/work-policy';
import { getWorkVideoDetail } from '@/lib/work-store';
import { getShoot } from '@/lib/shoots';
import { hasPermission } from '@/lib/permissions';
import { storage } from '@/lib/storage';
import { buildWorkArchiveHtml, buildWorkBudgetCsv } from '@/lib/work-export';
import { buildWorkZip, WorkZipLimitError, type WorkZipEntry } from '@/lib/work-zip';
import type { WorkBoard, WorkHistory, WorkSnapshot, WorkVideo, WorkVideoDetail } from '@/mobile/src/lib/work-model';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };
type SnapshotData = WorkSnapshot['data'];
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const archiveLimit = 24 * 1024 * 1024, metadataLimit = 8 * 1024 * 1024, fileLimit = 200;
const encoder = new TextEncoder();
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cross-Origin-Resource-Policy': 'same-origin' };
const csp = "default-src 'none'; script-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";
const oversized = () => new WorkError(413, 'სრული არქივი 24 MB-ს ან მონაცემების დასაშვებ მოცულობას აღემატება. ჩამოტვირთე ქოლშითი და ფაილები ცალ-ცალკე.');

function validSnapshot(value: unknown): value is SnapshotData & { videoId: string; version: number } {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>, sheet = row.callSheet as Record<string, unknown> | undefined, content = row.content as Record<string, unknown> | undefined, technical = row.technical as Record<string, unknown> | undefined, totals = row.totals as Record<string, unknown> | undefined;
  return typeof row.title === 'string' && (row.kind === 'short' || row.kind === 'video') && Number.isInteger(row.version) && Number(row.version) > 0 && typeof row.videoId === 'string'
    && !!sheet && ['days', 'crew', 'locations', 'scenes', 'needs', 'budget', 'photoIds'].every(key => Array.isArray(sheet[key]))
    && !!content && ['summary', 'idea', 'script', 'requirements'].every(key => typeof content[key] === 'string') && Array.isArray(content.photoIds)
    && !!technical && Array.isArray(technical.items) && Array.isArray(technical.photoIds)
    && (row.approvedTechnical === null || !!row.approvedTechnical && typeof row.approvedTechnical === 'object' && Array.isArray((row.approvedTechnical as Record<string, unknown>).items))
    && !!totals && ['base', 'technicalApproved', 'technicalPending', 'grandTotal'].every(key => typeof totals[key] === 'number' && Number.isFinite(totals[key]));
}

function fileIds(data: SnapshotData): string[] {
  return [data.content.coverId, ...data.content.photoIds, ...data.callSheet.photoIds,
    ...data.callSheet.locations.flatMap(location => location.photoIds), ...data.technical.photoIds,
    ...(data.approvedTechnical?.photoIds || [])].filter((id): id is string => !!id);
}

/** Archive queries must not inherit the UI's history limits or quietly return an incomplete export. */
async function completeHistory(detail: WorkVideoDetail, cutoff: number, includeSnapshotBodies: boolean) {
  const { DB } = storage(), args = [detail.video.id, detail.video.version, cutoff];
  const where = 'video_id=? AND version<=? AND created<=?';
  const [historySize, snapshotSize] = await Promise.all([
    DB.prepare(`SELECT COUNT(*) AS n,COALESCE(SUM(length(CAST(comment AS BLOB))+length(CAST(actor_name AS BLOB))+256),0) AS bytes FROM work_video_history WHERE ${where}`).bind(...args).first<{ n: number; bytes: number }>(),
    DB.prepare(`SELECT COUNT(*) AS n,COALESCE(SUM(${includeSnapshotBodies ? 'length(CAST(data_json AS BLOB))+' : ''}256),0) AS bytes FROM work_video_snapshots WHERE ${where}`).bind(...args).first<{ n: number; bytes: number }>(),
  ]);
  if (!historySize || !snapshotSize) throw new WorkError(503, 'არქივის მოცულობა ვერ შემოწმდა.');
  if (historySize.n > 2000 || snapshotSize.n > 500 || historySize.bytes + snapshotSize.bytes > metadataLimit) throw oversized();
  const [history, snapshots] = await Promise.all([
    DB.prepare(`SELECT id,board,action,from_stage,to_stage,comment,actor_name,created,version FROM work_video_history WHERE ${where} ORDER BY created DESC,id DESC LIMIT 2001`).bind(...args).all<{ id: string; board: WorkBoard; action: string; from_stage: string | null; to_stage: string | null; comment: string; actor_name: string; created: number; version: number }>(),
    DB.prepare(`SELECT id,board,version,created,actor_name${includeSnapshotBodies ? ',data_json' : ''} FROM work_video_snapshots WHERE ${where} ORDER BY created DESC,id DESC LIMIT 501`).bind(...args).all<{ id: string; board: WorkBoard; version: number; created: number; actor_name: string; data_json?: string }>(),
  ]);
  if (history.results.length > 2000 || snapshots.results.length > 500) throw oversized();
  const historyRows: WorkHistory[] = history.results.map(row => ({ id: row.id, board: row.board, action: row.action, fromStage: row.from_stage, toStage: row.to_stage, comment: row.comment, actorName: row.actor_name, created: row.created, version: row.version }));
  const revisions = snapshots.results.map(row => ({ id: row.id, board: row.board, version: row.version, created: row.created, actorName: row.actor_name }));
  const snapshotRows: WorkSnapshot[] = includeSnapshotBodies ? snapshots.results.map((row, index) => ({ ...revisions[index], data: JSON.parse(row.data_json!) as SnapshotData })) : [];
  return { detail: { ...detail, history: historyRows, snapshots: snapshotRows }, revisions };
}

export async function GET(req: Request, { params }: Params) {
  try {
    const context = await getWorkContext(), { id } = await params, url = new URL(req.url), format = url.searchParams.get('format') || 'html', shootId = url.searchParams.get('shoot');
    if (!uuid.test(id)) throw new WorkError(404, 'ვიდეო ვერ მოიძებნა.');
    if (!['html', 'json', 'csv', 'zip'].includes(format)) throw new WorkError(400, 'ექსპორტის ფორმატი არასწორია.');
    let detail = await getWorkVideoDetail(id, context), cutoff = detail.video.updated;
    let frozenRecord: WorkSnapshot | null = null;
    let technicalApproval: { at: number; by: string } | undefined;
    let productionApproval: { version?: number; at?: number; by?: string } | undefined;
    let completion: { at: number; by?: string } | undefined;
    if (shootId) {
      if (!hasPermission(context.actor, 'shoots.view')) throw new WorkError(403, 'გადაღების ნახვის უფლება საჭიროა.');
      if (!uuid.test(shootId)) throw new WorkError(404, 'გადაღება ვერ მოიძებნა.');
      const shoot = await getShoot(shootId);
      if (!shoot || shoot.work_video_id !== id) throw new WorkError(404, 'გადაღება ამ პროექტს არ უკავშირდება.');
      let frozen: unknown;
      try { frozen = JSON.parse(shoot.work_snapshot || 'null'); } catch { frozen = null; }
      if (!validSnapshot(frozen) || frozen.videoId !== id) throw new WorkError(409, 'გადაღების დამტკიცებული არქივი ვერ მოიძებნა. მიმდინარე მონახაზი არ ჩამოიტვირთება.');
      const approval = frozen as unknown as { technicalApprovedAt?: unknown; technicalApprovedBy?: unknown; productionVersion?: unknown; approvedAt?: unknown; approvedBy?: unknown; completedAt?: unknown; completedBy?: unknown };
      const completed = shoot.status === 'completed' || typeof approval.completedAt === 'number' && approval.completedAt > 0;
      const frozenAt = Math.max(...[approval.approvedAt, approval.technicalApprovedAt, approval.completedAt].map(value => typeof value === 'number' && Number.isFinite(value) ? value : 0)) || shoot.updated;
      // Whitelist frozen content. Never fill missing approved content with a later unsent draft.
      const video: WorkVideo = { ...detail.video, title: frozen.title, kind: frozen.kind, content: frozen.content, callSheet: frozen.callSheet,
        technical: frozen.technical, approvedTechnical: frozen.approvedTechnical, totals: frozen.totals, version: frozen.version,
        updated: frozenAt, reviewNotes: {}, stages: { story: frozen.kind === 'video' ? 'approved' : null, production: frozen.kind === 'video' ? completed ? 'filmed' : 'scheduled' : null, editing: null, social: frozen.kind === 'short' ? completed ? 'done' : 'scheduled' : null, technical: frozen.approvedTechnical ? 'approved' : null },
        shoots: [{ id: shoot.id, dayId: shoot.work_day_id || '', date: shoot.shoot_date, status: shoot.status }] };
      detail = { ...detail, video }; cutoff = frozenAt;
      frozenRecord = { id: `shoot-${shoot.id}-v${frozen.version}`, board: frozen.kind === 'short' ? 'social' : 'production', version: frozen.version, created: frozenAt, actorName: shoot.updated_by || '', data: { title: frozen.title, kind: frozen.kind, content: frozen.content, callSheet: frozen.callSheet, technical: frozen.technical, approvedTechnical: frozen.approvedTechnical, totals: frozen.totals } };
      if (typeof approval.technicalApprovedAt === 'number' && typeof approval.technicalApprovedBy === 'string') technicalApproval = { at: approval.technicalApprovedAt, by: approval.technicalApprovedBy };
      productionApproval = { ...(typeof approval.productionVersion === 'number' ? { version: approval.productionVersion } : {}), ...(typeof approval.approvedAt === 'number' ? { at: approval.approvedAt } : {}), ...(typeof approval.approvedBy === 'string' ? { by: approval.approvedBy } : {}) };
      if (typeof approval.completedAt === 'number') completion = { at: approval.completedAt, ...(typeof approval.completedBy === 'string' ? { by: approval.completedBy } : {}) };
    }
    const name = `Hungryman-Work-${id}${shootId ? '-shoot-' + shootId : ''}-v${detail.video.version}`;
    const response = (body: BodyInit, mime: string, extension: string, inline = false) => new Response(body, { headers: { ...headers, 'Content-Type': mime, 'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${name}.${extension}"`, ...(extension === 'html' ? { 'Content-Security-Policy': csp } : {}) } });
    if (format === 'csv') return response(buildWorkBudgetCsv(detail.video), 'text/csv; charset=utf-8', 'csv');
    const archive = await completeHistory(detail, cutoff, !frozenRecord);
    detail = archive.detail;
    // A technical approval may snapshot live drafts of other boards. A shoot archive contains only its exact
    // combined approved snapshot; historical approval metadata is retained without those unrelated draft bodies.
    if (frozenRecord) detail.snapshots = [frozenRecord];
    const generatedAt = new Date(), source = { type: shootId ? 'approved-shoot' : 'work-project', shootId: shootId || null, version: detail.video.version, cutoff,
      ...(frozenRecord ? { revisionHistory: archive.revisions, productionApproval, technicalApproval, completion } : {}) };
    const payload = { schemaVersion: 1, exportedAt: generatedAt.toISOString(), timeZone: 'Asia/Tbilisi', moneyUnit: 'tetri', source,
      video: { ...detail.video, permissions: undefined }, history: detail.history, snapshots: detail.snapshots };
    const metadata = encoder.encode(JSON.stringify(payload, null, 2));
    if (metadata.length > metadataLimit) throw oversized();
    if (format === 'json') return response(metadata.buffer as ArrayBuffer, 'application/json; charset=utf-8', 'json');
    if (format === 'html') {
      const html = buildWorkArchiveHtml(detail);
      if (encoder.encode(html).length > metadataLimit * 2) throw oversized();
      return response(html, 'text/html; charset=utf-8', 'html', true);
    }

    const ids = [...new Set([detail.video, ...detail.snapshots.map(row => row.data)].flatMap(fileIds))];
    if (ids.length > fileLimit) throw oversized();
    if (ids.some(file => !uuid.test(file))) throw new WorkError(409, 'არქივში არასწორი ფაილის მითითებაა. სრული არქივი ვერ შეიქმნა.');
    type StoredFile = { id: string; object_key: string; mime: string; bytes: number };
    const { DB, BUCKET } = storage(), files: StoredFile[] = [];
    for (let offset = 0; offset < ids.length; offset += 50) {
      const batch = ids.slice(offset, offset + 50);
      // IDs come exclusively from this authorized project's saved/frozen records, never request input.
      const result = await DB.prepare(`SELECT id,object_key,mime,bytes FROM work_files WHERE id IN (${batch.map(() => '?').join(',')})`).bind(...batch).all<StoredFile>();
      files.push(...result.results);
    }
    if (files.length !== ids.length || new Set(files.map(file => file.id)).size !== ids.length) throw new WorkError(409, 'არქივის ერთ-ერთი ფოტო ვერ მოიძებნა. არასრული არქივი არ ჩამოიტვირთება.');
    if (files.some(file => !['image/jpeg', 'image/png'].includes(file.mime) || !Number.isSafeInteger(file.bytes) || file.bytes < 1)) throw new WorkError(409, 'არქივის ერთ-ერთი ფოტოს ფორმატი არასწორია.');
    const paths = new Map(files.map(file => [file.id, `files/${file.id}.${file.mime === 'image/png' ? 'png' : 'jpg'}`]));
    let html = buildWorkArchiveHtml(detail, { fileUrl: file => paths.get(file) || '' });
    html = html.replace('<head>', '<head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'none\'; img-src \'self\' file:; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'">');
    const entries: WorkZipEntry[] = [
      { name: 'index.html', data: encoder.encode(html) }, { name: 'project.json', data: metadata },
      { name: 'budget.csv', data: encoder.encode(buildWorkBudgetCsv(detail.video)) },
      { name: 'files.json', data: encoder.encode(JSON.stringify(Object.fromEntries(paths), null, 2)) },
      { name: 'README.txt', data: encoder.encode('Hungryman Work\n\nარქივი მთლიანად ამოარქივე. ქოლშითის სანახავად გახსენი index.html; PDF-ისთვის ბრაუზერში აირჩიე ბეჭდვა / Save as PDF.\nproject.json შეიცავს პროექტს, ისტორიასა და დამტკიცებულ ვერსიებს. თანხები მითითებულია თეთრებში.\nbudget.csv იხსნება Excel-ში; ტექნიკის მიმდინარე და დამტკიცებული გეგმები ჯამში არ ორმაგდება.\nfiles.json აკავშირებს ფოტოების ID-ებს files საქაღალდეში შენახულ ორიგინალებთან.\n') },
    ];
    let total = entries.reduce((sum, entry) => sum + entry.data.length, 0);
    if (total + files.reduce((sum, file) => sum + file.bytes, 0) + 100000 > archiveLimit) throw oversized();
    for (const file of files) {
      const object = await BUCKET.get(file.object_key);
      if (!object || object.size !== file.bytes) { if (object) await object.body.cancel(); throw new WorkError(409, 'არქივის ერთ-ერთი ფოტო მიუწვდომელია ან შეიცვალა. არასრული არქივი არ ჩამოიტვირთება.'); }
      if (total + object.size + 100000 > archiveLimit) { await object.body.cancel(); throw oversized(); }
      const bytes = new Uint8Array(await object.arrayBuffer());
      if (bytes.length !== file.bytes) throw new WorkError(409, 'ფოტო სრულად ვერ ჩამოიტვირთა. სცადე ხელახლა.');
      total += bytes.length; entries.push({ name: paths.get(file.id)!, data: bytes });
    }
    return response(buildWorkZip(entries, { maxBytes: archiveLimit, date: generatedAt }).buffer, 'application/zip', 'zip');
  } catch (error) {
    return workRouteError(error instanceof WorkZipLimitError ? oversized() : error);
  }
}
