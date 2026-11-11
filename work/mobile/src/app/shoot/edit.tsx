import {ShootPhoto} from '../../ui/shoot-photo';
import {pickChatPhoto} from '../../lib/chat-media';
import {WorkMap} from "../../ui/work-map";
import {refreshResource} from "../../lib/resource-cache";
import { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../lib/auth";
import { api,uploadShootPhoto } from "../../lib/api";
import { useResource } from "../../lib/use-resource";
import type { ShootsData } from "../../lib/types";
import { today } from "../../lib/dates";
import {
  Button,
  Field,
  Screen,
  Select,
  State,
  success,
  S,
} from "../../ui/components";
export default function EditShoot() {
  const { id,date } = useLocalSearchParams<{ id?: string;date?:string }>(),
    { session } = useAuth(),
    r = useResource<ShootsData>("/api/shoots");
  const allowed = id ? session?.permissions?.canEditShoots : session?.permissions?.canCreateShoots;
  if(!allowed)return <Screen title="გადაღება" back><State empty="ამ მოქმედების უფლება არ გაქვს"/></Screen>;
  if(!r.data)return <Screen title="გადაღება" back><State loading={r.loading} error={r.error} retry={r.refresh}/></Screen>;
  if(id&&!r.data.shoots.some(s=>s.id===id))return <Screen title="გადაღება" back><State empty="გადაღება ვერ მოიძებნა"/></Screen>;
  return <ShootEditor key={id||date||'new'} id={id} date={date} data={r.data}/>;
}
function ShootEditor({id,data,date}:{id?:string;data:ShootsData;date?:string}) {
  const existing=data.shoots.find(shoot=>shoot.id===id);
  const [form, setForm] = useState(()=>existing?{
      title:existing.title,shootDate:existing.shoot_date,startTime:existing.start_time,endTime:existing.end_time||'',locationName:existing.location_name,locationUrl:existing.location_url||'',latitude:existing.latitude??null,longitude:existing.longitude??null,photoId:existing.photo_id||null,details:existing.details,status:existing.status,
      assignments:existing.tasks.map(task=>({assigneeEmail:task.assignee_email,task:task.task})),
    }:{
      photoId:null as string|null,
      title: "",
      shootDate: date&&/^\d{4}-\d{2}-\d{2}$/.test(date)?date:today(),
      startTime: "11:00",
      endTime: "",
      locationName: "",
      locationUrl: "",
      latitude:null as number|null,longitude:null as number|null,
      details: "",
      status: "planned",
      assignments: [] as { assigneeEmail: string; task: string }[],
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [photo,setPhoto]=useState<{uri:string;id:string}|null>(null);
  async function pick(){try{const result=await pickChatPhoto();if(result)setPhoto(result)}catch(e){setError((e as Error).message)}}
  const change = (key: string, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  async function save() {
    setBusy(true);
    setError("");
    try {
      const photoId=photo?await uploadShootPhoto(photo.uri,photo.id):form.photoId;
      await api(id ? `/api/shoots/${id}` : "/api/shoots", {
        method: id ? "PATCH" : "POST",
        body: {...form,photoId},
      });
      void refreshResource("/api/shoots");
      void refreshResource("/api/workspace");
      success();
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title={id ? "გადაღების რედაქტირება" : "ახალი გადაღება"} back>
      {(
        <>
          <Field
            label="დასახელება"
            value={form.title}
            onChangeText={(v) => change("title", v)}
          />
          <Field
            label="თარიღი (წელი-თვე-დღე)"
            value={form.shootDate}
            onChangeText={(v) => change("shootDate", v)}
            placeholder="2026-10-26"
          />
          <View style={S.row}>
            <View style={{ flex: 1 }}>
              <Field
                label="დაწყება (სთ:წთ)"
                value={form.startTime}
                onChangeText={(v) => change("startTime", v)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="დასრულება"
                value={form.endTime}
                onChangeText={(v) => change("endTime", v)}
              />
            </View>
          </View>
          <Field
            label="ლოკაცია"
            value={form.locationName}
            onChangeText={(v) => change("locationName", v)}
          />
          <Text style={S.muted}>რუკაზე დააჭირე გადაღების ადგილს.</Text><WorkMap select pins={form.latitude!==null&&form.longitude!==null?[{title:form.locationName||'გადაღება',latitude:form.latitude,longitude:form.longitude}]:[]} onSelect={(latitude,longitude)=>setForm({...form,latitude,longitude,locationUrl:`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`})}/>
          <Field
            label="რუკის ბმული"
            value={form.locationUrl}
            onChangeText={(v) => change("locationUrl", v)}
            autoCapitalize="none"
            keyboardType="url"
          />
          <Field
            label="დეტალები"
            value={form.details}
            onChangeText={(v) => change("details", v)}
            multiline
          />
<Text style={S.subtitle}>გადაღების ფოტო</Text><ShootPhoto id={photo?null:form.photoId} uri={photo?.uri}/><Button secondary title={photo||form.photoId?"ფოტოს შეცვლა":"ფოტოს დამატება"} icon="image-outline" disabled={busy} onPress={()=>void pick()}/>{(photo||form.photoId)&&<Button secondary title="ფოტოს მოხსნა" disabled={busy} onPress={()=>{setPhoto(null);setForm(f=>({...f,photoId:null}))}}/>}
          <Select
            label="სტატუსი"
            value={form.status}
            onChange={(v) => change("status", v)}
            options={[
              { value: "planned", label: "დაგეგმილი" },
              { value: "completed", label: "დასრულებული" },
              { value: "cancelled", label: "გაუქმებული" },
            ]}
          />
          <Text style={S.subtitle}>დავალებები</Text>
          {form.assignments.map((task, i) => (
            <View key={i} style={S.card}>
              <Select
                label="თანამშრომელი"
                value={task.assigneeEmail}
                options={data.people.map((p) => ({
                  label: p.fullName,
                  value: p.email,
                }))}
                onChange={(value) =>
                  setForm((f) => ({
                    ...f,
                    assignments: f.assignments.map((t, j) =>
                      i === j ? { ...t, assigneeEmail: value } : t,
                    ),
                  }))
                }
              />
              <Field
                label="დავალება"
                value={task.task}
                multiline
                onChangeText={(value) =>
                  setForm((f) => ({
                    ...f,
                    assignments: f.assignments.map((t, j) =>
                      i === j ? { ...t, task: value } : t,
                    ),
                  }))
                }
              />
              <Button
                title="ამოღება"
                secondary
                onPress={() =>
                  setForm((f) => ({
                    ...f,
                    assignments: f.assignments.filter((_, j) => j !== i),
                  }))
                }
              />
            </View>
          ))}
          <Button
            title="დავალების დამატება"
            secondary
            icon="add"
            onPress={() =>
              setForm((f) => ({
                ...f,
                assignments: [
                  ...f.assignments,
                  { assigneeEmail: "", task: "" },
                ],
              }))
            }
          />
          {error && <Text style={S.error}>{error}</Text>}
          <Button title="შენახვა" busy={busy} onPress={() => void save()} />
        </>
      )}
    </Screen>
  );
}
