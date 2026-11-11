import {levelColor} from '@/lib/department-directory';
export default function HierarchyBadge({level,maxLevel}:{level:number;maxLevel:number}){
 const color=levelColor(level,maxLevel);
 return <span className="hierarchy-badge" aria-label={`დონე ${level}`} title={`დონე ${level}`} style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:34,height:34,flexShrink:0,borderRadius:'50%',border:`2px solid ${color}`,color,fontSize:14,fontWeight:700,lineHeight:1,background:'#0a2333'}}>{level}</span>;
}
