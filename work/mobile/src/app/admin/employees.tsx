import {useAuth} from '../../lib/auth';
import {hasPermission} from '../../lib/permissions';
import {staffGroupingDefinitions,departmentForRole,hierarchyForRole,defaultMemberships,roleLabel} from '../../lib/departments';
import { useState } from "react";
import { Text, View } from "react-native";
import { api } from "../../lib/api";
import { useResource } from "../../lib/use-resource";
import type { Employee } from "../../lib/types";
import {
  Button,
  Field,
  Fold,
  Screen,
  Sheet,
  State,
  confirm,
  success,
  S,
} from "../../ui/components";
const blank = {
  id: "",
  fullName: "",
  birthDate: "",
  personalNumber: "",
  email: "",
  phone: "",
  position: "",
};
export default function Employees() {
  const p=useAuth().session?.permissions;
  const r = useResource<{ employees: Employee[] }>(
    "/api/mobile/admin/employees",
  );
  const [form, setForm] = useState<typeof blank | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const rows = r.data?.employees || [];
  const groups = new Map<string, Employee[]>();
  for(const row of rows){const memberships=row.memberships??defaultMemberships(row.account_role||row.position),ids=memberships.length?memberships.map(m=>m.departmentId):[row.departmentId||departmentForRole(row.account_role||row.position)];for(const id of ids)groups.set(id,[...(groups.get(id)||[]),row])}
  async function save() {
    if (!form) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/employees", {
        method: form.id ? "PATCH" : "POST",
        body: form,
      });
      success();
      setForm(null);
      await r.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function card(e: Employee) {
    return (
      <Fold key={e.id} title={e.full_name} subtitle={roleLabel(e.position)}>
        {[
          ["დაბადების თარიღი", e.birth_date],
          ["პირადი ნომერი", e.personal_number],
          ["ელფოსტა", e.email],
          ["ტელეფონი", e.phone],
        ].map(([label, value]) => (
          <View key={label}>
            <Text style={S.muted}>{label}</Text>
            <Text selectable style={S.text}>
              {value}
            </Text>
          </View>
        ))}
        {e.canManage&&<><Button
          title="რედაქტირება"
          secondary
          onPress={() => {
            setError("");
            setForm({
              id: e.id,
              fullName: e.full_name,
              birthDate: e.birth_date,
              personalNumber: e.personal_number,
              email: e.email,
              phone: e.phone,
              position: e.position,
            });
          }}
        />
        <Button
          title="თანამშრომლის ამოღება"
          secondary
          onPress={() =>
            confirm(
              "თანამშრომლის ამოღება მის ანგარიშზეც წვდომას შეაჩერებს.",
              async () => {
                await api("/api/admin/employees", {
                  method: "DELETE",
                  body: { id: e.id },
                });
                await r.refresh();
              },
            )
          }
        /></>}
      </Fold>
    );
  }
  return (
    <Screen title="თანამშრომლები" back refresh={r.refresh}>
      {hasPermission(p,'employees.manage')&&<Button
        title="თანამშრომლის დამატება"
        icon="add"
        onPress={() => {
          setForm({ ...blank });
          setError("");
        }}
      />}
      {(r.loading && !r.data) || r.error ? (
        <State loading={r.loading} error={r.error} retry={r.refresh} />
      ) : (
        <>
          <Text style={S.muted}>{rows.length} თანამშრომელი</Text>
          {staffGroupingDefinitions.map(department=>{const people=groups.get(department.id);if(!people?.length)return null;return <Fold key={department.id} title={department.name} subtitle={`${people.length} თანამშრომელი`}>{people.sort((a,b)=>(a.memberships?.find(m=>m.departmentId===department.id)?.level??hierarchyForRole(a.position))-(b.memberships?.find(m=>m.departmentId===department.id)?.level??hierarchyForRole(b.position))||a.full_name.localeCompare(b.full_name,'ka')).map(card)}</Fold>})}
        </>
      )}
      <Sheet
        visible={!!form}
        title={form?.id ? "რედაქტირება" : "ახალი თანამშრომელი"}
        onClose={() => {
          if (!busy) setForm(null);
        }}
      >
        {form && (
          <>
            {[
              ["fullName", "სახელი და გვარი"],
              ["birthDate", "დაბადების თარიღი"],
              ["personalNumber", "პირადი ნომერი"],
              ["email", "ელფოსტა"],
              ["phone", "ტელეფონი"],
              ["position", "პოზიცია"],
            ].map(([key, label]) => (
              <Field
                key={key}
                label={label}
                value={form[key as keyof typeof blank]}
                onChangeText={(value) => setForm({ ...form, [key]: value })}
                keyboardType={
                  key === "email"
                    ? "email-address"
                    : key === "phone"
                      ? "phone-pad"
                      : "default"
                }
                autoCapitalize={key === "email" ? "none" : "sentences"}
              />
            ))}
            {error && <Text style={S.error}>{error}</Text>}
            <Button title="შენახვა" busy={busy} onPress={() => void save()} />
          </>
        )}
      </Sheet>
    </Screen>
  );
}
