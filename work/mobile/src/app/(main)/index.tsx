import {hasPermission} from '../../lib/permissions';
import {AppBuildNotice} from '../../ui/app-updates';
import {NotificationButtons} from '../../ui/notification-center';
import {ShootPhoto} from '../../ui/shoot-photo';
import {UpcomingWeek} from "../../ui/upcoming-week";
import {Brand} from "../../ui/brand";
import { Alert,Linking,Platform,Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth";
import { useResource } from "../../lib/use-resource";
import { dateLabel, today } from "../../lib/dates";
import type { ChatData, ShootsData } from "../../lib/types";
import {
  Avatar,
  Button,
  Chip,
  Icon,
  Screen,
  State,
  S,
  C,
} from "../../ui/components";
export default function Home() {
  const { session } = useAuth();
  const p=session?.permissions,canShoot=hasPermission(p,'shoots.view'),canChat=hasPermission(p,'chat.view')&&p?.features?.teamChat!==false,canCalendar=hasPermission(p,'calendar.view'),canCabinet=hasPermission(p,'cabinet.view');
  const shoots = useResource<ShootsData>("/api/shoots", 30_000,canShoot),
    chat = useResource<ChatData>("/api/chat/messages", 30_000,canChat);
  const now = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tbilisi",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  const next = shoots.data?.shoots
    .filter(
      (s) =>
        s.status === "planned" &&
        (s.shoot_date > today() ||
          (s.shoot_date === today() && (s.end_time || "23:59") >= now)),
    )
    .sort((a, b) =>
      (a.shoot_date + a.start_time).localeCompare(b.shoot_date + b.start_time),
    )[0];
  const user = session!.user;
  return (
    <Screen
      title="Hungryman Work"
      refresh={() => {
        void shoots.refresh();
        void chat.refresh();
      }}
      right={
        <View style={S.row}><NotificationButtons/>{p?.features?.map!==false&&<Pressable accessibilityLabel="გუნდის რუკა" style={S.icon} onPress={()=>router.push("/work-map")}><Icon name="map-outline" size={20}/></Pressable>}
        {canCabinet&&<Pressable
          onPress={() => router.push("/profile")}
          accessibilityLabel="ჩემი კაბინეტი"
        >
          <Avatar
            {...user}
            name={user.fullName}
            version={user.profileUpdated}
          />
        </Pressable>}</View>
      }
    >
      {(shoots.cached||chat.cached)&&<Text style={[S.muted,{fontSize:10}]}>{shoots.error||chat.error?'შენახული ასლი · განახლება ვერ მოხერხდა':'შენახული ასლი · ახლდება…'}</Text>}
      <View style={S.row}><Brand/>{p?.features?.youtubeShortcut!==false&&<Pressable accessibilityLabel="Hungryman YouTube არხი" onPress={()=>{void Linking.openURL((Platform.OS==='ios'?'youtube':'vnd.youtube')+'://www.youtube.com/@hungrymantv').catch(()=>Linking.openURL('https://www.youtube.com/@hungrymantv')).catch(()=>Alert.alert('YouTube ვერ გაიხსნა'))}} style={S.icon}><Icon name="logo-youtube" color={C.red} size={22}/></Pressable>}<Text style={S.eyebrow}>{dateLabel(today())}</Text></View>
      <AppBuildNotice/>
      {hasPermission(p,'workspace.view')&&p?.features?.work!==false&&<Pressable accessibilityRole="button" accessibilityLabel="სამუშაო სივრცის გახსნა" onPress={()=>router.push('/work-tasks')} style={[S.card,S.row,{padding:17,borderColor:'#39435e',backgroundColor:'#14222f'}]}><View style={[S.icon,{backgroundColor:'#422330'}]}><Icon name="briefcase-outline" color="#f6465a"/></View><View style={{flex:1,gap:4}}><Text style={[S.subtitle,{fontSize:16}]}>სამუშაო სივრცე</Text><Text style={[S.muted,{fontSize:11}]}>ვიდეოები · ქოლშითები · დავალებები</Text></View><Icon name="chevron-forward" size={18}/></Pressable>}
      {canShoot&&<View style={[S.card, { borderColor: "#713044", padding: 20,borderLeftWidth:4,borderLeftColor:C.red }]}>
        <View style={S.between}>
          <Chip color={C.red}>შემდეგი გადაღება</Chip>
          <Icon name="videocam-outline" color={C.red} />
        </View>
        {shoots.loading && !shoots.data ? (
          <State loading />
        ) : shoots.error ? (
          <State error={shoots.error} retry={shoots.refresh} />
        ) : next ? (
          <>
            <Text style={S.title}>{next.title}</Text><ShootPhoto id={next.photo_id}/>
            <Text style={S.text}>
              {dateLabel(next.shoot_date)} · {next.start_time}
            </Text>
            <View style={S.row}>
              <Icon name="location-outline" size={18} />
              <Text style={[S.muted, { flex: 1 }]}>
                {next.location_name || "ლოკაცია მოგვიანებით დაზუსტდება"}
              </Text>
            </View>
            <Button
              title="გადაღების დეტალები"
              secondary
              onPress={() =>
                router.push({
                  pathname: "/shoot/[id]",
                  params: { id: next.id },
                })
              }
            />
          </>
        ) : (
          <>
            <Text style={S.subtitle}>ახალი გადაღება ჯერ არ დაგეგმილა</Text>
            <Text style={S.muted}>დაგეგმილი გადაღება აქ გამოჩნდება.</Text>
          </>
        )}
      </View>
      }
      {canCalendar&&<UpcomingWeek/>}
      {canChat&&<>
      <View style={S.between}>
        <Text style={S.subtitle}>აპინული შეტყობინებები</Text>
        <Pressable onPress={() => router.push({pathname:'/conversation/[id]',params:{id:'team'}})}>
          <Icon name="arrow-forward" />
        </Pressable>
      </View>
      {chat.error ? (
        <State error={chat.error} retry={chat.refresh} />
      ) : chat.loading && !chat.data ? (
        <State loading />
      ) : !chat.data?.pinned.length ? (
        <View style={S.card}>
          <Text style={S.muted}>
            ჩატის მნიშვნელოვანი შეტყობინებები აქ შეინახება.
          </Text>
        </View>
      ) : (
        chat.data.pinned.slice(0, 3).map((message) => (
          <Pressable
            key={message.id}
            style={S.card}
            onPress={() => router.push({pathname:'/conversation/[id]',params:{id:'team'}})}
          >
            <View style={S.between}>
              <Text style={S.eyebrow}>{message.authorName}</Text>
              <Icon name="pin-outline" size={17} />
            </View>
            <Text style={S.text} numberOfLines={4}>
              {message.body}
            </Text>
          </Pressable>
        ))
      )}
      </>}
    </Screen>
  );
}
