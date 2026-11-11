# Hungryman Work PWA

The Work site and installed PWA share the same routes, authentication, permissions and APIs. The manifest starts at `/work`; `/install` provides Georgian iPhone and Android instructions and notification settings. `team.hungryman.ge`, `careers.hungryman.ge`, the main website and the Careers bridge do not expose the Work manifest or worker.

Every normal build stamps a source hash into `lib/pwa-release.json`. The worker URL remains `/sw.js`, served without HTTP caching. The runtime checks for releases on foreground entry and at most once every five minutes while visible. A waiting release shows an update notice. Applying it requires confirmation and is blocked during an incoming/active call or unsent voice recording. Other open tabs are never reloaded by `controllerchange`. The browser activates a waiting worker once its old clients close; a later launch uses fresh network navigation.

Only the generic offline page, app icons and same-origin `/_next/static/` assets enter Cache Storage. Authenticated HTML, API responses, uploaded files, POST requests, RSC requests, query-string assets and authorization-bearing requests are excluded. Navigation uses the network with `no-store`; connection failure serves the generic offline page without account information. This release does not promise offline chat/history. The current and one preceding public asset cache are retained, capped at 120 entries each; other products' caches are untouched. No account data is added to persistent browser storage by the PWA runtime.

The root worker imports `/work/web-push-worker.js`. Push permission is requested only through the separate notification settings. Installing the PWA does not grant native iOS call/background privileges. Camera, microphone and notification permissions remain subject to the browser and operating system.

Verification: `node tests/pwa-lifecycle.mjs` executes the actual worker and client handlers with mocked browser primitives. Device testing must still cover Safari Home Screen installation, Android installation, online/offline launch, a deployment while a call is active, and notifications with the app closed.
