/* สมุดเตรียมฯ ของเฟย์เฟย์ — AI Exam Master + สมุดสรุป ในเว็บเดียว
   Static site (GitHub Pages) · Google sign-in · ข้อมูลเก็บใน Google Drive ของเจ้าของ */
(function(){
"use strict";
const CFG=window.APP_CONFIG||{};
const NAME=CFG.OWNER_NAME||"เฟย์เฟย์";
const IS_LOCAL=["localhost","127.0.0.1"].includes(location.hostname);
const DEMO=IS_LOCAL&&new URLSearchParams(location.search).has("demo");
const SCOPES="openid email profile https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file";

/* ---------------- helpers ---------------- */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad=n=>String(n).padStart(2,"0");
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseD=s=>{const[y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)};
const addDays=(s,n)=>{const d=parseD(s);d.setDate(d.getDate()+n);return ymd(d)};
const today=()=>ymd(new Date());
const diffDays=(a,b)=>Math.round((parseD(b)-parseD(a))/864e5);
const thD=(s,o={day:"numeric",month:"short"})=>parseD(s).toLocaleDateString("th-TH",o);
const fmtMin=m=>{m=Math.round(m||0);const h=Math.floor(m/60);return h?`${h} ชม. ${m%60} น.`:`${m} นาที`};
const clock=ms=>{const s=Math.max(0,Math.floor(ms/1000));return `${pad(Math.floor(s/3600))}:${pad(Math.floor(s/60)%60)}:${pad(s%60)}`};
const pct=v=>v==null||isNaN(v)?"–":`${Math.round(v)}%`;
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const natCmp=(a,b)=>a.localeCompare(b,"th",{numeric:true});
function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("on");clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove("on"),2600)}

const SUBJ={
  eng:{name:"ภาษาอังกฤษ",g:"E",c:"var(--lilac)",s:"var(--lilac-soft)"},
  sci:{name:"วิทยาศาสตร์",g:"ว",c:"var(--mint)",s:"var(--mint-soft)"},
  tha:{name:"ภาษาไทย",g:"ท",c:"var(--peach)",s:"var(--peach-soft)"},
  soc:{name:"สังคมศึกษา",g:"ส",c:"var(--butter)",s:"var(--butter-soft)"},
  mat:{name:"คณิตศาสตร์",g:"ค",c:"var(--sky)",s:"var(--sky-soft)"},
  oth:{name:"ยังไม่ระบุวิชา",g:"?",c:"var(--pink)",s:"var(--pink-soft)"}
};
const NB_SUBJ={math:"mat",science:"sci",english:"eng",thai:"tha",social:"soc"};
const TYPES={exam:"ข้อสอบ",read:"อ่าน/สรุป",extra:"อ่านเสริม",ans:"เฉลย"};
const REASONS=["ไม่เข้าใจเนื้อหา","จำสูตร/หลักไม่ได้","คำนวณผิด","อ่านโจทย์ผิด","ตีความผิด","ศัพท์ไม่รู้","เวลาไม่พอ","เดา"];
const subjTag=k=>`<span class="tag" style="background:${(SUBJ[k]||SUBJ.oth).c}" aria-hidden="true">${(SUBJ[k]||SUBJ.oth).g}</span>`;

/* ---------------- state ---------------- */
const DEFAULT={v:1,settings:{start:today(),deadline:"2026-12-31",examDate:"2027-03-06",hWeekday:3,hWeekend:5,maxSets:3,target:70,offDays:[]},
  catalog:{syncedAt:null,items:[]},over:{},plan:[],attempts:[],session:null,nb:{done:{},star:{},wrong:[],pomo:{}},updatedAt:0};
let S=structuredClone(DEFAULT);
let NB=null; // notebook content (notebook.json)
let VIEW="today";
const UI={exSubj:"",exType:"exam",exQ:"",nbTab:"topics",nbSubj:"all",timerMode:"exam",timerExam:"",quiz:null,cardI:0,cardSubj:"all"};

/* ---------------- auth ---------------- */
let TOKEN=null,EMAIL="",tokenClient=null,PENDING_AFTER_LOGIN=null;
const configured=()=>CFG.GOOGLE_CLIENT_ID&&!/ใส่/.test(CFG.GOOGLE_CLIENT_ID);
function gate(msg){
  $("#shell").hidden=true;$("#gate").hidden=false;
  if(msg)$("#gateMsg").textContent=msg;
}
function initAuth(){
  const btn=$("#loginBtn");
  if(DEMO){btn.disabled=false;btn.textContent="เข้าโหมดทดลอง (เครื่องนี้)";btn.onclick=()=>{EMAIL="demo@local";enterApp()};$("#gateNote").textContent="โหมดทดลองบน localhost: ข้อมูลอยู่ในเบราว์เซอร์นี้เท่านั้น";return}
  if(!configured()){btn.disabled=true;$("#gateMsg").textContent="ยังไม่ได้ใส่ Google Client ID ในไฟล์ config.js (ดูวิธีใน README.md)";return}
  const saved=(()=>{try{return JSON.parse(sessionStorage.getItem("ffs.tok")||"null")}catch{return null}})();
  if(saved&&saved.exp>Date.now()+60e3){TOKEN=saved.t;EMAIL=saved.email;enterApp();}
  const ready=()=>{
    tokenClient=google.accounts.oauth2.initTokenClient({client_id:CFG.GOOGLE_CLIENT_ID,scope:SCOPES,callback:onToken,error_callback:e=>{$("#gateMsg").textContent=e.type==="popup_closed"?"ปิดหน้าต่างเข้าสู่ระบบไปก่อน ลองกดใหม่อีกครั้งนะ":"เข้าสู่ระบบไม่สำเร็จ ("+e.type+")"}});
    btn.disabled=false;
  };
  if(window.google?.accounts?.oauth2)ready();else{const t=setInterval(()=>{if(window.google?.accounts?.oauth2){clearInterval(t);ready()}},150);setTimeout(()=>{if(btn.disabled)$("#gateMsg").textContent="โหลดระบบเข้าสู่ระบบของ Google ไม่ได้ ตรวจอินเทอร์เน็ตแล้วรีเฟรช"},12000)}
  btn.onclick=()=>{ // must stay synchronous for iPad/iPhone popups
    tokenClient.requestAccessToken({prompt:EMAIL?"":"select_account",login_hint:EMAIL||undefined});
  };
}
async function onToken(resp){
  if(resp.error){$("#gateMsg").textContent="เข้าสู่ระบบไม่สำเร็จ: "+resp.error;return}
  TOKEN=resp.access_token;
  try{
    const r=await fetch("https://www.googleapis.com/oauth2/v3/userinfo",{headers:{Authorization:"Bearer "+TOKEN}});
    const u=await r.json();const em=(u.email||"").toLowerCase();
    const hash=[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(em)))].map(b=>b.toString(16).padStart(2,"0")).join("");
    const allow=(CFG.ALLOWED_EMAIL_SHA256||[]).map(x=>x.toLowerCase());
    if(!em||!allow.includes(hash)){google.accounts.oauth2.revoke(TOKEN,()=>{});TOKEN=null;gate(`บัญชี ${em||"นี้"} ไม่มีสิทธิ์เข้าเว็บนี้ เว็บนี้สำหรับ${NAME}เท่านั้น`);return}
    EMAIL=em;
    try{sessionStorage.setItem("ffs.tok",JSON.stringify({t:TOKEN,exp:Date.now()+(+resp.expires_in||3600)*1000,email:EMAIL}))}catch{}
    if(PENDING_AFTER_LOGIN){const f=PENDING_AFTER_LOGIN;PENDING_AFTER_LOGIN=null;$("#gate").hidden=true;$("#shell").hidden=false;f();}
    else enterApp();
  }catch(e){gate("ตรวจสอบบัญชีไม่สำเร็จ ลองใหม่อีกครั้ง")}
}
function authExpired(){
  TOKEN=null;try{sessionStorage.removeItem("ffs.tok")}catch{}
  PENDING_AFTER_LOGIN=loaded?()=>{Store.flush();toast("เข้าสู่ระบบต่อแล้ว")}:()=>{entered=false;enterApp()};
  gate("หมดเวลาเข้าสู่ระบบ แตะปุ่มด้านล่างเพื่อทำต่อ (ข้อมูลที่ทำไว้ยังอยู่)");
}
function logout(){
  Store.flush();
  if(TOKEN&&window.google?.accounts?.oauth2)google.accounts.oauth2.revoke(TOKEN,()=>{});
  TOKEN=null;EMAIL="";try{sessionStorage.removeItem("ffs.tok")}catch{}
  closeDlg();gate("ออกจากระบบแล้ว");
}

/* ---------------- Google Drive ---------------- */
async function api(url,opts={}){
  if(!TOKEN)throw new Error("ยังไม่ได้เข้าสู่ระบบ");
  const r=await fetch(url.startsWith("http")?url:"https://www.googleapis.com/drive/v3/"+url,{...opts,headers:{Authorization:"Bearer "+TOKEN,...(opts.headers||{})}});
  if(r.status===401){authExpired();throw new Error("auth")}
  if(!r.ok){let m="";try{m=(await r.json()).error?.message||""}catch{}throw new Error(`Drive ${r.status} ${m}`)}
  return r;
}
async function listChildren(folderId){
  const out=[];let token="";
  do{
    const q=encodeURIComponent(`'${folderId}' in parents and trashed=false`);
    const r=await api(`files?q=${q}&fields=nextPageToken,files(id,name,mimeType,size,createdTime)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true${token?"&pageToken="+token:""}`);
    const j=await r.json();out.push(...(j.files||[]));token=j.nextPageToken||"";
  }while(token);
  return out;
}

/* ---------------- storage ---------------- */
const Store={
  fileId:null,timer:null,saving:false,dirty:false,
  localKey(){return "ffs.data."+(EMAIL||"x")},
  cache(){try{localStorage.setItem(this.localKey(),JSON.stringify(S))}catch{}},
  readCache(){try{return JSON.parse(localStorage.getItem(this.localKey())||"null")}catch{return null}},
  async load(){
    const local=this.readCache();
    if(DEMO){if(local)S=merge(local);return}
    const q=encodeURIComponent(`name='${CFG.DATA_FILE_NAME}' and trashed=false and 'me' in owners`);
    const r=await api(`files?q=${q}&fields=files(id,modifiedTime)&orderBy=${encodeURIComponent("modifiedTime desc")}&spaces=drive`);
    const f=(await r.json()).files?.[0];
    if(f){
      this.fileId=f.id;
      const d=await (await api(`files/${f.id}?alt=media`)).json();
      S=merge(local&&local.updatedAt>(d.updatedAt||0)?local:d);
      if(local&&local.updatedAt>(d.updatedAt||0))this.save();
    }else{
      if(local)S=merge(local);
      await this.create();
    }
  },
  async create(){
    const boundary="ffs"+uid();
    const meta={name:CFG.DATA_FILE_NAME,mimeType:"application/json",description:`ข้อมูลเว็บสมุดเตรียมฯ ของ${NAME} (คะแนน แผน ความคืบหน้า)`};
    const body=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(S)}\r\n--${boundary}--`;
    const r=await api("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",{method:"POST",headers:{"Content-Type":"multipart/related; boundary="+boundary},body});
    this.fileId=(await r.json()).id;
  },
  save(){S.updatedAt=Date.now();this.cache();this.dirty=true;setSave("รอบันทึก…");clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),1500)},
  async flush(){
    clearTimeout(this.timer);
    if(!this.dirty)return;
    if(DEMO){this.dirty=false;setSave("บันทึกในเครื่องแล้ว ✓");return}
    if(!TOKEN||this.saving){if(this.saving)this.timer=setTimeout(()=>this.flush(),1200);return}
    this.saving=true;this.dirty=false;setSave("กำลังบันทึกลง Drive…");
    try{
      if(!this.fileId)await this.create();
      else await api(`https://www.googleapis.com/upload/drive/v3/files/${this.fileId}?uploadType=media`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(S)});
      setSave("บันทึกใน Drive แล้ว ✓");
    }catch(e){this.dirty=true;setSave(e.message==="auth"?"รอเข้าสู่ระบบเพื่อบันทึก":"ยังไม่ได้บันทึก (ออฟไลน์?) จะลองใหม่");if(e.message!=="auth")this.timer=setTimeout(()=>this.flush(),15000)}
    finally{this.saving=false}
  }
};
function merge(d){const o=structuredClone(DEFAULT);Object.assign(o,d||{});o.settings={...DEFAULT.settings,...(d?.settings||{})};o.nb={...DEFAULT.nb,...(d?.nb||{})};o.catalog=d?.catalog||DEFAULT.catalog;return o}
function setSave(t){const n=$("#saveState");if(n)n.textContent=t}
const save=()=>Store.save();

