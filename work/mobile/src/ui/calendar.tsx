import {CalendarDayManager} from './calendar-day-manager';
import {useAuth} from '../lib/auth';
import {hasPermission} from '../lib/permissions';
import {PrivateNote} from './private-note';
import { useEffect, useMemo, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  PanResponder,
  Pressable,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useResource } from "../lib/use-resource";
import type { CalendarData, CalendarEvent } from "../lib/types";
import {
  dateLabel,
  kindLabels,
  monthBounds,
  moveMonth,
  occurs,
  today,
} from "../lib/dates";
import { Button, Chip, Icon, Sheet, State, S, C } from "./components";
const tones: Record<string, string> = {
  shoot: "#622338",
  shorts: "#493367",
  leave: "#124A43",
  sick: "#345369",
  holiday: "#4C4020",
  day_off: "#4C4020",
  overtime: "#4A2B58",
  salary: "#164D38",
  info: "#193D59",
  birthday: "#4D3158",
};
const priority = [
  "shoot",
  "shorts",
  "leave",
  "sick",
  "holiday",
  "day_off",
  "overtime",
  "salary",
  "birthday",
  "info",
];
export function Calendar() {
  const p=useAuth().session?.permissions,canNote=hasPermission(p,'cabinet.notes');
  const [action,setAction]=useState<'summary'|'note'|'manage'>('summary');
  const [month, setMonth] = useState(today().slice(0, 7)),
    [selected, setSelected] = useState<string | null>(null);
  const { from, to } = monthBounds(month);
  const resource = useResource<CalendarData>(
    `/api/calendar?from=${from}&to=${to}`,
    60_000,
  );
  const notes=useResource<{notes:{date:string;body:string;updated:number}[]}>(`/api/calendar/notes?from=${from}&to=${to}`,60_000,canNote);
  const [year, number] = month.split("-").map(Number),
    offset = (new Date(Date.UTC(year, number - 1, 1)).getUTCDay() + 6) % 7,
    days = Number(to.slice(-2));
  const events = resource.data?.events || [];
  const selectedEvents = selected
    ? events.filter((e) => occurs(e, selected))
    : [];
  const [glow] = useState(() => new Animated.Value(0.3));
  const [slide] = useState(() => new Animated.Value(0));
  const [reducedMotion, setReducedMotion] = useState(false);
  const pan = useMemo(() => {
    return PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) =>
      gesture.numberActiveTouches === 1 && Math.abs(gesture.dx) > 14 &&
      Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.6,
    onMoveShouldSetPanResponderCapture: (_, gesture) =>
      gesture.numberActiveTouches === 1 && Math.abs(gesture.dx) > 14 &&
      Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.6,
    onPanResponderGrant: () => slide.stopAnimation(),
    onPanResponderMove: (_, gesture) => {
      if (!reducedMotion) slide.setValue(Math.max(-60, Math.min(60, gesture.dx * 0.35)));
    },
    onPanResponderRelease: (_, gesture) => {
      const changed = Math.abs(gesture.dx) >= 64 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.6;
      if (changed) {
        setSelected(null);
        setMonth(current => moveMonth(current, gesture.dx < 0 ? 1 : -1));
      }
      Animated.timing(slide, {toValue: 0, duration: reducedMotion ? 0 : 160, useNativeDriver: true})
        .start();
    },
    onPanResponderTerminationRequest: () => true,
    onPanResponderTerminate: () => {
      slide.setValue(0);
    },
    });
  }, [slide, reducedMotion]);
  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (active) setReducedMotion(reduced);
      if (reduced || !active) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0.3,
            duration: 1800,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
    });
    return () => {
      active = false;
      loop?.stop();
    };
  }, [glow]);
  function workLabel(date: string, list: CalendarEvent[]) {
    if (list.some((e) => ["leave", "sick", "day_off", "holiday"].includes(e.kind)))
      return "დასვ.";
    const pattern = resource.data?.workPatterns
      .filter(
        (p) =>
          p.effective_from <= date &&
          (!p.effective_to || p.effective_to >= date),
      )
      .sort(
        (a, b) =>
          b.effective_from.localeCompare(a.effective_from) ||
          b.updated - a.updated,
      )[0];
    const dow = new Date(date + "T12:00:00Z").getUTCDay() || 7;
    let schedule: Record<string, { start: string; end: string }> | null = null;
    try {
      if (pattern) schedule = JSON.parse(pattern.schedule_json);
    } catch {}
    const work = schedule
      ? schedule[String(dow)]
      : dow < 6
        ? { start: "11:00", end: "19:00" }
        : undefined;
    return work ? `${work.start.slice(0, 2)}–${work.end.slice(0, 2)}` : "დასვ.";
  }
  return (
    <View style={{ gap: 14 }}>
      <View style={S.between}>
        <Text style={S.subtitle}>კალენდარი</Text>
        <Pressable
          style={S.icon}
          accessibilityLabel="მიმდინარე თვე"
          onPress={() => setMonth(today().slice(0, 7))}
        >
          <Icon name="today-outline" size={21} />
        </Pressable>
      </View>
      <View style={S.between}>
        <Pressable
          style={S.icon}
          accessibilityLabel="წინა თვე"
          onPress={() => setMonth(moveMonth(month, -1))}
        >
          <Icon name="chevron-back" />
        </Pressable>
        <Text style={S.text}>
          {new Date(from + "T12:00:00Z").toLocaleDateString("ka-GE", {
            month: "long",
            year: "numeric",
          })}
        </Text>
        <Pressable
          style={S.icon}
          accessibilityLabel="შემდეგი თვე"
          onPress={() => setMonth(moveMonth(month, 1))}
        >
          <Icon name="chevron-forward" />
        </Pressable>
      </View>
      {resource.loading && !resource.data ? (
        <State loading />
      ) : resource.error ? (
        <State error={resource.error} retry={resource.refresh} />
      ) : (
        <>
          <View style={{ flexDirection: "row" }}>
            {["ორ", "სა", "ოთ", "ხუ", "პა", "შა", "კვ"].map((d) => (
              <Text
                key={d}
                style={[S.muted, { width: "14.2857%", textAlign: "center" }]}
              >
                {d}
              </Text>
            ))}
          </View>
          <Animated.View {...pan.panHandlers} style={{ flexDirection: "row", flexWrap: "wrap", gap: 0, transform: [{translateX: slide}] }}>
            {Array.from({ length: offset + days }, (_, i) => {
              if (i < offset)
                return <View key={i} style={{ width: "14.2857%" }} />;
              const date = `${month}-${String(i - offset + 1).padStart(2, "0")}`,
                list = events.filter((e) => occurs(e, date)),
                tone = priority.find((k) => list.some((e) => e.kind === k)),note=canNote?notes.data?.notes.find(n=>n.date===date):undefined;
              return (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityLabel={`${dateLabel(date)}${list.length ? `, ${list.length} ჩანაწერი` : ""}`}
                  onPress={() => {setAction('summary');setSelected(date)}}
                  style={{ width: "14.2857%", minHeight: 66, padding: 3 }}
                >
                  <View
                    style={{
                      flex: 1,
                      borderRadius: 12,
                      paddingVertical: 8,
                      alignItems: "center",
                      gap: 5,
                      backgroundColor: tone ? tones[tone] : C.surface,
                      borderWidth: 1,
                      borderColor: date === today() ? C.red : "transparent",
                    }}
                  >
                    {(tone === "shoot" || tone === "shorts") && (
                      <Animated.View
                        pointerEvents="none"
                        style={{
                          position: "absolute",
                          inset: 0,
                          borderWidth: 2,
                          borderColor: tone === "shorts" ? "#ae8bfa" : C.red,
                          borderRadius: 12,
                          opacity: glow,
                        }}
                      />
                    )}
                    <Text
                      style={{ color: C.text, fontSize: 15, fontWeight: "600" }}
                    >
                      {i - offset + 1}
                    </Text>
                    <Text style={{ color: C.muted, fontSize: 9 }}>
                      {workLabel(date, list)}
                    </Text>
                    {note&&<View style={{alignItems:'center',width:'100%',gap:2,paddingHorizontal:2}}><Icon name="document-text" size={21} color={C.blue}/><Text numberOfLines={2} style={{fontSize:8,lineHeight:11,color:C.text,textAlign:'center'}}>{note.body.trim().split(/\s+/).slice(0,2).join(' ')}</Text></View>}
                    <View style={{ flexDirection: "row", gap: 3 }}>

                      {list.slice(0, 3).map((e) => (
                        <Text
                          key={e.id}
                          style={{
                            fontSize: 10,
                            color: e.kind === "salary" ? C.green : C.text,
                          }}
                        >
                          {e.kind === "salary"
                            ? "₾"
                            : e.kind === "birthday" ? "🎂" : (e.kind === "shoot" || e.kind === "shorts")
                              ? "●"
                              : "•"}
                        </Text>
                      ))}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </Animated.View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {["shoot", "shorts", "leave", "holiday", "overtime", "salary", "birthday"].map((kind) => (
              <View
                key={kind}
                style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 3,
                    backgroundColor: kind === "shoot" ? C.red : kind === "shorts" ? "#ae8bfa" : tones[kind],
                  }}
                />
                <Text style={{ ...S.muted, fontSize: 11 }}>
                  {kindLabels[kind]}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
      <Sheet
        visible={!!selected}
        title={selected ? dateLabel(selected) : ""}
        onClose={() => setSelected(null)}
      >
        {selected&&<>
          {canNote&&<Button title="ჩემი პირადი ნოუთი" secondary={action!=='note'} icon="document-text-outline" onPress={()=>setAction('note')}/>}
          {resource.data?.canManage&&<Button title="კალენდრის მართვა" secondary={action!=='manage'} icon="calendar-outline" onPress={()=>setAction('manage')}/>}
          {action==='summary'&&canNote&&notes.data?.notes.find(n=>n.date===selected)&&<View style={S.card}><Icon name="document-text" size={28}/><Text style={S.text}>{notes.data.notes.find(n=>n.date===selected)?.body}</Text></View>}
          {action==='note'&&canNote&&(!notes.data?<State loading={notes.loading} error={notes.error} retry={notes.refresh}/>:<PrivateNote key={selected+':'+(notes.data.notes.find(n=>n.date===selected)?.updated||0)} date={selected} body={notes.data.notes.find(n=>n.date===selected)?.body||''} onSaved={()=>{void notes.refresh();setSelected(null)}}/>)}
          {action==='manage'&&resource.data?.canManage&&<CalendarDayManager key={selected} date={selected} people={resource.data.people||[]} canCreateShoots={resource.data.canCreateShoots} onSaved={()=>{void resource.refresh();setSelected(null)}} onNavigate={()=>setSelected(null)}/>}
        </>}
        {selectedEvents.map((event) => (
          <View key={event.id} style={S.card}>
            <Chip>{kindLabels[event.kind]}</Chip>
            <Text style={S.subtitle}>{event.title}</Text>
            {event.employee_name && (
              <Text style={S.text}>{event.employee_name}</Text>
            )}
            <Text style={S.muted}>
              {dateLabel(event.start_date)}
              {event.end_date !== event.start_date
                ? ` — ${dateLabel(event.end_date)}`
                : ""}
            </Text>
            {event.start_time && (
              <Text style={S.text}>
                {event.start_time}
                {event.end_time ? ` — ${event.end_time}` : ""}
              </Text>
            )}
            {event.duration_minutes != null && (
              <Text style={S.text}>{event.duration_minutes} წუთი</Text>
            )}
            {event.location_name && (
              <Text style={S.text}>{event.location_name}</Text>
            )}
            {(event.kind === "shoot" || event.kind === "shorts") && (
              <Button
                secondary
                title="გადაღების ნახვა"
                onPress={() => {
                  setSelected(null);
                  router.push({
                    pathname: "/shoot/[id]",
                    params: { id: event.id },
                  });
                }}
              />
            )}
          </View>
        ))}
      </Sheet>
    </View>
  );
}
