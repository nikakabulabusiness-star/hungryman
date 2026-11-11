import {hasPermission} from '../../lib/permissions';
import {ShootPhoto} from '../../ui/shoot-photo';
import { Linking, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useResource } from "../../lib/use-resource";
import { useAuth } from "../../lib/auth";
import { api } from "../../lib/api";
import type { Shoot } from "../../lib/types";
import { dateLabel } from "../../lib/dates";
import {
  Button,
  Chip,
  Screen,
  State,
  confirm,
  S,
  C,
} from "../../ui/components";
export default function ShootDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    r = useResource<{ shoot: Shoot }>(`/api/shoots/${encodeURIComponent(id)}`);
  const { session } = useAuth();
  const shoot = r.data?.shoot;
  return (
    <Screen title="გადაღების დეტალები" back refresh={r.refresh}>
      {r.cached&&<Text style={[S.muted,{fontSize:10}]}>{r.error?'შენახული ასლი · განახლება ვერ მოხერხდა':'შენახული ასლი · ახლდება…'}</Text>}
      {!shoot ? (
        <State loading={r.loading} error={r.error} retry={r.refresh} />
      ) : (
        <>
          <Chip color={shoot.content_kind==='short'?'#ae8bfa':C.red}>
            {dateLabel(shoot.shoot_date)} · {shoot.start_time}
            {shoot.end_time ? `–${shoot.end_time}` : ""}
          </Chip>
          <Text style={S.title}>{shoot.title}</Text><ShootPhoto id={shoot.photo_id}/>
          <View style={S.card}>
            <Text style={S.subtitle}>
              {shoot.location_name || "ლოკაცია არ არის მითითებული"}
            </Text>
            {shoot.location_url && (
              <Button
                title="რუკაზე ნახვა"
                secondary
                icon="map-outline"
                onPress={() => {
                  if (/^https?:\/\//.test(shoot.location_url!))
                    void Linking.openURL(shoot.location_url!);
                }}
              />
            )}
            <Text style={S.text}>
              {shoot.details || "დამატებითი დეტალები არ არის."}
            </Text>
          </View>
          {shoot.work_video_id&&hasPermission(session?.permissions,'workspace.view')&&session?.permissions?.features?.work!==false&&<View style={S.card}><Text style={S.subtitle}>სამუშაო პროექტი</Text><Text style={S.muted}>ქოლშითი, სცენარი, გუნდი, ბიუჯეტი და ყველა დეპარტამენტის ეტაპი.</Text><Button title="პროექტის და ქოლშითის გახსნა" secondary icon="briefcase-outline" onPress={()=>router.push({pathname:'/work-video/[id]',params:{id:shoot.work_video_id!,board:shoot.content_kind==='short'?'social':'production'}})}/><Button title="ისტორია და სრული არქივი" secondary icon="archive-outline" onPress={()=>router.push({pathname:'/work-video/[id]',params:{id:shoot.work_video_id!,tab:'history',shootId:shoot.id}})}/></View>}
          <Text style={S.subtitle}>გუნდი და დავალებები</Text>
          {shoot.tasks.map((task) => (
            <View key={task.id} style={S.card}>
              <Text style={S.subtitle}>{task.assignee_name}</Text>
              <Text style={S.muted}>{task.assignee_role}</Text>
              <Text style={S.text}>{task.task}</Text>
            </View>
          ))}
          {!shoot.tasks.length && (
            <Text style={S.muted}>დავალებები ჯერ არ განაწილებულა.</Text>
          )}
          {session?.permissions?.canEditShoots && !shoot.work_video_id && (
            <Button
              title="რედაქტირება"
              secondary
              icon="pencil-outline"
              onPress={() =>
                router.push({ pathname: "/shoot/edit", params: { id } })
              }
            />
          )}
          {(session?.permissions?.isOwner || session?.user.role === "HR") && !shoot.work_video_id && (
            <Button
              title="გადაღების წაშლა"
              secondary
              onPress={() =>
                confirm("წაიშალოს გადაღება?", async () => {
                  await api(`/api/shoots/${id}`, { method: "DELETE" });
                  router.back();
                })
              }
            />
          )}
        </>
      )}
    </Screen>
  );
}
