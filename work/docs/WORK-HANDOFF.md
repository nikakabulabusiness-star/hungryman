# Hungryman Work continuation

Recovered on 24 October 2026 from the prior conversation, existing source, saved Site versions and delivered Mac patch. This is an engineering handoff, not a verbatim export of the original chat.

## Existing project to continue

- Production: https://hungryman-applications-test.hungryman.chatgpt.site
- Sites project: `appgprj_6aa4489123ec81919883bdd1f629f190`.
- Checkout: `/workspace/sites/hungryman-applications-test`.
- Source remote: `https://git.chatgpt-team.site/26e6580b-a925-4bf0-b79b-5473af25e79e/appgprj_6aa4489123ec81919883bdd1f629f190.git`, branch `main`.
- The historical URL contains “test” but the user designated this the primary website on 23 October. Keep its accounts, database and uploads. Do not create a replacement project.
- The public site serves vacancies/applications. Internal calendars, chat, staff profiles and administration require authenticated approved accounts. Native Work excludes public careers pages.
- Web: React/Next-style app routes on Vinext and Cloudflare Workers; Drizzle, D1 `DB`, R2 `BUCKET`.
- Mobile: React Native 0.88, Expo SDK 58, Expo Router; real native UI, not a PWA/WebView wrapper. A WebView is used only for maps and the call media engine.
- Expo: owner `hungrymanworks-team`, slug `hungryman-wrok`, project `9e2f2ace-b709-4e31-b709-c3eae666194a`. Keep the exact spelling.
- Standard bundle/package `ge.hungryman.work`; personal iPhone bundle defaults to `ge.hungryman.work.personal`.
- The September Flutter/Supabase preview is an older separate prototype, not the current implementation.

## Last recovered state

Site version 50 was deployed on 23 October 2026 at 23:25 Asia/Tbilisi from `d38d2ef8b51632851e7c9b8a1e360cea9658abe4`. The local source then advanced to `1fd1c022d1c83d36a29196362265f56df8646127` for the delivered Shorts-removal patch. Latest notification/attendance/map/chat work was found uncommitted and preserved before completion in this conversation. Saved/deployed Site version numbers and native-device installations are separate states.

The user installed the free Personal Team iPhone app on their Mac after enabling Developer Mode and trusting their own certificate. The existing Mac project is `Desktop/HungrymanWork-Free-Mac`, Xcode workspace `mobile/ios/HungrymanWork.xcworkspace`, Run configuration Release. Preserve signing, local `ios-personal.local.json`, the generated native project and the installed app. The user explicitly chose free installation and no paid services. The original installed build had Personal Team OTA and APNs disabled. The 0.3.15 bootstrap below enables OTA after one successful Xcode Release Run; APNs remains disabled. Linux JavaScript exports do not prove Xcode compilation or phone installation.

## Product decisions to preserve

- Georgian UI, dark navy/teal Hungryman styling, compact cards, clear unread indicators; public brand site is distinct from staff access.
- Main native tabs: მთავარი, გადაღებები, ჩატი, კაბინეტი, მართვა, permission-gated. Shorts viewing tab was removed at the user's request; do not restore it. Shorts Editor employment roles are unrelated.
- Main hub includes upcoming shoot, pinned team messages, next seven days and `@hungrymantv` shortcut.
- Approved email/password accounts are shared with the website. Mobile uses hashed bearer sessions and SecureStore. New registration waits for approval. Suspension and permissions are enforced server-side.
- Owner, Developer and HR roles and granular permission dependencies are defined by current code, not September bootstrap assumptions. App Owner email is fixed in `lib/staff-auth.ts`; Site hosting owner is a distinct account. Private conversations and personal notes remain private even to ordinary administrators.
- Cabinet/calendar includes work patterns, actual recorded work, leave/day-off/sick requests, private notes, birthdays and salary dates. Existing policy and validation remain authoritative.
- YouTube reports are explicitly demo data and social statistics manual until provider owners authorize real connections. Do not represent fixtures as live analytics.
- Calls use in-app WebRTC/STUN; TURN/background calls/CallKit and physical two-device QA remain separate unfinished work, outside this update.

## User's current acceptance requirements

