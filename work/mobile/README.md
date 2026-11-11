# Hungryman Work — native iOS & Android

## Current update — 0.3.16: PWA companion and native update delivery

The Work website now has an installable PWA companion. The native React Native application remains a separate client using the same accounts, server data and authorization. Website publication updates the website/PWA; compatible native code/assets must also be published through Expo Updates. A web UI change is not automatically translated to React Native. Follow [the combined release workflow](../docs/PWA-NATIVE-RELEASE.md) for each product change.

Version 0.3.16 preserves the `58-personal-ota1` native runtime and compatibility hash. The guarded Mac source updater also accepts the delivered 0.3.15 source. An app already successfully bootstrapped with OTA can receive this compatible release without another native build, once an authorized owner publishes it. An older app with OTA disabled still needs the one-time installation below.

An installed free Personal Team app that has not received the 0.3.15 bootstrap needs **one successful Xcode Release Run** of this update. Older installed versions have OTA disabled; this cannot be enabled remotely. The guarded Mac updater changes source and only Expo's update metadata using the actual config-plugin pipeline, while preserving the existing Xcode project, bundle identifier, Apple Team and signing choices. Native metadata is backed up separately. This is a source updater, not a signed IPA.

After that bootstrap, Expo Updates is enabled on the isolated `personal-iphone` channel with runtime `58-personal-ota1`. Compatible JavaScript/assets download in the background and activate on the next cold start, or after confirmation in Profile → აპის განახლებები. The app never automatically reloads an active call or recording. Expo Go is not needed. This does not extend the free Apple signing period or add APNs/CallKit/background calls.

Developer function management at მართვა → ფუნქციების ამოღება covers the feature catalog and permission actions. Removal is reversible configuration, not code/data destruction. It blocks API actions, hides guarded routes, closes affected calls, preserves role grants and records, and records history. Core workspace/admin recovery cannot be removed. Dependency checks apply even to Developer. Site owner read-only MCP tool `work_system_status` exposes current removals and recent history for future maintenance. Map/attendance/YouTube shortcut module switches are included; disabling attendance stops native tracking after configuration refresh while retaining historical work data.

Native administration now includes the Developer-only account database, separate system rights delegation, confirmed account deletion/deactivation, and delegated feature switches. Server authorization remains mandatory. Disabled chat modules are excluded from warm snapshots and the home pinned feed.

A lightweight public `/api/mobile/release` endpoint exposes release metadata, not account data. On launch/foreground (throttled 15 minutes) and manual check, native runtime compatibility is compared with an **explicit replacement list**. When a newly released build replaces the installed runtime, Home and Profile show “საჭიროა ახალი ბილდი” with installation instructions. The app remains usable. Unknown, newer, same-runtime and other-channel builds are never incorrectly told to downgrade. This notice requires this initial 0.3.15 installation and internet access; it is not closed-app push.

Publishing from the owner's already-authorized Mac:

```sh
cd mobile
npx eas-cli@latest login
npm run updates:verify
npm run updates:personal
```

The delivered ZIP includes `Login-to-Expo.command` for signing into Expo on the owner's Mac; it does not publish. Use an existing account with publication access to `@hungrymanworks-team/hungryman-wrok`. Enter credentials only in the Expo CLI prompt, never in chat. `Publish-Update.command` wraps publication for `~/Desktop/HungrymanWork-Free-Mac`. The publisher checks the native-configuration hash, exact configured project UUID and owner/slug, then asks Expo to verify the authenticated remote project before publishing only iOS to `personal-iphone` using the preview environment. EAS CLI creates the matching channel/branch if absent. No paid build, plan change or store submission is performed. The execution environment was checked on 26 October 2026 and is **not logged into Expo**; no OTA release has been published here.

For future **native** changes: create/test a new binary, give it a new `personal-runtime.json.runtimeVersion`, retain all superseded runtimes in `previousRuntimeVersions`, and record the new native hash after review. Publish the server release metadata only when that new installation package is ready. JavaScript-only updates keep the same runtime and do not trigger a rebuild notice. Never simply refresh the hash to bypass a native incompatibility.

Validation: native/server TypeScript, Expo lint, actual Expo configuration introspection, personal iOS JS export, guarded source/native metadata migrations, current server authorization and encrypted-cache tests. These are not an Xcode compilation or physical iPhone/OTA-delivery test.

