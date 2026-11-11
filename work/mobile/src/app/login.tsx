import {useResource} from '../lib/use-resource';
import {Brand} from '../ui/brand';
import {Pressable,Text,View} from 'react-native';
import {useAuth} from '../lib/auth';
import {api} from '../lib/api';
import {useEmailFlow,codeTime} from '../lib/email-flow';
import {Button,Field,Screen,S,C} from '../ui/components';

export default function Login(){
 const {login}=useAuth(),settings=useResource<{registration:boolean}>('/api/mobile/config');
 const f=useEmailFlow((path,body)=>api(`/api/mobile/auth/${path}`,{method:'POST',body,public:true}),login);
 const isLogin=f.mode==='login',codeStep=f.step==='code',passwordStep=f.step==='password';
 const link=(title:string,onPress:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={disabled||f.busy} onPress={onPress} hitSlop={8} style={{opacity:disabled||f.busy?0.45:1,paddingVertical:4}}><Text style={{color:C.blue,fontSize:12}}>{title}</Text></Pressable>;
 return <Screen title=""><View style={{gap:22,paddingTop:20}}>
  <View style={{gap:14,alignItems:'center',paddingVertical:15}}><Brand large/><Text style={S.muted}>ჰანგრიმენის გუნდის სამუშაო სივრცე</Text></View>
  {f.step==='done'?<View style={{gap:18}}><Text style={S.title}>{f.mode==='reset'?'პაროლი შეიცვალა':'ელფოსტა დადასტურებულია'}</Text><Text style={{...S.text,color:C.green}}>{f.message}</Text><Button title="ავტორიზაციაზე გადასვლა" onPress={()=>f.changeMode('login')}/></View>:<>
   {f.mode==='reset'?<View style={{gap:10}}>{link('← ავტორიზაცია',()=>f.changeMode('login'))}<Text style={S.title}>პაროლის აღდგენა</Text></View>:<View style={[S.row,{padding:5,backgroundColor:C.surface,borderRadius:17}]}>{(settings.data?.registration===false?['ავტორიზაცია']:['ავტორიზაცია','რეგისტრაცია']).map((title,i)=><Pressable key={title} accessibilityRole="button" disabled={f.busy} onPress={()=>f.changeMode(i===0?'login':'register')} style={{flex:1,paddingVertical:12,alignItems:'center',borderRadius:13,backgroundColor:isLogin===(i===0)?'#81102D':'transparent'}}><Text style={S.text}>{title}</Text></Pressable>)}</View>}
   {!isLogin&&<View style={[S.row,{gap:8}]}>{['ელფოსტა','კოდი','პაროლი'].map((title,i)=><Text key={title} style={{flex:1,textAlign:'center',paddingBottom:9,fontSize:11,color:i===(codeStep?1:passwordStep?2:0)?C.text:C.muted,borderBottomWidth:2,borderBottomColor:i===(codeStep?1:passwordStep?2:0)?C.red:C.surface}}>{i+1} · {title}</Text>)}</View>}
   <View style={{gap:17}}>
    {f.step==='email'?<Field label="ელფოსტა" value={f.email} onChangeText={f.setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" editable={!f.busy} maxLength={254}/>:<View style={[S.between,{gap:12}]}><Text style={[S.muted,{flex:1}]}>{f.email}</Text>{link('შეცვლა',f.back)}</View>}
    {!isLogin&&f.step==='email'&&<Text style={S.muted}>{f.mode==='reset'?'გამოგიგზავნით ერთჯერად კოდს. დადასტურების შემდეგ ახალ პაროლს შექმნი.':'ანგარიშის შესაქმნელად ჯერ ელფოსტა დაადასტურე ერთჯერადი კოდით.'}</Text>}
    {codeStep&&<><Text style={S.muted}>კოდი გაგზავნილია. შეამოწმე ელფოსტა და სპამის საქაღალდე.</Text><Field label="ერთჯერადი კოდი" value={f.code} onChangeText={f.setCode} keyboardType="number-pad" autoComplete="one-time-code" autoCorrect={false} autoCapitalize="none" maxLength={6} editable={!f.busy&&f.seconds>0} autoFocus placeholder="000000" onSubmitEditing={()=>void f.submit()}/><View style={[S.between,{flexWrap:'wrap',gap:10}]}><Text style={{fontSize:12,color:f.seconds>0?C.muted:C.red,fontVariant:['tabular-nums']}}>{f.seconds>0?`დარჩენილი დრო · ${codeTime(f.seconds)}`:'კოდის ვადა ამოიწურა'}</Text>{link(f.resendSeconds>0?`ხელახლა · ${codeTime(f.resendSeconds)}`:'ახალი კოდის გაგზავნა',()=>void f.resend(),f.resendSeconds>0)}</View></>}
    {(isLogin||passwordStep)&&<Field label={isLogin?'პაროლი':'ახალი პაროლი'} value={f.password} onChangeText={f.setPassword} secureTextEntry autoComplete={isLogin?'current-password':'new-password'} maxLength={128} editable={!f.busy} onSubmitEditing={()=>{if(isLogin)void f.submit()}}/>}
    {passwordStep&&<Field label="გაიმეორე პაროლი" value={f.confirmation} onChangeText={f.setConfirmation} secureTextEntry autoComplete="new-password" maxLength={128} editable={!f.busy} onSubmitEditing={()=>void f.submit()}/>}
    {isLogin&&<View style={{alignItems:'flex-end',marginTop:-7}}>{link('დაგავიწყდა პაროლი?',()=>f.changeMode('reset'))}</View>}
    {!!f.error&&<Text accessibilityRole="alert" style={S.error}>{f.error}</Text>}
    <Button title={isLogin?'შესვლა':codeStep?'კოდის დადასტურება':passwordStep?(f.mode==='reset'?'პაროლის შენახვა':'ანგარიშის შექმნა'):'კოდის გაგზავნა'} busy={f.busy} disabled={codeStep&&(f.seconds===0||f.code.length!==6)} onPress={()=>void f.submit()}/>
    {f.mode==='register'&&<Text style={S.muted}>ელფოსტის დადასტურების შემდეგ ანგარიშს ადმინისტრაცია დაამტკიცებს.</Text>}
   </View>
  </>}
 </View></Screen>;
}