/* ---------------- catalog (read from Drive folders) ---------------- */
const JUNK=/goodnotesmeta|^สมุดโน้ตไม่มีชื่อ|^(copy of )?รูปภาพ/i;
const FOLDER_SUBJ=[[/^eng(lish)?\b|eng tu/i,"eng"],[/social|สังคม/i,"soc"],[/^ไทย|thai/i,"tha"],[/วิทย์|science|p.panjan/i,"sci"],[/คณิต|math/i,"mat"]];
function cleanTitle(n){return n.replace(/\.(pdf|docx?|pptx?|xlsx?|png|jpe?g|heic)$/i,"").replace(/\.pdf$/i,"").replace(/^(copy of )+/i,"").replace(/^[0-9A-F]{40}_/i,"").replace(/-20(?=[A-Za-z])/g," ").replace(/(\s*\(\d+\))+\s*$/,"").replace(/_/g," ").trim()}
function guessSubj(path,title){
  for(const p of path)for(const[re,k]of FOLDER_SUBJ)if(re.test(p))return k;
  if(/grammar|vocab|reading|english|eng/i.test(title))return"eng";
  if(/วิทย์|science|ฟิสิกส์|เคมี|ชีว/i.test(title))return"sci";
  if(/ภาษาไทย|ไทย/.test(title))return"tha";if(/สังคม|ข่าว/.test(title))return"soc";if(/คณิต|math/i.test(title))return"mat";
  return"oth";
}
function guessType(title,path,size){
  if(/เฉลย/.test(title))return"ans";
  if(/oxford|vocab|z-library|reading 500|e-book|pdfgallery|error 500|^\d{4,6}$/i.test(title)||size>40e6)return"extra";
  if(path.some(p=>/^(สรุป|จด|ทวน)$/.test(p)))return"read";
  if(/สรุป|เอกสาร|ติวก่อนนอน|ข่าว|content|ใบแก้|เคมี$|ไฟล์เปล่า/i.test(title))return"read";
  return"exam";
}
function guessTopic(s,t){
  const R={eng:[[/signature mock/i,"Signature Mock"],[/adv/i,"Advanced TU"],[/grammar|error/i,"Grammar"],[/vocab|oxford/i,"Vocabulary"],[/reading/i,"Reading"]],
    sci:[[/test day/i,"Test Day"],[/เลนส์|ลึกจริง|มุมวิกฤต|ทัศน|แสง/,"ฟิสิกส์: แสง"],[/simple machine/i,"ฟิสิกส์: เครื่องกล"],[/เคมี/,"เคมี"],[/solution|os-test|qr-form|ใบแก้/i,"Online Solution"],[/tu8\d|ปี 6\d|แนว/i,"แนวข้อสอบ TU"]],
    tha:[[/pre-?test/i,"Pre-Test"],[/สายวิทย์/,"สายวิทย์-สายศิลป์"],[/ติว|เก็ง/,"เอกสารติว/เก็ง"]],
    soc:[[/ข่าว/,"ข่าว/เหตุการณ์ปัจจุบัน"],[/ติว/,"เอกสารติว"],[/pre-?test/i,"Pre-Test"]]}[s]||[];
  for(const[re,n]of R)if(re.test(t))return n;
  return s==="eng"?"Mock / แนวข้อสอบ":"แนวข้อสอบรวม";
}
async function syncCatalog(showResult){
  if(DEMO){S.catalog={syncedAt:Date.now(),items:demoCatalog()};save();render();if(showResult)toast("โหมดทดลอง: ใช้รายการตัวอย่าง");return}
  setSave("กำลังอ่านรายการไฟล์จาก Drive…");
  const files=[];const seen=new Set();
  async function walk(id,path,depth){
    if(seen.has(id)||depth>5)return;seen.add(id);
    const kids=await listChildren(id);
    const subs=[];
    for(const f of kids){
      if(f.mimeType==="application/vnd.google-apps.folder")subs.push(walk(f.id,[...path,f.name],depth+1));
      else if(!JUNK.test(f.name))files.push({...f,path});
    }
    await Promise.all(subs);
  }
  try{
    await Promise.all((CFG.EXAM_FOLDERS||[]).map(id=>walk(id,[],0)));
  }catch(e){setSave("อ่าน Drive ไม่สำเร็จ");if(e.message!=="auth")toast("อ่านโฟลเดอร์ Drive ไม่สำเร็จ: "+e.message);return}
  // group duplicates: same subject + same cleaned title + same size (±2%)
  const groups=new Map();
  for(const f of files){
    const title=cleanTitle(f.name);const subj=guessSubj(f.path,title);const size=+f.size||0;
    const key=subj+"|"+title.toLowerCase().replace(/\s+/g,"");
    const arr=groups.get(key)||[];groups.set(key,arr);
    let cl=arr.find(c=>!c.size||!size||Math.abs(c.size-size)/Math.max(c.size,size)<0.02);
    if(!cl){cl={title,subj,size,path:f.path,files:[]};arr.push(cl)}
    cl.files.push(f);
  }
  const items=[];
  for(const arr of groups.values()){
    arr.forEach((cl,i)=>{
      cl.files.sort((a,b)=>(a.createdTime||"").localeCompare(b.createdTime||"")||a.id.localeCompare(b.id));
      const p=cl.files[0];
      const title=arr.length>1?`${cl.title} (ไฟล์ ${(cl.size/1048576).toFixed(1)} MB)`:cl.title;
      items.push({id:p.id,title,subj:cl.subj,type:guessType(cl.title,cl.path,cl.size),topic:guessTopic(cl.subj,cl.title),size:cl.size,folder:cl.path.join(" / "),dups:cl.files.slice(1).map(f=>f.id)});
    });
  }
  // keep ids that earlier pointed at a now-duplicate file working (alias map)
  items.sort((a,b)=>a.subj.localeCompare(b.subj)||natCmp(a.title,b.title));
  const before=new Set(S.catalog.items.map(i=>i.id));
  const added=items.filter(i=>!before.has(i.id)&&!S.catalog.items.some(o=>o.dups?.includes(i.id))).length;
  S.catalog={syncedAt:Date.now(),items};save();render();
  setSave("อ่านรายการไฟล์แล้ว ✓");
  if(showResult)toast(`พบ ${items.length} ชุด/ไฟล์ · ใหม่ ${before.size?added:items.length} · ไฟล์ซ้ำ ${files.length-items.length}`);
}
function demoCatalog(){
  const L=[];const mk=(subj,n,title,type)=>L.push({id:`demo-${subj}-${n}`,title,subj,type,topic:guessTopic(subj,title),size:1e6,folder:"ตัวอย่าง",dups:[]});
  for(let i=1;i<=6;i++)mk("eng",i,`Signature Mock ชุดที่ ${i}`,"exam");
  mk("eng",7,"100 Grammar Questions","exam");mk("eng",8,"Vocab พิชิตฝัน","extra");
  for(let i=1;i<=3;i++)mk("sci",i,`Test Day ${i} Science`,"exam");mk("sci",4,"เลนส์","exam");mk("sci",5,"เคมี","read");
  mk("tha",1,"Pre-Test ภาษาไทย 2568","exam");mk("tha",2,"แนวข้อสอบภาษาไทย สายวิทย์-สายศิลป์ ครั้งที่ 1","exam");
  mk("soc",1,"TU86","exam");mk("soc",2,"TU'89 สรุปข่าวโค้ง","read");
  return L;
}

/* ---------------- derived ---------------- */
let _ex=null,_alias=null;
function exams(){
  if(_ex)return _ex;
  _alias={};
  _ex=S.catalog.items.map(i=>({...i,...(S.over[i.id]||{})}));
  _ex.forEach(e=>{_alias[e.id]=e.id;(e.dups||[]).forEach(d=>_alias[d]=e.id)});
  return _ex;
}
const exById=id=>{exams();return _ex.find(e=>e.id===(_alias[id]||id))};
const invalidate=()=>{_ex=null};
const exMins=e=>e?.mins||(e?.type==="read"?45:e?.type==="extra"?60:90);
const planned=e=>e&&!e.excluded&&(e.type==="exam"||e.type==="read");
const attemptsOf=id=>S.attempts.filter(a=>(_alias[a.examId]||a.examId)===id);
function status(e){
  if(S.session&&exById(S.session.examId)?.id===e.id)return"doing";
  const at=attemptsOf(e.id);
  if(!at.length)return e.done||S.plan.some(p=>p.examId===e.id&&p.done)?"done":"todo";
  return at[at.length-1].pct<S.settings.target?"review":"done";
}
const ST={todo:["ยังไม่ทำ",""],doing:["กำลังทำ","doing"],done:["เสร็จแล้ว","done"],review:["ควรทำซ้ำ","review"],late:["เลยกำหนด","late"]};
const pill=s=>`<span class="pill ${ST[s][1]}">${ST[s][0]}</span>`;
function subjStats(k){
  const at=S.attempts.filter(a=>a.subj===k&&a.pct!=null);const v=at.map(a=>a.pct);
  const ex=exams().filter(e=>e.subj===k&&planned(e));
  return{n:v.length,avg:avg(v),last:v.at(-1)??null,prev:v.at(-2)??null,first:v[0]??null,total:ex.length,done:ex.filter(e=>status(e)!=="todo").length};
}
const dayAt=d=>S.attempts.filter(a=>a.date===d);
const dayPlan=d=>S.plan.filter(p=>p.date===d);
function itemStatus(p){if(p.done)return"done";if(S.session&&exById(S.session.examId)?.id===exById(p.examId)?.id)return"doing";if(p.date<today())return"late";return"todo"}
function streak(){const s=new Set(S.attempts.map(a=>a.date).concat(S.plan.filter(p=>p.done).map(p=>p.doneDate||p.date)));let d=today(),n=0;if(!s.has(d))d=addDays(d,-1);while(s.has(d)){n++;d=addDays(d,-1)}return n}
function chapterStats(){
  const m={};
  S.attempts.forEach(a=>(a.chapters||[]).forEach(c=>{if(!c.full)return;const k=a.subj+"|"+c.name;(m[k]=m[k]||{subj:a.subj,name:c.name,v:[]}).v.push(c.score/c.full*100)}));
  return Object.values(m).map(x=>({...x,avg:avg(x.v),trend:x.v.length<2?"ข้อมูลยังน้อย":x.v.at(-1)-x.v[0]>=5?"ดีขึ้น":x.v.at(-1)-x.v[0]<=-5?"ลดลง":"คงที่"})).sort((a,b)=>a.avg-b.avg);
}
function reasonStats(){const m={};S.attempts.forEach(a=>(a.reasons||[]).forEach(r=>m[r]=(m[r]||0)+1));return Object.entries(m).sort((a,b)=>b[1]-a[1])}