## Historical notifications and team workflow update 0.3.7

This update completes the preserved 24 October notification/request center work,
quiet foreground chat with unread badges, HR attendance decisions, named map
places with photos, private/group chat deletion and horizontal calendar swipes.
The website uses the same server authorization and data. Personal Team remains
local-signing only: this update does not add APNs or OTA capability to that build.
Salary/attendance local reminders synchronize when the app opens; remote chat,
shoot and HR event pushes require a push-capable signed distribution build and
valid platform credentials. See `../docs/WORK-HANDOFF.md` and
`../docs/work-notification-scheduling.md` for continuity and scheduler readiness.

`scripts/package-mac-update.mjs` (repository root) creates a guarded source updater
for the existing Mac project at either the pre-Shorts-removal or post-removal
revision. It preserves signing/native project/local configuration, backs up changed
files, validates all old/new hashes first and refuses divergent user edits or
symbolic links. After applying, the user must perform a successful Xcode Release
Run on their iPhone. The ZIP is an updater, not a pre-signed IPA.

Confirmed product requirement: a fully installable phone app for iPhone and Android. The requested PWA is an additional installation option; it does not replace this native project. The interface uses React Native controls with Expo Router. The public careers website is not part of this app.

## Current implementation

- Georgian sign-in and registration with the same email/password accounts as the public Hungryman Work site; administrator approval and suspended states.
- Main screen: next shoot, pinned team messages, next seven days of calendar events and the Hungryman YouTube shortcut.
- Profile name/photo editor, native photo picker and personal calendar.
- Shared chat with active members, avatars, links, message pins and idempotent send retries.
- Shoot list, details, map links, creation/editing, task assignment and role-based deletion.
- Native administration: applications, notes, ratings, sorting, vacancy settings, candidate creation/deletion; accounts and permissions; employees grouped by position; position catalog; calendar events, schedules, leave limits and analytics.
- App icon, iOS bundle ID and Android package `ge.hungryman.work`; preview APK and signed iOS build profiles.

The API is the public Hungryman Work site at https://hungryman-applications-test.hungryman.chatgpt.site. The existing URL is retained for installed-client compatibility. Account credentials, calendar privacy and all write permissions are enforced by the server on every request. Mobile sessions are random `hmw_` bearer tokens, hashed in D1 and stored on-device in SecureStore. Passwords are not persisted by the app. Selected chat and shoot snapshots use an account-scoped encrypted cache; see the cache section and current source. Expired sessions return to sign-in. No service keys ship in the binary.

## Communication and map update (0.3.1)

- Team conversation stays first. Direct conversations keep server-enforced membership, including attachments, shared photos/emoji settings, media/link pagination and notification feeds. Developer status does not reveal unrelated private conversations.
- Photos are resized to at most 1400 pixels, converted to JPEG and uploaded with `expo/fetch` using a file-backed binary body. A stable upload UUID makes retry safe; the preview stays visible after an error. The legacy multipart endpoint remains supported.
- The map follows the current foreground position, falls back to the office, and expands inside the app. Dark/light styles, pinch/zoom and recenter controls preserve the office radius. Viewing your own position does not send it to the team; attendance and chat sharing remain separate opt-in operations.
- Calls now use our own WebRTC media screen inside the app, with no Jitsi/Safari/external-app redirect. Audio/video, microphone/camera switches, camera flip, private signaling, device sessions and up to six group participants are implemented. The WebView is only the media engine; the application UI remains React Native. Camera/microphone stop when backgrounded or leaving the screen.
- **Call connectivity is not production-complete:** only Cloudflare STUN is configured. A TURN relay is still required for restrictive/symmetric-NAT networks. No paid relay was enabled. Native CallKit, background calling and large-group SFU calls are not implemented. Two-device iPhone/Android audio/video testing remains required.
- In-app message banners open their exact conversation. Push token registration, per-recipient delivery jobs, device removal at logout and tap navigation are implemented for a future standalone build. Expo Go cannot receive remote push notifications. Actual delivery still requires APNs/FCM credentials and a device build; iOS push signing requires an Apple Developer membership. No paid enrollment or installer build was started.
- Version changed to **0.3.1** because camera/microphone native configuration changed. Do not send this OTA to existing 0.3.0 standalone binaries. The `expo-go-preview` branch can run it in Expo Go. Offline editing remains unsupported.

