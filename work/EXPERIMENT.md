# Private application experiment

Public careers site must remain unchanged until the user explicitly says “განვაახლოთ საიტი”.

This private Site contains six vacancies and role-specific application routes for writer, director, producer, Video Editor, Thumbnail Designer, and Shorts Video Editor, plus the authenticated /admin cabinet. The Video Editor form includes per-program proficiency and 1–5 skill matrices; Premiere Pro is enforced as required. Answers are validated against the selected role on both client and server, and role/schema version is saved with each application. Earlier applications use legacy question labels.

Text drafts are isolated by role in sessionStorage and expire after two hours. File-picker activation saves a draft. After a browser reload, the candidate must reselect the CV or explicitly continue without it. Physical iPhone and ChatGPT in-app file picker behavior has not been reproduced in this environment.

Verification: TypeScript; application-flow tests cover all three schemas and counts, validation, persistence, private CV download, idempotency, failed upload cleanup, and role-isolated draft recovery.