1. Background/closed-app OS notifications for chat; mute suppresses ordinary messages, `@everyone` overrides mute; tapping opens the exact conversation. No foreground chat banners, only unread badge counts.
2. Durable notification bell with read/unread status and numeric badge; separate request-review icon for HR/authorized reviewers.
3. New shoots, salary at 10:00 Tbilisi, leave/sick decisions and attendance responses generate appropriate notices. Scheduled operations must work without an open webpage; see `work-notification-scheduling.md`.
4. One-time transparent notification/location onboarding; no attendance-card enable/disable buttons. OS permissions remain the user's choice. Today’s recorded hours and remote-work request remain visible.
5. At 13:00, “აგვიანებ?” with “მაგვიანდება”, “არ ვმუშაობ”, “დისტანციურზე ვარ”; submit to HR, remote/day-off status changes only after approval.
6. Important map places: URL or pin, name, optional photo icon, small label; management permission, secure uploads and shared web/native data.
7. DM deletion affects only the deleting user; new later messages may reopen the conversation. Group deletion affects everyone and is allowed for creator or configured permission, default HR/Owner/Producer/Creative Director. Main chat deletion/recreation only for Developer.
8. Calendar months swipe horizontally in addition to existing arrows; preserve vertical scrolling.
9. Update existing website and provide a guarded Mac source updater for the user's installed iPhone project.

## Verification and release boundaries

The current feature batch includes migration `0023_numerous_cardiac.sql`. New tables hold notices, deliveries, attendance requests, map places/photos and conversation visibility/tombstones. Preserve earlier migrations and existing data.

Use SDK58 documentation and `mobile/AGENTS.md`. Run server/mobile TypeScript, mobile lint, relevant SQLite authorization/concurrency regressions, map lifecycle tests, native scheduling tests, guarded Mac updater tests, then web build and native iOS/Android JS exports. Physical iPhone/Android notification delivery, Always-location behavior and final Xcode signing require device verification.

Personal Team cannot receive new remote chat/event pushes in this build. Its local salary/attendance schedules are refreshed when the app opens and are bounded by the OS pending-notification limit; server calendar changes cannot instantly update a closed Personal Team app. Do not simulate “always running” or claim these limitations are solved. Standard distribution push still needs valid APNs/FCM credentials and an installed compatible build.

The scheduler must remain flagged unavailable until the hosted writer and cloud task are actually verified. Configuration/provisioning alone is not proof of a completed scheduled run. Use the persisted dispatch receipt and current Sites/tool responses for final status.

## Free-build continuation, 24 October

Continue this D1/R2 project, not the September Flutter/Supabase prototype. The old Supabase Free project `rvjbayfnezirrctbhcci` was resumed during recovery; it reached ACTIVE_HEALTHY, but no schema, client configuration or current Work data was changed there. It is not this application's backend.

Added `mobile/scripts/build-local-android.cjs` and Georgian `ANDROID-FREE.md`: isolated local Android build, separate `.local` package, embedded JS with OTA disabled, no production Expo push registration, signature verification and SHA-256 output. Existing iOS signing/native files remain untouched. No Android SDK was available in this execution environment; no APK was built or installed.

Validation: website/mobile TypeScript, mobile lint, native auth, 44 permission route denials, chat deletion/concurrency, work notifications, native reminder scheduling, map-place authorization and mocked WebRTC tests pass. These checks do not prove real-device media or push delivery. All services remain on their existing plans; no paid service was enabled.

## Call startup repair, source 0.3.8

User reported an empty/nonfunctional call page on the installed iPhone app. Replaced the remote `work/call.html` load with generated `mobile/src/lib/call-document.ts`, using the existing HTTPS base origin. Added auto-join, retrying init handshake, visible startup timeout/retry, stale-native-reply protection and capture/background race cleanup. `scripts/sync-call-document.mjs` must run after HTML engine edits. Root startup tests assert shipped and tested HTML match.

Optional TURN credentials are generated after session authorization from server-only WORK_TURN_URLS and WORK_TURN_SECRET. No relay was provisioned, paid service enabled or network/device reliability verified. Standard push, Personal Team limits, CallKit and background calls remain as previously documented. The guarded Mac updater now accepts both earlier 0.3.6 source revisions and the 0.3.7 Site versions 51/52.

