# Work website, PWA and native release workflow

User requirement, 26 October 2026: keep the installed Work PWA and native app aligned with relevant product changes. Preserve Georgian text, dark red/blue styling and the compact rounded mobile layout. Do not change the main Hungryman website or public recruitment site as a side effect.

## Clients and source of truth

| Client | Origin/source | Delivery |
| --- | --- | --- |
| Work desktop/mobile website and installed PWA | `work.hungryman.ge`, repository web routes/components | Site deployment; service-worker update for the installed PWA |
| iPhone/Android native app | `mobile/src`, React Native and Expo Router | Compatible JavaScript/assets via an authorized Expo update, or a new signed binary for native changes |
| Shared accounts, permissions and product data | Existing Work server APIs | Backward-compatible server deployment |

PWA installation uses the same website and backend, not a copied database. Web publication does not compile or publish the React Native client. A server-only change can affect both clients immediately, but native UI changes must be implemented and verified in native source. Do not promise all platforms receive every capability: browser/OS background execution, push and permission behavior differ.

## Required procedure for each product release

1. Inspect the current live feature-removal configuration with `work_system_status`. Preserve developer removals and permission boundaries; do not silently restore disabled modules.
2. Identify which changes belong to web/PWA, native, or shared server. Implement the relevant clients in the same change and record any intentional platform limitations. Preserve compatibility with installed older clients.
3. Verify server authorization, web/PWA build and update behavior, plus native typecheck/lint and relevant native tests. Verify the UI change on both clients when it affects both. Include offline/account-isolation/logout behavior when changing cached data. Keep active calls, recordings and unsent drafts safe during update activation.
4. For compatible native code/assets, run `cd mobile && npm run updates:verify`. Keep `58-personal-ota1` unchanged for JavaScript-only releases. Do not edit the hash merely to bypass a native compatibility failure.
5. Commit the verified source before producing the final source updater so `manifest.json.sourceCommit` identifies its actual source. Package with `node scripts/package-mac-update.mjs /absolute/output/HungrymanWork-iPhone-Update-VERSION`, then ZIP that generated folder. It is a Mac source updater, not an IPA. Preserve the generated manifest, payload and executable launchers together.
6. Deploy and verify the Work website/PWA. Publish a compatible native update separately from an authorized Expo session; verify project, channel, runtime and the resulting update ID. An unperformed publication must be reported as pending, not delivered.
7. Verify one installed native app downloads/applies the release and one installed PWA receives its new service worker. Report source/build validation separately from physical-device validation. Record the deployed site version, native app version/runtime/update ID, checks and remaining blockers in `WORK-HANDOFF.md`.

Do not automatically reload an active call or recording. Downloaded native updates take effect at a safe restart or after the user's confirmation. PWA update activation follows its own guarded UI/service-worker policy; it does not activate native updates.

## Native 0.3.16 delivery

- Expo owner/project: `@hungrymanworks-team/hungryman-wrok` (the existing slug is intentionally retained).
- Project ID: `9e2f2ace-b709-4e31-b709-c3eae666194a`.
- Personal iPhone channel: `personal-iphone`; environment: `preview`; runtime: `58-personal-ota1`.
- Native hash: `16d79d182257d85cd1e66149c3cb0d009f157a8a80620df95eaf22afa1065cd5`.
- Version 0.3.16 does not add native dependencies or change the personal runtime. The source updater accepts delivered 0.3.15 (`fbe5ecfa54a937634bb83efa2d0c8c791f056511`) and the previously supported source revisions, including `bce6f529b1f6da111ffb5f0b1df519cd28b80d00`.

For an older app with OTA disabled: open `Update-on-Mac.command` on the owner's Mac, use the existing `~/Desktop/HungrymanWork-Free-Mac` project, and successfully Run the Release scheme on the iPhone from Xcode. This enables OTA; enabling OTA cannot itself be delivered to an OTA-disabled binary. Keep the existing app installed to preserve its data. The updater preserves local bundle ID, Apple Team and signing choices.

For publication: first apply the source update to that Mac project. Open `Login-to-Expo.command` and sign into an existing Expo account with publication rights on the team project. Then open `Publish-Update.command`. Login and publication are separate deliberate actions. The publisher refuses a changed native configuration, wrong local project, missing session, failed remote project verification, or failed Expo publication. Never request credentials, recovery codes or tokens in chat. This workflow does not grant Codex an Expo session.

On 26 October 2026 the execution environment returned **Not logged in** from `eas whoami`. No native OTA publication or signed binary has been produced here. A Linux JavaScript export is not Xcode compilation or proof of iPhone delivery.

## When a new binary is necessary

Native dependencies, entitlements, native configuration or permissions can require a newly signed binary. Give it a new personal runtime, retain replaced runtimes in `previousRuntimeVersions`, validate the new native hash, and prepare/test the installation package before publishing server metadata that announces the replacement. `/api/mobile/release` exposes the replacement list; the native Home/Profile notice says “საჭიროა ახალი ბილდი” only for explicitly superseded runtimes.

The free Apple Personal Team signature still expires in approximately seven days and must be renewed through Xcode. OTA changes code/assets; it does not renew Apple signing or add APNs/CallKit. A PWA does not require Apple code signing. Expo service quotas still apply; no paid plan or store submission is authorized by this workflow. Native closed-app incoming calls remain a separate platform-signing/integration requirement.
