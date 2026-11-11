import {useLocalSearchParams} from 'expo-router';
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { api } from "../../lib/api";
import { useResource } from "../../lib/use-resource";
import { today, dateLabel, kindLabels, moveMonth } from "../../lib/dates";
import type { CalendarAdminData, ManagedEvent } from "../../lib/calendar-admin";
import {
  Button,
  Chip,
  Field,
  Fold,
  Icon,
  Screen,
  Select,
  Sheet,
  State,
  Toggle,
  confirm,
  success,
  S,
} from "../../ui/components";
const emptyEvent = () => ({
  id: "",
  kind: "leave",
  title: "",
  startDate: today(),
  endDate: today(),
  employeeEmail: "",
  visibility: "individual",
  startTime: "",
  endTime: "",
  durationMinutes: "",
  recurringYearly: false,
});
export default function AdminCalendar() {
  const {date}=useLocalSearchParams<{date?:string}>(),initialDate=date&&/^\d{4}-\d{2}-\d{2}$/.test(date)?date:today();
  const [month, setMonth] = useState(initialDate.slice(0, 7)),
    [mode, setMode] = useState(""),
    [event, setEvent] = useState(()=>({...emptyEvent(),startDate:initialDate,endDate:initialDate})),
    [employee, setEmployee] = useState(""),
    [effective, setEffective] = useState(today()),
    [schedule, setSchedule] = useState<
      Record<string, { start: string; end: string }>
    >(
      Object.fromEntries(
        ["1", "2", "3", "4", "5"].map((day) => [
          day,
          { start: "11:00", end: "19:00" },
        ]),
      ),
    ),
    [pause, setPause] = useState("0"),
    [allowance, setAllowance] = useState("24"),
    [carryover, setCarryover] = useState("0"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const r = useResource<CalendarAdminData>(
    `/api/admin/calendar?month=${month}`,
  );
  const people =
    r.data?.people.map((person) => ({
      value: person.email,
      label: person.fullName,
    })) || [];
  function open(type: string) {
    setMode(type);
    setError("");
    if (type === "event") setEvent({...emptyEvent(),startDate:initialDate,endDate:initialDate});
  }
  function edit(e: ManagedEvent) {
    setEvent({
      id: e.id,
      kind: e.kind,
      title: e.title,
      startDate: e.start_date,
      endDate: e.end_date,
      employeeEmail: e.employee_email || "",
      visibility: e.visibility,
      startTime: e.start_time || "",
      endTime: e.end_time || "",
      durationMinutes:
        e.duration_minutes == null ? "" : String(e.duration_minutes),
      recurringYearly: !!e.recurring_yearly,
    });
    setError("");
    setMode("event");
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      if (mode === "event")
        await api(
          event.id ? `/api/admin/calendar/${event.id}` : "/api/admin/calendar",
          {
            method: event.id ? "PATCH" : "POST",
            body: {
              ...event,
              durationMinutes: event.durationMinutes
                ? Number(event.durationMinutes)
                : null,
            },
          },
        );
      else if (mode === "schedule")
        await api("/api/admin/calendar/work-pattern", {
          method: "PUT",
          body: {
            employeeEmail: employee,
            effectiveFrom: effective,
            schedule,
            breakMinutes: Number(pause),
          },
        });
      else
        await api("/api/admin/calendar/leave-entitlement", {
          method: "PUT",
          body: {
            employeeEmail: employee,
            year: Number(month.slice(0, 4)),
            allowanceDays: Number(allowance),
            carryoverDays: Number(carryover),
          },
        });
      success();
      setMode("");
      await r.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function personChange(email: string) {
    setEmployee(email);
    const entitlement = r.data?.entitlements.find(
      (e) => e.employee_email === email,
    );
    setAllowance(String(entitlement?.allowance_days ?? 24));
    setCarryover(String(entitlement?.carryover_days ?? 0));
    const pattern = r.data?.patterns
      .filter((p) => p.employee_email === email)
      .sort(
        (a, b) =>
          b.effective_from.localeCompare(a.effective_from) ||
          b.updated - a.updated,
      )[0];
    if (pattern) {
      try {
        setSchedule(JSON.parse(pattern.schedule_json));
        setPause(String(pattern.break_minutes));
      } catch {}
    }
  }
  return (
    <Screen title="კალენდრის მართვა" back refresh={r.refresh}>
      <View style={S.between}>
        <Pressable
          style={S.icon}
          accessibilityLabel="წინა თვე"
          onPress={() => setMonth(moveMonth(month, -1))}
        >
          <Icon name="chevron-back" />
        </Pressable>
        <Text style={S.text}>
          {new Date(month + "-01T12:00:00Z").toLocaleDateString("ka-GE", {
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
      <Button
        title="კალენდრის ჩანაწერი"
        icon="add"
        onPress={() => open("event")}
      />
      <Button
        title="სამუშაო საათების შეცვლა"
        secondary
        onPress={() => open("schedule")}
      />
      <Button
        title="შვებულების ლიმიტები"
        secondary
        onPress={() => open("entitlement")}
      />
      {(r.loading && !r.data) || r.error ? (
        <State loading={r.loading} error={r.error} retry={r.refresh} />
      ) : (
        <Fold
          title="თვის ჩანაწერები"
          subtitle={`${r.data?.events.length || 0} ჩანაწერი`}
        >
          {r.data?.events.map((e) => (
            <View key={e.id} style={S.card}>
              <Chip>
                {kindLabels[e.kind]} ·{" "}
                {e.visibility === "all" ? "ყველასთვის" : e.employee_name}
              </Chip>
              <Text style={S.subtitle}>{e.title}</Text>
              <Text style={S.muted}>
                {dateLabel(e.start_date)} — {dateLabel(e.end_date)}
              </Text>
              <Button title="რედაქტირება" secondary onPress={() => edit(e)} />
              <Button
                title="წაშლა"
                secondary
                onPress={() =>
                  confirm("წაიშალოს ჩანაწერი?", async () => {
                    await api(`/api/admin/calendar/${e.id}`, {
                      method: "DELETE",
                    });
                    await r.refresh();
                  })
                }
              />
            </View>
          ))}
          {!r.data?.events.length && (
            <Text style={S.muted}>ამ თვეში ჩანაწერები არ არის.</Text>
          )}
        </Fold>
      )}
      <Sheet
        visible={!!mode}
        title={
          mode === "event"
            ? "კალენდრის ჩანაწერი"
            : mode === "schedule"
              ? "სამუშაო გრაფიკი"
              : "შვებულების ლიმიტი"
        }
        onClose={() => {
          if (!busy) setMode("");
        }}
      >
        {mode === "event" ? (
          <>
            <Select
              label="ტიპი"
              value={event.kind}
              onChange={(kind) =>
                setEvent({
                  ...event,
                  kind,
                  visibility:
                    kind === "holiday"
                      ? "all"
                      : ["leave", "sick", "overtime"].includes(kind)
                        ? "individual"
                        : event.visibility,
                })
              }
              options={["leave", "sick", "day_off", "overtime", "holiday", "info"].map(
                (kind) => ({ value: kind, label: kindLabels[kind] }),
              )}
            />
            {!["leave", "sick", "overtime", "holiday"].includes(event.kind) && (
              <Select
                label="ხილვადობა"
                value={event.visibility}
                options={[
                  { value: "all", label: "ყველასთვის" },
                  {
                    value: "individual",
                    label: "მხოლოდ კონკრეტული თანამშრომლისთვის",
                  },
                ]}
                onChange={(visibility) => setEvent({ ...event, visibility })}
              />
            )}
            {event.visibility === "individual" && (
              <Select
                label="თანამშრომელი"
                value={event.employeeEmail}
                options={people}
                onChange={(employeeEmail) =>
                  setEvent({ ...event, employeeEmail })
                }
              />
            )}
            <Field
              label="სათაური"
              value={event.title}
              onChangeText={(title) => setEvent({ ...event, title })}
            />
            <Field
              label="დაწყება (წელი-თვე-დღე)"
              value={event.startDate}
              onChangeText={(startDate) =>
                setEvent({
                  ...event,
                  startDate,
                  endDate:
                    event.kind === "overtime" ? startDate : event.endDate,
                })
              }
            />
            {event.kind !== "overtime" && (
              <Field
                label="დასრულება (წელი-თვე-დღე)"
                value={event.endDate}
                onChangeText={(endDate) => setEvent({ ...event, endDate })}
              />
            )}
            <Field
              label="დაწყების დრო (სთ:წთ, არასავალდებულო)"
              value={event.startTime}
              onChangeText={(startTime) => setEvent({ ...event, startTime })}
            />
            <Field
              label="დასრულების დრო (სთ:წთ, არასავალდებულო)"
              value={event.endTime}
              onChangeText={(endTime) => setEvent({ ...event, endTime })}
            />
            {event.kind === "overtime" && (
              <Field
                label="ხანგრძლივობა წუთებში"
                keyboardType="numeric"
                value={event.durationMinutes}
                onChangeText={(durationMinutes) =>
                  setEvent({ ...event, durationMinutes })
                }
              />
            )}
            {event.kind === "holiday" && (
              <Toggle
                label="ყოველწლიურად გამეორება"
                value={event.recurringYearly}
                onChange={(recurringYearly) =>
                  setEvent({ ...event, recurringYearly })
                }
              />
            )}
          </>
        ) : (
          <>
            <Select
              label="თანამშრომელი"
              value={employee}
              options={people}
              onChange={personChange}
            />
            {mode === "schedule" ? (
              <>
                <Field
                  label="ძალაში შესვლის თარიღი (წელი-თვე-დღე)"
                  value={effective}
                  onChangeText={setEffective}
                />
                {[
                  "ორშაბათი",
                  "სამშაბათი",
                  "ოთხშაბათი",
                  "ხუთშაბათი",
                  "პარასკევი",
                  "შაბათი",
                  "კვირა",
                ].map((label, index) => {
                  const key = String(index + 1),
                    day = schedule[key];
                  return (
                    <View key={key} style={S.card}>
                      <Toggle
                        label={label}
                        value={!!day}
                        onChange={(checked) =>
                          setSchedule((previous) => {
                            const next = { ...previous };
                            if (checked)
                              next[key] = { start: "11:00", end: "19:00" };
                            else delete next[key];
                            return next;
                          })
                        }
                      />
                      {day && (
                        <View style={S.row}>
                          <View style={{ flex: 1 }}>
                            <Field
                              label="დაწყება"
                              value={day.start}
                              onChangeText={(start) =>
                                setSchedule({
                                  ...schedule,
                                  [key]: { ...day, start },
                                })
                              }
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Field
                              label="დასრულება"
                              value={day.end}
                              onChangeText={(end) =>
                                setSchedule({
                                  ...schedule,
                                  [key]: { ...day, end },
                                })
                              }
                            />
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
                <Field
                  label="შესვენება (წუთი)"
                  value={pause}
                  onChangeText={setPause}
                  keyboardType="numeric"
                />
              </>
            ) : (
              <>
                <Text style={S.muted}>{month.slice(0, 4)} წელი</Text>
                <Field
                  label="წლიური შვებულება (დღე)"
                  value={allowance}
                  onChangeText={setAllowance}
                  keyboardType="numeric"
                />
                <Field
                  label="წინა წლიდან გადმოტანილი დღეები"
                  value={carryover}
                  onChangeText={setCarryover}
                  keyboardType="numeric"
                />
              </>
            )}
          </>
        )}
        {error && <Text style={S.error}>{error}</Text>}
        <Button title="შენახვა" busy={busy} onPress={() => void save()} />
      </Sheet>
    </Screen>
  );
}
