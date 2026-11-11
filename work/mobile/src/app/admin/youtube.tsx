import Svg,{Path,Defs,LinearGradient,Stop} from "react-native-svg";
import {Brand} from "../../ui/brand";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, Text, View, StyleSheet } from "react-native";
import { Button, Chip, Fold, Icon, Screen, State, S, C } from "../../ui/components";
import { loadChannelSnapshot, prepareChannelReport, selectWindow, formatMetric, tbilisiTimestamp, type ChannelSnapshot, type WindowDays } from "../../lib/channel-analytics";

export default function YouTubeScreen() {
  const [snapshot, setSnapshot] = useState<ChannelSnapshot | null>(null);
  const [days, setDays] = useState<WindowDays>(28);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  async function refresh() {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try { setSnapshot(await loadChannelSnapshot()); setError(""); }
    catch { setError("ანალიტიკა ვერ განახლდა. სცადე ხელახლა."); }
    finally { busy.current = false; setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    busy.current = true;
    void loadChannelSnapshot().then((value) => {
      if (active) { setSnapshot(value); setLoading(false); }
    }).catch(() => {
      if (active) { setError("ანალიტიკა ვერ ჩაიტვირთა. სცადე ხელახლა."); setLoading(false); }
    }).finally(() => { if (active) busy.current = false; });
    return () => { active = false; };
  }, []);
  async function download() {
    if (busy.current) return;
    busy.current = true;
    setExporting(true);
    try {
      // Capture all periods together, after a fresh provider read, not from stale UI state.
      const report = await prepareChannelReport(loadChannelSnapshot);
      setSnapshot(report.snapshot);
      setError("");
      const { exportChannelReport } = await import("../../lib/export-channel-report");
      await exportChannelReport(report.snapshot, report.generatedAt);
    } catch (e) {
      Alert.alert("PDF ვერ შეიქმნა", e instanceof Error ? e.message : "სცადე ხელახლა.");
    } finally { busy.current = false; setExporting(false); }
  }
  const window = snapshot ? selectWindow(snapshot, days) : null;
  const series = window?.views.series || [];
  // Compact display bins preserve totals; report uses the original daily series.
  const bins = Array.from({ length: Math.min(series.length, 28) }, (_, i) => {
    const start = Math.floor(i * series.length / Math.min(series.length, 28));
    const end = Math.floor((i + 1) * series.length / Math.min(series.length, 28));
    return series.slice(start, end).reduce((a, b) => a + b, 0);
  });
  return (
    <Screen title="YouTube Studio" back refresh={() => void refresh()} loading={loading && !!snapshot}
      right={<Pressable accessibilityLabel="განახლება" accessibilityRole="button" disabled={loading || exporting} onPress={() => void refresh()} style={S.icon}><Icon name="refresh-outline" size={20} /></Pressable>}>
      {(!snapshot && loading) || (!snapshot && error) ? <State loading={loading} error={error} retry={() => void refresh()} /> : snapshot && window ? <>
        <View style={S.between}>
          <Brand/><View style={{ flex: 1, gap: 2 }}><Text style={S.subtitle}>{snapshot.channel}</Text><Text style={S.muted}>{snapshot.handle}</Text></View>
          <Chip color={snapshot.mode === "demo" ? C.amber : C.green}>{snapshot.mode === "demo" ? "საცდელი" : "დაკავშირებულია"}</Chip>
        </View>
        {snapshot.mode === "demo" && <Text style={S.muted}>საილუსტრაციო მონაცემები. არხი ჯერ არ არის დაკავშირებული.</Text>}
        {!!error && <Text style={S.error}>{error}</Text>}
        <View style={styles.segments}>
          {([7, 28, 90] as const).map((n) => <Pressable key={n} accessibilityRole="button" accessibilityState={{ selected: days === n }} onPress={() => setDays(n)} style={[styles.segment, days === n && { backgroundColor: C.text }]}><Text style={{ color: days === n ? C.bg : C.muted, fontSize: 13, fontWeight: "600" }}>{n} დღე</Text></Pressable>)}
        </View>
        <View style={styles.card}>
          <Text style={S.muted}>ნახვები · ბოლო {days} დღე</Text>
          <Text style={styles.hero}>{formatMetric(window.views)}</Text>
          <View accessibilityLabel="ნახვების დინამიკა" style={{height:110,marginTop:10}}><Svg width="100%" height="100%" viewBox="0 0 300 100"><Defs><LinearGradient id="area" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={C.red} stopOpacity={0.3}/><Stop offset="1" stopColor={C.red} stopOpacity={0}/></LinearGradient></Defs><Path d={linePath(bins)+' L300 100 L0 100 Z'} fill="url(#area)"/><Path d={linePath(bins)} stroke={C.red} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" fill="none"/></Svg></View>
          <View style={S.between}><Text style={styles.small}>{window.start}</Text><Text style={styles.small}>{window.end}</Text></View>
        </View>
        <View style={S.row}>
          {[snapshot.youtube.followers, window.watchHours].map((m) => <View key={m.label} style={[styles.card, { flex: 1 }]}><Text style={styles.small}>{m.label}</Text><Text style={styles.number} adjustsFontSizeToFit numberOfLines={1}>{formatMetric(m)}</Text></View>)}
        </View>
        <Fold title="პოპულარული ვიდეოები"><Text style={styles.small}>ვიდეოების ჯამური ნახვები</Text>{snapshot.videos.map((v) => <View key={v.title} style={S.between}><Text style={[S.text, { flex: 1 }]}>{v.title}</Text><Text style={S.subtitle}>{formatMetric({ label: "", value: v.views })}</Text></View>)}</Fold>
        <View style={styles.card}>
          <View style={S.row}><Icon name="document-text-outline" color={C.red} /><Text style={S.subtitle}>ანალიტიკის ანგარიში</Text></View>
          <Text style={S.muted}>10-გვერდიანი PDF · 28 / 90 / 365 დღე. მოიცავს YouTube-სა და სოციალური ქსელების სექციებს.</Text>
          <Button title={exporting ? "PDF მზადდება…" : "ჩამოტვირთვა · PDF"} icon="download-outline" busy={exporting} disabled={loading} onPress={() => void download()} />
          <Text style={styles.small}>შენახვის ფანჯარაში აირჩიე Files ან სასურველი აპი.</Text>
        </View>
        <Fold title="სოციალური ქსელები" subtitle="ანგარიშის დამატებითი სექციები">
          {[snapshot.tiktok, snapshot.facebook, snapshot.instagram].map((p) => <View key={p.name} style={S.between}><Text style={S.text}>{p.name}</Text><Chip color={C.amber}>{p.state === "demo" ? "საცდელი" : p.state === "unavailable" ? "დასაკავშირებელია" : "დაკავშირებულია"}</Chip></View>)}
          <Text style={S.muted}>რეალური განახლებისთვის თითოეული პლატფორმა ცალკე უნდა დავაკავშიროთ. ზოგი მაჩვენებელი შეიძლება API-ით მიუწვდომელი იყოს.</Text>
        </Fold>
        <Text style={styles.small}>{snapshot.mode === "demo" ? `საცდელი პერიოდის ბოლო დღე: ${snapshot.dataThrough}` : `მონაცემები თარიღამდე: ${snapshot.dataThrough}`}</Text>
        {snapshot.fetchedAt && <Text style={styles.small}>ბოლო სინქრონიზაცია: {tbilisiTimestamp(snapshot.fetchedAt)}</Text>}
      </> : null}
    </Screen>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: C.surface, borderRadius: 24, padding: 16, gap: 10,borderWidth:1,borderColor:C.line },
  hero: { color: C.text, fontSize: 44, fontWeight: "700", fontVariant: ["tabular-nums"] },
  number: { color: C.text, fontSize: 23, fontWeight: "700" },
  small: { color: C.muted, fontSize: 11, lineHeight: 18 },
  chart: { height: 85, flexDirection: "row", alignItems: "flex-end", gap: 3, marginTop: 10 },
  segments: { flexDirection: "row", backgroundColor: C.surface, borderRadius: 16, padding: 4 },
  segment: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 40, borderRadius: 13 },
});

function linePath(values:number[]){const max=Math.max(...values,1);return values.map((v,i)=>`${i?"L":"M"}${i*300/Math.max(1,values.length-1)} ${95-v/max*85}`).join(" ")||"M0 100 L300 100"}
