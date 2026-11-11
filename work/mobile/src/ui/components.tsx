import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
// Import only the Ionicons family: the package index pulls in every icon
// family's glyph map and bundles all 19 icon fonts as update assets.
import Ionicons from "@expo/vector-icons/Ionicons";
import { isLoaded as fontIsLoaded } from "expo-font";
import * as Haptics from "expo-haptics";
import { avatarSource } from "../lib/api";
import { C, S } from "./theme";
export { C, S };
export const ICON_FONT = Ionicons.getFontFamily();
export const iconFont = Ionicons.font;
export function Icon({
  name,
  size = 22,
  color = C.blue,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  size?: number;
  color?: React.ComponentProps<typeof Ionicons>["color"];
}) {
  // Until the icon font is registered, @expo/vector-icons renders an empty
  // <Text/> with no size, which makes rows jump when icons pop in. Reserve the
  // icon's box instead (the font is preloaded at startup, so this is rare).
  if (!fontIsLoaded(ICON_FONT)) return <View style={{ width: size, height: size }} />;
  return <Ionicons name={name} size={size} color={color} />;
}
export function Screen({
  title,
  children,
  right,
  back = false,
  refresh,
  loading = false,
  scroll = true,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  back?: boolean;
  refresh?: () => void;
  loading?: boolean;
  scroll?: boolean;
}) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={S.fill}>
      <View style={[S.between, { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 }]}>
        <View style={[S.row, { flex: 1 }]}>
          {back && (
            <Pressable
              accessibilityLabel="უკან"
              style={S.icon}
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/")
              }
            >
              <Icon name="arrow-back" />
            </Pressable>
          )}
          <Text style={[S.title, { flexShrink: 1 }]}>{title}</Text>
        </View>
        {right}
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={S.page}
            refreshControl={
              refresh ? (
                <RefreshControl
                  refreshing={loading}
                  onRefresh={refresh}
                  tintColor={C.red}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          children
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Button({
  title,
  onPress,
  busy = false,
  secondary = false,
  disabled = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  secondary?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Icon>["name"];
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      style={({ pressed }) => [
        S.button,
        secondary && S.ghost,
        { opacity: disabled || busy ? 0.55 : pressed ? 0.7 : 1 },
      ]}
      onPress={onPress}
    >
      {busy ? (
        <ActivityIndicator color="#fff" />
      ) : icon ? (
        <Icon name={icon} size={18} color="#fff" />
      ) : null}
      <Text style={S.buttonText}>{title}</Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={S.muted}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={C.muted}
        {...props}
        style={[
          S.input,
          props.multiline && { minHeight: 100, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
export function Chip({
  children,
  color = C.blue,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <View style={S.chip}>
      <Text style={{ fontSize: 12, color }}>{children}</Text>
    </View>
  );
}
export function Avatar({
  userId,
  name,
  version = 0,
  hasAvatar = false,
  size = 42,
}: {
  userId?: string | null;
  name: string;
  version?: number;
  hasAvatar?: boolean;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  return hasAvatar && userId && !failed ? (
    <Image
      onError={() => setFailed(true)}
      source={avatarSource(userId, version)}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: C.raised,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: C.blue, fontWeight: "700", fontSize: size / 2.7 }}>
        {name.trim().slice(0, 1).toUpperCase() || "H"}
      </Text>
    </View>
  );
}
export function State({
  loading,
  error,
  empty,
  retry,
}: {
  loading?: boolean;
  error?: string;
  empty?: string;
  retry?: () => void;
}) {
  return (
    <View style={S.center}>
      {loading ? (
        <ActivityIndicator size="large" color={C.red} />
      ) : (
        <>
          <Text style={error ? S.error : S.muted}>{error || empty}</Text>
          {error && retry && (
            <Button title="ხელახლა ცდა" secondary onPress={retry} />
          )}
        </>
      )}
    </View>
  );
}
export function Fold({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useEffect(()=>onSaved(()=>setOpen(false)),[]);
  return (
    <View style={S.card}>
      <Pressable
        style={S.between}
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <View style={{ flex: 1 }}>
          <Text style={S.subtitle}>{title}</Text>
          {subtitle && <Text style={S.muted}>{subtitle}</Text>}
        </View>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={18} />
      </Pressable>
      {open && children}
    </View>
  );
}
export function Sheet({
  visible,
  title,
  children,
  onClose,
}: {
  visible: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#000000aa",
          justifyContent: "flex-end",
        }}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="დახურვა"
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ maxHeight: "92%", width: "100%" }}
        >
          <SafeAreaView
            edges={["bottom"]}
            style={{
              flexShrink: 1,
              backgroundColor: C.surface,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: 20,
            }}
          >
            <View style={[S.between, { marginBottom: 18 }]}>
              <Text style={[S.subtitle, { flex: 1 }]}>{title}</Text>
              <Pressable
                style={S.icon}
                onPress={onClose}
                accessibilityLabel="დახურვა"
              >
                <Icon name="close" />
              </Pressable>
            </View>
            <ScrollView
              style={{flexShrink:1}}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 16, paddingBottom: 20 }}
            >
              {children}
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
export function Select({label,value,options,onChange}:{label:string;value:string;options:{label:string;value:string}[];onChange:(value:string)=>void}) {
  const [open,setOpen]=useState(false),[query,setQuery]=useState('');
  return <View style={{gap:7}}><Text style={S.muted}>{label}</Text><Pressable style={[S.input,S.between]} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{expanded:open}} onPress={()=>{setOpen(!open);setQuery('')}}><Text style={[S.text,{flex:1}]}>{options.find(o=>o.value===value)?.label||value||'აირჩიე'}</Text><Icon name={open?'chevron-up':'chevron-down'} size={18}/></Pressable>
    {open&&<View style={{backgroundColor:C.bg,borderColor:C.line,borderWidth:1,borderRadius:14,paddingHorizontal:12}}>
      {options.length>8&&<TextInput accessibilityLabel="სიაში ძიება" value={query} onChangeText={setQuery} placeholder="ძიება…" placeholderTextColor={C.muted} style={[S.input,{marginVertical:8,fontSize:14}]}/>}
      <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{maxHeight:260}}>{options.filter(o=>o.label.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(option=><Pressable key={option.value} accessibilityRole="radio" accessibilityState={{selected:option.value===value}} style={[S.between,{minHeight:46,paddingVertical:7}]} onPress={()=>{onChange(option.value);setOpen(false)}}><Text style={[S.text,{flex:1}]}>{option.label}</Text>{option.value===value&&<Icon name="checkmark" size={18}/>}</Pressable>)}</ScrollView>
    </View>}
  </View>;
}
export function Toggle({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[S.row, { minHeight: 44, opacity: disabled ? 0.5 : 1 }]}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value, disabled }}
      onPress={() => onChange(!value)}
    >
      <Icon
        name={value ? "checkbox" : "square-outline"}
        color={value ? C.green : C.muted}
      />
      <Text style={[S.text, { flex: 1 }]}>{label}</Text>
    </Pressable>
  );
}
export function confirm(title: string, action: () => Promise<void>) {
  Alert.alert(title, "ეს ცვლილება საიტზეც აისახება.", [
    { text: "გაუქმება", style: "cancel" },
    {
      text: "დადასტურება",
      style: "destructive",
      onPress: () =>
        void action().catch((e) => Alert.alert("ვერ შესრულდა", e.message)),
    },
  ]);
}
const savedListeners=new Set<()=>void>();
function onSaved(listener:()=>void){savedListeners.add(listener);return()=>{savedListeners.delete(listener)}}
export function SavedToast(){const [visible,setVisible]=useState(false),[opacity]=useState(()=>new Animated.Value(0));useEffect(()=>{let timer:ReturnType<typeof setTimeout>|undefined;const off=onSaved(()=>{if(timer)clearTimeout(timer);setVisible(true);Animated.timing(opacity,{toValue:1,duration:160,useNativeDriver:true}).start();timer=setTimeout(()=>Animated.timing(opacity,{toValue:0,duration:180,useNativeDriver:true}).start(()=>setVisible(false)),1200)});return()=>{off();if(timer)clearTimeout(timer)}},[opacity]);if(!visible)return null;return <Animated.View pointerEvents="none" accessibilityLiveRegion="polite" style={{position:"absolute",bottom:100,left:30,right:30,borderRadius:20,padding:14,backgroundColor:"#103C38",borderWidth:1,borderColor:C.green,opacity,zIndex:500}}><Text style={{color:C.green,textAlign:"center",fontSize:13}}>✓ შენახულია</Text></Animated.View>}
export function success() {
  savedListeners.forEach(fn=>fn());
  void Haptics.notificationAsync(
    Haptics.NotificationFeedbackType.Success,
  ).catch(() => {});
}
