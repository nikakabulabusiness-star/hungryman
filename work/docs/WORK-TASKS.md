# Work production system — 26 October 2026

This release extends the existing Hungryman Work D1/R2 application. It does not migrate to Supabase, create replacement accounts, or change the public brand/recruitment sites. Visual reference: user-supplied `Hungryman_Task_System_Design(2).pdf` (48 pages). The mock role switcher and example data are not production features.

## Entrypoints and clients

- Web/PWA: `/work/tasks`, department `?board=story|production|editing|social|technical`, private/assigned `?view=mine`, restricted directory `?view=contacts`, founder inbox `?view=approvals`.
- Video detail: `/work/tasks/video/:id`; nine-section call sheet plus technical plan, approval controls and revision history.
- Native: `/work-tasks`, `/work-video/:id`, shared types in `mobile/src/lib/work-model.ts` and `work-task-model.ts`.
- The main hub and menus include Work. Existing five bottom tabs remain. Linked shoots open their frozen call sheet and link back to all Work stages.
- Shorts **production scheduling** is separate from main shoots (`/shoots?kind=short`) and purple in the calendar. This does not restore the previously removed Shorts viewing/feed tab.

## Workflow

| Department | Stages |
| --- | --- |
| Writing | Idea → script → founder review → approved |
| Production | Approved script → planning/call sheet → founder review → scheduled → filmed |
| Editing | Footage → editing → complete |
| Social | Idea → preparation/mini call sheet → founder review → scheduled → complete |
| Technical | Scheduled shoot → equipment preparation → founder review → approved |

Writing approval makes the same video available to production. Production/social approval atomically schedules one stable-UUID shoot per call-sheet day, assigns internal crew tasks, publishes calendar visibility and durable staff notices. The technical board receives scheduled projects automatically; legacy manual shoots can be attached explicitly. Internal crew identity/role is resolved server-side; external people remain in the call sheet without fabricated employee accounts.

Only the current canonical business `Owner` role can approve. Developer administration and previewing another role do not confer business founder approval. Board editing follows current department memberships/head configuration. Producers and Senior Editors can assign work within their authority; Senior Editors may assign peers and junior editors but not the producer. Contacts are restricted to founders, HR, configured department heads and the developer system account.

## Versioning and data protection

Migration `0030_marvelous_major_mapleleaf.sql` was generated from `db/schema.ts` and has its Drizzle journal/snapshot. It adds Work videos/history/approval snapshots/files, tasks/task events, contacts and nullable workflow links/frozen payloads on existing shoots. There is no production seed or destructive backfill.

Updates use the expected integer version, a per-mutation token and atomic D1 batches. A stale editor receives 409 and keeps their draft. History, scheduling and notices are guarded by the winning mutation. Editing an approved script requires new founder approval; the previously published shoot keeps its approved content. Technical approval replaces the approved rental amount, preserving the published base budget. Pending rental replacement is displayed separately and never counted twice.

Private tasks are creator-only at the API/query level, including against HR/founder/developer access. They emit no outward notifications or global audit entries. Private tasks and their events are erased in the account-deletion transaction. Shared assigned tasks remain recoverable with anonymized deleted identities and stale edit versions invalidated. Assigned task notices are hidden after reassignment/deletion or permission/module removal.

The `work` feature participates in existing developer module removal and delegated feature controls. Both clients and the APIs check the module; uploads also respect the upload feature. Saved shared production archives remain linked. Legacy shoot edit/delete endpoints cannot overwrite or erase a linked approved Work record, including an attachment race.

## Call sheet and exports

Nine sections: general, script, schedule, crew, locations, requirements, budget, files and notes. Includes multiple days, arrival/camera times, INT/EXT and DAY/NIGHT scenes, internal/external crew, location contacts/maps, categorized quantity × unit-price costs, images, catering/radios/emergency and backup plans. Prices are stored as integer tetri, with bounded values and summed server-side.

Web export route: `/api/work/videos/:id/export?format=html|json|csv|zip`. Optional `shoot=:uuid` selects the matching frozen approved shoot instead of the live draft. HTML can be printed to PDF using the browser; CSV includes a BOM and formula-injection protection. ZIP includes the rendered archive, structured data, budget and authorized image files, with explicit bounds/errors rather than silently partial files. Authentication is required; exports are not public URLs. Native uses existing PDF libraries and the Georgian font to generate and share a real PDF, JSON or CSV.

Normal detail views load bounded history pages; export fetches full eligible history subject to explicit safety bounds. Frozen shoot exports must not accidentally include unapproved call-sheet content embedded in another department's raw revision body. Unrelated staff directory metadata, viewer permissions and private tasks are excluded from exports.

## Delivery and verification boundaries

All product text is Georgian, with the requested Work/Shorts names retained. Desktop uses compact dark navy rounded cards and drag/drop; phone uses stage chips and explicit move actions. The live backend contains real operations, not demo data. Foreground polling refreshes shared data; do not describe it as websocket realtime or promise zero network delay. Work/private payloads are not added to the persistent browser cache.

Native version 0.3.17 is a compatible JavaScript/assets update if `updates:verify` passes against the existing `58-personal-ota1` runtime. No native dependency/config change is intended. Website publication does not publish Expo code. This environment's `eas whoami` returned `Not logged in`; native OTA remains unpublished until an authorized owner session runs the guarded publisher. Source updater packages preserve signing and reject unexpected local edits.

Automated checks cover real SQLite workflows/permissions/concurrency, private task isolation, account erasure rollback, notification visibility, staged moves, archive/export integrity, web/mobile types, mobile lint, native export/runtime and build packaging. Managed local browser QA is unavailable: the preview daemon is blocked by an unrelated existing `/site` Vinext server. Do not claim pixel-perfect private-screen or installed-device validation. Founder/staff acceptance should exercise one video through writing/production/technical/editing, one Shorts production, one private task and one cross-role assignment on actual desktop and phone accounts.