## Desktop call reception and ringing, 0.3.9

Phone caller reached waiting state, but desktop had no call receiver/buttons. Added top-level browser call coordinator, answer/decline UI and same-origin media bridge using the same session API as native. Added desktop/docked-chat outgoing audio/video actions and original ring/ringback assets on both platforms. Native ringback follows the engine's actual waiting/connected/stopped signals. Browser autoplay may require an interaction; there is an explicit enable-sound action. Reload desktop after publishing. New Mac updater accepts the 0.3.8 source (`a9e0145a36305d1e67fbd834c53a804f500dca70`) too. Current update still needs Xcode Release Run; no new native module was added. Real-device media validation and TURN remain pending. Browser preview infrastructure timed out; do not claim visual/media browser QA passed.


## 0.3.10 — camera during an audio call

Audio calls reserve a send/receive video transceiver without requesting the camera. The camera button explicitly requests video, attaches it to each reserved sender, and shows the local preview. Remote video tracks update visibility on mute/unmute/ended. Camera denial leaves the microphone and call connected. Capture completing after hangup is released; flip uses the same capture path with rollback on replacement failure. No new native dependencies or API/schema changes.

Validated with mocked SDP/ICE and audio-to-video tests, browser bridge tests, mobile typecheck/lint and updater compatibility. Real device camera, front/rear switching and phone/browser video still require user testing. Both clients should use this engine; iPhone requires installing 0.3.10 from the source updater. TURN and closed-app push limitations are unchanged.


## 0.3.11 — browser calls, answerer video, chat latency

User reported local camera preview but no remote video and inactive browser call buttons. Fixed a concrete WebRTC association error: only deterministic offerer preallocates the video transceiver; answerer binds its camera to the transceiver created by the remote offer before answering. Tests model unassociated vs negotiated senders for initial video and audio-to-video upgrades.

Browser coordinator now initializes under outer hosting frames (except the actual /chat/embed dock). Call button loader waits for the coordinator; compact dock alone forwards to its parent. Immediate preparing state, duplicate prevention, cancellation during POST, and updated static asset versions. Calls GET includes authenticated viewer ID and scoped mute settings; start no longer waits for /mobile/me. Incoming polling3s browser /4s native becomes1.5s, WebRTC setup polls300ms vs900ms then1.2s connected. Session heartbeat/peer/signal reads batched; heartbeat writes throttled10s.

Browser chat stores last viewed messages/directories only in account-scoped RAM (60s /24 entries), clears denied access and pagehide, renders warm snapshots then revalidates. Completion-driven polling, network timeout/backoff, hidden pause, initial fetch never long-polls. Dedup member/list fetches, parallel presence, avoid duplicate read acknowledgments. No durable browser cache. First chat page no longer synchronously writes profile (presence heartbeat remains); next shoot read runs with thread authorization. Backend private/group auth2queries→1, fresh permissions parallel with profile, non-mention sends save2–4 directory queries, heartbeat3queries→1, long-poll check2queries→1. No auth cache.

Validation: browser lifecycle/framing/cancel tests, four mocked media tests, chat cache and query-budget tests, workspace authorization integration, TypeScript/mobile lint, updater compatibility. Preview daemon unavailable (existing unrelated vinext lock /site); real browser/physical media QA and host latency measurements are NOT completed. No claim of zero latency or measured milliseconds.

Remaining architecture: this release still uses HTTP polling/long-polling backed by D1. Truly event-driven cross-instance chat/call notifications need a provisioned realtime transport (e.g. WebSocket hub); current Sites bindings are DB/R2 only. TURN credentials are still absent, so cross-network media is not guaranteed. More expensive generic hosting alone does not fix either. No paid services activated.


## 0.3.12 — call layout and reconnection

Mobile call stage now uses a large remote tile plus self PiP default bottom-right. Drag follows pointer with capture and snaps to eight edge anchors; arrow keys/Home supported. ResizeObserver and viewport resize keep it inside the stage above controls; native landscape forces mobile mode. Desktop presents two equal video tiles. Camera-off state shows authenticated profile avatar/background (initial fallback); peer media-state signaling avoids black frozen video when remote track.enabled=false. Browser hover/focus rings and compact rounded dark navy/red controls; duplicate native header hides during a ready call, returns on stopped/error states.

