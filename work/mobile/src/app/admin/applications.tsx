import {hasPermission} from '../../lib/permissions';
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { api } from "../../lib/api";
import { useResource } from "../../lib/use-resource";
import { useAuth } from "../../lib/auth";
import type { Application } from "../../lib/types";
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
  C,
} from "../../ui/components";
type Vacancy = {
  role: string;
  isOpen: boolean;
  deadline: string | null;
  accepting: boolean;
};
type Data = {
  applications: Application[];
  vacancies: Vacancy[];
  roles: Record<string, string>;
  questionLabels: Record<string, Record<string, string>>;
};
const statuses = [
  { value: "new", label: "ახალი" },
  { value: "reviewing", label: "განხილვაში" },
  { value: "interview", label: "გასაუბრება" },
  { value: "task", label: "პრაქტიკული დავალება" },
  { value: "accepted", label: "მიღებული" },
  { value: "rejected", label: "უარყოფილი" },
];
export default function Applications() {
  const r = useResource<Data>("/api/mobile/admin/applications"),
    p = useAuth().session!.permissions!;
  const canEdit=hasPermission(p,'applications.edit');
  const [search, setSearch] = useState(""),
    [order, setOrder] = useState("new"),
    [filter, setFilter] = useState(""),
    [edit, setEdit] = useState<Application | null>(null),
    [vacancy, setVacancy] = useState<Vacancy | null>(null),
    [candidate, setCandidate] = useState<{
      name: string;
      email: string;
      phone: string;
      position: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(
    path: string,
    method: string,
    body: unknown,
    done: () => void,
  ) {
    setBusy(true);
    setError("");
    try {
      await api(path, { method, body });
      success();
      done();
      await r.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const sorted = [...(r.data?.applications || [])].sort((a, b) =>
      order === "manual"
        ? b.manual_order - a.manual_order
        : order === "old"
          ? a.created - b.created
          : b.created - a.created,
    ),
    rows = sorted.filter(
      (a) =>
        (!filter || a.status === filter) &&
        `${a.name} ${a.email} ${a.position}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
  let answers: Record<string, unknown> = {};
  try {
    answers = edit ? JSON.parse(edit.answers) : {};
  } catch {}
  const labels = r.data?.questionLabels[String(answers.role || "writer")] || {};
  async function move(id: string, direction: number) {
    const index = sorted.findIndex((a) => a.id === id),
      other = index + direction;
    if (other < 0 || other >= sorted.length) return;
    const copy = [...sorted];
    [copy[index], copy[other]] = [copy[other], copy[index]];
    await save(
      "/api/admin/applications/order",
      "PATCH",
      { orderedIds: copy.map((a) => a.id) },
      () => setOrder("manual"),
    );
  }
  return (
    <Screen title="განაცხადები" back refresh={r.refresh}>
      {canEdit&&<><Fold title="ვაკანსიების მართვა">
        {r.data?.vacancies.map((v) => (
          <Pressable
            key={v.role}
            style={S.between}
            onPress={() => {
              setVacancy({ ...v });
              setError("");
            }}
          >
            <Text style={[S.text, { flex: 1 }]}>{r.data?.roles[v.role]}</Text>
            <Chip color={v.accepting ? C.green : C.muted}>
              {v.accepting ? "ღია" : "დახურული"}
            </Chip>
          </Pressable>
        ))}
      </Fold>
      <Button
        title="კანდიდატის დამატება"
        secondary
        icon="add"
        onPress={() => {
          setCandidate({ name: "", email: "", phone: "", position: "" });
          setError("");
        }}
      />
      </>}
      <Field
        label="ძებნა"
        value={search}
        onChangeText={setSearch}
        placeholder="სახელი, ელფოსტა ან პოზიცია"
      />
      <Select
        label="სორტირება"
        value={order}
        onChange={setOrder}
        options={[
          { value: "new", label: "ახალი → ძველი" },
          { value: "old", label: "ძველი → ახალი" },
          { value: "manual", label: "ხელით დალაგებული" },
        ]}
      />
      <Select
        label="სტატუსი"
        value={filter}
        onChange={setFilter}
        options={[{ value: "", label: "ყველა" }, ...statuses]}
      />
      {error && !edit && !vacancy && !candidate && (
        <Text style={S.error}>{error}</Text>
      )}
      {(r.loading && !r.data) || r.error ? (
        <State loading={r.loading} error={r.error} retry={r.refresh} />
      ) : !rows.length ? (
        <State empty="განაცხადები ვერ მოიძებნა" />
      ) : (
        rows.map((a) => (
          <View key={a.id} style={S.card}>
            <Pressable
              onPress={() => {
                setEdit({ ...a });
                setError("");
              }}
            >
              <Text style={S.subtitle}>{a.name}</Text>
              <Text style={S.muted}>{a.position}</Text>
              <Text style={S.muted}>
                {new Date(a.created).toLocaleDateString("ka-GE")}
              </Text>
            </Pressable>
            <View style={S.between}>
              <Chip>{statuses.find((s) => s.value === a.status)?.label}</Chip>
              {canEdit&&<View style={S.row}>
                <Pressable
                  disabled={busy}
                  accessibilityLabel="ზემოთ ატანა"
                  onPress={() => void move(a.id, -1)}
                  style={S.icon}
                >
                  <Icon name="arrow-up" size={18} />
                </Pressable>
                <Pressable
                  disabled={busy}
                  accessibilityLabel="ქვემოთ ჩამოტანა"
                  onPress={() => void move(a.id, 1)}
                  style={S.icon}
                >
                  <Icon name="arrow-down" size={18} />
                </Pressable>
              </View>}
            </View>
          </View>
        ))
      )}
      <Sheet
        visible={!!edit}
        title={edit?.name || "განაცხადი"}
        onClose={() => {
          if (!busy) setEdit(null);
        }}
      >
        {edit && (
          <>
            <Text style={S.muted}>
              {edit.email} · {edit.position}
            </Text>
            <Fold title="კითხვარის პასუხები">
              {Object.entries(answers)
                .filter(([key, v]) => v && labels[key])
                .map(([key, value]) => (
                  <View key={key} style={{ gap: 5 }}>
                    <Text style={S.muted}>{labels[key]}</Text>
                    <Text selectable style={S.text}>
                      {typeof value === "object"
                        ? JSON.stringify(value)
                        : String(value)}
                    </Text>
                  </View>
                ))}
            </Fold>
            {canEdit?<><Select
              label="სტატუსი"
              value={edit.status}
              options={statuses}
              onChange={(status) => setEdit({ ...edit, status })}
            />
            <Select
              label="ჩემი შეფასება"
              value={String(edit.rating)}
              options={Array.from({ length: 6 }, (_, i) => ({
                value: String(i),
                label: i ? "★".repeat(i) : "შეფასების გარეშე",
              }))}
              onChange={(rating) =>
                setEdit({ ...edit, rating: Number(rating) })
              }
            />
            <Field
              label="შენიშვნა"
              multiline
              value={edit.admin_note}
              onChangeText={(admin_note) => setEdit({ ...edit, admin_note })}
            />
            {error && <Text style={S.error}>{error}</Text>}
            <Button
              title="შენახვა"
              busy={busy}
              onPress={() =>
                void save(
                  `/api/admin/applications/${edit.id}`,
                  "PATCH",
                  {
                    status: edit.status,
                    rating: edit.rating,
                    note: edit.admin_note,
                  },
                  () => setEdit(null),
                )
              }
            />
            </>:<><Text style={S.text}>{statuses.find(s=>s.value===edit.status)?.label}</Text><Text style={S.muted}>{edit.admin_note}</Text></>}
            {hasPermission(p,'applications.delete') && (
              <Button
                title="განაცხადის წაშლა"
                secondary
                disabled={busy}
                onPress={() =>
                  confirm("წაიშალოს ეს განაცხადი?", async () => {
                    await api(`/api/admin/applications/${edit.id}`, {
                      method: "DELETE",
                    });
                    setEdit(null);
                    await r.refresh();
                  })
                }
              />
            )}
          </>
        )}
      </Sheet>
      <Sheet
        visible={!!vacancy}
        title="ვაკანსიის პარამეტრები"
        onClose={() => {
          if (!busy) setVacancy(null);
        }}
      >
        {vacancy && (
          <>
            <Text style={S.subtitle}>{r.data?.roles[vacancy.role]}</Text>
            <Toggle
              label="განაცხადების მიღება"
              value={vacancy.isOpen}
              onChange={(isOpen) => setVacancy({ ...vacancy, isOpen })}
            />
            <Field
              label="ბოლო თარიღი (წელი-თვე-დღე, არასავალდებულო)"
              value={vacancy.deadline || ""}
              onChangeText={(deadline) => setVacancy({ ...vacancy, deadline })}
            />
            {error && <Text style={S.error}>{error}</Text>}
            <Button
              title="შენახვა"
              busy={busy}
              onPress={() =>
                void save(
                  "/api/admin/vacancies",
                  "PATCH",
                  { ...vacancy, deadline: vacancy.deadline || "" },
                  () => setVacancy(null),
                )
              }
            />
          </>
        )}
      </Sheet>
      <Sheet
        visible={!!candidate}
        title="ახალი კანდიდატი"
        onClose={() => {
          if (!busy) setCandidate(null);
        }}
      >
        {candidate && (
          <>
            {[
              ["name", "სახელი და გვარი"],
              ["email", "ელფოსტა"],
              ["phone", "ტელეფონი"],
            ].map(([key, label]) => (
              <Field
                key={key}
                label={label}
                value={candidate[key as keyof typeof candidate]}
                onChangeText={(v) => setCandidate({ ...candidate, [key]: v })}
                autoCapitalize={key === "email" ? "none" : "sentences"}
              />
            ))}
            <Select
              label="პოზიცია"
              value={candidate.position}
              onChange={(position) => setCandidate({ ...candidate, position })}
              options={Object.values(r.data?.roles || {}).map((role) => ({
                value: role,
                label: role,
              }))}
            />
            {error && <Text style={S.error}>{error}</Text>}
            <Button
              title="დამატება"
              busy={busy}
              onPress={() =>
                void save("/api/admin/applications", "POST", candidate, () =>
                  setCandidate(null),
                )
              }
            />
          </>
        )}
      </Sheet>
    </Screen>
  );
}