/* ---------------- planner ---------------- */
function buildPlan(){
  const st=S.settings,t0=today(),from=st.start>t0?st.start:t0;
  const keep=S.plan.filter(p=>p.done||(p.pinned&&p.date>=from));
  const keepIds=new Set(keep.filter(p=>!p.done).map(p=>exById(p.examId)?.id));
  const tasks=[];
  exams().filter(planned).forEach(e=>{const s=status(e);if(s==="done"||keepIds.has(e.id))return;tasks.push({e,kind:s==="review"?"retake":"new",mins:exMins(e)})});
  const pri={};Object.keys(SUBJ).forEach(k=>{const a=subjStats(k).avg;pri[k]=a==null?1.15:1+Math.max(0,st.target-a)/50});
  const groups={};tasks.forEach(t=>(groups[t.e.subj]=groups[t.e.subj]||[]).push(t));
  Object.values(groups).forEach(g=>g.sort((a,b)=>(a.kind==="retake"?0:1)-(b.kind==="retake"?0:1)||(a.e.type==="exam"?0:1)-(b.e.type==="exam"?0:1)||natCmp(a.e.title,b.e.title)));
  const credit={},queue=[];const sumP=Object.keys(groups).reduce((s,k)=>s+pri[k],0)||1;Object.keys(groups).forEach(k=>credit[k]=0);
  while(Object.values(groups).some(g=>g.length)){let b=null;for(const k in groups){if(!groups[k].length)continue;credit[k]+=pri[k];if(!b||credit[k]>credit[b])b=k}credit[b]-=sumP;queue.push(groups[b].shift())}
  const days=[];for(let d=from;d<=st.deadline;d=addDays(d,1)){const w=parseD(d).getDay();if(st.offDays.includes(w))continue;days.push({date:d,cap:(w===0||w===6?st.hWeekend:st.hWeekday)*60,used:0,n:0,subj:{},buffer:false})}
  days.slice(-2).forEach(d=>{if(days.length>4)d.buffer=true});
  keep.filter(p=>!p.done).forEach(p=>{const d=days.find(x=>x.date===p.date);if(d){d.used+=p.mins;d.n++}});
  const work=days.filter(d=>!d.buffer),total=queue.reduce((s,t)=>s+t.mins,0),even=work.length?total/work.length:0;
  const place=(t,pool,cap,lim)=>{for(const d of pool){if(d.n>=st.maxSets||(lim&&(d.subj[t.e.subj]||0)>=2))continue;if(d.used+t.mins<=cap(d)||(d.n===0&&t.mins>d.cap)){d.used+=t.mins;d.n++;d.subj[t.e.subj]=(d.subj[t.e.subj]||0)+1;return d}}return null};
  const placed=[],overflow=[];
  queue.forEach(t=>{const d=place(t,work,x=>Math.min(x.cap,Math.max(even*1.2,60)),true)||place(t,work,x=>x.cap,true)||place(t,work,x=>x.cap,false)||place(t,days.filter(x=>x.buffer),x=>x.cap,false);
    if(d)placed.push({id:uid(),examId:t.e.id,date:d.date,mins:t.mins,kind:t.kind,done:false});else overflow.push(t)});
  const cap=days.reduce((s,d)=>s+d.cap,0);
  return{items:keep.concat(placed).sort((a,b)=>a.date.localeCompare(b.date)),placed,overflow,total,cap,days:days.length,usedBuffer:placed.some(p=>days.find(d=>d.date===p.date)?.buffer)};
}
function planDialog(){
  const r=buildPlan();window.__plan=r;const st=S.settings;
  const need=(r.total/60/Math.max(1,r.days)).toFixed(1);
  openDlg(`<h2 id="dlgTitle">จัดแผนให้จบภายใน ${thD(st.deadline,{day:"numeric",month:"long"})}</h2>
  <div class="grid g2" style="gap:10px">
    <div class="card butter" style="box-shadow:none"><div class="eyebrow">จัดลงตาราง</div><div class="big-num" style="font-size:2.2rem">${r.placed.length}<span>ชุด</span></div></div>
    <div class="card mint" style="box-shadow:none"><div class="eyebrow">เฉลี่ยต่อวัน</div><div class="big-num" style="font-size:2.2rem">${need}<span>ชม.</span></div></div>
  </div>
  ${r.overflow.length?`<p class="result" style="background:var(--pink-soft)">ยังจัดไม่ลง ${r.overflow.length} ชุด เพราะเวลาไม่พอ ลองเพิ่มชั่วโมงต่อวัน (ตอนนี้ ${st.hWeekday}/${st.hWeekend} ชม.) หรือชุดต่อวัน หรือย้ายเอกสารที่ไม่จำเป็นไปเป็น “อ่านเสริม”</p>`
   :r.usedBuffer?`<p class="result">จัดครบทุกชุด แต่ต้องใช้วันสำรองช่วงท้าย ถ้าอยากมีเวลาเผื่อ เพิ่มชั่วโมงต่อวันในตั้งค่าได้</p>`
   :`<p class="result" style="background:var(--mint-soft)">ทันแน่นอน! ทุกชุดจบก่อนเส้นตาย และยังมีวันสำรอง</p>`}
  <p class="small muted" style="margin:0">ระบบสลับวิชาไม่ให้ซ้ำเกิน 2 ชุดต่อวัน วิชาที่คะแนนต่ำกว่าเป้าได้ทำบ่อยขึ้น ชุดที่ได้ต่ำกว่า ${st.target}% จะถูกจัดให้ทำซ้ำ งานที่ทำแล้วและงานที่ย้ายเองจะไม่ถูกแตะ</p>
  <div class="dlg-actions"><button class="btn" data-act="closeDlg" autofocus>ยังก่อน</button><button class="btn pri" data-act="planSave">ใช้แผนนี้</button></div>`);
}

/* ---------------- dialog ---------------- */
const dlg=()=>$("#dlg");
let CONFIRM=null;
// sticky = a form with typed data: no tap-outside dismiss, so a stray tap can't lose a score
function openDlg(html,sticky){const d=dlg();d.setAttribute("closedby",sticky?"closerequest":"any");d.dataset.sticky=sticky?"1":"";$("#dlgBody").innerHTML=html;if(!d.open)d.showModal();const a=$("#dlgBody [autofocus]");if(a)a.focus()}
function closeDlg(){if(dlg().open)dlg().close()}
dlg().addEventListener("cancel",e=>{if(dlg().dataset.sticky){e.preventDefault();toast("กด “ยกเลิก” หรือ “บันทึก” เพื่อปิดหน้านี้")}});
function confirmDlg(title,body,ok,fn){CONFIRM=fn;openDlg(`<h2 id="dlgTitle">${esc(title)}</h2><p style="margin:0">${body}</p><div class="dlg-actions"><button class="btn" data-act="closeDlg" autofocus>ยกเลิก</button><button class="btn danger" data-act="confirmOk">${esc(ok)}</button></div>`)}
// light dismiss for browsers without <dialog closedby> (Safari / iPad / iPhone)
if(!("closedBy" in HTMLDialogElement.prototype)){
  const outside=(e,d)=>{const r=d.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom};
  let down=false;const d=document.getElementById("dlg");
  d.addEventListener("pointerdown",e=>{down=outside(e,d)});
  d.addEventListener("pointerup",e=>{if(down&&outside(e,d)&&!d.dataset.sticky)d.close()});
}

/* ---------------- views ---------------- */
const VIEWS={};
const TITLES={today:"วันนี้",exams:"คลังข้อสอบ",timer:"จับเวลา",notes:"สมุดสรุป",progress:"คะแนน"};
const CHEERS=["วันนี้อ่านนิดเดียวก็ยังดีกว่าไม่อ่านเลยนะ","ค่อย ๆ ไปทีละชุด เดี๋ยวก็ครบ","ข้อที่ผิดวันนี้ คือข้อที่ถูกในวันสอบ","เหนื่อยก็พักได้ แต่อย่าเลิกนะ","เตรียมอุดมฯ รออยู่ ไปด้วยกัน!","เก่งขึ้นทุกวัน แม้จะมองไม่เห็นก็ตาม"];
function greet(){const h=new Date().getHours();return h<12?"สวัสดีตอนเช้า":h<17?"สวัสดีตอนบ่าย":"สวัสดีตอนเย็น"}
function taskRow(p){
  const e=exById(p.examId);if(!e)return"";const s=itemStatus(p);
  return `<div class="task ${p.done?"done":""}">${subjTag(e.subj)}<div class="t"><b>${esc(e.title)}</b><span>${SUBJ[e.subj].name} · ${fmtMin(p.mins)}${p.kind==="retake"?" · ทำซ้ำ":""}${p.date!==today()?" · "+thD(p.date):""}</span></div>
  ${p.done?`<span class="pill done">เสร็จ ✓</span>`:`${s==="late"?pill("late"):""}<button class="btn sm pri" data-act="startExam" data-id="${e.id}">${e.type==="read"?"อ่าน":"เริ่ม"}</button><button class="btn sm ghost" data-act="taskMenu" data-id="${p.id}" aria-label="จัดการงานนี้">⋯</button>`}</div>`;
}
VIEWS.today=()=>{
  const t=today(),st=S.settings;const items=dayPlan(t);const late=S.plan.filter(p=>!p.done&&p.date<t);
  const left=diffDays(t,st.deadline),examLeft=diffDays(t,st.examDate);
  const td=dayAt(t),yd=dayAt(addDays(t,-1));const tAvg=avg(td.map(a=>a.pct)),yAvg=avg(yd.map(a=>a.pct));
  const mins=td.reduce((s,a)=>s+(a.mins||0),0);
  const next7=[];for(let i=1;i<=7;i++){const d=addDays(t,i);const it=dayPlan(d);if(it.length)next7.push([d,it])}
  const subs=Object.keys(SUBJ).filter(k=>exams().some(e=>e.subj===k&&planned(e)));
  return `<div class="hero">
    <div class="card pink hello"><div class="eyebrow">${greet()}</div><h1>${NAME}<em> สู้ ๆ นะ!</em></h1><p>${CHEERS[new Date().getDate()%CHEERS.length]}</p><svg viewBox="0 0 64 64" aria-hidden="true"><use href="#bunny"/></svg></div>
    <div class="card butter"><div class="eyebrow">ทำคลังข้อสอบให้จบใน</div><div class="big-num">${Math.max(0,left)}<span>วัน</span></div><div class="small muted">ถึง ${thD(st.deadline,{day:"numeric",month:"long"})} · วันสอบจริงอีก ${Math.max(0,examLeft)} วัน · ต่อเนื่อง ${streak()} วัน</div></div>
  </div>
  ${!S.catalog.items.length?`<div class="card sky empty"><b>ยังไม่มีรายการข้อสอบ</b><span>กดเพื่ออ่านรายชื่อไฟล์จากโฟลเดอร์ใน Google Drive</span><button class="btn pri" data-act="sync">อ่านไฟล์จาก Drive</button></div>`
   :!S.plan.length?`<div class="card sky empty"><b>มีข้อสอบ ${exams().filter(planned).length} ชุดแล้ว</b><span>ให้ระบบจัดตารางว่าแต่ละวันทำชุดไหน ให้จบภายใน 31 ธ.ค.</span><button class="btn pri" data-act="plan">จัดแผนให้เลย</button></div>`:""}
  ${late.length?`<div class="card pink row between"><span><b>มีงานค้าง ${late.length} ชุด</b> <span class="small muted">จากวันก่อน ๆ</span></span><span class="row"><button class="btn sm" data-act="lateToday">ย้ายมาวันนี้</button><button class="btn sm pri" data-act="plan">จัดแผนใหม่</button></span></div>`:""}
  <div class="grid g2">
    <div class="card"><div class="sec-h"><h2>ภารกิจวันนี้</h2><span class="pill">${items.filter(p=>p.done).length}/${items.length} ชุด</span></div>
      <div class="stack" style="margin-top:12px">${items.length?items.map(taskRow).join(""):`<div class="empty">วันนี้ไม่มีงานในแผน พักผ่อน หรือไปทวนสมุดสรุปก็ได้นะ<a class="btn sm" href="#notes">เปิดสมุดสรุป</a></div>`}</div></div>
    <div class="card mint"><h2>สรุปวันนี้</h2>
      <div class="grid g2" style="gap:10px;margin-top:10px">
        <div><div class="eyebrow">ทำไปแล้ว</div><div class="big-num" style="font-size:2rem">${td.length}<span>ชุด</span></div></div>
        <div><div class="eyebrow">เวลาฝึก</div><div class="big-num" style="font-size:2rem">${Math.round(mins)}<span>นาที</span></div></div>
      </div>
      <p style="margin:.6rem 0 0">${tAvg==null?"ยังไม่ได้บันทึกคะแนนวันนี้":yAvg==null?`คะแนนเฉลี่ยวันนี้ ${pct(tAvg)}`:`คะแนนเฉลี่ย ${pct(yAvg)} → <b>${pct(tAvg)}</b> ${tAvg>=yAvg?"ดีขึ้นจากเมื่อวาน เก่งมาก!":"ลดลงจากเมื่อวานนิดหน่อย ไม่เป็นไรนะ ดูจุดที่ผิดในหน้าคะแนน"}`}</p>
      <a class="btn sm" href="#progress" style="margin-top:10px">ดูพัฒนาการ</a></div>
  </div>
  <div class="card"><h2 style="margin-bottom:10px">ความคืบหน้าแต่ละวิชา</h2><div class="stack">${subs.map(k=>{const s=subjStats(k);return `<div class="prog">${subjTag(k)}<div><div class="row between small"><b>${SUBJ[k].name}</b><span class="muted num">${s.done}/${s.total} · เฉลี่ย ${pct(s.avg)}</span></div><div class="bar"><i style="width:${s.total?s.done/s.total*100:0}%;background:${SUBJ[k].c}"></i></div></div></div>`}).join("")||`<span class="muted small">ยังไม่มีข้อมูล</span>`}</div></div>
  ${next7.length?`<details class="card"><summary style="cursor:pointer;min-height:44px;display:flex;align-items:center"><h2>7 วันข้างหน้า</h2></summary><div class="stack" style="margin-top:10px">${next7.map(([d,it])=>`<div><div class="eyebrow">${thD(d,{weekday:"long",day:"numeric",month:"short"})}</div><div class="stack" style="margin-top:6px">${it.map(taskRow).join("")}</div></div>`).join("")}</div></details>`:""}`;
};

