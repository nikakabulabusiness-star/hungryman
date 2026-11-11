import {AppUpdatesCard} from '../../ui/app-updates';
import {roleLabel} from '../../lib/departments';
import {router} from 'expo-router';
import {hasPermission} from '../../lib/permissions';
import {SocialShortcuts} from '../../ui/social';
import {canUseSocial} from '../../lib/social';
import {CabinetPanel,TimeOffBell} from '../../ui/cabinet-panel';
import {AttendanceCard} from "../../ui/attendance-card";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useAuth } from "../../lib/auth";
import { api } from "../../lib/api";
import { Calendar } from "../../ui/calendar";
import {
  Avatar,
  Button,
  Chip,
  Field,
  Icon,
  Screen,
  Sheet,
  success,
  S,
} from "../../ui/components";
export default function Profile() {
  const { session, refresh, logout } = useAuth();
  const user = session!.user;
  const [editing, setEditing] = useState(false),
    [name, setName] = useState(user.fullName),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save() {
    setBusy(true);
    setError("");
    try {
      await api("/api/team/profile", {
        method: "PATCH",
        body: { fullName: name },
      });
      await refresh();
      success();
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function photo() {
    setBusy(true);
    setError("");
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled) return;
      const context = ImageManipulator.manipulate(result.assets[0].uri);
      context.resize({ width: 720 });
      const image = await context.renderAsync();
      const output = await image.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.8,
      });
      const form = new FormData();
      form.append("avatar", {
        uri: output.uri,
        name: "avatar.jpg",
        type: "image/jpeg",
      } as unknown as Blob);
      await api("/api/team/avatar", { method: "POST", body: form });
      await refresh();
      success();
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      title="ჩემი კაბინეტი" right={hasPermission(session?.permissions,'cabinet.leave.request')?<TimeOffBell/>:undefined}
      refresh={() => void refresh().catch(() => {})}
    >
      <View style={[S.card, S.row]}>
        <Avatar
          key={user.profileUpdated}
          {...user}
          name={user.fullName}
          version={user.profileUpdated}
          size={58}
        />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={S.subtitle}>{user.fullName}</Text>
          <Chip>{roleLabel(user.role) || "თანამშრომელი"}</Chip>
        </View>
        <Pressable
          style={S.icon}
          accessibilityLabel="პროფილის რედაქტირება"
          onPress={() => {
            setName(user.fullName);
            setEditing(true);
          }}
        >
          <Icon name="pencil-outline" size={19} />
        </Pressable>
      </View>
      <CabinetPanel/>{canUseSocial(user.role)&&hasPermission(session?.permissions,'social.view')&&<SocialShortcuts/>}{hasPermission(session?.permissions,'departments.view')&&<Button title="დეპარტამენტები" secondary icon="git-network-outline" onPress={()=>router.push('/departments')}/>}
      {hasPermission(session?.permissions,'calendar.view')&&<View style={S.card}><Calendar/></View>}
      {session?.permissions?.features?.attendance!==false&&<AttendanceCard/>}<AppUpdatesCard/>
      <Button
        title="ანგარიშიდან გასვლა"
        secondary
        onPress={() =>
          Alert.alert("ანგარიშიდან გასვლა", "გსურს გასვლა?", [
            { text: "გაუქმება", style: "cancel" },
            {
              text: "გასვლა",
              style: "destructive",
              onPress: () =>
                void logout().catch((e) =>
                  Alert.alert("ვერ შესრულდა", e.message),
                ),
            },
          ])
        }
      />
      <Sheet
        visible={editing}
        title="პროფილი"
        onClose={() => {
          if (!busy) setEditing(false);
        }}
      >
        <Text style={S.muted}>{user.email}</Text>
        {user.phone && <Text style={S.muted}>{user.phone}</Text>}
        <Field
          label="სახელი და გვარი"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
        <Button
          title="ფოტოს შეცვლა"
          icon="image-outline"
          secondary
          busy={busy}
          onPress={() => void photo()}
        />
        {user.hasAvatar && (
          <Button
            title="ფოტოს წაშლა"
            secondary
            disabled={busy}
            onPress={() =>
              Alert.alert("ფოტოს წაშლა", "წაიშალოს პროფილის ფოტო?", [
                { text: "გაუქმება" },
                {
                  text: "წაშლა",
                  style: "destructive",
                  onPress: () => {
                    setBusy(true);
                    void api("/api/team/avatar", { method: "DELETE" })
                      .then(refresh)
                      .then(() => {
                        success();
                        setEditing(false);
                      })
                      .catch((e) => setError(e.message))
                      .finally(() => setBusy(false));
                  },
                },
              ])
            }
          />
        )}
        <Text style={S.error}>{error}</Text>
        <Button title="შენახვა" busy={busy} onPress={() => void save()} />
      </Sheet>
    </Screen>
  );
}
