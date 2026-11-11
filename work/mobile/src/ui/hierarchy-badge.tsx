import {Text,View} from 'react-native';
import {levelColor} from '../lib/departments';
export function HierarchyBadge({level,maxLevel}:{level:number;maxLevel:number}){
 const color=levelColor(level,maxLevel);
 return <View accessible accessibilityLabel={`დონე ${level}`} style={{width:34,height:34,flexShrink:0,borderRadius:17,borderWidth:2,borderColor:color,backgroundColor:'#0a2333',alignItems:'center',justifyContent:'center'}}><Text style={{color,fontSize:14,fontWeight:'700'}}>{level}</Text></View>;
}