Validation: root/mobile TypeScript checks, Expo lint, iOS/Android JS export, SQLite-backed route tests, and map/WebRTC lifecycle tests. Media devices and push delivery in automated tests are mocked. Browser preview was blocked by an unrelated managed server already holding port 4173; this does not substitute for physical-device QA.

## Development and validation

Run from this directory:

```sh
npm ci
npm run typecheck
npm run lint
npm run bundle
npm start
```

The native Android/iOS directories are generated by Expo CNG. Do not hand-edit them. No web target is configured. A successful JavaScript bundle is not an APK or IPA and does not replace device QA.

Backend tests (repository root):

```sh
node tests/application-flow.mjs
node tests/mobile-auth.mjs
node tests/workspace-upgrade.mjs
node tests/map-lifecycle.mjs
node tests/call-engine.mjs
```

## Installable builds — account connection required

**2026-10-23: the user explicitly selected the free seven-day Personal Team installation on their Mac (iPhone on iOS 26.6).** Open [Start-on-Mac.command](Start-on-Mac.command), or run `npm run prepare:ios:mac`; instructions are in [MAC-IPHONE.md](MAC-IPHONE.md). The launcher checks prerequisites, prepares a new project, or reopens an existing personal workspace for weekly re-signing without regenerating it or overwriting signing choices. The user signs in to Apple and runs the Release scheme from Xcode. Initial pairing on iOS 26.6 uses a cable; subsequent same-network wireless installation can be used after pairing. No paid enrollment, App Store submission, EAS account authorization or automatic weekly renewal is enabled. This explicit Mac workflow generates native files with Expo CNG; no hand-maintained native project is included. The Personal Team variant has a separate bundle identifier and no APNs entitlement. OTA was disabled in these original builds; the 0.3.15 bootstrap above enables a dedicated update channel. The user confirmed installation and successful use on their iPhone after enabling Developer Mode and trusting their certificate. This repository does not contain a newly signed IPA; no native compilation was performed in this Linux environment.

**Removed the mobile Shorts viewing feature at the user's request.** The Shorts route, tab, embedded player and player-only navigation helpers are removed. The remaining tabs retain their permission guards and standard styling. Existing server feed contracts and their shared catalog remain for older installed clients; Shorts Editor staff roles, recruitment and social analytics are unrelated and unchanged. The free Mac build needs a source update and a new Xcode Run to receive this change.

The cloud archive now includes the shared permission/department modules. `npm run verify:source` checks their presence before a build; EAS runs it after dependency installation. The normal EAS distribution profiles and existing site's API origin are preserved.

Mac preparation validation: mobile TypeScript and lint, iOS/Android JS exports, actual Expo native-config introspection for both variants, and a personal iOS export from the filtered source package pass. Source checks also reject a missing shared module and exclude server code/local signing settings. EAS `build:inspect` could not run without account authentication; its local archive filter was checked separately without an account or upload. A successful JS export is not an Xcode compilation or an installable IPA.

The double-click launcher additionally passed Bash syntax checks and isolated, simulated Mac command checks for first preparation, read-only prerequisites, explicit Personal Team selection, weekly reopen without regeneration, and preserving unknown/incomplete native projects. TypeScript and lint were rerun successfully. These shell checks do not verify Xcode, CocoaPods, Apple signing or a real device.

The project is linked to the existing Expo account (`hungrymanworks-team/hungryman-wrok`). Before any future cloud build, confirm the existing session and signing setup. No Expo or Apple credentials are embedded in the repository.

```sh
npx eas-cli@latest login
npx eas-cli@latest init
npm run build:android
npm run build:ios
```

Android preview produces an APK. The iOS preview requires the owner's Apple Developer signing credentials and registered test devices. A simulator build can use `--profile simulator`; that cannot be installed on a physical iPhone. Production store distribution uses the `production` profile and the owner's Apple/Google developer accounts. Do not submit to stores without an explicit release request.

Before distribution, verify on physical iPhone and Android: login/logout, pending approval, permissions after suspension, chat keyboard, photo upload, day details, all management sheets, and back navigation. Store release also requires final store metadata and privacy disclosures.

