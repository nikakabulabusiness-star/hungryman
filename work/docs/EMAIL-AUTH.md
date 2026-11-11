# Email verification and password recovery

Implemented for Work web/PWA and native 0.3.18. Existing accounts continue to log in; legacy accounts are not retroactively marked verified. New registration requires mailbox proof before creating an account, then retains the existing pending/administration-approval workflow.

## Production readiness

The application code and D1 migration are ready. Email delivery is **not configured or verified end-to-end yet**. Only `WORK_AUTH_CODE_SECRET` is configured in Sites as a secret. Until the sender and Resend key are added, code requests fail explicitly with 503; they never claim mail was sent, expose a code, or bypass verification. Consequently new registrations cannot finish until delivery is connected. Existing logins continue normally.

Required production variables (Sites environment settings, never source/app config):

- `WORK_AUTH_RESEND_API_KEY`: Resend sending API key, stored as a **secret**, restricted to the verified sending domain where supported.
- `WORK_AUTH_EMAIL_FROM`: bare sender email on a verified domain, e.g. `security@mail.hungryman.ge` only after that subdomain has been verified.
- `WORK_AUTH_CODE_SECRET`: random 32-byte hex secret, already configured. Do not rotate casually: outstanding codes will stop verifying.

Set up a Resend account and add a sending subdomain in its Domains screen. Copy the account-specific SPF/DKIM records from Resend into Cloudflare. Do not invent those records or overwrite the existing main domain's website/MX configuration. Turn off email click/open tracking for security messages. Store the sending key in Sites through its secret input, then redeploy the saved version to apply the new environment revision. No API key belongs in chat, Git, an app bundle, a URL, or screenshots.

Official integration references:
- https://resend.com/docs/api-reference/emails/send-email
- https://resend.com/docs/dashboard/domains/introduction
- https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html

Once configured, use a consented test mailbox to verify inbox/spam delivery, all three UI steps, old-password rejection, session revocation across devices, and registration approval notifications. Local tests mock the provider and **do not demonstrate real inbox delivery**.

## Protocol and protections

- POST `/api/auth/email-code/request` with `email` and `purpose` (`reset` or `register`). Returns a random challenge ID, server time, expiry and resend time. Identical delivery/request behavior for existing and unknown mailboxes. Unknown reset accounts receive a code but cannot be created by recovery; that information is shown only after mailbox proof.
- POST `/api/auth/email-code/verify` with that ID, email, purpose and 6-digit code. Cryptographic uniform random codes expire 120 seconds after provider acceptance. Only HMAC digests are stored, using the independent server secret.
- Verification atomically permits one successful use and issues a high-entropy, hashed, purpose/mailbox-bound grant valid for 10 minutes to finish password entry.
- POST `/api/auth/password-reset` or `/api/auth/register` with email, grant, password and passwordConfirmation. 8–128 character password policy matches login. No automatic login after recovery.
- The same paths under `/api/mobile/auth/` support native JSON requests. Browser requests require same-origin protection; native exceptions apply only to exact public auth paths and reject browser-origin/Fetch-Metadata requests.
- Resend wait 60 seconds; 5 incorrect attempts per code; 5 sends/address/hour across both purposes; 30 sends/IP/hour; site-wide 80 code sends/day to bound abuse/spend. Verification/completion also have per-address and per-IP limits independent of User-Agent.
- A replacement invalidates the old code and grant. Account deletion purges challenges. D1 transactions bind grant consumption to the account and current password hash; concurrent completions, deletes/recreations, resends and password changes cannot replay a grant.
- Password reset preserves role/approval/deactivation status, revokes web/native sessions and old push device registrations, and attempts a password-change notification email. Confirmation email failure never reverses a successful reset or falsely reports that the reset failed.
- Login inserts a session only if its checked password record is still current, preventing an in-flight old-password login from surviving reset.
- Codes/grants/passwords only live in UI memory, never persistent cache or URLs. All auth responses are no-store; the countdown uses server clock offset and absolute expiry so backgrounding does not extend validity.

## Validation

`tests/email-auth.mjs`, `tests/email-flow-ui.mjs`, `tests/mobile-auth.mjs`, `tests/registration-notices.mjs`, `tests/account-deletion.mjs`, plus cabinet/workspace regressions, web/native typecheck and native lint. Browser preview is unavailable in this environment because an unrelated `/site` process owns the managed preview port; do not terminate it. Published login/recovery entry can be checked using the real browser after deployment. Physical-device recovery and real email delivery still require the above connection and acceptance test.
