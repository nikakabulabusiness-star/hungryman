# Hungryman Work calls: deployment and remaining verification

The app includes its own call UI/media document and exchanges signaling through the authenticated native API. No third-party meeting page is opened. Up to six approved conversation members can join. Media is WebRTC peer-to-peer; it is not recorded by this service.

## Relay configuration (not yet provisioned)

Direct STUN connectivity cannot cover every mobile/carrier/hotel network. The server supports a coturn-compatible TURN REST service. In Sites runtime settings, configure:

- `WORK_TURN_URLS`: comma-separated relay URLs, for example `turn:YOUR_RELAY_HOST:3478?transport=udp,turns:YOUR_RELAY_HOST:443?transport=tcp`.
- `WORK_TURN_SECRET`: at least 32 characters, matching coturn's `static-auth-secret` with `use-auth-secret` enabled. Store as a runtime secret, never source or mobile configuration.

These are placeholders, not a provisioned server. Coturn is open-source; running it still needs a reachable host, ports, TLS certificate for TURN/TLS and bandwidth. No paid hosting or public shared credentials were enabled. Do not expose an unauthenticated relay. Apply per-user/global allocation and bandwidth quotas on the relay.

After an authorized join, the API returns time-limited HMAC credentials tied to that device session, with no-store caching. Shared secrets never reach the phone. Expiry covers the server's four-hour call limit. Missing configuration accurately returns `relayAvailable:false`; incomplete configuration fails with an explicit service error. A `true` flag means credentials were configured, not that a relay path was tested.

## Device acceptance

1. Install the current update on two separate physical devices and sign in with two approved accounts that belong to the same conversation.
2. Keep both apps open. Start audio: only microphone permission should be requested; the other app should show the incoming-call banner. Accept and verify two-way sound and mute.
3. Start video: verify self preview, two-way video/audio, camera toggle/flip and hangup. Deny microphone once and verify recovery through OS Settings.
4. Background or leave either call and verify camera/microphone stop. Reopen and explicitly join again. Background calling/CallKit are not implemented.
5. Test same Wi-Fi, separate Wi-Fi and Wi-Fi-to-mobile-data. For a configured TURN deployment, inspect a selected relay candidate on a controlled test device; a same-Wi-Fi success does not prove TURN works.
6. Suspend a participant or revoke conversation access and confirm media stops after the next signaling rejection.

Free Personal Team iPhone builds cannot receive remote APNs call invitations when closed. This repair does not change that limitation. Automated tests mock devices/WebRTC and cannot certify physical-device media delivery.

References:
- https://webrtc.org/getting-started/turn-server
- https://github.com/coturn/coturn/wiki/turnserver
- https://docs.expo.dev/versions/v58.0.0/

## Desktop and ringtones (0.3.9)

The top-level browser coordinator `/work/call-client.js` polls authorized invitations every three seconds, shows answer/decline, and routes call media through the same-origin `/work/call.html` iframe with camera/microphone/autoplay delegation. It is loaded on the staff pages and signed-in careers homepage. Full and docked chats provide audio/video call buttons. RPC messages must match both the exact iframe window and origin; the coordinator binds call/session IDs itself and never trusts supplied IDs. Cookie sessions and server permissions remain authoritative. Refresh an already-open desktop page after deployment.

Original incoming/outgoing WAV tones are bundled on web and native. Accept/decline/end/connection stop the respective tone; outgoing ringing expires after 90 seconds. Browser autoplay failures expose a sound-enable button and never imply sound was delivered. A local browser-tab lease limits duplicate incoming sound. Native tone playback pauses in the background, cancels late async playback and releases its player on completion. No new dependency or signing capability was added.

Automated browser controller/bridge, native tone lifecycle, WebRTC/media mocks, authorization and Mac updater tests pass. Website/mobile TypeScript and mobile lint are checked. The managed browser preview failed its health timeout and was stopped by the preview supervisor; live browser media and physical phone-to-browser audio/video still require user testing. TURN and closed-app Personal Team limitations above remain unchanged.


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
