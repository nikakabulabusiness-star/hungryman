# Channel analytics and PDF export

The native page is `/admin/youtube`, under the existing admin authorization guard.
It currently uses **demo data only**. No Google, Meta or TikTok OAuth connection is
active. Do not describe fixture values as live or update their observation date
on refresh. `fetchedAt` is deliberately null for the demo.

`prepareChannelReport` reads the provider again for every download, clones one
snapshot, and records a separate generation time. It does not export the old
screen cache after a failed refresh. All ten pages use that same snapshot. A PDF
already saved to Files is a fixed copy; downloading again creates a new one.

The 2025 user-supplied PDF defines these sections: cover; multi-platform audience;
YouTube views, average duration, unique viewers, impressions and demographics;
Facebook performance; Instagram performance/audience; Facebook audience. The PDF
renderer recreates those categories with selectable text, vector charts, embedded
Georgian fonts and the existing channel logo. It does not relabel the old PDF's
numbers as new. Each page shows demo status or data coverage and generation time.

## Future real provider

- Implement authenticated server-side OAuth; tokens must never enter this model,
  app bundle or PDF. Enforce staff analytics access on the server too.
- YouTube Studio invited Editor access does not provide API access. Channel owner
  authorization is needed. Read-only scopes are sufficient for non-revenue data.
- Meta and TikTok require separate connections. YouTube cannot supply those data.
- Map supported metrics and periods exactly. YouTube `averageViewDuration` is
  seconds; watch-time units differ by API. Do not sum unique viewers, percentages,
  follower counts or average durations across days or platforms.
- Check actual API support for impressions, unique viewers, Instagram impressions
  and legacy Facebook video metrics. Set unsupported metrics to `null`, with a
  reason. Never silently replace them with zero, a demo value or a different metric.
- Use source coverage dates, not wall-clock time, for report periods. Reports are
  the latest **available** data, not guaranteed second-by-second Studio realtime.
- Keep fetch time, coverage date and PDF creation time distinct. Mixed platform
  coverage should use each platform's `dataThrough` and matching period metadata.
- Read all periods as one server snapshot to avoid mixed revisions. Add server
  rate limiting/caching and refresh scheduling only when a real connection exists.

## Validation and distribution

Run `node scripts/test-channel-report.cjs <temporary-output-directory>`,
`npm run typecheck`, and `npm run lint`. Inspect the rendered PDFs before delivery.
`pdf-lib` generates the same bytes in Node and native JS; `expo-file-system` and
`expo-sharing` save/open the device share sheet. The user chooses Files or another
destination; the app does not automatically send the report to anyone.

Version/runtime is 0.2.0 because expo-sharing adds native code. Publish previews to
`expo-go-preview` only. Existing 0.1.0 IPA/APK binaries require a new build; do not
push this update to their channels or claim those binaries include this feature.

Embedded DejaVu fonts are subset to Latin/Georgian; see `assets/DejaVu-LICENSE.txt`.
