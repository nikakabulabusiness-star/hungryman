import { Alert, Text, View } from "react-native";
import { useAuth } from "../lib/auth";
import { Button, Icon, Screen, S } from "../ui/components";
export default function Pending() {
  const { session, refresh, logout } = useAuth();
  return (
    <Screen title="Hungryman Work">
      <View style={[S.card, { marginTop: 36 }]}>
        <Icon name="time-outline" size={40} />
        <Text style={S.title}>
          {session?.user.status === "suspended" || session?.user.status === "approved"
            ? "წვდომა შეჩერებულია"
            : "დადასტურების მოლოდინში"}
        </Text>
        <Text style={S.text}>{session?.user.fullName}</Text>
        <Text style={S.muted}>{session?.user.email}</Text>
        <Text style={S.muted}>
          გუნდის სივრცე ადმინისტრატორის მიერ სტატუსის მინიჭების შემდეგ
          გაიხსნება.
        </Text>
        <Button
          title="სტატუსის განახლება"
          onPress={() => void refresh().catch(() => {})}
        />
        <Button
          title="გასვლა"
          secondary
          onPress={() =>
            void logout().catch((e) => Alert.alert("ვერ შესრულდა", e.message))
          }
        />
      </View>
    </Screen>
  );
}