References: https://docs.expo.dev/build/setup/ · https://docs.expo.dev/app-signing/app-credentials/ · https://docs.expo.dev/versions/v58.0.0/sdk/securestore/

## Chat, calendar and shoot media update (0.3.2)

- Message timestamps are available in the long-press action sheet; delivered-message footer rows are hidden. Pending and retry states remain visible. Typing expiry is isolated from the message list, and unchanged polling results reuse the cached messages.
- Keyboard Controller 1.22.7 with the SDK 58 bundled Reanimated/Worklets moves the composer with the keyboard. Sending dismisses the keyboard.
- Voice messages: foreground microphone permission, mono AAC recording, stop/preview/cancel/send, stable upload IDs and failed-message retry. The limit is five minutes. Web capture runs in an AudioWorklet and encodes mono 16 kHz WAV for iOS/Android/browser compatibility. Private, authenticated byte-range playback and an audio gallery use the same conversation authorization as images.
- Per-user chat mute is stored on the account and checked for foreground alerts and queued push delivery. Mobile foreground messages use a short bundled sound and haptic feedback; web pages use sound without vibration after the browser has received a user interaction. Only the last active web tab plays alerts. Audio playback and recording remain foreground-only.
- Employee birthdays are derived from the employee directory at read time, displayed in the monthly calendar and next-seven-days hub. Responses expose only the current occurrence, name and label, not birth years or other private employee fields. February 29 is observed on February 28 in non-leap years.
- Shoot create/edit accepts an optional compressed photo, with preview, removal and an enlarged viewer in the app and website. Unattached uploads remain private to the uploader. Older clients preserve an existing photo when they omit the new field.
- SDK 58 Expo Go includes the new audio and keyboard modules. Runtime 0.3.2 isolates the native dependency changes from older standalone builds. No installer build or paid service is used. Remote push while the app is closed remains unavailable in Expo Go; standalone push still needs native credentials.

Validation: root/mobile TypeScript, mobile ESLint, iOS/Android Expo export, API/storage/authorization regressions, voice PCM/WAV duration limits, resource-cache, native auth, map and call-engine tests. Real iPhone/Android microphone, keyboard timing, speaker/vibration and two-device audio playback require device testing. Browser QA could not run because the managed preview reported an existing server from another checkout (`/site`, port 4173); it was not stopped or replaced.

## Cabinet, requests, social workspace and group chats (0.3.5)

- Personal cabinet has a collapsed yearly balance and monthly recorded-work section. Vacation uses existing entitlements; HR/Owner/Developer set annual day-off limits. An unset limit stays unknown. Sick leave is 30 calendar days per year. Approved future absences reserve the balance. Recorded office hours are distinguished from unmeasured remote/shoot hours and approved overtime.
- Private date notes are keyed by the authenticated user; even administrative accounts cannot read another user's notes through the notes API.
- Employees request vacation, day off or sick leave with date ranges and an optional reason. HR/Owner/Developer review with a response. Approval is atomic with an individual calendar event and cannot apply twice. Notification badges refresh in the app and website; replies are visible in the employee's own requests.
- Group chats support names, member selection/addition and photos on mobile and desktop. The main chat stays first. Website chat now includes private conversations, image upload and a composer emoji picker. Mention suggestions support personal handles, roles, @სცენარი and @everyone. Only current conversation members are notified; mentions bypass the recipient's per-chat mute. OS-level permissions and Expo Go remote-push limits still apply.
- Social workspace is restricted to Content Creator, სოციალური მედია and Developer (role preview is respected). Each eligible user configures their own Instagram/Facebook/TikTok shortcuts. Shared monthly reports have explicit manual-source labels, totals and history. Automatic social account sync is not connected: OAuth registrations/authorizations are still required. No fake metrics or paid integrations were added.
- No installer build or new native dependency. This release is an Expo Go OTA for both iOS and Android.

Validation: TypeScript for website and mobile, Expo lint, migration-backed SQLite integration tests for privacy/permissions, leave workflow, balance calculations, groups/mentions/mute overrides, and social access. Existing chat/media/call/push regression tests use mocked delivery and media devices. Browser QA remains unavailable: the managed preview is blocked by an unrelated server on port 4173. Physical-device UI and push delivery need device verification.

## Role management, departments and mobile parity (0.3.6)

