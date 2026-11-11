import {headers} from 'next/headers';
import {isCareersBridge} from '@/lib/careers-bridge';
import ChatNotifications from '@/components/chat-notifications';
import DeveloperMode from '@/components/developer-mode';
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const publicCareers=isCareersBridge(await headers());
  return (
    <html lang="ka" className="dark">
      <head><link rel="stylesheet" href="/work/call-client.css?v=58"/><link rel="stylesheet" href="/work/chat-dock.css?v=3"/>{!publicCareers&&<><link rel="manifest" href="/manifest.webmanifest"/><link rel="apple-touch-icon" href="/work/pwa/icon-180.png"/><meta name="theme-color" content="#041925"/><meta name="apple-mobile-web-app-capable" content="yes"/><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/><meta name="apple-mobile-web-app-title" content="Hungryman Work"/></>}</head>
      <body className="antialiased">{!publicCareers&&<DeveloperMode/>}{children}<SaveFeedback/>{!publicCareers&&<><ChatNotifications/><WorkMobileShell/><PwaRuntime/><WebPushSessionSync/></>}</body>
    </html>
  );
}