The standalone call-layout.js is inlined into the single HTML script by sync-call-document.mjs, and the whole document ships inside the native app. No runtime JS fetch needed for PiP. Avatar RPC authorizes own joined session and active peer, accepts raster data only up to existing5MiB upload limit, never exposes bearer token to HTML. Avatar fetch is nonblocking.

Reliability: server signaling membership grace90s (was35s), consistent with abandonment/capacity/target checks. Initial SDP retries reuse pending local SDP after failed POST. Remote-target409 does not terminate local microphone. Disconnected/failed RTC uses bounded deterministic ICE restart attempts, canceled/reset on reconnection. Brief missing peer lists get8s grace; failed received signals retry before advancing cursor. Late poll responses from a stopped run are discarded. Camera state signals retry until acknowledged.

Validation: PiP drag/snap/resize/desktop tests; SDP association, initial offer503/409 retries, missing-peer grace, recovery cancel and camera-off tests; avatar privacy/type/size; browser bridge; workspace authorization; root/mobile TypeScript and mobile lint; updater compatibility. Browser visual QA unavailable: managed preview failed with existing unrelated vinext /site lock. Physical-device drag/video/network-switch testing still required. TURN remains unconfigured; native app still stops media when fully backgrounded for current build, so no promise of always-on background calling or zero latency.


## 0.3.13 — audio first, direct calls and persistent display cache

Microphone capture and remote audio playback are independent of camera capture. Each peer has an audio-only playback element and a separate muted video element. Join and signaling proceed before camera permission resolves; camera denial cannot suppress voice. Native bundled WKWebView grants capture only for its own allowed host after the operating system permission; Android reuses an existing microphone grant and requests camera only when needed. Revoked OS grants must be granted again. Native Expo ring playback stops before WebRTC capture; outgoing mobile ringback uses WebAudio within the call engine to avoid resetting the recording audio session.

A direct call ends for both sides on either participant leaving/declining, and both clients return to the conversation without a second server mutation. Group callers join immediately; invitations expire after30seconds, and an unanswered call ends. Leaving a group preserves the call for remaining members; the last member ends it. Calls produce one deterministic caller-authored chat summary with duration measured from the second participant's server join until end. End time, reason and summary are committed together. Session replacement cleanup cannot disconnect the new session. Incoming notifications and server end observation still use polling, so they are not zero-latency.

The native app stores a bounded AES-GCM encrypted display snapshot of recently visited chats/directories and shoot summaries for7days (2MiB, up to30resources). The encryption key lives in device-only SecureStore. Authentication, permissions, admin data, salaries, live location, tokens and temporary outgoing messages are excluded. Cold start validates the current approved account online before hydrating; warm screens render a marked saved copy and refresh in the background. Logout, account switch and denied access clear snapshots, and old in-flight requests cannot repopulate them. Browser caching remains account-scoped RAM only. First-time pages, cold account validation and new network data still require a connection.

Validation covers audio before camera, pending/denied camera, late capture cleanup, both-client end routing, group409peer departure,30second expiry, group leave/last leave, caller summary/duration/idempotency, encrypted restart hydration,7day expiry, account isolation/logout and permission revocation. Root/mobile type checks, mobile lint, web build, mobile iOS/Android JS export and Mac updater compatibility passed. These checks use mocked media and do not certify physical iPhone microphone routing; device-to-browser testing remains necessary. No new native dependencies or DB migration. TURN is still absent, and this build leaves calls when fully backgrounded; closed-app APNs/CallKit calls are not implemented. No guarantee of zero network latency.


## 0.3.15 — administration, Personal Team OTA and rebuild notice

Ported the latest web system-administration controls into the native app, using the existing protected API. Developer-only account list/details/system permission delegation is separate from employment roles; ordinary staff do not gain system status visibility. Added native delegated feature toggles and registry-aware home/cache/notification guards. `/api/mobile/config` exposes only the registration toggle for the login UI.

