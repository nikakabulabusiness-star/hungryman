import {useResource} from '../../lib/use-resource';
import type {NoticeCounts} from '../../ui/notification-center';
import { Tabs } from "expo-router/js-tabs";
import { Icon, C } from "../../ui/components";
import { useAuth } from "../../lib/auth";
import {hasPermission} from '../../lib/permissions';
export default function MainLayout() {
  const { session } = useAuth();
  const counts=useResource<NoticeCounts>("/api/notifications?counts=1");
  const p=session?.permissions;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.red,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: { backgroundColor: C.bg, borderTopColor: C.line },
        tabBarLabelStyle: { fontSize: 10 },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "მთავარი",
          tabBarIcon: ({ focused }) => (
            <Icon name="grid-outline" color={focused ? C.red : C.muted} size={22} />
          ),
        }}
      />
      <Tabs.Protected guard={hasPermission(p,'shoots.view')}>
      <Tabs.Screen
        name="shoots"
        options={{
          title: "გადაღებები",
          tabBarIcon: ({ focused }) => (
            <Icon name="videocam-outline" color={focused ? C.red : C.muted} size={22} />
          ),
        }}
      />
      </Tabs.Protected>
      <Tabs.Protected guard={hasPermission(p,'chat.view')}>
      <Tabs.Screen
        name="chat"
        options={{
          title: "ჩატი",
          tabBarBadge: counts.data?.chatUnread ? counts.data.chatUnread>99?'99+':counts.data.chatUnread : undefined,
          tabBarBadgeStyle: {backgroundColor:C.red,color:"white",fontSize:10},
          tabBarIcon: ({ focused }) => (
            <Icon name="chatbubbles-outline" color={focused ? C.red : C.muted} size={22} />
          ),
        }}
      />
      </Tabs.Protected>
      <Tabs.Protected guard={hasPermission(p,'cabinet.view')}>
      <Tabs.Screen
        name="profile"
        options={{
          title: "კაბინეტი",
          tabBarIcon: ({ focused }) => (
            <Icon name="person-circle-outline" color={focused ? C.red : C.muted} size={22} />
          ),
        }}
      />
      </Tabs.Protected>
      <Tabs.Protected guard={hasPermission(p,'admin.view')||hasPermission(p,'youtube.view')}>
        <Tabs.Screen
          name="manage"
          options={{
            title: "მართვა",
            tabBarIcon: ({ focused }) => (
              <Icon name="options-outline" color={focused ? C.red : C.muted} size={22} />
            ),
          }}
        />
      </Tabs.Protected>
    </Tabs>
  );
}
