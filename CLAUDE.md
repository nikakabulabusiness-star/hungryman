# Hungryman developer handoff • 2026-11-11

## Start in this directory

The four sibling directories are tracked-file snapshots of separate Sites Git repositories. Each snapshot was checked against the saved version's Git SHA. Use projects.json for IDs, exact version numbers, branch names, source remotes and configured environment variable NAMES. Old documents sometimes contain historical paths, URLs and release numbers. Preserve those documents; use the manifest for the exported revision.

| Product | Where to edit | Responsibilities |
|---|---|---|
| hungryman.ge | main-site/public, src, db, drizzle | Public content, assets, analytics and administration. Read ARCHITECTURE.md. |
| team.hungryman.ge | careers/worker/index.js and work/app/apply, work/app/careers | Public gateway calls the Work backend. Forms and application handling live in Work. Change the appropriate repo; test both ends. |
| work.hungryman.ge | work/app, lib, db, drizzle, scripts, tests | Staff web app, backend and mobile API. Read docs/WORK-HANDOFF.md, WORK-TASKS.md, EMAIL-AUTH.md, CALLS-SETUP.md and work-notification-scheduling.md. DB and BUCKET bind to hosted D1 and R2. |
| Installed mobile app | work/mobile inside the Work repository | Expo SDK 58, React Native 0.88, Expo Router. app.json reports 0.3.18. Read mobile/AGENTS.md, README.md, MAC-IPHONE.md, FREE-INSTALL.md and ANDROID-FREE.md. Keep sibling work/lib for shared code. |
| Browser preview | app-preview/flutter-source and dist | Older Flutter prototype with in-memory HTTP adapter. Data resets on reload. Separate repository and deployment. |

## Starting locally

Use Node 24 for the JS tests (node:sqlite). Run each line from the indicated directory:
- main-site: `npm run build` followed by `node tests/workflows.mjs`.
- careers: `node build.mjs` followed by `node test.mjs`.
- work: Node >=22.13 and pnpm 11.25.0. Use `pnpm install --frozen-lockfile`, `pnpm dev`, `pnpm build`. The repository's Linux CI install path is `npm run install:ci`. Inspect scripts/run-framework.mjs and scripts/sites-env.mjs for host dependencies. Windows users can use WSL2. Use local bindings/test data. Targeted regression checks after dependency installation: `node tests/work-production-flow.mjs` and `node tests/work-web-interactions.mjs`.
- work/mobile: `npm ci` then `npm start` for the Expo development server. Native modules require the matching native build. Use the existing Mac project and personal signing for iPhone. For local Android builds follow ANDROID-FREE.md. Preserve identifiers, runtime channel and personal signing settings. Check the configured API URL before testing writes.
- app-preview/flutter-source: Flutter 3.35.4, `flutter pub get`, `flutter test`, `flutter build web --release --no-tree-shake-icons --target=lib/main_preview.dart`. See ../README.md for updating dist.

## Current product decisions

Georgian interface, rounded dark UI. Work production board is restricted to Developer Mode until Nika opens it for the team. Preserve server and direct-route checks. Workflow: idea title + short description → Word-style rich-text script → founder approval → production → editing with senior editor assignment → ready → Finish when published. Preserve call sheet, drag handles for order, compact color-coded team credits, links, history and tasks. Staff approval, personal-note privacy and the disabled Shorts viewing tab are intentional. Mobile and web share accounts and the API. Older Flutter/Supabase design documents describe an earlier proposal; follow the active source for implementation.

## Local editing and returning changes to the original projects

1. Extract the whole ZIP on the owner's computer. Run `claude` in its extracted root. No hosting login is needed to read and edit these copies. If using local Git, initialize a separate repo in each affected source folder and commit the untouched snapshot as a baseline before changing files. Keep the four repos distinct. The ZIP omits .git history.
2. To deliver changes to the existing hosting without a Claude-compatible hosting integration, from a changed folder run `git add -A` and `git diff --cached --binary HEAD > ../PROJECT.patch` before committing. Give the patch and baseline SHA to the owner in the existing Sites workspace. Apply on a fresh checkout of the original repo, check for upstream changes, run tests, push the reviewed commit, save a new version against that commit and deploy to the existing project. Confirm the deployment result. Preserve domains and access policy.
3. For direct Git collaboration instead, the owner can give Claude Code access to their own private remote and add these source folders there. Syncing to that remote does not publish to Sites. Direct publishing to the current hosts requires authorized Sites operations and a fresh project-scoped Git credential. No durable Claude hosting session or collaborator grant is created by this export.
4. Runtime values remain in hosting. projects.json lists configured names; source docs describe optional values and external providers. CAREERS_BRIDGE_SECRET pairs careers and work; WORK_INBOX_SECRET pairs main-site and work. Use independent development values in both ends of each local pair. Do not rotate live values to run a local build. D1/R2 contents, employee accounts, CVs, chat history, OAuth grants, production passwords, Apple signing identity and Expo account sessions are not part of the source snapshot. For native releases use the owner's existing Xcode/Expo account and approved release route. A web deployment does not install a new native build.

## Verification

Compared each repo HEAD with its saved version; all matched. The main-site workflows and careers gateway tests passed on Node 24. Work flow tests require TypeScript/dependency installation. No signed mobile build, live-data mutation or production publish was performed. reference-files.md lists prior builds and design materials available to the owner separately. Old ZIPs, APK and unsigned IPA may predate the exported source.