The user asked to send updates into the already-installed app, then requested preparation and a message whenever a new binary is needed. Old Personal Team binaries have OTA disabled. This package requires a one-time Xcode Release Run. `enable-personal-updates.cjs` uses Expo's own mod compiler to update only Expo.plist, preserving signing/project/Info.plist and backing up previous metadata. The isolated channel is personal-iphone, runtime 58-personal-ota1, existing Expo project unchanged. No new native dependency, APNs capability or paid service was introduced.

`personal-runtime.json` is the native compatibility ledger. `verify-personal-runtime.cjs` refuses publication after native dependency/config changes until a deliberately reviewed new runtime/binary is prepared. New native releases list replaced runtime IDs explicitly in previousRuntimeVersions. The public `/api/mobile/release` response contains only version/channel/runtime/replacement metadata. The app checks at launch/foreground/manual check and shows “საჭიროა ახალი ბილდი” in Home/Profile only for explicitly superseded installed runtimes. Same/newer/unknown runtimes, other channels and Expo Go do not produce a false rebuild warning. Future release metadata must not announce an unavailable new binary. Current empty replacement list correctly means 0.3.15 does not need another rebuild.

Expo native startup checks run in the background (0ms launch wait), and compatible updates apply next launch. Foreground checks are throttled 15min, with manual profile retry. No forced reload; manual apply confirms and checks call route/audio/background state. Root provider works without signed-in account data. No remote OTA has been published: EAS whoami in this environment returned Not logged in. The owner's Mac helper can publish after Expo login; never ask for passwords/tokens in chat.

The source ZIP includes Update-on-Mac.command, Publish-Update.command and Georgian READ-ME. It preserves the installed app and signing, validates known source hashes before mutation, keeps backups and rejects user divergence/symlinks. Free signing renewal is still necessary; OTA does not extend Apple certificate validity. No signed IPA, Xcode compilation or physical device/OTA-delivery verification was performed here.

### Developer-controlled function removal (latest steering)

The user wants Developer to remove functions with one click and have future assistant work reflect those choices. Implemented reversible removal in `/admin/functions` and native `admin/functions`, covering feature modules and permission actions. This **does not delete source code or stored user data**; the UI says that explicitly. There is no bulk destructive purge. The core workspace/admin recovery permissions are protected. Removal/restoration changes JSON fields on workspace_settings.site_features atomically, records workspace_audit, ends affected calls, and keeps independent switches/role grants intact. Permission dependencies now apply to Developer too. Map and attendance module guards include own-data APIs, native route/visibility guards, and stopping background attendance after session refresh. Other existing clients may update visible navigation on their next session refresh; API denial applies immediately.

Before future changes, call the connected read-only `work_system_status` tool (configured Site owner only) and respect removedFeatures/removedPermissions. Do not accidentally restore deliberately removed functions when shipping code. The tool contains configuration and the latest 20 audit events, not employee records or credentials; it is not an automatic message into this chat. Developer UI retains latest100 events; full history stays in workspace_audit. No live feature was removed during implementation/testing.

## 0.3.16 — installable Work PWA and native release continuity

The user wants both installable web/PWA and native app, with the existing compact Georgian navy/red design and equivalent available features. The Work PWA starts at `/work`, uses the same authenticated web API/pages as desktop, and adds permission-aware mobile navigation. `/install` provides platform-specific installation and notification setup. The public careers bridge and primary brand website must not become Work PWA entrypoints.

Web deployments update both desktop and PWA. The service worker caches only narrowly allowlisted public assets and a generic offline shell; authenticated HTML/API, files and employee data are excluded. It does not promise offline chat access. Updates must not interrupt a call or forcibly reload other tabs; applying a waiting update requires explicit user action. Build-time source stamping changes the worker release even when the native version stays unchanged.

Browser Web Push uses server-side VAPID credentials, encrypted generic notices, authenticated session-bound subscriptions, recipient checks and deduplication. Permission must follow a user gesture; iPhone Web Push needs the installed Home Screen web app. Push is distinct from native CallKit/continuous background microphone/location, which remain unavailable in this free-build setup. Real device delivery and camera/microphone behavior require device testing.