- Native account controls now use server-provided management/deletion rules. Pending is automatic; administrators choose only active or suspended. The pending count opens and highlights the first request. Roles inherit their complete permission set.
- Positions combine department/hierarchy ordering, grouped permission switches, creation, rename, suspension and deletion. Developer is outside this editable list; HR cannot change Owner, and Creative Director can grant only owned permissions to permitted subordinate roles. Protected screens, requests and write controls follow effective permissions, including role preview.
- Native department pages show leadership, reporting lines and the planned roster. Planned names never grant account access. Assigning a registered head/director uses the same verified role checks as the website.
- Personal calendar cells show a note icon and the first two words. Date details separate private notes from administrative events, personal leave and monthly payday changes. Existing shoot-photo creation opens with the selected date.
- Chats keep the main group first, followed by recent conversations. Search selects people, group editors support people/department chips, avatars use compact controls, and mute switches update optimistically. A failed unmute sound cannot revert the saved mute preference.
- No new native modules, installer builds or paid services. Publication target remains the Expo Go preview branch. An export alone is not a published update or physical-device validation.

Validation for 0.3.6: website/mobile TypeScript, Expo lint and iOS/Android JavaScript exports pass. SQLite route tests cover native login, minimal department data, protected employee actions, role/delegation rules, calendar history, chat audiences and cached-request invalidation. Physical-device UI/media testing is still required. The OTA release is not yet published: Expo CLI sign-in needs approval for its account/organization access scope. A development-tunnel attempt did not connect.

### Department revision (included in unpublished 0.3.6)

The website and Expo app share six department definitions and per-department role memberships. Producer belongs to post production, story/organization and preproduction; Creative Director, Producer Assistant and Organizer also appear in their respective multiple departments. Founder is the display label for the internal `Owner` role and is always level 0. Roles at the same tier share a numbered circular badge, with a red-to-green scale down the hierarchy.

Migration `0022_department_levels.sql` replaces named leadership with roles, adds Producer Assistant and updates reporting lines while preserving existing account identities, role permissions, active flags and deletion tombstones. Unspecified/custom roles remain available under “დეპარტამენტის გარეშე”; this is a role-list section, not a seventh department. Role management edits each department membership independently, validates reporting parents on the server, and retains one set of permissions per role. Chat department audiences include all memberships without duplicate participants.

Verification: department migration/tiers, reporting cycles and level validation, delegation ceilings, native authentication, account deletion and chat audience tests. The managed browser preview could not start because the preview environment reported an existing Vinext server; browser and physical-device UI verification remain outstanding. Expo publication still requires the previously requested CLI access-scope approval.

## Free local Android test package

See [ANDROID-FREE.md](ANDROID-FREE.md). `npm run build:android:local` stages a separate native build, disables OTA for that test package, verifies APK signing and preserves the existing Mac/iPhone project. No EAS or Play account is used. Android SDK and a compatible JDK must be installed locally; an actual APK and physical-device validation remain pending.

## In-app call startup repair (0.3.8)

The audio/video engine now ships inside the app with an HTTPS base origin rather than fetching a separate hosted HTML page. A repeated bridge handshake and load-end initialization eliminate a missed-ready deadlock; calls automatically request media and join after opening. Initialization failures show a native retry action. Audio calls request no camera; a denied permission leaves an explicit join retry. Android permission checks repeat on return from Settings. Replaced native screens ignore old RPC replies. Backgrounding cancels pending capture and cleans up late server joins. Streamless remote tracks are combined so video does not replace audio.

TURN REST support is prepared on the authorized session endpoint. It is NOT provisioned: default STUN-only calls remain dependent on the peers' networks. See `../docs/CALLS-SETUP.md`. Personal Team has no remote incoming-call push, CallKit or background calling. No new native dependency was added; use the guarded Mac source updater and Xcode Release Run. Real two-device audio/video verification remains required.

## Desktop interoperability and ringing (0.3.9)

Desktop can now receive and start calls through the same authorized session/signaling API. Native adds original incoming and outgoing ring tones, stopping on answer, connection, decline, hangup, timeout and background. Update the existing Mac source project and Run Release again. Desktop needs a page refresh and browser camera/microphone permission. Use two different approved accounts for phone-to-browser tests. Automated media checks use mocks; TURN, background calls and closed-app Personal Team pushes remain unconfigured.


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
