# Hungryman Work browser preview

Same Flutter app screens, separate `main_preview.dart` entrypoint with an in-memory HTTP adapter. No production credentials. All state resets on reload. Calls, uploads, live location and protected admin RPCs require the real backend and are not simulated as successful. Preview bypass is never imported by main.dart.

`flutter-source` preserves the exact app sources used for this preview. Build with Flutter 3.35.4: `flutter build web --release --no-tree-shake-icons --target=lib/main_preview.dart`, copy build/web to dist and retain preview favicon/title. Hosted output is static in dist.

Verified: Flutter web build and widget integration test opening Home, sending a chat message and opening Shoot Workspace. Browser/device rendering not separately verified.

Home now contains only Next Shoot and pinned messages from the team conversation. Greeting, announcements, tasks and recent chat blocks are removed from Home. Preview starts in dark mode.

Compact rounded theme, smaller typography and chat bubbles with sender initials and timestamps. Georgian UI and Material dialog localization. Backend enum values remain unchanged; uiLabel translates their display. 390px widget integration test passes.
