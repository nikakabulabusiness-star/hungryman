# Hungryman Work scheduled reminders

The existing Site publishes a small authenticated MCP service at `/mcp` for its
owner's cloud task. It does not replace employee login or change the Site audience.

## Hosted configuration

- `WORK_NOTIFICATION_SCHEDULER_OWNER_EMAIL`: the current Site owner's verified
  account email. It must match the Sites-authenticated email and a nonempty
  Sites-authenticated user ID. No default is accepted.
- `WORK_NOTIFICATION_SCHEDULER_ENABLED`: set to `1` only after the unattended
  connection, writer and schedule are verified. Leave unset while setup is pending
  so standalone clients retain local reminder fallback.
- `WORK_NOTIFICATION_CRON_SECRET`: optional for the separate authenticated HTTP
  dispatch endpoint. The MCP route does not need or reveal this secret.

The configuration belongs in Sites runtime settings. Never put credentials in the
repository, app binary or schedule prompt. A Sites service bypass is not an owner
identity and is not accepted by `/mcp`.

## Tools

`work_notification_status` reports readiness and the last completed dispatch receipt
using aggregate counts only. `run_due_work_notifications` runs the shared reminder
producer at server time, retries eligible work/chat deliveries and persists a
completion receipt in `workspace_settings`. Both take an empty argument object and
are restricted to the configured Site owner. A caller cannot choose another date,
recipient, message body or attendance decision.

Salary reminders become due at **10:00 Asia/Tbilisi** on the configured salary date.
Attendance prompts become due at **13:00 Asia/Tbilisi**, only for employees who are
scheduled to work and have not arrived or already answered. The producer catches
up only on the same local date. Deterministic notice IDs and per-device delivery
claims make retries safe. Calling the tool does not approve an HR request or
change attendance.

## Provision and verify

1. Publish this existing Site with `mcp` in its preserved hosting capabilities.
2. Obtain the provisioned plugin through Sites. Confirm the owner's connection and
   call `work_notification_status` through that connection. Merely listing the
   public tool schemas does not verify write access.
3. Call `run_due_work_notifications` through the same connection, then read
   `work_notification_status` and verify its persisted completion timestamp/counts.
   A successful run may create zero notices when none are currently due.
4. Read the Site's linked schedules. Reuse a matching task, including its paused
   state, or create a linked cloud task for **10:00 and 13:00 Asia/Tbilisi daily**.
   Schedule timing is best effort; local reminders remain the fallback until the
   supported unattended writer is ready. No browser-only session is sufficient.
5. After the schedule is saved and its connection is ready, enable the runtime
   scheduling flag and deploy it. Verify the next scheduled run's persisted receipt.

Suggested self-contained task instruction:

> Call this Site's `run_due_work_notifications` tool once using the connected Site
> owner's identity, then call `work_notification_status` to verify the run receipt.
> Use only the saved Hungryman Work calendar and attendance rules. Do not change
> employee records, calendars, access, or source code. If the connection is missing
> or the call fails, report the failure; do not treat it as a successful delivery.

The Site ID belongs in the Sites task link and is supplied by the scheduling
system. Do not include any token, password or secret in the task instructions.

## Delivery limits

The server can create an inbox notice even if a phone has no registered push token.
An Expo accepted ticket is not proof that a device displayed a notification. Remote
delivery still requires the device's notification permission, supported signed
native build and valid APNs/FCM setup. The current free iPhone Personal Team build
intentionally disables APNs and continues to use local scheduled reminders.

If plugin connection or cloud scheduling cannot be completed, leave the server
scheduling flag off and describe unattended server reminders as pending.