Future changes must inspect both clients. Shared server changes publish once; native React Native UI/logic changes require a separate compatible Expo update. A website deployment does not compile or publish native JavaScript. Preserve `58-personal-ota1` for compatible JS-only changes and validate the native fingerprint before publishing. Native dependency/config changes require a reviewed new runtime and binary, then explicit replaced-runtime metadata so installed devices receive an accurate rebuild notice. OTA does not extend free Apple signing validity. Do not claim an Expo update was published unless publication actually succeeds.

Validation completed for this batch: root/mobile TypeScript, mobile lint, PWA worker/cache/update lifecycle, mobile navigation/authorization, Web Push encryption/signature and SQLite subscription/delivery tests, system-administration and route denials, existing work-notification/MCP and workspace/chat/call regressions, native runtime/update/publisher guards and all13 accepted Mac updater bases. Local browser preview remains unavailable because of an unrelated existing `/site` Vinext server lock; no private-screen or physical-device visual/media/push verification is claimed. `eas whoami` returned `Not logged in`; owner Expo login/publication and any required Xcode signing are still external steps.

### PWA navigation, native screen parity and request optimization

The installed PWA now uses real browser anchors for the bottom tabs, hub and management links. The existing Vinext client router could cancel Link navigation; do not revert these anchors without reproducing and fixing that routing failure. Tap feedback is immediate, while a new authenticated page still needs its server response. StaffHeader seeds the shell with the already authorized account and permissions, avoiding another startup identity request. APIs continue to authorize independently.

The mobile header, red selected tabs, spacing, rounded cards, next shoot/upcoming events/pins, chat list, shoot filters and profile order follow the actual native source. Mobile shoots open a dedicated native-style detail view with date, photo, location/map, crew/tasks and the existing authorized edit/delete actions. Hash deep links and back navigation preserve the list; desktop keeps its accordion. Installed touch devices retain mobile navigation in landscape up to 1024px. Existing calendar/edit controls remain functional web controls; this is not a shared React Native renderer. The desktop floating chat dock is neither mounted nor polled on mobile/standalone surfaces, and its stylesheet also suppresses it. Direct chat navigation and the separate incoming-call coordinator remain active.

The mobile chat header controls use the conversation directory's real permissions to open the existing direct/group dialogs. Chat preview time, own-message prefix and people search follow native. Unread tab badges reuse the shared notification-count store, avoiding another polling loop. Opening a conversation hides the duplicate global header/tabs and uses the chat's own back/call controls; returning to the list restores navigation. Shoot details likewise omit the main tabs.

Shared Work reads use bounded account-scoped RAM display snapshots (60 seconds, 24 entries, 1 MiB), request deduplication, completion-driven foreground polling and a 12-second timeout. Only shoot, pinned-chat, notification-count and calendar display routes are eligible. Authentication, HR and balance routes are excluded; there is no persistent private browser cache. Account changes/logout/denials invalidate old responses. Writes invalidate GETs without cancelling concurrent writes. Do not promise immediate cold loads, cross-page RAM retention, offline private data or zero network latency.

Validation includes actual shell anchor handlers and access removal, mobile/standalone dock suppression, cache isolation/concurrent writes/stale response rejection, existing browser call lifecycle, chat loading, notifications and PWA update/cache boundaries. TypeScript and production build are required before publication. Managed preview remains blocked by the unrelated existing `/site` server, so private-screen/physical-phone visual QA is not completed. This batch changes web/PWA only; it requires no native build or Expo publication.


## Department Work system, 26 October 2026

The active request adds Work boards, founder approvals, nine-section multiday call sheets, technical rentals, private/assigned tasks and a restricted contact directory to both clients. The user's 48-page task design PDF is the visual reference. See `WORK-TASKS.md` for entrypoints, workflow, permission and archive guarantees. This is the existing Work Site only; no public brand/recruitment site changes and no new Supabase backend.

New generated migration: `0030_marvelous_major_mapleleaf.sql`. Native source version: 0.3.17, same personal OTA runtime/fingerprint. No demo records. Expo session was checked again during this work: `Not logged in`; do not claim native OTA delivery. Website release IDs and the exact packaged source are supplied by the successful Sites workflow result. The managed preview is still blocked by unrelated `/site` server PID14, so private-screen browser and physical-device QA remain unverified.
