import {cookies,headers} from 'next/headers';
import {STAFF_EMBEDDED_SESSION_COOKIE,STAFF_SESSION_COOKIE} from '@/lib/staff-auth';
import {isCareersBridge} from '@/lib/careers-bridge';
import ChatNotifications from '@/components/chat-notifications';
import DeveloperModeGate from '@/components/developer-mode-gate';
import PwaRuntime from '@/components/pwa-runtime';
import WorkMobileShell from '@/components/work-mobile-shell';
import {WebPushSessionSync} from '@/components/web-push-settings';
import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./application.css";
import "@/components/work-mobile-content.css";
import SaveFeedback from '@/components/save-feedback';

export const metadata: Metadata = {
  title: "Hungryman Work — გუნდის სამუშაო სივრცე",
  description: "ჰანგრიმენის ვაკანსიები და გუნდის სამუშაო სივრცე — ჩატი, კალენდარი, გადაღებები და მართვა.",
  icons: {
    icon: "/hungryman.svg",
    shortcut: "/hungryman.svg",
  },
};

export const viewport: Viewport = {width:'device-width',initialScale:1,viewportFit:'cover'};

// Workspace navigation intentionally uses native anchors (see WORK-HANDOFF.md), so every
// page switch is a document load. Let Chromium start that request on hover/touch-start
// (moderate eagerness) for internal staff pages only. Prefetch is a plain GET that the
// server authorizes exactly like a click; APIs, exports, embeds and downloads are excluded.
const speculationRules=JSON.stringify({prefetch:[{where:{and:[
 {href_matches:['/','/work','/work/*','/team','/team/*','/shoots','/chat','/admin','/admin/*','/install','/profile','/profile/*']},
 {not:{href_matches:['/chat/embed*','/api/*','/work/tasks/video/*/export*']}},
 {not:{selector_matches:'[download],[target="_blank"],[data-no-prefetch]'}},
]},eagerness:'moderate'}]});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const publicCareers=isCareersBridge(await headers());
  // Signed-out visitors (apply pages, login) get no staff-only clients: the call/dock/
  // notice scripts only produced 401/403 polling for them. Developer Mode is decided
  // on the server (DeveloperModeGate) instead of a per-page client probe.
  // Every staff API still authorizes on its own; this only skips useless requests.
  const jar=await cookies(),staffSession=jar.has(STAFF_SESSION_COOKIE)||jar.has(STAFF_EMBEDDED_SESSION_COOKIE);
  return (
    <html lang="ka" className="dark">
      <head><link rel="stylesheet" href="/work/call-client.css?v=58"/><link rel="stylesheet" href="/work/chat-dock.css?v=3"/>{!publicCareers&&<><link rel="manifest" href="/manifest.webmanifest"/><link rel="apple-touch-icon" href="/work/pwa/icon-180.png"/><meta name="theme-color" content="#041925"/><meta name="apple-mobile-web-app-capable" content="yes"/><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/><meta name="apple-mobile-web-app-title" content="Hungryman Work"/><script type="speculationrules" dangerouslySetInnerHTML={{__html:speculationRules}}/></>}</head>
      <body className="antialiased">{!publicCareers&&staffSession&&<DeveloperModeGate/>}{children}<SaveFeedback/>{!publicCareers&&<>{staffSession&&<ChatNotifications/>}<WorkMobileShell/><PwaRuntime/><WebPushSessionSync/></>}</body>
    </html>
  );
}
