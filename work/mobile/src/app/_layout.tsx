import {AppUpdatesProvider} from '../ui/app-updates';
import {KeyboardProvider} from 'react-native-keyboard-controller';
import {MessageNotifications} from '../ui/message-notifications';
import {canReviewRequests} from '../ui/notification-center';
import {CallLifecycle} from '../ui/call-lifecycle';
import {LocationLifecycle} from "../ui/location-lifecycle";
import {LaunchLogo} from "../ui/brand";
import {DeveloperMode} from "../ui/developer-mode";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../lib/auth";
import { Button, Screen, State, SavedToast, C } from "../ui/components";
import {hasPermission} from '../lib/permissions';
function Navigation() {
  const { session, loading, error, refresh } = useAuth();
  if (loading)
    return (
      <Screen title="Hungryman Work">
        <State loading />
      </Screen>
    );
  if (error && !session)
    return (
      <Screen title="Hungryman Work">
        <State error={error} />
        <Button
          title="ხელახლა ცდა"
          onPress={() => void refresh().catch(() => {})}
        />
      </Screen>
    );
  const approved = !!session?.permissions?.isApprovedStaff;
  return (
    <>
    <DeveloperMode/>
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: C.bg },
        animation: "slide_from_right",
      }}
    >
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !approved}>
        <Stack.Screen name="pending" />
      </Stack.Protected>
      <Stack.Protected guard={approved}>
        <Stack.Screen name="(main)" />
        <Stack.Protected guard={hasPermission(session?.permissions,'workspace.view')&&session?.permissions?.features?.work!==false}><Stack.Screen name="work-tasks" /><Stack.Screen name="work-video/[id]" /></Stack.Protected>
        <Stack.Protected guard={hasPermission(session?.permissions,'shoots.view')}><Stack.Screen name="shoot/[id]" /></Stack.Protected>
        <Stack.Protected guard={hasPermission(session?.permissions,'shoots.create')||hasPermission(session?.permissions,'shoots.edit')}><Stack.Screen name="shoot/edit" /></Stack.Protected>
        <Stack.Protected guard={session?.permissions?.features?.map!==false}><Stack.Screen name="work-map" /></Stack.Protected><Stack.Protected guard={session?.permissions?.features?.notifications!==false}><Stack.Screen name="notifications" /></Stack.Protected>
        <Stack.Protected guard={hasPermission(session?.permissions,'departments.view')}><Stack.Screen name="departments" /></Stack.Protected>
        <Stack.Protected guard={hasPermission(session?.permissions,'chat.view')}><Stack.Screen name="conversation/[id]" /></Stack.Protected>
        <Stack.Protected guard={hasPermission(session?.permissions,'chat.call')}><Stack.Screen name="call/[id]" /></Stack.Protected>
        <Stack.Protected guard={hasPermission(session?.permissions,'cabinet.leave.request')}><Stack.Screen name="time-off" /></Stack.Protected>
        <Stack.Protected guard={canReviewRequests(session)}><Stack.Screen name="time-off-review" /></Stack.Protected>
        <Stack.Protected guard={hasPermission(session?.permissions,'social.view')}><Stack.Screen name="social" /></Stack.Protected>
      </Stack.Protected>
      <Stack.Protected
        guard={approved && (hasPermission(session?.permissions,'admin.view')||hasPermission(session?.permissions,'youtube.view'))}
      >
        <Stack.Screen name="admin" />
      </Stack.Protected>
    </Stack>
    {approved&&<LaunchLogo/>}{approved&&<MessageNotifications/>}{approved&&hasPermission(session?.permissions,'chat.call')&&<CallLifecycle/>}
    </>
  );
}
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <KeyboardProvider><AppUpdatesProvider><AuthProvider>
        <StatusBar style="light" />
        <LocationLifecycle/>
        <Navigation />
        <SavedToast/>
      </AuthProvider></AppUpdatesProvider></KeyboardProvider>
    </SafeAreaProvider>
  );
}