VIEWS.exams=()=>{
  const q=UI.exQ.trim().toLowerCase();
  let L=exams().filter(e=>(!UI.exSubj||e.subj===UI.exSubj)&&(UI.exType==="all"||e.type===UI.exType)&&(!q||(e.title+e.topic).toLowerCase().includes(q)));
  L.sort((a,b)=>a.subj.localeCompare(b.subj)||natCmp(a.topic,b.topic)||natCmp(a.title,b.title));
  const subs=Object.keys(SUBJ).filter(k=>exams().some(e=>e.subj===k));
  const synced=S.catalog.syncedAt?new Date(S.catalog.syncedAt).toLocaleString("th-TH",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"ยังไม่เคย";
  return `<div class="sec-h"><div><div class="eyebrow">อ่านจาก Google Drive ล่าสุด ${synced}</div><h2>${exams().length} ไฟล์ในคลัง</h2></div><button class="btn sm" data-act="sync">อัปเดตจาก Drive</button></div>
  <input class="search" type="search" id="exQ" placeholder="ค้นหาชื่อชุด…" value="${esc(UI.exQ)}" aria-label="ค้นหาข้อสอบ">
  <div class="chips" role="group" aria-label="วิชา"><button class="chip" data-act="exSubj" data-k="" aria-pressed="${!UI.exSubj}">ทุกวิชา</button>${subs.map(k=>`<button class="chip" data-act="exSubj" data-k="${k}" aria-pressed="${UI.exSubj===k}">${SUBJ[k].name}</button>`).join("")}</div>
  <div class="chips" role="group" aria-label="ประเภท">${[["exam","ข้อสอบ"],["read","อ่าน/สรุป"],["extra","อ่านเสริม"],["ans","เฉลย"],["all","ทั้งหมด"]].map(([k,l])=>`<button class="chip" data-act="exType" data-k="${k}" aria-pressed="${UI.exType===k}">${l} (${exams().filter(e=>(k==="all"||e.type===k)&&(!UI.exSubj||e.subj===UI.exSubj)).length})</button>`).join("")}</div>
  <div class="list">${L.map(e=>{const at=attemptsOf(e.id);const s=status(e);return `<div class="erow" style="${e.excluded?"opacity:.55":""}">${subjTag(e.subj)}<div class="t"><b>${esc(e.title)}</b><span>${esc(e.topic)}${at.length?` · ทำ ${at.length} ครั้ง · ล่าสุด ${pct(at.at(-1).pct)}`:""}${e.dups?.length?` · มีไฟล์ซ้ำ ${e.dups.length}`:""}${e.excluded?" · ไม่นับในแผน":""}</span></div>
    <div class="acts">${planned(e)?pill(s):""}<a class="btn sm" href="https://drive.google.com/file/d/${encodeURIComponent(e.id)}/view" target="_blank" rel="noopener">เปิดไฟล์</a>${e.type!=="ans"?`<button class="btn sm pri" data-act="startExam" data-id="${e.id}">เริ่ม</button>`:""}<button class="btn sm ghost" data-act="editExam" data-id="${e.id}" aria-label="แก้ไข ${esc(e.title)}">⋯</button></div></div>`}).join("")||`<div class="card empty">${S.catalog.items.length?"ไม่พบไฟล์ตามตัวกรองนี้":"ยังไม่ได้อ่านไฟล์จาก Drive"}<button class="btn sm pri" data-act="sync">อ่านไฟล์จาก Drive</button></div>`}</div>
  <p class="small muted">ระบบเดาวิชาจากชื่อโฟลเดอร์ และเดาประเภทจากชื่อไฟล์ ถ้าไม่ตรงกด ⋯ เพื่อแก้ ไฟล์ชื่อเดียวกันและขนาดเท่ากันจะรวมเป็นชุดเดียว</p>`;
};

/* ---------- timer ---------- */
const sessElapsed=()=>S.session?S.session.segs.reduce((t,[a,b])=>t+((b??Date.now())-a),0):0;
let POMO={preset:25,mode:"focus",left:25*60,total:25*60,run:false,endAt:0};
VIEWS.timer=()=>{
  const seg=`<div class="seg" role="group" aria-label="โหมดจับเวลา"><button data-act="tmMode" data-k="exam" aria-pressed="${UI.timerMode==="exam"}">ทำข้อสอบ</button><button data-act="tmMode" data-k="pomo" aria-pressed="${UI.timerMode==="pomo"}">Pomodoro</button></div>`;
  if(UI.timerMode==="pomo"){
    const r=120,c=2*Math.PI*r,p=POMO.left/POMO.total;
    return `<div class="row" style="justify-content:center">${seg}</div><div class="card timer">
      <div class="chips" style="justify-content:center">${[25,50].map(k=>`<button class="chip" data-act="pomoPreset" data-k="${k}" aria-pressed="${POMO.preset===k}">${k} + ${k===25?5:10} นาที</button>`).join("")}</div>
      <svg viewBox="0 0 280 280" role="img" aria-label="นาฬิกา Pomodoro"><circle cx="140" cy="140" r="${r}" fill="var(--paper)" stroke="var(--hair)" stroke-width="18"/><circle id="arc" cx="140" cy="140" r="${r}" fill="none" stroke="${POMO.mode==="focus"?"var(--pink)":"var(--mint)"}" stroke-width="18" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c*(1-p)}" transform="rotate(-90 140 140)"/><text id="tnum" class="tnum" x="140" y="150" text-anchor="middle">${pad(Math.floor(POMO.left/60))}:${pad(POMO.left%60)}</text><text class="tlab" x="140" y="186" text-anchor="middle">${POMO.mode==="focus"?"โฟกัส":"พักผ่อน"}</text></svg>
      <div class="row" style="justify-content:center"><button class="btn ${POMO.run?"y":"pri"}" data-act="pomoGo">${POMO.run?"หยุดชั่วคราว":"เริ่มเลย"}</button><button class="btn" data-act="pomoReset">เริ่มใหม่</button></div>
      <p class="muted" style="margin:0">วันนี้โฟกัสไปแล้ว <b class="num" style="color:var(--ink)">${S.nb.pomo[today()]||0}</b> รอบ</p></div>`;
  }
  const s=S.session;const ex=exams().filter(e=>e.type!=="ans");
  const cur=s?.examId||UI.timerExam||dayPlan(today()).find(p=>!p.done)?.examId||"";
  const e=exById(cur);const plan=(e?exMins(e):60)*60000;const el=sessElapsed();const p=clamp(el/plan,0,1);
  const r=120,c=2*Math.PI*r;
  return `<div class="row" style="justify-content:center">${seg}</div>
  <div class="card timer">
    <label class="f" style="width:100%;max-width:520px;text-align:left">ชุดที่จะทำ<select id="tmEx" ${s?"disabled":""}><option value="">— เลือกชุดข้อสอบ —</option>${ex.map(x=>`<option value="${x.id}" ${x.id===e?.id?"selected":""}>${esc(SUBJ[x.subj].name)} · ${esc(x.title)}</option>`).join("")}</select></label>
    ${e?`<a class="btn sm" href="https://drive.google.com/file/d/${encodeURIComponent(e.id)}/view" target="_blank" rel="noopener">เปิดไฟล์ข้อสอบ ↗</a>`:""}
    <svg viewBox="0 0 280 280" role="img" aria-label="เวลาที่ใช้"><circle cx="140" cy="140" r="${r}" fill="var(--paper)" stroke="var(--hair)" stroke-width="18"/><circle id="arc" cx="140" cy="140" r="${r}" fill="none" stroke="${el>plan?"var(--bad)":"var(--pink)"}" stroke-width="18" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c*(1-p)}" transform="rotate(-90 140 140)"/><text id="tnum" class="tnum" x="140" y="150" text-anchor="middle">${clock(el)}</text><text class="tlab" x="140" y="186" text-anchor="middle">${s?(s.status==="running"?"กำลังจับเวลา":"พักอยู่"):"แนะนำ "+fmtMin(plan/60000)}</text></svg>
    <div class="row" style="justify-content:center">
      ${!s?`<button class="btn pri big" data-act="tStart" ${e?"":"disabled"}>เริ่มทำ</button>`:""}
      ${s?.status==="running"?`<button class="btn y" data-act="tPause">พัก</button>`:""}
      ${s?.status==="paused"?`<button class="btn pri" data-act="tResume">ทำต่อ</button>`:""}
      ${s?`<button class="btn ok" data-act="tFinish">เสร็จแล้ว บันทึกคะแนน</button><button class="btn danger" data-act="tReset">ยกเลิก</button>`:""}
    </div>
    <p class="small muted" style="margin:0">เวลาเดินต่อแม้ปิดหน้าจอ สลับแอป หรือเปิดจากอีกเครื่อง (บันทึกใน Drive)</p>
  </div>`;
};
let wake=null;
async function keepAwake(on){try{if(on&&navigator.wakeLock&&!wake){wake=await navigator.wakeLock.request("screen");wake.addEventListener("release",()=>wake=null)}if(!on&&wake){await wake.release();wake=null}}catch{wake=null}}
function chime(){try{const C=new(window.AudioContext||window.webkitAudioContext)();[0,.18,.36].forEach((t,i)=>{const o=C.createOscillator(),g=C.createGain();o.frequency.value=[784,988,1175][i];g.gain.setValueAtTime(.0001,C.currentTime+t);g.gain.exponentialRampToValueAtTime(.25,C.currentTime+t+.02);g.gain.exponentialRampToValueAtTime(.0001,C.currentTime+t+.5);o.connect(g).connect(C.destination);o.start(C.currentTime+t);o.stop(C.currentTime+t+.55)})}catch{}}
setInterval(()=>{
  if(VIEW!=="timer")return;const n=$("#tnum"),a=$("#arc");if(!n||!a)return;const c=2*Math.PI*120;
  if(UI.timerMode==="exam"&&S.session){const e=exById(S.session.examId);const plan=exMins(e)*60000;const el=sessElapsed();n.textContent=clock(el);a.setAttribute("stroke-dashoffset",c*(1-clamp(el/plan,0,1)));if(el>plan)a.setAttribute("stroke","var(--bad)")}
  if(UI.timerMode==="pomo"&&POMO.run){POMO.left=Math.max(0,Math.round((POMO.endAt-Date.now())/1000));n.textContent=`${pad(Math.floor(POMO.left/60))}:${pad(POMO.left%60)}`;a.setAttribute("stroke-dashoffset",c*(1-POMO.left/POMO.total));
    if(POMO.left<=0){POMO.run=false;chime();keepAwake(false);if(POMO.mode==="focus"){S.nb.pomo={[today()]:(S.nb.pomo[today()]||0)+1};save();setPomo("break");toast(`ครบรอบโฟกัสแล้ว พักก่อนนะ ${NAME}`)}else{setPomo("focus");toast("หมดเวลาพัก กลับมาลุยต่อกัน!")}render()}}
},500);
function setPomo(m){POMO.mode=m;POMO.total=(m==="focus"?POMO.preset:(POMO.preset===25?5:10))*60;POMO.left=POMO.total}

/* ---------- score form ---------- */
function scoreDialog(examId,mins){
  const e=exById(examId);const ex=exams().filter(x=>x.type!=="ans");
  const prev=e?attemptsOf(e.id).at(-1):null;
  window.__chapters=(prev?.chapters||[]).map(c=>({name:c.name,score:"",full:c.full}));
  openDlg(`<h2 id="dlgTitle">บันทึกคะแนน</h2>
  <label class="f">ชุดข้อสอบ<select id="sEx">${ex.map(x=>`<option value="${x.id}" ${x.id===e?.id?"selected":""}>${esc(SUBJ[x.subj].name)} · ${esc(x.title)}</option>`).join("")}</select></label>
  <div class="f2">
    <label class="f">ได้ (ข้อ/คะแนน)<input type="number" inputmode="decimal" id="sScore" min="0" step="any" autofocus></label>
    <label class="f">เต็ม<input type="number" inputmode="decimal" id="sFull" min="0" step="any" value="${prev?.full??e?.q??""}"></label>
    <label class="f">ใช้เวลา (นาที)<input type="number" inputmode="numeric" id="sMins" min="0" value="${mins??""}"></label>
    <label class="f">วันที่<input type="date" id="sDate" value="${today()}"></label>
  </div>
  <div class="result" id="sRes">กรอกคะแนนแล้วระบบจะคิดเปอร์เซ็นต์ให้</div>
  <details ${window.__chapters.length?"open":""}><summary style="cursor:pointer;min-height:44px;display:flex;align-items:center;font-weight:600">แยกคะแนนตามบท / พาร์ท (ไม่บังคับ)</summary><div id="chapRows" class="stack" style="margin-top:8px"></div><button class="btn sm" type="button" data-act="chapAdd" style="margin-top:8px">+ เพิ่มบท</button></details>
  <label class="f">ข้อที่ผิด (ถ้าจำได้)<input type="text" id="sWrong" placeholder="เช่น 3, 7, 12-15"></label>
  <div class="f" role="group" aria-label="ผิดเพราะอะไร"><span class="small" style="font-weight:600">ส่วนใหญ่ผิดเพราะ (เลือกได้หลายข้อ)</span><div class="reasons">${REASONS.map((r,i)=>`<label><input type="checkbox" value="${esc(r)}" id="rs${i}">${esc(r)}</label>`).join("")}</div></div>
  <label class="f">โน้ตถึงตัวเอง<input type="text" id="sNote" placeholder="เช่น พาร์ท Reading ทำไม่ทัน"></label>
  <div class="dlg-actions"><button class="btn" data-act="closeDlg">ยกเลิก</button><button class="btn pri" data-act="scoreSave">บันทึก</button></div>`,true);
  drawChapters();calcScore();
}
function drawChapters(){
  const box=$("#chapRows");if(!box)return;
  box.innerHTML=window.__chapters.map((c,i)=>`<div class="row" style="flex-wrap:nowrap"><input type="text" placeholder="ชื่อบท" value="${esc(c.name)}" data-ch="${i}" data-k="name" aria-label="ชื่อบท ${i+1}" style="flex:2"><input type="number" inputmode="decimal" placeholder="ได้" value="${c.score}" data-ch="${i}" data-k="score" aria-label="คะแนนบท ${i+1}" style="flex:1"><input type="number" inputmode="decimal" placeholder="เต็ม" value="${c.full}" data-ch="${i}" data-k="full" aria-label="คะแนนเต็มบท ${i+1}" style="flex:1"><button class="btn sm ghost" type="button" data-act="chapDel" data-i="${i}" aria-label="ลบบท ${i+1}">×</button></div>`).join("");
}
function scoreValues(){
  const ch=window.__chapters.filter(c=>c.name&&c.full!==""&&c.score!=="");
  let score=parseFloat($("#sScore").value),full=parseFloat($("#sFull").value);
  if(ch.length){score=ch.reduce((s,c)=>s+(+c.score||0),0);full=ch.reduce((s,c)=>s+(+c.full||0),0)}
  return{score,full,ch,pct:full>0&&isFinite(score)?score/full*100:null};
}
function calcScore(){
  const v=scoreValues();const r=$("#sRes");if(!r)return;
  if(v.ch.length){$("#sScore").value=v.score;$("#sFull").value=v.full}
  r.textContent=v.pct==null?"กรอกคะแนนแล้วระบบจะคิดเปอร์เซ็นต์ให้":`${v.score}/${v.full} = ${Math.round(v.pct*10)/10}% ${v.pct>=S.settings.target?"ผ่านเป้า เก่งมาก!":"ยังต่ำกว่าเป้า "+S.settings.target+"% ระบบจะจัดให้ทำซ้ำ"}`;
}
function parseNums(s){const out=[];(s||"").split(/[,\s]+/).forEach(p=>{const m=p.match(/^(\d+)-(\d+)$/);if(m){for(let i=+m[1];i<=+m[2]&&out.length<300;i++)out.push(i)}else if(/^\d+$/.test(p))out.push(+p)});return out}

/* ---------- notebook ---------- */
const PRI_LABEL={HIGH:"สำคัญมาก",MEDIUM:"สำคัญ",LOW:"เสริม"};
function nbSubj(id){return SUBJ[NB_SUBJ[id]]||SUBJ.oth}
VIEWS.notes=()=>{
  if(!NB)return `<div class="card empty">กำลังโหลดสมุดสรุป…</div>`;
  const seg=`<div class="seg" role="group" aria-label="ส่วนของสมุด">${[["topics","สรุปเนื้อหา"],["quiz","ข้อสอบจำลอง"],["cards","การ์ดสูตร"]].map(([k,l])=>`<button data-act="nbTab" data-k="${k}" aria-pressed="${UI.nbTab===k}">${l}</button>`).join("")}</div>`;
  const subjChips=(cur,act)=>`<div class="chips" role="group" aria-label="วิชา"><button class="chip" data-act="${act}" data-k="all" aria-pressed="${cur==="all"}">ทุกวิชา</button>${NB.subjects.map(s=>`<button class="chip" data-act="${act}" data-k="${s.id}" aria-pressed="${cur===s.id}">${esc(s.nameTh)}</button>`).join("")}</div>`;
  if(UI.nbTab==="quiz")return `<div class="row" style="justify-content:center">${seg}</div>`+quizView(subjChips);
  if(UI.nbTab==="cards")return `<div class="row" style="justify-content:center">${seg}</div>`+cardsView(subjChips);
  const L=NB.topics.filter(t=>UI.nbSubj==="all"||t.subjectId===UI.nbSubj);
  const done=NB.topics.filter(t=>S.nb.done[t.id]).length;
  return `<div class="row" style="justify-content:center">${seg}</div>
  <div class="card lilac row between"><span><b>อ่านจบแล้ว ${done}/${NB.topics.length} หัวข้อ</b><br><span class="small muted">แตะหัวข้อเพื่ออ่านสรุป สูตร และเทคนิคจำ</span></span><span class="pill">ข้อที่เคยผิดรอทวน ${S.nb.wrong.length}</span></div>
  ${subjChips(UI.nbSubj,"nbSubj")}
  <div class="grid g3">${L.map(t=>{const s=nbSubj(t.subjectId);return `<a class="card" href="#topic-${encodeURIComponent(t.id)}" style="text-decoration:none;display:flex;flex-direction:column;gap:8px;${S.nb.done[t.id]?"background:var(--mint-soft)":""}"><div class="row between"><span class="tag" style="background:${s.c}">${s.g}</span><span class="pill">${PRI_LABEL[t.priority]||""}</span></div><h3 style="font-size:1.05rem">${esc(t.title)}</h3><span class="small muted">${t.estimatedMinutes} นาที${S.nb.star[t.id]?" · ★":""}${S.nb.done[t.id]?" · อ่านจบแล้ว ✓":""}</span></a>`}).join("")}</div>`;
};
function topicView(id){
  const t=NB?.topics.find(x=>x.id===id);if(!t)return `<div class="card empty">ไม่พบหัวข้อนี้<a class="btn sm" href="#notes">กลับ</a></div>`;
  const s=nbSubj(t.subjectId);const list=a=>`<ul class="dots" style="--dotc:${s.c}">${(a||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`;
  const w=t.workedExample;
  return `<a class="btn sm" href="#notes" style="align-self:flex-start">‹ กลับไปสมุดสรุป</a>
  <div class="card" style="background:${s.s}"><div class="eyebrow">${esc(NB.subjects.find(x=>x.id===t.subjectId)?.nameTh)} · ประมาณ ${t.estimatedMinutes} นาที</div><h1 style="font-size:clamp(1.4rem,3.6vw,2rem)">${esc(t.title)}</h1><p class="small" style="margin:.4rem 0 0">${esc(t.recommendationReason)}</p></div>
  <div class="card"><h2 style="margin-bottom:10px">สรุปสั้น ๆ</h2>${list(t.summaryBullets)}</div>
  <div class="card"><h2 style="margin-bottom:8px">หลักการสำคัญ</h2><p style="margin:0">${esc(t.principles)}</p></div>
  ${t.comparisonTable?`<div class="card"><h2 style="margin-bottom:10px">${esc(t.comparisonTable.title)}</h2><div class="tbl" role="region" aria-label="${esc(t.comparisonTable.title)}" tabindex="0"><table><thead><tr>${t.comparisonTable.headers.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${t.comparisonTable.rows.map(r=>`<tr>${r.map(x=>`<td>${esc(x)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`:""}
  ${t.formulas?.length?`<div class="card"><h2 style="margin-bottom:10px">สูตร / กฎที่ต้องจำ</h2><div class="grid g2" style="gap:10px">${t.formulas.map(f=>`<div class="formula"><b>${esc(f.name)}</b><code>${esc(f.formula)}</code>${f.note?`<span class="small muted">${esc(f.note)}</span>`:""}</div>`).join("")}</div></div>`:""}
  ${t.vocabulary?.length?`<div class="card"><h2 style="margin-bottom:10px">คำศัพท์สำคัญ</h2><div class="grid g2" style="gap:10px">${t.vocabulary.map(v=>`<div class="formula" style="background:var(--peach-soft)"><b>${esc(v.term)}</b><span>${esc(v.meaning)}</span>${v.usage?`<span class="small muted">${esc(v.usage)}</span>`:""}</div>`).join("")}</div></div>`:""}
  <div class="card mint"><h2 style="margin-bottom:10px">เทคนิคช่วยจำ</h2>${list(t.memoryTechniques)}</div>
  <div class="card pink"><h2 style="margin-bottom:10px">จุดที่มักพลาด</h2>${list(t.commonMistakes)}</div>
  ${w?`<div class="card lilac"><h2 style="margin-bottom:8px">ลองคิดก่อนดูเฉลย</h2><p style="margin:0;font-weight:600">${esc(w.problem)}</p><details style="margin-top:10px"><summary class="btn sm y" style="list-style:none">ดูวิธีคิด</summary><ol>${(w.thinkingSteps||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ol><p style="margin:0">${esc(w.solution)}</p><p style="margin:.4rem 0 0"><b>คำตอบ:</b> ${esc(w.answer)}</p></details></div>`:""}
  <div class="card butter"><h2 style="margin-bottom:10px">โน้ตก่อนเข้าห้องสอบ</h2>${list(t.quickCramNotes)}</div>
  <div class="card"><div class="row"><button class="btn ${S.nb.done[t.id]?"":"ok"}" data-act="nbDone" data-id="${esc(t.id)}">${S.nb.done[t.id]?"ยกเลิกอ่านจบ":"อ่านจบแล้ว ✓"}</button><button class="btn" data-act="nbStar" data-id="${esc(t.id)}">${S.nb.star[t.id]?"★ ปักดาวแล้ว":"☆ ปักดาวไว้อ่านซ้ำ"}</button>${NB.questions.some(q=>q.topicId===t.id)?`<button class="btn pri" data-act="quizTopic" data-id="${esc(t.id)}">ทำข้อสอบเรื่องนี้</button>`:""}</div><p class="small muted" style="margin:.6rem 0 0">อ้างอิง: ${esc(t.sourceTitle)}</p></div>`;
}
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function quizView(chips){
  const Q=UI.quiz;
  if(!Q)return `${chips(UI.nbSubj,"nbSubj")}<div class="card pink stack"><h2>ข้อสอบจำลองจากสมุดสรุป</h2><p style="margin:0">ตอบแล้วเห็นเฉลยทันที ข้อที่ผิดจะเก็บไว้ให้ทวน</p><div class="row"><button class="btn pri" data-act="quizGo" data-n="10">เริ่ม 10 ข้อ</button><button class="btn" data-act="quizGo" data-n="5">5 ข้อ</button>${S.nb.wrong.length?`<button class="btn y" data-act="quizWrong">ทวนข้อที่เคยผิด (${S.nb.wrong.length})</button>`:""}</div></div>`;
  if(Q.i>=Q.qs.length){const c=Q.ans.filter(Boolean).length;return `<div class="card butter timer"><div class="eyebrow">${esc(Q.label)}</div><div class="big-num">${c}<span>/ ${Q.qs.length}</span></div><p style="margin:0">${c/Q.qs.length>=.8?`เก่งมาก ${NAME}!`:c/Q.qs.length>=.5?"ดีแล้ว ทวนข้อที่ผิดอีกนิดนะ":"ไม่เป็นไรนะ ข้อที่ผิดเก็บไว้ให้ทวนแล้ว"}</p><button class="btn pri" data-act="quizEnd">เสร็จแล้ว</button></div>`}
  const q=Q.qs[Q.i];const picked=Q.picked;
  return `<div class="card stack"><div class="row between"><span class="eyebrow">${esc(Q.label)} · ข้อ ${Q.i+1}/${Q.qs.length}</span><button class="btn sm ghost" data-act="quizEnd">ออก</button></div>
  <div class="bar"><i style="width:${Q.i/Q.qs.length*100}%"></i></div>
  <h2 style="font-family:var(--f-body);font-weight:600;font-size:1.15rem;line-height:1.6">${esc(q.questionText)}</h2>
  <div class="stack">${q.choices.map((ch,i)=>`<button class="choice ${picked!=null?(i===q.correctIndex?"right":i===picked?"wrong":""):""}" data-act="quizPick" data-i="${i}" ${picked!=null?"disabled":""}><span class="k">${"กขคง"[i]||i+1}</span><span>${esc(ch)}</span></button>`).join("")}</div>
  ${picked!=null?`<div class="result"><b>${picked===q.correctIndex?"ถูกต้อง เก่งมาก!":"ยังไม่ถูกนะ ไม่เป็นไร"}</b><div style="font-weight:400;margin-top:4px">${esc(q.explanation)}</div></div><div class="row" style="justify-content:flex-end"><button class="btn pri" data-act="quizNext">${Q.i+1<Q.qs.length?"ข้อต่อไป ›":"ดูคะแนน"}</button></div>`:""}</div>`;
}
function cardsView(chips){
  const L=NB.knowledge.filter(k=>UI.cardSubj==="all"||k.subjectId===UI.cardSubj);if(UI.cardI>=L.length)UI.cardI=0;const k=L[UI.cardI];
  if(!k)return chips(UI.cardSubj,"cardSubj")+`<div class="card empty">ยังไม่มีการ์ดในวิชานี้</div>`;
  const s=nbSubj(k.subjectId);
  return `${chips(UI.cardSubj,"cardSubj")}<div class="flip" id="flip" role="button" tabindex="0" aria-label="แตะเพื่อพลิกการ์ด"><div class="in"><div class="face front" style="background:${s.s}"><span class="pill">${esc(k.category||"")}</span><h2>${esc(k.title)}</h2><span class="small muted">นึกคำตอบในใจก่อน แล้วแตะเพื่อพลิก</span></div><div class="face back"><h3>${esc(k.title)}</h3><code>${esc(k.expression)}</code><div>${esc(k.explanation)}</div>${k.example?`<div class="small muted"><b>ตัวอย่าง:</b> ${esc(k.example)}</div>`:""}</div></div></div>
  <div class="row" style="justify-content:center"><button class="btn" data-act="card" data-n="-1" aria-label="การ์ดก่อนหน้า">‹</button><span class="num muted">${UI.cardI+1} / ${L.length}</span><button class="btn pri" data-act="card" data-n="1" aria-label="การ์ดถัดไป">›</button></div>`;
}

/* ---------- progress ---------- */
function lineChart(series,n){
  if(!n)return `<div class="empty small">บันทึกคะแนนอย่างน้อย 2 ครั้ง กราฟจะขึ้นตรงนี้</div>`;
  const W=600,H=200,L=30,R=12,T=12,B=24,iw=W-L-R,ih=H-T-B;const x=i=>L+(n===1?iw/2:i*iw/(n-1)),y=v=>T+ih-v/100*ih;
  let g="";[0,50,100].forEach(v=>g+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--hair)" stroke-width="1.5"/><text x="${L-6}" y="${y(v)+4}" text-anchor="end">${v}</text>`);
  g+=`<line x1="${L}" x2="${W-R}" y1="${y(S.settings.target)}" y2="${y(S.settings.target)}" stroke="var(--pink)" stroke-dasharray="5 5"/>`;
  series.forEach(s=>{const pts=s.v.map((v,i)=>[x(i),y(v)]);if(pts.length>1)g+=`<polyline points="${pts.map(p=>p.join(",")).join(" ")}" fill="none" stroke="${s.c}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;pts.forEach((p,i)=>g+=`<circle cx="${p[0]}" cy="${p[1]}" r="${i===pts.length-1?5.5:3.5}" fill="${s.c}" stroke="var(--line)" stroke-width="1.5"><title>${s.name} ${Math.round(s.v[i])}%</title></circle>`)});
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="กราฟคะแนนแต่ละครั้ง">${g}</svg><div class="legend">${series.map(s=>`<span><i style="background:${s.c}"></i>${s.name}</span>`).join("")}<span><i style="background:var(--pink-soft);border-style:dashed"></i>เป้า ${S.settings.target}%</span></div>`;
}
VIEWS.progress=()=>{
  const ks=Object.keys(SUBJ).filter(k=>S.attempts.some(a=>a.subj===k));
  const series=ks.map(k=>({name:SUBJ[k].name,c:SUBJ[k].c,v:S.attempts.filter(a=>a.subj===k).slice(-10).map(a=>a.pct)}));
  const n=Math.max(0,...series.map(s=>s.v.length));
  const ch=chapterStats(),rs=reasonStats();
  const weak=ch.filter(c=>c.avg<S.settings.target).slice(0,4);
  const hist=S.attempts.slice().reverse().slice(0,40);
  return `<div class="row between"><button class="btn pri big" data-act="scoreNew">+ บันทึกคะแนน</button><button class="btn" data-act="askAI">ถาม AI ช่วยวิเคราะห์</button></div>
  ${!S.attempts.length?`<div class="card empty"><b>ยังไม่มีคะแนน</b><span>ทำข้อสอบในหน้า “จับเวลา” แล้วกดเสร็จ หรือกด “บันทึกคะแนน” ได้เลย</span></div>`:`
  <div class="grid g2">${ks.map(k=>{const s=subjStats(k);const d=s.prev==null?null:s.last-s.prev;return `<div class="card" style="background:${SUBJ[k].s}"><div class="row">${subjTag(k)}<h2 style="font-size:1.15rem">${SUBJ[k].name}</h2></div><div class="row between" style="margin-top:8px"><div><div class="eyebrow">ล่าสุด</div><div class="big-num" style="font-size:2.1rem">${pct(s.last)}</div></div><div style="text-align:right"><div class="small">เฉลี่ย ${pct(s.avg)} · ${s.n} ครั้ง</div><div class="small"><b>${d==null?"ทำอีกครั้งเพื่อเทียบ":d>=0?`ดีขึ้น +${Math.round(d)}`:`ลดลง ${Math.round(d)}`}</b>${s.n>1?` · จากครั้งแรก ${s.last-s.first>=0?"+":""}${Math.round(s.last-s.first)}`:""}</div></div></div></div>`}).join("")}</div>
  <div class="card"><h2 style="margin-bottom:8px">คะแนนแต่ละครั้ง (10 ครั้งล่าสุดต่อวิชา)</h2>${lineChart(series,n)}<p class="small muted" style="margin:.4rem 0 0">แต่ละชุดยากไม่เท่ากัน ถ้าอยากรู้ว่าเก่งขึ้นจริงไหม ดูจากการทำชุดเดิมซ้ำ</p></div>
  <div class="grid g2">
    <div class="card pink"><h2 style="margin-bottom:10px">ควรฝึกเพิ่มตรงไหน</h2>${weak.length?`<ul class="dots">${weak.map(c=>`<li><b>${esc(SUBJ[c.subj].name)}: ${esc(c.name)}</b> เฉลี่ย ${pct(c.avg)} (${c.trend})</li>`).join("")}</ul>`:ch.length?`<p style="margin:0">ทุกบทที่บันทึกไว้ผ่านเป้าแล้ว เก่งมาก!</p>`:`<p style="margin:0" class="small">ยังไม่มีคะแนนรายบท ลองกรอก “แยกคะแนนตามบท” ตอนบันทึก จะรู้ว่าบทไหนไม่แม่น</p>`}</div>
    <div class="card butter"><h2 style="margin-bottom:10px">ผิดบ่อยเพราะ</h2>${rs.length?`<ul class="dots" style="--dotc:var(--butter)">${rs.slice(0,4).map(([r,c])=>`<li><b>${esc(r)}</b> ${c} ครั้ง</li>`).join("")}</ul>`:`<p style="margin:0" class="small">ยังไม่ได้เลือกสาเหตุที่ผิด เลือกตอนบันทึกคะแนนได้</p>`}</div>
  </div>
  <div class="card"><h2 style="margin-bottom:10px">ประวัติทุกครั้ง</h2><div class="list">${hist.map(a=>{const e=exById(a.examId);return `<div class="erow">${subjTag(a.subj)}<div class="t"><b>${esc(e?.title||a.title||"ชุดที่ถูกลบ")}</b><span>${thD(a.date)} · ครั้งที่ ${a.no} · ${a.score}/${a.full} · ${fmtMin(a.mins)}${a.wrongNums?.length?` · ผิดข้อ ${a.wrongNums.slice(0,8).join(", ")}${a.wrongNums.length>8?"…":""}`:""}</span></div><div class="acts"><span class="big-num" style="font-size:1.4rem">${pct(a.pct)}</span><button class="btn sm ghost" data-act="attDel" data-id="${a.id}" aria-label="ลบคะแนนครั้งนี้">×</button></div></div>`}).join("")}</div></div>`}`;
};
function aiPrompt(){
  const st=S.settings;const ks=Object.keys(SUBJ).filter(k=>S.attempts.some(a=>a.subj===k));
  const lines=[`ฉันชื่อ${NAME} กำลังเตรียมสอบเข้า ม.4 เตรียมอุดมศึกษา ตั้งเป้าทำข้อสอบในคลังให้จบภายใน ${st.deadline} (วันนี้ ${today()}) เป้าคะแนน ${st.target}%`,
    `ช่วยวิเคราะห์จากข้อมูลจริงด้านล่าง: วิชาไหน/บทไหนยังไม่แม่น ส่วนใหญ่ผิดเพราะอะไร ควรทำโจทย์แนวไหนเพิ่ม และพรุ่งนี้ควรทำอะไร (อย่าเดาข้อมูลที่ไม่มี)`,"",
    "สรุปรายวิชา:",...ks.map(k=>{const s=subjStats(k);return `- ${SUBJ[k].name}: ทำ ${s.n} ครั้ง เฉลี่ย ${pct(s.avg)} ครั้งแรก ${pct(s.first)} ล่าสุด ${pct(s.last)} (ทำครบ ${s.done}/${s.total} ชุด)`}),
    "","คะแนนรายบท:",...chapterStats().map(c=>`- ${SUBJ[c.subj].name} / ${c.name}: เฉลี่ย ${pct(c.avg)} (${c.trend})`),
    "","สาเหตุที่ผิดบ่อย: "+(reasonStats().map(([r,c])=>`${r} ${c} ครั้ง`).join(", ")||"ยังไม่ได้บันทึก"),
    "","20 ครั้งล่าสุด:",...S.attempts.slice(-20).map(a=>`- ${a.date} ${SUBJ[a.subj]?.name} "${exById(a.examId)?.title||a.title}" ครั้งที่ ${a.no}: ${a.score}/${a.full} (${pct(a.pct)}) ${a.mins} นาที${a.reasons?.length?" ผิดเพราะ "+a.reasons.join("/"):""}${a.note?" โน้ต: "+a.note:""}`),
    "","ชุดที่ยังไม่ได้ทำ: "+exams().filter(e=>planned(e)&&status(e)==="todo").map(e=>e.title).slice(0,40).join(" | ")];
  return lines.join("\n");
}

/* ---------------- settings ---------------- */
function settingsDialog(){
  const st=S.settings;const dows=["อา","จ","อ","พ","พฤ","ศ","ส"];
  openDlg(`<h2 id="dlgTitle">ตั้งค่า</h2>
  <p class="small muted" style="margin:0">เข้าสู่ระบบเป็น <b>${esc(EMAIL)}</b>${Store.fileId?` · <a href="https://drive.google.com/file/d/${Store.fileId}/view" target="_blank" rel="noopener">ไฟล์ข้อมูลใน Drive</a>`:""}</p>
  <div class="f2">
    <label class="f">ทำคลังให้จบภายใน<input type="date" id="stDl" value="${st.deadline}" max="2026-12-31"></label>
    <label class="f">วันสอบจริง<input type="date" id="stEx" value="${st.examDate}"></label>
    <label class="f">ชม./วัน (จ–ศ)<input type="number" inputmode="decimal" step="0.5" min="0" id="stHw" value="${st.hWeekday}"></label>
    <label class="f">ชม./วัน (ส–อา)<input type="number" inputmode="decimal" step="0.5" min="0" id="stHe" value="${st.hWeekend}"></label>
    <label class="f">ชุดสูงสุดต่อวัน<input type="number" inputmode="numeric" min="1" id="stMax" value="${st.maxSets}"></label>
    <label class="f">เป้าคะแนน (%)<input type="number" inputmode="numeric" min="0" max="100" id="stT" value="${st.target}"></label>
  </div>
  <div class="f"><span class="small" style="font-weight:600">วันที่ไม่อ่านทุกสัปดาห์</span><div class="reasons">${dows.map((d,i)=>`<label><input type="checkbox" class="stOff" value="${i}" ${st.offDays.includes(i)?"checked":""}>${d}</label>`).join("")}</div></div>
  <div class="dlg-actions" style="justify-content:flex-start"><button class="btn pri" data-act="settingsSave">บันทึกและจัดแผนใหม่</button></div>
  <hr style="border:0;border-top:2px dashed var(--hair);width:100%">
  <div class="row"><button class="btn sm" data-act="sync">อัปเดตไฟล์จาก Drive</button><button class="btn sm" data-act="exportJson">สำรองข้อมูล (.json)</button><button class="btn sm" data-act="exportCsv">คะแนน (.csv)</button><button class="btn sm" data-act="restore">กู้คืนจากไฟล์</button></div>
  <div class="dlg-actions"><button class="btn danger" data-act="logout">ออกจากระบบ</button><button class="btn" data-act="closeDlg">ปิด</button></div>`);
}
function download(name,text,type){const b=new Blob([text],{type});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}

/* ---------------- actions ---------------- */
const ACT={
  closeDlg,confirmOk:()=>{const f=CONFIRM;CONFIRM=null;closeDlg();f&&f()},
  sync:()=>{closeDlg();syncCatalog(true)},
  plan:()=>planDialog(),
  planSave:()=>{const r=window.__plan;if(!r)return;S.plan=r.items;save();closeDlg();render();toast(`จัดแผนแล้ว ${r.placed.length} ชุด สู้ ๆ นะ!`)},
  lateToday:()=>{let k=0;S.plan.forEach(p=>{if(!p.done&&p.date<today()){p.date=today();p.pinned=true;k++}});save();render();toast(`ย้าย ${k} ชุดมาวันนี้แล้ว`)},
  taskMenu:b=>{const p=S.plan.find(x=>x.id===b.dataset.id);if(!p)return;const e=exById(p.examId);
    openDlg(`<h2 id="dlgTitle">${esc(e?.title||"")}</h2><label class="f">ย้ายไปวันที่<input type="date" id="mvD" value="${p.date}" max="${S.settings.deadline}" autofocus></label>
    <div class="dlg-actions"><button class="btn danger" data-act="taskDel" data-id="${p.id}">เอาออกจากแผน</button><button class="btn ok" data-act="taskDone" data-id="${p.id}">ทำเสร็จแล้ว</button><button class="btn pri" data-act="taskMove" data-id="${p.id}">ย้าย</button></div>`)},
  taskMove:b=>{const p=S.plan.find(x=>x.id===b.dataset.id);const d=$("#mvD").value;if(!d)return;p.date=d;p.pinned=true;save();closeDlg();render();toast("ย้ายไป "+thD(d))},
  taskDone:b=>{const p=S.plan.find(x=>x.id===b.dataset.id);p.done=true;p.doneDate=today();save();closeDlg();render()},
  taskDel:b=>{S.plan=S.plan.filter(x=>x.id!==b.dataset.id);save();closeDlg();render()},
  startExam:b=>{const e=exById(b.dataset.id);if(S.session&&exById(S.session.examId)?.id!==e.id){toast("มีชุดที่จับเวลาค้างอยู่ จบหรือยกเลิกก่อนนะ");location.hash="timer";return}
    if(e.type==="read"){window.open(`https://drive.google.com/file/d/${encodeURIComponent(e.id)}/view`,"_blank","noopener");const p=S.plan.find(x=>x.examId===e.id&&!x.done);openDlg(`<h2 id="dlgTitle">อ่าน “${esc(e.title)}”</h2><p style="margin:0">เปิดไฟล์ให้แล้ว อ่านจบแล้วกลับมากดปุ่มนี้นะ</p><div class="dlg-actions"><button class="btn" data-act="closeDlg">ยังไม่จบ</button><button class="btn ok" data-act="readDone" data-id="${e.id}" ${p?`data-p="${p.id}"`:""}>อ่านจบแล้ว ✓</button></div>`);return}
    UI.timerMode="exam";UI.timerExam=e.id;closeDlg();if(VIEW==="timer")render();else location.hash="timer"},
  readDone:b=>{const p=S.plan.find(x=>x.id===b.dataset.p);if(p){p.done=true;p.doneDate=today()}S.over[b.dataset.id]={...(S.over[b.dataset.id]||{}),done:true};save();closeDlg();render();toast(`เก่งมาก ${NAME}!`)},
  exSubj:b=>{UI.exSubj=b.dataset.k;render()},exType:b=>{UI.exType=b.dataset.k;render()},
  editExam:b=>{const e=exById(b.dataset.id);openDlg(`<h2 id="dlgTitle">แก้ไขข้อมูลชุด</h2><p class="small muted" style="margin:0">${esc(e.folder||"")}</p>
    <label class="f">ชื่อ<input type="text" id="eT" value="${esc(e.title)}"></label>
    <div class="f2"><label class="f">วิชา<select id="eS">${Object.keys(SUBJ).map(k=>`<option value="${k}" ${e.subj===k?"selected":""}>${SUBJ[k].name}</option>`).join("")}</select></label>
    <label class="f">ประเภท<select id="eTy">${Object.entries(TYPES).map(([k,l])=>`<option value="${k}" ${e.type===k?"selected":""}>${l}</option>`).join("")}</select></label>
    <label class="f">หัวข้อ/บท<input type="text" id="eTp" value="${esc(e.topic)}"></label>
    <label class="f">เวลาที่ใช้โดยประมาณ (นาที)<input type="number" inputmode="numeric" id="eM" value="${exMins(e)}"></label></div>
    <label class="row small" style="min-height:44px"><input type="checkbox" id="eX" ${e.excluded?"checked":""}> ไม่นับในแผน</label>
    <div class="dlg-actions"><button class="btn" data-act="closeDlg">ยกเลิก</button><button class="btn pri" data-act="exSave" data-id="${e.id}">บันทึก</button></div>`)},
  exSave:b=>{S.over[b.dataset.id]={...(S.over[b.dataset.id]||{}),title:$("#eT").value.trim()||undefined,subj:$("#eS").value,type:$("#eTy").value,topic:$("#eTp").value.trim()||"ทั่วไป",mins:+$("#eM").value||undefined,excluded:$("#eX").checked};save();closeDlg();render();toast("บันทึกแล้ว")},
  tmMode:b=>{UI.timerMode=b.dataset.k;render()},
  tStart:()=>{const id=$("#tmEx").value;if(!id)return;const now=Date.now();S.session={examId:id,startedAt:now,segs:[[now,null]],status:"running"};save();Store.flush();keepAwake(true);render()},
  tPause:()=>{const s=S.session;s.segs.at(-1)[1]=Date.now();s.status="paused";save();Store.flush();keepAwake(false);render()},
  tResume:()=>{const s=S.session;s.segs.push([Date.now(),null]);s.status="running";save();Store.flush();keepAwake(true);render()},
  tFinish:()=>{const s=S.session;if(s.status==="running")s.segs.at(-1)[1]=Date.now();const mins=Math.max(1,Math.round(sessElapsed()/60000));const id=s.examId;window.__sess={mins,segs:s.segs};S.session=null;save();keepAwake(false);render();scoreDialog(id,mins)},
  tReset:()=>confirmDlg("ยกเลิกการจับเวลา?","เวลาที่จับไว้รอบนี้จะไม่ถูกบันทึก","ยกเลิกรอบนี้",()=>{S.session=null;save();keepAwake(false);render()}),
  pomoPreset:b=>{POMO.preset=+b.dataset.k;POMO.run=false;setPomo("focus");render()},
  pomoGo:()=>{if(POMO.run){POMO.run=false;keepAwake(false)}else{POMO.run=true;POMO.endAt=Date.now()+POMO.left*1000;keepAwake(true)}render()},
  pomoReset:()=>{POMO.run=false;setPomo(POMO.mode);keepAwake(false);render()},
  scoreNew:()=>scoreDialog(UI.timerExam||dayPlan(today()).find(p=>!p.done)?.examId||exams().find(planned)?.id,null),
  chapAdd:()=>{window.__chapters.push({name:"",score:"",full:""});drawChapters()},
  chapDel:b=>{window.__chapters.splice(+b.dataset.i,1);drawChapters();calcScore()},
  scoreSave:()=>{
    const v=scoreValues();const e=exById($("#sEx").value);
    if(!e){toast("เลือกชุดข้อสอบก่อนนะ");return}
    if(v.pct==null){toast("กรอกคะแนนที่ได้และคะแนนเต็มก่อนนะ");$("#sScore").focus();return}
    if(v.score>v.full){toast("คะแนนที่ได้มากกว่าคะแนนเต็ม ลองเช็กอีกทีนะ");return}
    const a={id:uid(),examId:e.id,title:e.title,subj:e.subj,topic:e.topic,date:$("#sDate").value||today(),no:attemptsOf(e.id).length+1,score:v.score,full:v.full,pct:Math.round(v.pct*10)/10,mins:+$("#sMins").value||0,
      chapters:v.ch.map(c=>({name:c.name.trim(),score:+c.score,full:+c.full})),wrongNums:parseNums($("#sWrong").value),reasons:$$("#dlgBody .reasons input:checked").map(i=>i.value),note:$("#sNote").value.trim(),segs:window.__sess?.segs||null,createdAt:Date.now()};
    window.__sess=null;S.attempts.push(a);
    const p=S.plan.filter(x=>exById(x.examId)?.id===e.id&&!x.done).sort((x,y)=>x.date.localeCompare(y.date))[0];if(p){p.done=true;p.doneDate=a.date}
    save();closeDlg();if(VIEW!=="progress")location.hash="progress";else render();
    toast(a.pct>=S.settings.target?`ได้ ${pct(a.pct)} เก่งมาก ${NAME}!`:`ได้ ${pct(a.pct)} บันทึกแล้ว ชุดนี้จะได้ทำซ้ำนะ`)},
  attDel:b=>confirmDlg("ลบคะแนนครั้งนี้?","ลบแล้วกู้คืนไม่ได้ (ยกเว้นมีไฟล์สำรอง)","ลบ",()=>{S.attempts=S.attempts.filter(a=>a.id!==b.dataset.id);save();render()}),
  askAI:()=>{const t=aiPrompt();const w=window.open("https://claude.ai/new","_blank","noopener");
    if(navigator.clipboard?.writeText)navigator.clipboard.writeText(t).then(()=>toast("คัดลอกข้อมูลแล้ว วางในแชต AI ได้เลย")).catch(()=>showPrompt(t));else showPrompt(t);if(!w)showPrompt(t)},
  nbTab:b=>{UI.nbTab=b.dataset.k;render()},nbSubj:b=>{UI.nbSubj=b.dataset.k;render()},cardSubj:b=>{UI.cardSubj=b.dataset.k;UI.cardI=0;render()},
  nbDone:b=>{const id=b.dataset.id;if(S.nb.done[id])delete S.nb.done[id];else{S.nb.done[id]=today();toast(`เก่งมาก ${NAME}! อ่านจบแล้ว ${Object.keys(S.nb.done).length} หัวข้อ`)}save();const y=scrollY;render();scrollTo(0,y)},
  nbStar:b=>{const id=b.dataset.id;if(S.nb.star[id])delete S.nb.star[id];else S.nb.star[id]=1;save();const y=scrollY;render();scrollTo(0,y)},
  quizTopic:b=>{const t=NB.topics.find(x=>x.id===b.dataset.id);UI.quiz={qs:shuffle(NB.questions.filter(q=>q.topicId===t.id)),i:0,picked:null,ans:[],label:t.title};UI.nbTab="quiz";location.hash="notes"},
  quizGo:b=>{const pool=NB.questions.filter(q=>UI.nbSubj==="all"||q.subjectId===UI.nbSubj);UI.quiz={qs:shuffle(pool).slice(0,+b.dataset.n),i:0,picked:null,ans:[],label:UI.nbSubj==="all"?"ทุกวิชา":NB.subjects.find(s=>s.id===UI.nbSubj).nameTh};render()},
  quizWrong:()=>{UI.quiz={qs:shuffle(NB.questions.filter(q=>S.nb.wrong.includes(q.id))),i:0,picked:null,ans:[],label:"ทวนข้อที่เคยผิด"};render()},
  quizPick:b=>{const Q=UI.quiz,q=Q.qs[Q.i],i=+b.dataset.i,ok=i===q.correctIndex;Q.picked=i;Q.ans.push(ok);
    if(!ok){if(!S.nb.wrong.includes(q.id))S.nb.wrong.push(q.id)}else S.nb.wrong=S.nb.wrong.filter(x=>x!==q.id);save();render()},
  quizNext:()=>{UI.quiz.i++;UI.quiz.picked=null;render();scrollTo(0,0)},
  quizEnd:()=>{UI.quiz=null;render()},
  card:b=>{const L=NB.knowledge.filter(k=>UI.cardSubj==="all"||k.subjectId===UI.cardSubj);UI.cardI=(UI.cardI+ +b.dataset.n+L.length)%L.length;render()},
  settingsSave:()=>{const st=S.settings;let dl=$("#stDl").value||"2026-12-31";if(dl>"2026-12-31")dl="2026-12-31";
    Object.assign(st,{deadline:dl,examDate:$("#stEx").value||st.examDate,hWeekday:+$("#stHw").value||0,hWeekend:+$("#stHe").value||0,maxSets:Math.max(1,+$("#stMax").value||3),target:clamp(+$("#stT").value||70,0,100),offDays:$$(".stOff:checked").map(i=>+i.value)});
    save();render();planDialog()},
  exportJson:()=>download(`feyfey-backup-${today()}.json`,JSON.stringify({app:"feyfey-study",exportedAt:new Date().toISOString(),data:S},null,1),"application/json"),
  exportCsv:()=>{const rows=[["วันที่","วิชา","ชุด","ครั้งที่","ได้","เต็ม","%","นาที","ผิดเพราะ","โน้ต"],...S.attempts.map(a=>[a.date,SUBJ[a.subj]?.name,exById(a.examId)?.title||a.title,a.no,a.score,a.full,a.pct,a.mins,(a.reasons||[]).join("/"),a.note||""])];
    download(`feyfey-scores-${today()}.csv`,"﻿"+rows.map(r=>r.map(v=>/[",\n]/.test(String(v??""))?`"${String(v).replace(/"/g,'""')}"`:String(v??"")).join(",")).join("\n"),"text/csv")},
  restore:()=>$("#restoreFile").click(),
  logout,
};
function showPrompt(t){openDlg(`<h2 id="dlgTitle">ข้อมูลสำหรับถาม AI</h2><p class="small" style="margin:0">คัดลอกข้อความนี้ไปวางในแชต AI (เช่น Claude) แล้วกดส่ง</p><textarea readonly style="min-height:240px" id="aiTxt">${esc(t)}</textarea><div class="dlg-actions"><a class="btn" href="https://claude.ai/new" target="_blank" rel="noopener">เปิด Claude</a><button class="btn pri" data-act="closeDlg">ปิด</button></div>`);const ta=$("#aiTxt");ta.focus();ta.select()}

/* ---------------- routing & events ---------------- */
function render(){
  invalidate();
  const h=decodeURIComponent((location.hash||"#today").slice(1));
  const isTopic=h.startsWith("topic-");
  VIEW=isTopic?"notes":(VIEWS[h]?h:"today");
  $$(".tab-in a").forEach(a=>a.setAttribute("aria-current",a.dataset.v===VIEW?"page":"false"));
  $("#topTitle").textContent=isTopic?"สมุดสรุป":TITLES[VIEW];
  const left=diffDays(today(),S.settings.deadline);$("#countChip").textContent=left>0?`อีก ${left} วัน`:left===0?"วันสุดท้าย!":"ครบกำหนด";
  try{$("#view").innerHTML=isTopic?topicView(h.slice(6)):VIEWS[VIEW]()}catch(e){console.error(e);$("#view").innerHTML=`<div class="card pink">เกิดข้อผิดพลาด: ${esc(e.message)}</div>`}
}
let lastHash="";
window.addEventListener("hashchange",()=>{render();if(location.hash!==lastHash){scrollTo(0,0);$("#view").focus({preventScroll:true})}lastHash=location.hash});
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-act]");if(b&&ACT[b.dataset.act]){e.preventDefault();ACT[b.dataset.act](b,e);return}
  const f=e.target.closest("#flip");if(f)f.classList.toggle("on");
});
document.addEventListener("keydown",e=>{const f=e.target.closest?.("#flip");if(f&&(e.key===" "||e.key==="Enter")){e.preventDefault();f.classList.toggle("on")}});
let sx=null;
document.addEventListener("touchstart",e=>{if(e.target.closest("#flip"))sx=e.touches[0].clientX},{passive:true});
document.addEventListener("touchend",e=>{if(sx==null)return;const dx=e.changedTouches[0].clientX-sx;sx=null;if(Math.abs(dx)>60)ACT.card({dataset:{n:dx<0?1:-1}})});
document.addEventListener("input",e=>{
  const t=e.target;
  if(t.id==="exQ"){UI.exQ=t.value;clearTimeout(window.__q);window.__q=setTimeout(()=>{render();const n=$("#exQ");n.focus();n.setSelectionRange(n.value.length,n.value.length)},300)}
  if(t.dataset.ch!=null){window.__chapters[+t.dataset.ch][t.dataset.k]=t.value;calcScore()}
  if(t.id==="sScore"||t.id==="sFull")calcScore();
});
document.addEventListener("change",e=>{if(e.target.id==="tmEx"){UI.timerExam=e.target.value;render()}if(e.target.id==="sEx"){const f=exById(e.target.value);const prev=f&&attemptsOf(f.id).at(-1);if(prev&&!$("#sFull").value)$("#sFull").value=prev.full;calcScore()}});
$("#menuBtn").addEventListener("click",settingsDialog);
document.addEventListener("visibilitychange",()=>{if(document.hidden)Store.flush();else if(VIEW==="timer")render()});
window.addEventListener("pagehide",()=>Store.flush());
$("#restoreFile").addEventListener("change",ev=>{
  const f=ev.target.files[0];ev.target.value="";if(!f)return;const rd=new FileReader();
  rd.onload=()=>{try{const o=JSON.parse(rd.result);if(o.app!=="feyfey-study"||!o.data)throw new Error("ไม่ใช่ไฟล์สำรองของเว็บนี้");
    confirmDlg("กู้คืนข้อมูล?",`ไฟล์นี้มีคะแนน ${o.data.attempts?.length||0} ครั้ง แผน ${o.data.plan?.length||0} รายการ ข้อมูลตอนนี้จะถูกแทนที่`,"กู้คืน",()=>{S=merge(o.data);save();render();toast("กู้คืนแล้ว")})}catch(e){toast("อ่านไฟล์ไม่ได้: "+e.message)}};
  rd.readAsText(f);
});

/* ---------------- boot ---------------- */
let entered=false,loaded=false;
async function enterApp(){
  if(entered)return;entered=true;
  $("#gate").hidden=true;$("#shell").hidden=false;
  $("#view").innerHTML=`<div class="card empty">กำลังเปิดสมุดของ${NAME}…</div>`;
  fetch("notebook.json").then(r=>r.json()).then(j=>{NB=j;if(VIEW==="notes")render()}).catch(()=>{});
  try{await Store.load()}catch(e){if(e.message==="auth")return;toast("โหลดข้อมูลจาก Drive ไม่สำเร็จ ใช้ข้อมูลในเครื่องไปก่อน");const l=Store.readCache();if(l)S=merge(l)}
  loaded=true;
  if(S.session&&S.session.status==="running")keepAwake(true);
  render();
  const stale=!S.catalog.syncedAt||Date.now()-S.catalog.syncedAt>12*3600e3;
  if(stale)syncCatalog(!S.catalog.items.length);
}
initAuth();
})();
