import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useAuth } from "../../lib/auth";
import { useResource } from "../../lib/use-resource";
import { moveMonth, today } from "../../lib/dates";
import type { CalendarAdminData } from "../../lib/calendar-admin";
import { Fold, Icon, Screen, State, S, C } from "../../ui/components";
type Analytics = {
  visitors: { active: number; total: number };
  applications: { total: number; rating: number | null; reviews: number };
  statuses: { status: string; count: number }[];
  funnel: { kind: string; count: number }[];
  positions: { position: string; count: number }[];
  team: null | {
    employees: number;
    accounts: { status: string; count: number }[];
    roles: { role: string; count: number }[];
  };
};
function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={[S.between, { paddingVertical: 7 }]}>
      <Text style={[S.muted, { flex: 1 }]}>{label}</Text>
      <Text style={[S.subtitle, { color: C.blue }]}>{value}</Text>
    </View>
  );
}
function CalendarAnalytics() {
  const [month, setMonth] = useState(today().slice(0, 7)),
    r = useResource<CalendarAdminData>(`/api/admin/calendar?month=${month}`);
  return (
    <>
      <View style={S.between}>
        <Pressable
          style={S.icon}
          onPress={() => setMonth(moveMonth(month, -1))}
        >
          <Icon name="chevron-back" />
        </Pressable>
        <Text style={S.text}>{month}</Text>
        <Pressable style={S.icon} onPress={() => setMonth(moveMonth(month, 1))}>
          <Icon name="chevron-forward" />
        </Pressable>
      </View>
      {(r.loading && !r.data) || r.error ? (
        <State loading={r.loading} error={r.error} retry={r.refresh} />
      ) : (
        <>
          <Text style={S.muted}>
            გრაფიკისა და კალენდრის მიხედვით; საათები დასწრების აღრიცხვას არ
            წარმოადგენს.
          </Text>
          <Metric
            label="თვის სამუშაო დღეები"
            value={r.data?.calendarTotals.workDays || 0}
          />
          <Metric
            label="დასვენების დღეები"
            value={r.data?.calendarTotals.restDays || 0}
          />
          {r.data?.metrics.map((m) => (
            <Fold key={m.email} title={m.fullName} subtitle={m.role}>
              <Metric label="სამუშაო დღეები" value={m.workedDays} />
              <Metric label="სამუშაო საათები" value={m.workedHours} />
              <Metric label="დასვენება" value={m.restDays} />
              <Metric label="ოვერთაიმი (სთ)" value={m.overtimeHours} />
              <Metric label="შვებულების დღეები" value={m.leaveDays} />
              <Metric label="დარჩენილი შვებულება" value={m.leaveRemaining} />
            </Fold>
          ))}
        </>
      )}
    </>
  );
}
export default function AnalyticsScreen() {
  const p = useAuth().session!.permissions!,
    r = useResource<Analytics>("/api/admin/analytics", 30_000);
  return (
    <Screen title="ანალიტიკა" back refresh={r.refresh}>
      {(r.loading && !r.data) || r.error ? (
        <State loading={r.loading} error={r.error} retry={r.refresh} />
      ) : (
        r.data && (
          <>
            <Fold title="საიტის ანალიტიკა">
              <Metric
                label="ამჟამად აქტიური ვიზიტორები"
                value={r.data.visitors.active}
              />
              <Metric label="ჯამური ვიზიტორები" value={r.data.visitors.total} />
            </Fold>
            <Fold title="განაცხადების ანალიტიკა">
              <Metric
                label="ყველა განაცხადი"
                value={r.data.applications.total}
              />
              <Metric
                label="ფორმის საშუალო შეფასება"
                value={r.data.applications.rating?.toFixed(1) || "—"}
              />
              <Metric
                label="შეფასებების რაოდენობა"
                value={r.data.applications.reviews}
              />
              {r.data.positions.map((row) => (
                <Metric
                  key={row.position}
                  label={row.position}
                  value={row.count}
                />
              ))}
            </Fold>
            {r.data.team && (
              <Fold title="თანამშრომლების ანალიტიკა">
                <Metric label="თანამშრომლები" value={r.data.team.employees} />
                {r.data.team.accounts.map((a) => (
                  <Metric
                    key={a.status}
                    label={
                      a.status === "approved"
                        ? "აქტიური ანგარიშები"
                        : a.status === "pending"
                          ? "მოლოდინში"
                          : "შეჩერებული"
                    }
                    value={a.count}
                  />
                ))}
                {r.data.team.roles.map((row) => (
                  <Metric key={row.role} label={row.role} value={row.count} />
                ))}
              </Fold>
            )}
            {p.canManageCalendar && (
              <Fold title="კალენდრის ანალიტიკა">
                <CalendarAnalytics />
              </Fold>
            )}
          </>
        )
      )}
    </Screen>
  );
}
