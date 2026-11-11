# Hungryman site and administration

The existing owner-private Site now uses a Cloudflare ESM Worker, D1 and R2. The Site's original project ID and audience are preserved. `hungryman.ge` is not connected.

## Source and build

`public/` contains the original branded frontend, route templates and assets. `generate-pages.mjs` renders five static public entrypoints. `src/index.js` contains the authenticated API and Worker dispatcher; `src/admin-page.js` renders the protected administration shell. `build.mjs` produces `dist/server/index.js`, `dist/client/` and hosting metadata/migrations. The build itself needs no dependencies. Drizzle development tools were reused from the installed workspace toolchain; package.json declares their exact versions for installation on another machine.

Run `npm run build`. For schema updates install the declared development dependencies and run `npm run db:generate`. Production schema changes are generated in `drizzle/` and never performed by request handlers. Applied migrations are immutable. `tests/workflows.mjs` exercises Worker endpoints with a SQLite adapter, without network calls or production records.

## Identity and security

The Sites dispatcher authenticates users and supplies trusted user ID and email headers. Every /admin and /api/admin route requires both identity headers and either the ADMIN_EMAIL owner configured in Sites or a matching canonical email in the administrators table. Anonymous /admin navigations go through dispatch-owned sign-in; other identities receive 403. The admin account is the current Site owner. Data APIs are server-authorized on every request, not just hidden client controls. No applicant/email records are embedded in public assets.

Mutations require the known Site Origin. Queries are prepared, payloads and uploads are bounded, public submissions have per-source rate limits, and UUID submission IDs provide retry deduplication. All email and user content is rendered as escaped text. Remote email HTML and attachments are not displayed. R2 allows only validated raster file signatures and serves them with fixed image MIME types and nosniff.

## Workflows

- `/admin/`: owner dashboard; counters refresh every 30 seconds while visible.
- Feedback: optional name/email, category, required message; D1 inbox supports new/reviewed/archived.
- Castings: upload cover to R2, title/description, active flag, up to 20 custom questions; active records populate `/participate/`. Required base fields are name/email/phone and purpose-specific consent. Question labels/answers are snapshotted with applications. Deactivation retains existing applications and rejects new ones.
- Sponsors: initial names Betlive, TBC Bank, 2 ტონა are inserted once transactionally. Deleting them does not cause reseeding.
- Visits: server-signed HttpOnly browser cookie, D1 unique-browser records, 30-second heartbeat when visible, active window 90 seconds. Admin and recognized bot requests are excluded. Counts begin at implementation; no historic traffic has been invented. Cookie deletion and other devices count separately.
- Business: existing mailto links target info@hungryman.ge; click events from the Business page are recorded idempotently. Counters represent email-intent clicks, not confirmed sent emails.
- Sales: only administrator-entered paid sales contribute to quantity/revenue. Cancellations remove them from totals. Online checkout and payment automation remain unconnected and are explicitly labeled.

## Mailbox connection boundary

The connected ChatGPT Gmail profile is not info@hungryman.ge; no messages from that unrelated account were imported. The inbox is implemented and protected. Optional Google Workspace integration is prepared using server-only GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN values. The sync endpoint checks the Gmail profile is exactly info@hungryman.ge before accessing messages. It imports up to 25 as-yet-unseen inbox matches for sponsor/collaboration keywords, with no changes to the mailbox; the admin UI syncs on opening and every minute while visible. This is a keyword filter, not a claim of perfect classification or an always-on background job. Mail configuration is currently absent and the UI says so. Confirm the mailbox provider and authorize that exact account before completing the connection; an IMAP-only provider requires an HTTPS integration because raw TCP is unsupported.

Runtime secrets belong in Sites. No authentication or mailbox credentials are committed. All user-facing copy is Georgian, preserving the original Hungryman design.


## Delegated administrators

The owner can add/revoke an administrator by email under /admin/#administrators. Only the configured owner can list/change these grants; delegated admins can use operational features but cannot manage access. Owner access is not a deletable database row. Every request rechecks the grant; revocation takes effect on the next request. /api/session conditionally shows the top-right administration link on the public site's header, including mobile.

Application grants do not change the Sites platform audience. This Site remains owner-private: the owner must also grant the intended viewer access through the native Share menu using the same email. The UI explicitly explains the two steps. No email invitation is sent by this form, and no platform access credentials are embedded in the application.

## YouTube integration

The Business page exposes four metrics only: subscribers, lifetime views, latest available 28-day views and average daily views (period total / 28). Watch duration, geography and age are removed from the page. An IntersectionObserver triggers one 850 ms counter/slide entrance per page load; reduced-motion users see final values immediately.

`src/youtube.js` implements owner-only Google OAuth for external data access, not Site login. The owner configures their Google Cloud Web OAuth client in `/admin/#youtube`, then grants `youtube.readonly` and `yt-analytics.readonly`. Both YouTube Data API v3 and YouTube Analytics API must be enabled. Redirect URI: `https://hungryman-official.hungryman.chatgpt.site/api/youtube/oauth-callback`. The callback checks a ten-minute, single-use state, Secure/HttpOnly cookie, PKCE verifier and trusted owner ID. It accepts only channel `UCWGUvLISUIa5QciKrZY0jyw`; other grants are revoked. Client secrets and refresh tokens are AES-GCM encrypted in D1 settings using a purpose-derived key from the server-only TRACKING_SECRET. Changing that secret requires reconnecting YouTube. No credentials or OAuth tokens are returned by public or admin status APIs.

`GET /api/analytics` checks an hourly D1 cache and refreshes on demand; a database lease prevents parallel/repeated provider calls for five minutes. A visible Business page polls every five minutes. This is request-driven updating, not a cron job or realtime Studio feed. Daily views by creatorContentType are aggregated for the latest returned day and preceding 27 days. Metadata preserves the actual reporting period and successful refresh time. Provider failures retain a dated cache for at most 30 days; the original supplied screenshot snapshot is the explicit fallback. Disconnect deletes tokens and cache and attempts Google token revocation. The OAuth app should leave Google's Testing mode for a persistent offline grant; Google's consent/verification requirements still apply.

Deployment includes the connection workflow but does not constitute an authorized Google connection. Google Cloud client configuration and the channel owner's consent are still required. Tests use a mocked Google provider and SQLite D1 adapter, covering state replay, wrong channel, role/origin checks, encryption, aggregation, cache reuse and disconnect.
