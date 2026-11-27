/* BoltSpec – torque & service module. Runs after the page loader has put the car's data in window.__BS_D. */
// backup file format id (older backups were written with the legacy id and can still be restored)
const BACKUP_ID='boltspec',BACKUP_IDS=['boltspec','vreaupiese-torque','cupluri-ista']; // older ids are still accepted on restore
const I=(n,c='')=>'<svg class="u-i '+c+'" aria-hidden="true"><use href="/assets/icons.svg#i-'+n+'"/></svg>';
const thr=t=>String(t||'').replace(/\s*[x×]\s*(?=\d)/g,'×').replace(/^WAF\s*/i,'spanner ').replace(/^(\d)AZ$/,'$1 pcs');
const D=window.__BS_D; // one car's data, decrypted by the page loader, plus the public car index
const S=D.S, R=D.R, GE=D.GE||{}, SE=D.SE, C=D.C;
let FAV=new Set();try{FAV=new Set(JSON.parse(localStorage.getItem('tq_fav')||'[]'))}catch(e){}
const nod=s=>String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const $=s=>document.querySelector(s), esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const RM=matchMedia('(prefers-reduced-motion: reduce)');
const SM=()=>RM.matches?'auto':'smooth';
const isNarrow=()=>matchMedia('(max-width:860px)').matches;
function goTo(el,block='start'){if(el)el.scrollIntoView({behavior:SM(),block});}

// search-term highlighting (diacritics-insensitive)
let QT=[];
function hl(s){s=String(s??'');if(!QT.length||!s)return esc(s);
  let n='';const map=[];for(let i=0;i<s.length;i++){const c=nod(s[i]);for(let k=0;k<c.length;k++)map.push(i);n+=c;}
  const m=new Uint8Array(s.length);let any=0;
  QT.forEach(t=>{let p=0;while((p=n.indexOf(t,p))>-1){for(let k=p;k<p+t.length;k++)m[map[k]]=1;p+=t.length;any=1}});
  if(!any)return esc(s);
  let o='',on=0;for(let i=0;i<s.length;i++){if(m[i]&&!on){o+='<mark>';on=1}else if(!m[i]&&on){o+='</mark>';on=0}o+=esc(s[i])}return on?o+'</mark>':o;}
// bilingual html: ro main + en small
function lbl(t,tag='span'){ return `<${tag}>${hl(t)}</${tag}>`; }
const gEn=g=>GE[g]||('Group '+g); // group names (from the data)

let toastT;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),1800);}

const NAMES={E12:'5 Series (1972–81)',E21:'3 Series (1975–83)',E23:'7 Series (1977–86)',E24:'6 Series (1976–89)',E28:'5 Series (1981–88)',E30:'3 Series (1982–94)',E31:'8 Series',E32:'7 Series (1986–94)',E34:'5 Series (1988–96)',E36:'3 Series (1990–2000)',E38:'7 Series (1994–2001)',E39:'5 Series (1995–2004)',E46:'3 Series (1998–2006)',E52:'Z8',E53:'X5 (1999–2006)',E60:'5 Series Sedan',E61:'5 Series Touring',E63:'6 Series Coupé',E64:'6 Series Cabrio',E65:'7 Series',E66:'7 Series L',E67:'7 Series Security',E68:'Hydrogen 7',E70:'X5 (2007–13)',E71:'X6 (2008–14)',E72:'X6 ActiveHybrid',E81:'1 Series 3-door',E82:'1 Series Coupé',E83:'X3 (2003–10)',E84:'X1 (2009–15)',E85:'Z4 Roadster',E86:'Z4 Coupé',E87:'1 Series 5-door',E88:'1 Series Cabrio',E89:'Z4 (2009–16)',E90:'3 Series Sedan',E91:'3 Series Touring',E92:'3 Series Coupé',E93:'3 Series Cabrio',
F01:'7 Series',F02:'7 Series L',F03:'7 Series Security',F04:'ActiveHybrid 7',F06:'6 Series Gran Coupé',F07:'5 Series GT',F10:'5 Series Sedan',F11:'5 Series Touring',F12:'6 Series Cabrio',F13:'6 Series Coupé',F15:'X5 (2013–18)',F16:'X6 (2014–19)',F18:'5 Series L (China)',F20:'1 Series 5-door',F21:'1 Series 3-door',F22:'2 Series Coupé',F23:'2 Series Cabrio',F25:'X3 (2010–17)',F26:'X4 (2014–18)',F30:'3 Series Sedan',F31:'3 Series Touring',F32:'4 Series Coupé',F33:'4 Series Cabrio',F34:'3 Series GT',F35:'3 Series L (China)',F36:'4 Series Gran Coupé',F39:'X2',F40:'1 Series (2019–)',F44:'2 Series Gran Coupé',F45:'2 Series Active Tourer',F46:'2 Series Gran Tourer',F48:'X1 (2015–22)',F49:'X1 L (China)',F52:'1 Series Sedan',F80:'M3',F82:'M4 Coupé',F83:'M4 Cabrio',F85:'X5 M',F86:'X6 M',F87:'M2',
I01:'i3',I12:'i8',I15:'i8 Roadster',U06:'2 Series Active Tourer (2022–)',
R50:'MINI Hatch (2001–06)',R52:'MINI Cabrio (2004–08)',R53:'MINI Cooper S (2001–06)',R55:'MINI Clubman (2007–14)',R56:'MINI Hatch (2006–13)',R57:'MINI Cabrio (2009–15)',R58:'MINI Coupé',R59:'MINI Roadster',R60:'MINI Countryman (2010–16)',R61:'MINI Paceman',F54:'MINI Clubman (2015–)',F55:'MINI 5-door',F56:'MINI 3-door',F57:'MINI Cabrio (2016–)',F60:'MINI Countryman (2017–)',
RR1:'Phantom',RR2:'Phantom Drophead Coupé',RR3:'Phantom Coupé',RR4:'Ghost',RR5:'Wraith',RR6:'Dawn'};
const BRANDS=[['BMW E','BMW (E)',s=>/^E\d\d$/.test(s)],['BMW F','BMW (F)',s=>/^F\d\d$/.test(s)&&!/^F5[4-8]|^F60/.test(s)],['BMW i','BMW i / U',s=>/^[IU]\d\d$/.test(s)],['MINI','MINI',s=>/^R\d\d$/.test(s)||/^F5[4-8]|^F60/.test(s)],['RR','Rolls-Royce',s=>/^RR\d$/.test(s)],['Alt','Other',s=>!/^(E|F|I|U|R|RR)\d+$/.test(s)]];

// Zones of the car -> main groups
const ZONES=[
 {id:'eng',name:'Engine & ancillaries',g:['11','12','13','17'],x:175,y:150},
 {id:'light',name:'Lights & electrics',g:['61','63','66','67','84'],x:72,y:178},
 {id:'fa',name:'Front axle & steering',g:['31','32','37'],x:192,y:244},
 {id:'brk',name:'Brakes & wheels',g:['34','36'],x:708,y:244},
 {id:'trans',name:'Transmission',g:['21','22','23','24','25','26','27','28'],x:380,y:262},
 {id:'ra',name:'Rear axle & differential',g:['33'],x:600,y:262},
 {id:'fuel',name:'Fuel tank & exhaust',g:['16','18'],x:800,y:226},
 {id:'cab',name:'Interior',g:['35','52','62','64','65','72'],x:420,y:116},
 {id:'body',name:'Body & doors',g:['41','51','54','71'],x:560,y:186},
 {id:'gen',name:'General',g:['00','82'],x:845,y:96}
];
const zoneOf={};ZONES.forEach(z=>z.g.forEach(g=>zoneOf[g]=z.id));
const zById=id=>ZONES.find(z=>z.id==id);
// common jobs -> search shortcuts (hidden when no results for the car)
const QUICK=[['Left-hand thread','left-hand thread'],['Wheel bolts','wheel bolts'],['Brake caliper','caliper'],['Oil drain plug','oil drain plug'],['Spark plugs','spark plug'],['Anti-roll bar link','anti-roll bar link'],['Shock absorber','shock absorber'],['Oil filter','oil filter']];

let st={brand:'BMW F',series:null,engine:null,zone:null,group:null,sub:null,q:'',fav:false,pickOpen:true,sq:''};

// precompute rows
const ROWS=R.map(r=>({g:r[0],sgi:r[1],pi:r[2],opi:r[5],sg:S[r[1]],p:S[r[2]],a:S[r[3]],th:S[r[4]],op:S[r[5]],v:S[r[6]],ser:r[7].map(i=>S[i]),eng:r[8].map(i=>S[i]),et:S[r[9]],x:S[r[10]],gen:r[11]}));
ROWS.forEach(r=>{r.k=[r.g,r.sg,r.p,r.a,r.th,r.v,r.et].join('|');r.rep=/\b(replace|renew)\b[^.]*\b(screws?|bolts?|nuts?)\b/i.test(r.op);r.ang=/°|angle of rotation|rotation angle/i.test(r.op+' '+r.v)});
const LHSET=new Set(D.LH||[]);const LHRX=/left[- ]?hand(ed)?[- ]threads?|\bLH[- ]thread|left[- ]threads?|reverse[- ]threads?|threads?[^.]{0,25}(counter-?clockwise|anti-?clockwise)/i;
ROWS.forEach((r,i)=>{r.lh=LHSET.has(i)||LHRX.test(r.p+' '+r.op+' '+r.th+' '+r.x+' '+r.v)});
function indexText(){ROWS.forEach(r=>r.txt=nod((r.lh?'left-hand thread ':'')+r.p+' '+r.sg+' '+r.th+' '+r.op+' '+gEn(r.g)));}
indexText();
const allSeries=D.ALLS; // every series in the database (public index); only this page's series has rows
const ALLENG=[...new Set(ROWS.flatMap(r=>r.eng))].sort();
const SCNT=D.SCNT; // torque spec counts per series (public index)

function rowMatch(r){
  const s=st.series; if(!s) return false;
  if(r.ser.length && !r.ser.includes(s)) return false;
  if(!r.ser.length && !r.eng.length && !r.gen) return false;
  if(r.eng.length){
    if(st.engine){ if(!r.eng.includes(st.engine)) return false; }
    else { const se=SE[s]||[]; if(!r.ser.length && se.length && !r.eng.some(e=>se.includes(e))) return false; if(!r.ser.length && !se.length) return false; }
  }
  return true;
}
let base=[],cur=[];
const terms=q=>nod(q).split(/\s+/).filter(Boolean);
// a search word must match the start of a word ("wheel" finds "wheel bolt", not "flywheel")
const hasW=(t,w)=>t.startsWith(w)||t.includes(' '+w)||t.includes('-'+w)||t.includes('('+w)||t.includes('/'+w);
function recompute(){
  base=ROWS.filter(rowMatch);cur=base;QT=[];
  if(st.q){QT=terms(st.q);cur=cur.filter(r=>QT.every(w=>hasW(r.txt,w)));
    // rows whose part name contains every search word come first
    const ph=QT.join(' '),sc=r=>{const p=nod(r.p);return hasW(p,ph)?-1:QT.every(w=>hasW(p,w))?0:QT.some(w=>hasW(p,w))?1:2};cur=cur.map((r,i)=>[sc(r),i,r]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]).map(x=>x[2]);}
}
const carLabel=()=>`${st.series}${NAMES[st.series]?' · '+NAMES[st.series]:''}${st.engine?' · '+st.engine:''}`;

// ---------- history (phone back button walks back through the flow) ----------
const snap=()=>({zone:st.zone,group:st.group,sub:st.sub,fav:st.fav});
function nav(ch,scrollTo){Object.assign(st,ch);try{history.pushState(snap(),'')}catch(e){}refresh();if(scrollTo)goTo(scrollTo);}
addEventListener('popstate',e=>{const s=e.state||{zone:null,group:null,sub:null,fav:false};Object.assign(st,{zone:s.zone,group:s.group,sub:s.sub,fav:!!s.fav});if(st.series)refresh();});

// ---------- picker ----------
function renderBrands(){
  const sq=nod(st.sq.trim());
  $('#brandTabs').innerHTML=BRANDS.map(b=>`<button class="chip ${st.brand==b[0]&&!sq?'on':''}" data-b="${b[0]}" aria-pressed="${st.brand==b[0]&&!sq}">${b[1]}</button>`).join('');
  const f=BRANDS.find(b=>b[0]==st.brand)[2];
  const list=sq?allSeries.filter(s=>nod(s+' '+(NAMES[s]||'')).includes(sq)||nod(s+(NAMES[s]||'')).replace(/\s/g,'').includes(sq.replace(/\s/g,''))):allSeries.filter(f);
  $('#sInfo').textContent=sq?`${list.length} series found across all brands`:'';
  $('#seriesBox').innerHTML=list.length?'<div class="sgrid">'+list.map(s=>`<button class="chip ${st.series==s?'on':''}" data-s="${s}" aria-pressed="${st.series==s}"><b>${s}</b><small>${esc(NAMES[s]||'')}${NAMES[s]?' · ':''}${SCNT[s]==1?'1 torque spec':SCNT[s]+' torque specs'}</small></button>`).join('')+'</div>':`<div class="empty">No series match “${esc(st.sq)}”. Try the chassis code (e.g. F30, E90) or the model (e.g. X5).</div>`;
}
function renderPick(){try{renderVin()}catch(e){}
  const col=!!st.series&&!st.pickOpen;
  $('#pick').classList.toggle('collapsed',col);
  $('#changeCar').setAttribute('aria-expanded',!col);$('#carPill').setAttribute('aria-expanded',!col);
  if(st.series)$('#sumCar').innerHTML=`${esc(st.series)}<small>${esc(NAMES[st.series]||'')} · ${SCNT[st.series]} torque specs</small>`;
  $('#changeCar').textContent=col?'Change car':'Close';
  if(st.series&&!col){$('#pickSum').style.display='flex'}else $('#pickSum').style.removeProperty('display');
}
$('#brandTabs').onclick=e=>{const b=e.target.closest('[data-b]');if(!b)return;st.brand=b.dataset.b;st.sq='';$('#sq').value='';renderBrands();};
$('#seriesBox').onclick=e=>{const b=e.target.closest('[data-s]');if(!b)return;selectSeries(b.dataset.s);};
$('#sq').oninput=e=>{st.sq=e.target.value;renderBrands();};
$('#changeCar').onclick=()=>{st.pickOpen=!st.pickOpen;renderPick();if(st.pickOpen){goTo($('#pick'));setTimeout(()=>$('#sq').focus({preventScroll:true}),50)}};
$('#carPill').onclick=()=>{if(st.series&&st.pickOpen){st.pickOpen=false;renderPick();return}st.pickOpen=true;renderPick();goTo($('#pick'));};
function selectSeries(s,quiet){
  // each series has its own page (and its own data): go there
  if(window.BS&&BS.series&&s!==BS.series){try{localStorage.setItem('tq_series',s);localStorage.setItem('tq_engine','')}catch(e){}location.href='/'+s.toLowerCase()+'/';return;}
  st.series=s;st.engine=null;st.group=null;st.sub=null;st.zone=null;st.fav=false;st.pickOpen=false;st.sq='';$('#sq').value='';
  st.brand=(BRANDS.find(b=>b[2](s))||BRANDS[0])[0];
  renderBrands();renderEngines();renderPick();$('#app').classList.remove('hide');$('#pickHint').classList.add('hide');refresh();
  try{localStorage.setItem('tq_series',s);if(!quiet)localStorage.setItem('tq_engine','')}catch(e){}try{window.UShell&&UShell.sync()}catch(e){}
  try{history.replaceState(snap(),'')}catch(e){}
  if(!quiet){toast(`Car: ${carLabel()}`);setTimeout(()=>goTo($('#pick')),50);}
}
function renderEngines(){
  const se=(SE[st.series]||[]).slice().sort();
  $('#engineBox').classList.remove('hide');
  const others=ALLENG.filter(e=>!se.includes(e));
  $('#engines').innerHTML=`<span class="lbl">Engine:</span><button class="chip ${!st.engine?'on':''}" data-e="" aria-pressed="${!st.engine}">All</button>`+se.map(e=>`<button class="chip ${st.engine==e?'on':''}" data-e="${e}" aria-pressed="${st.engine==e}">${e}</button>`).join('')+
   `<select id="otherEng" class="chip ${st.engine&&!se.includes(st.engine)?'on':''}" aria-label="Other engine (from the whole database)" title="Engine not listed? Pick it here"><option value="">Other engine…</option>${others.map(e=>`<option ${st.engine==e?'selected':''}>${e}</option>`).join('')}</select>`;
  $('#otherEng').onchange=ev=>setEngine(ev.target.value||null);
}
function scrollEng(){setTimeout(()=>{const c=document.querySelector('#engines .chip.on');if(c&&c.scrollIntoView)c.scrollIntoView({inline:'center',block:'nearest'})},80)}
function setEngine(e){st.engine=e;if(e&&window.BSA)BSA('engine',BS.series+' '+e);renderEngines();refresh();try{localStorage.setItem('tq_engine',st.engine||'')}catch(err){}try{window.UShell&&UShell.sync()}catch(err){}toast(e?`Engine: ${e}`:'All engines');}
$('#engines').onclick=e=>{const b=e.target.closest('[data-e]');if(!b)return;setEngine(b.dataset.e||null)};

// ---------- car svg ----------
function drawCar(counts){
  const body=`<path class="body" d="M48,232 L46,196 Q48,170 92,160 L238,142 Q300,92 372,80 L560,76 Q628,80 690,134 L812,150 Q858,158 860,192 L862,232 Q860,240 850,240 L770,240 A62,62 0 0 0 646,240 L254,240 A62,62 0 0 0 130,240 L58,240 Q48,240 48,232Z"/>
  <path class="glass" d="M262,142 Q316,98 378,90 L455,88 L455,142Z"/><path class="glass" d="M468,88 L556,88 Q608,92 660,138 L468,142Z"/>
  <line x1="461" y1="88" x2="461" y2="236" stroke="var(--ink)" stroke-width="1.5"/><line x1="258" y1="146" x2="258" y2="236" stroke="var(--ink)" stroke-width="1.2" opacity=".5"/><line x1="668" y1="142" x2="668" y2="236" stroke="var(--ink)" stroke-width="1.2" opacity=".5"/>
  <path d="M52,178 L96,170 L98,186 L54,192Z" fill="var(--warn)" stroke="var(--ink)"/><path d="M846,166 L860,168 L860,190 L842,188Z" fill="var(--danger)" stroke="var(--ink)"/>
  <circle class="tyre" cx="192" cy="244" r="50"/><circle class="rim" cx="192" cy="244" r="30"/><circle class="tyre" cx="708" cy="244" r="50"/><circle class="rim" cx="708" cy="244" r="30"/>
  <line x1="40" y1="296" x2="870" y2="296" stroke="var(--line)" stroke-width="3"/>`;
  const zs=ZONES.map(z=>{const n=counts[z.id]||0;return `<g class="zone ${st.zone==z.id?'on':''} ${n?'':'off'}" data-z="${z.id}" tabindex="${n?0:-1}" role="button" aria-pressed="${st.zone==z.id}" aria-label="${n>999?'1k+':n} · ${z.name}, ${n} torque specs"><circle class="hl" cx="${z.x}" cy="${z.y}" r="46"/><circle class="hit" cx="${z.x}" cy="${z.y}" r="44" fill="transparent"/><circle class="pin" cx="${z.x}" cy="${z.y}" r="${n>999?31:28}" stroke-width="3"/><text x="${z.x}" y="${z.y+6}" text-anchor="middle">${n>999?'1k+':n}</text><title>${z.name}: ${n} torque specs</title></g>`}).join('');
  $('#carSvg').innerHTML=body+zs;
}
$('#carSvg').onclick=e=>{const z=e.target.closest('[data-z]');if(!z||z.classList.contains('off'))return;setZone(z.dataset.z)};
$('#carSvg').onkeydown=e=>{if(e.key!='Enter'&&e.key!=' ')return;const z=e.target.closest('[data-z]');if(!z)return;e.preventDefault();setZone(z.dataset.z);const n=$(`#carSvg [data-z="${z.dataset.z}"]`);if(n)n.focus()};
function setZone(z){
  const nz=st.zone==z?null:z;const ch={zone:nz,group:null,sub:null,fav:false};
  const zz=zById(nz);let single=false;
  if(zz){const gs=zz.g.filter(g=>gcount[g]);if(gs.length==1){ch.group=gs[0];single=true}}
  nav(ch);
  if(nz&&isNarrow())goTo(single?$('#detail'):$('#zoneList'));
}

let gcount={},zc={};
function refresh(){
  recompute();
  gcount={};base.forEach(r=>gcount[r.g]=(gcount[r.g]||0)+1);
  zc={};Object.entries(gcount).forEach(([g,n])=>{const z=zoneOf[g]||'gen';zc[z]=(zc[z]||0)+n});
  drawCar(zc);
  $('#carPill').querySelector('.t').innerHTML=`${esc(st.series)}<span class="nm">${NAMES[st.series]?' · '+esc(NAMES[st.series]):''}</span>${st.engine?' · '+esc(st.engine):''}`;
  // zone list
  const zz=zById(st.zone);
  if(zz){
    const gs=zz.g.filter(g=>gcount[g]);
    $('#zoneList').innerHTML=`<div class="zhead"><span>Groups in <b style="color:var(--ink)">${zz.name}</b></span><button class="linkbtn" id="clrZ">All areas</button></div><div class="zl">`+
      (gs.map(g=>`<button data-g="${g}" class="${st.group==g?'on':''}" aria-pressed="${st.group==g}"><span>${g} · ${lbl(gEn(g))}</span><span class="cnt">${gcount[g]}</span></button>`).join('')||'<p class="muted">No torque specs in this area for the current selection.</p>')+'</div>';
  } else {
    $('#zoneList').innerHTML='<div class="zhead"><span>Zone</span></div><div class="zl z2">'+ZONES.map(z=>`<button data-zz="${z.id}" ${zc[z.id]?'':'disabled'}><span>${z.name}</span><span class="cnt">${zc[z.id]||0}</span></button>`).join('')+'</div>';
  }
  const cz=$('#clrZ');if(cz)cz.onclick=()=>nav({zone:null,group:null,sub:null});
  // quick jobs
  const qk=QUICK.map(([l,q])=>{const t=terms(q);const n=base.filter(r=>t.every(w=>hasW(r.txt,w))).length;return n?`<button class="chip" data-q="${esc(q)}">${esc(l)} <span class="cnt">${n}</span></button>`:''}).join('');
  const nf=base.filter(r=>FAV.has(r.k)).length;
  $('#quick').innerHTML=(qk||nf)?`<h3 style="margin-top:0">Quick access</h3><div class="chips">${nf?`<button class="chip" data-fav="1">${I('star-fill','sm')} Favourites <span class="cnt">${nf}</span></button>`:''}${qk}</div>`:'';
  // groups grid
  const gs=Object.keys(gcount).sort();
  $('#gTotal').textContent=gs.length;
  $('#groups').innerHTML=gs.map(g=>`<button class="tile ${st.group==g?'on':''}" data-g="${g}" aria-pressed="${st.group==g}"><b>${g}</b>${lbl(gEn(g))} <span class="cnt">${gcount[g]}</span></button>`).join('')||'<div class="empty">Nothing for the current selection. Try “All” engines.</div>';
  if(isNarrow()&&st.zone)$('#allg').open=false;
  renderCrumbs();
  renderDetail();
}
function pickGroup(g,fromGrid){nav({group:g,sub:null,fav:false,zone:fromGrid?(zoneOf[g]||null):st.zone},$('#detail'));}
$('#zoneList').onclick=e=>{const b=e.target.closest('button');if(!b||b.disabled||b.id=='clrZ')return;if(b.dataset.zz)setZone(b.dataset.zz);else if(b.dataset.g)pickGroup(b.dataset.g)};
$('#groups').onclick=e=>{const b=e.target.closest('[data-g]');if(!b)return;pickGroup(b.dataset.g,true)};
$('#quick').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.fav){nav({fav:true,sub:null},$('#detail'));return}$('#q').value=b.dataset.q;doSearch(b.dataset.q)};

// ---------- breadcrumb ----------
function renderCrumbs(){
  const it=[];const searching=!!st.q;
  it.push(`<li><button data-c="car" title="Change car">${esc(st.series)}${st.engine?' · '+esc(st.engine):''}</button></li>`);
  if(searching){it.push(`<li><span aria-current="page">Search “${esc(st.q)}”</span></li>`);}
  else if(st.fav){it.push(`<li><span aria-current="page">${I('star-fill','sm')} Favourites</span></li>`);}
  else{
    const zz=zById(st.zone);
    const last=!st.group;
    it.push(zz?`<li>${last?`<span aria-current="page">${zz.name}</span>`:`<button data-c="zone">${zz.name}</button>`}</li>`:(st.group?`<li><button data-c="zones">Zone</button></li>`:`<li><span aria-current="page">Choose a zone or group</span></li>`));
    if(st.group){const gl=`${st.group} · ${esc(gEn(st.group))}`;it.push(`<li>${st.sub?`<button data-c="group">${gl}</button>`:`<span aria-current="page">${gl}</span>`}</li>`);}
    if(st.group&&st.sub){const r=cur.find(r=>r.sg==st.sub);it.push(`<li><span aria-current="page">${esc(r?r.sg:st.sub)}</span></li>`);}
  }
  const canBack=searching||st.fav||st.group||st.zone;
  const nf=base.filter(r=>FAV.has(r.k)).length;
  $('#crumbs').innerHTML=`${canBack?'<button class="back" data-c="back" aria-label="Back">‹</button>':''}<ol>${it.join('')}</ol>${nf&&!st.fav?`<button class="fav" data-c="fav" aria-label="Favourites (${nf})">${I('star-fill','sm')} ${nf}</button>`:''}`;
  const ol=$('#crumbs ol');if(ol)ol.scrollLeft=ol.scrollWidth;
}
$('#crumbs').onclick=e=>{const b=e.target.closest('[data-c]');if(!b)return;const c=b.dataset.c;
  if(c=='car'){st.pickOpen=true;renderPick();goTo($('#pick'));}
  else if(c=='zone')nav({group:null,sub:null},$('#zoneCard'));
  else if(c=='zones')nav({zone:null,group:null,sub:null},$('#zoneCard'));
  else if(c=='group')nav({sub:null});
  else if(c=='fav')nav({fav:true,sub:null},$('#detail'));
  else if(c=='back'){
    if(st.q){clearSearch();return}
    if(st.fav)nav({fav:false},$('#zoneCard'));
    else if(st.sub)nav({sub:null});
    else if(st.group){const zz=zById(st.zone);const single=zz&&zz.g.filter(g=>gcount[g]).length==1;nav(single?{group:null,zone:null}:{group:null},$('#zoneCard'));}
    else nav({zone:null},$('#zoneCard'));
  }};

// ---------- detail ----------
function valHtml(v,op){
  if(!v)return `<span class="val long" style="cursor:default">${op&&/\d\s*(Nm|°)/.test(op)?'see the steps below':'value missing in the source – check ISTA'}</span>`;
  const m=v.match(/^\s*([\d.,]+(?:\s*(?:-|–|\.\.\.|up to)\s*[\d.,]+)?)\s*(±\s*[\d.,]+)?\s*(Nm|°)\s*$/i);
  const lab=`Copy ${v}`;
  if(m)return `<button class="val" data-copy="${esc(v)}" aria-label="${esc(lab)}" title="Tap to copy"><span class="n">${esc(m[1].replace(/\s*up to\s*/i,'–').replace(/\s*-\s*/,'–'))}</span>${m[2]?`<span class="tol">${esc(m[2].replace(/\s*±\s*/,'± '))}</span>`:''}<span class="u">${esc(m[3])}</span></button>`;
  return `<button class="val long" data-copy="${esc(v)}" aria-label="${esc(lab)}" title="Tap to copy">${esc(v)}</button>`;
}
const LEGEND=`<details class="legend"><summary>What the symbols mean</summary><b>Nm</b> = newton-metre · <b>Angle</b> = after the base torque, turn further by the angle shown · <b>1AZ, 2AZ…</b> = tightening-torque reference number in ISTA · <b>New bolt</b> = single use, must be replaced · <b>Left-hand thread</b> = tightens anticlockwise and loosens clockwise. Tap a value to copy it, the star to save it to favourites.</details>`;
function renderDetail(){
  let list=cur;
  const searching=!!st.q;
  document.getElementById('tabTorque').classList.toggle('picked',!!(st.group||st.fav||searching));
  if(!searching && !st.group && !st.fav){
    $('#detailHead').innerHTML=`<div class="empty"><span class="big" aria-hidden="true">${I('chevron-right','xl')}</span><b style="color:var(--ink)">Pick an area on the drawing or from the list</b><br>The number shows how many torque specs it has. You can also search for a part directly in the field above${matchMedia('(hover:hover)').matches?' (key <kbd>/</kbd>)':''}.</div>`;
    $('#subs').innerHTML='';$('#rows').innerHTML='';return;}
  if(st.fav && !searching) list=list.filter(r=>FAV.has(r.k));
  else if(st.group && !searching) list=list.filter(r=>r.g==st.group);
  const subs={},sgi={};list.forEach(r=>{subs[r.sg]=(subs[r.sg]||0)+1;sgi[r.sg]=r.sgi});
  const sk=Object.keys(subs).sort((a,b)=>a.localeCompare(b));
  if(st.sub && !subs[st.sub]) st.sub=null;
  const title=searching?`Results for “${esc(st.q)}”`:st.fav?I('star-fill','sm')+' Favourites':`${st.group} · ${hl(gEn(st.group))}`;
  $('#detailHead').innerHTML=`<h2>${title} <span class="cnt">${list.length}</span>${(st.group&&!searching&&!st.fav)?roBtn(st.group):''}</h2>${list.length?LEGEND:''}`;
  $('#subs').innerHTML=sk.length>1?`<button class="chip ${!st.sub?'on':''}" data-sub="" aria-pressed="${!st.sub}">All <span class="cnt">${list.length}</span></button>`+sk.map(s=>`<button class="chip ${st.sub==s?'on':''}" data-sub="${esc(s)}" aria-pressed="${st.sub==s}">${lbl(s)} <span class="cnt">${subs[s]}</span></button>`).join(''):'';
  subsCollapse();
  if(st.sub) list=list.filter(r=>r.sg==st.sub);
  const shown=list.slice(0,600);
  let last='';
  $('#rows').innerHTML=shown.map(r=>{
    const hdr=(!st.sub && r.sg!==last)?`<h3>${(searching||st.fav)?esc(r.g+' · '+gEn(r.g)+' › '):''}${hl(r.sg)}</h3>`:'';last=r.sg;
    const meta=[r.lh&&'<span class="badge lh" title="Tightens anticlockwise">'+I('rotate-ccw','sm')+'Left-hand thread</span>',r.rep&&'<span class="badge rep">'+I('alert','sm')+'New bolt</span>',r.ang&&'<span class="badge ang">'+I('angle','sm')+'Angle</span>',r.a&&`<span class="tag" title="Tightening-torque reference number in ISTA">${esc(r.a.replace(/\s+(?=AZ$)/,''))}</span>`,r.th&&`<span>${/^M\d|^\d/i.test(r.th)?'Thread ':''}<b>${hl(thr(r.th))}</b></span>`,r.et&&`<span>Engine: ${esc(r.et)}</span>`,r.x&&`<span>${esc(r.x)}</span>`,r.ser.length>1?`<span title="${esc(r.ser.join(', '))}">${r.ser.length} series</span>`:'',(!r.ser.length&&!r.eng.length)?'<span>series not specified in ISTA</span>':''].filter(Boolean).join('');
    const f=FAV.has(r.k);
    return hdr+`<div class="row${r.lh?' islh':''}"><div><div class="p">${lbl(r.p)}</div><div class="meta">${meta}</div></div><div class="vbox">${valHtml(r.v,r.op)}<button class="star ${f?'on':''}" data-fk="${esc(r.k)}" aria-pressed="${f}" aria-label="${f?'Remove from favourites':'Add to favourites'}">${f?I('star-fill'):I('star')}</button></div><div class="op">${r.op?lbl(r.op):''}</div></div>`;
  }).join('')+(list.length>600?`<p class="muted">Showing the first 600 of ${list.length}. Narrow down with a subgroup or search.</p>`:'');
  if(!list.length){
    let other=0;if(st.engine&&searching){const e=st.engine;st.engine=null;other=ROWS.filter(r=>rowMatch(r)&&QT.every(w=>hasW(r.txt,w))).length;st.engine=e;}
    $('#rows').innerHTML=`<div class="empty"><span class="big" aria-hidden="true">${I('search','xl')}</span><b style="color:var(--ink)">${searching?`No results for “${esc(st.q)}” on ${esc(carLabel())}`:'No saved parts yet'}</b><br>${searching?'Try a shorter word, a synonym or the thread size (e.g. “M8”).':'Tap the star next to a torque spec to save it here.'}<div class="chips">${searching?'<button class="chip" data-act="clr">'+I('x','sm')+' Clear search</button>':''}${other?`<button class="chip" data-act="alleng">Search all engines (${other})</button>`:''}</div></div>`;
  }
}
// long subgroup lists (some groups have 60+) show the first few chips; the rest open on demand
const SUBS_MAX=7;let subsAll=false,subsKey='';
function subsCollapse(){const box=$('#subs'),key=[st.series,st.group,st.q,st.fav,st.engine].join('|');if(key!==subsKey){subsKey=key;subsAll=false}
  box.querySelector('.subs-more')?.remove();const chips=[...box.querySelectorAll('.chip')];if(chips.length<=SUBS_MAX+2)return;
  chips.forEach((c,i)=>{c.hidden=!subsAll&&i>SUBS_MAX&&!c.classList.contains('on')});
  box.insertAdjacentHTML('beforeend',`<button class="chip subs-more" data-more="1" aria-expanded="${subsAll}">${subsAll?'Show fewer':`Show all ${chips.length-1} subgroups`}</button>`)}
$('#subs').onclick=e=>{if(e.target.closest('[data-more]')){subsAll=!subsAll;subsCollapse();return}const b=e.target.closest('[data-sub]');if(!b)return;nav({sub:b.dataset.sub||null});const on=$('#subs .chip.on');if(on)on.scrollIntoView({behavior:SM(),inline:'nearest',block:'nearest'})};
async function copyText(t){try{await navigator.clipboard.writeText(t);try{UShell.noteCopy()}catch(_){}return true}catch(e){const a=document.createElement('textarea');a.value=t;a.style.position='fixed';a.style.opacity='0';document.body.appendChild(a);a.select();let ok=false;try{ok=document.execCommand('copy')}catch(_){}a.remove();return ok}}
$('#rows').onclick=async e=>{
  const v=e.target.closest('[data-copy]');
  if(v){const row=v.closest('.row');const pe=row&&(row.querySelector('.p > span'));const name=pe?pe.textContent:'';const t=v.dataset.copy;const ok=await copyText(name?`${name}: ${t}`:t);v.classList.add('copied');setTimeout(()=>v.classList.remove('copied'),900);toast(ok?`Copied: ${t}`:t);return}
  const s=e.target.closest('[data-fk]');
  if(s){const k=s.dataset.fk;if(FAV.has(k))FAV.delete(k);else FAV.add(k);try{localStorage.setItem('tq_fav',JSON.stringify([...FAV]))}catch(err){}
    const on=FAV.has(k);s.classList.toggle('on',on);s.innerHTML=on?I('star-fill'):I('star');s.setAttribute('aria-pressed',on);s.setAttribute('aria-label',on?'Remove from favourites':'Add to favourites');toast(on?'Added to favourites':'Removed from favourites');
    if(st.fav&&!on){refresh()}else{renderCrumbs();refreshQuickFav(k)}return}
  const a=e.target.closest('[data-act]');
  if(a){if(a.dataset.act=='clr')clearSearch();else if(a.dataset.act=='alleng')setEngine(null);}
};
function refreshQuickFav(k){const nf=base.filter(r=>FAV.has(r.k)).length;const b=$('#quick [data-fav]');if(b&&nf)b.querySelector('.cnt').textContent=nf;else if(!!b!=!!nf){const sel=k?`[data-fk="${CSS.escape(k)}"]`:null,el=sel&&$(sel),t0=el?el.getBoundingClientRect().top:0,y=scrollY;refresh();const el2=sel&&$(sel);if(el2)scrollBy(0,el2.getBoundingClientRect().top-t0);else scrollTo(0,y)}}

// ---------- VIN + RealOEM ----------
let VIN={};try{VIN=JSON.parse(localStorage.getItem('tq_vin')||'{}')}catch(e){}
function saveVIN(){try{localStorage.setItem('tq_vin',JSON.stringify(VIN))}catch(e){}}
function roUrl(g){const v=VIN[st.series];if(!v)return null;
  if(v.rid)return 'https://www.realoem.com/bmw/enUS/partgrp?id='+encodeURIComponent(v.rid)+(g?'&mg='+encodeURIComponent(g):'');
  return 'https://www.realoem.com/bmw/enUS/select?vin='+encodeURIComponent(v.vin)}
function roBtn(g){const v=VIN[st.series];
  if(!v)return ` <button class="chip" data-ro="set" style="font-size:13px" title="Add your VIN to open the parts diagrams">${I('link','sm')} RealOEM · add VIN</button>`;
  return ` <a class="chip" href="${esc(roUrl(g))}" target="_blank" rel="noopener noreferrer" data-ro="go" data-g="${esc(g)}" style="font-size:13px;text-decoration:none" title="Open parts diagrams for ${esc(st.series)} (VIN …${esc(v.vin)})">${I('link','sm')} RealOEM diagrams · group ${esc(g)}</a>`}
function renderVin(){const v=VIN[st.series];const b=$('#vinBtn');if(!b)return;b.innerHTML=I('key','sm')+(v?' VIN …'+esc(v.vin):' Add VIN');$('#vinCar').textContent=st.series||'';}
$('#vinBtn').onclick=()=>{const f=$('#vinForm');const open=f.classList.toggle('hide')===false;$('#vinBtn').setAttribute('aria-expanded',open);const v=VIN[st.series]||{};$('#vinIn').value=v.full||v.vin||'';$('#roIn').value=v.rid?('id='+v.rid):'';if(open)$('#vinIn').focus()};
$('#vinSave').onclick=()=>{const raw=$('#vinIn').value.toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(raw.length!=7&&raw.length!=17){toast('The VIN must have 7 or 17 characters');return}
  if(/[IOQ]/.test(raw)){toast('A VIN never contains the letters I, O or Q — please check');return}
  const m=($('#roIn').value||'').match(/[?&]?id=([A-Za-z0-9_-]+)/);
  VIN[st.series]={vin:raw.slice(-7),full:raw.length==17?raw:'',rid:m?m[1]:''};saveVIN();renderVin();$('#vinForm').classList.add('hide');$('#vinBtn').setAttribute('aria-expanded','false');toast('VIN saved for '+st.series);if(st.group){const y=scrollY;renderDetail();scrollTo(0,y)}};
$('#vinDel').onclick=()=>{delete VIN[st.series];saveVIN();renderVin();$('#vinForm').classList.add('hide');toast('VIN deleted');if(st.group){const y=scrollY;renderDetail();scrollTo(0,y)}};
$('#detailHead').addEventListener('click',async e=>{const a=e.target.closest('[data-ro]');if(!a)return;
  if(a.dataset.ro=='set'){e.preventDefault();$('#pick').scrollIntoView({behavior:SM(),block:'start'});if($('#vinForm').classList.contains('hide'))$('#vinBtn').click();return}
  const v=VIN[st.series];if(v&&!v.rid){await copyText(v.vin);toast('VIN …'+v.vin+' copied · on RealOEM, go to group '+a.dataset.g)}});

function backupAll(){
  const o={app:BACKUP_ID,v:2,date:new Date().toISOString(),fav:[...FAV],vin:VIN};
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(o)],{type:'application/json'}));a.download='boltspec_backup_'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();toast('Backup downloaded')}
async function restoreAll(file){try{const o=JSON.parse(await file.text());if(!BACKUP_IDS.includes(o.app))throw 0;
  (o.fav||[]).forEach(k=>FAV.add(k));if(o.vin){Object.assign(VIN,o.vin);saveVIN();renderVin()}localStorage.setItem('tq_fav',JSON.stringify([...FAV]));
  toast('Backup restored');if(st.series)refresh();}catch(e){toast('Invalid backup file')}}

// ---------- search ----------
function doSearch(v){
  st.q=v.trim();
  if(!st.series){const h=$('#pickHint');h.classList.toggle('hide',!st.q);h.textContent='Choose your car first — then I\'ll search “'+st.q+'” in its torque specs only.';st.pickOpen=true;renderPick();return}
  if(st.q)showTab('tabTorque');
  refresh();if(st.q)goTo($('#detail'));
  {const c=document.querySelector('#detailHead .cnt'),sr=$('#srStatus');if(sr)sr.textContent=st.q?`${c?c.textContent:0} results for ${st.q}`:'';}
  // analytics: log the search once the user stops typing, with the number of results
  clearTimeout(window.__bsSq);if(st.q.length>1&&window.BSA){const qq=st.q;window.__bsSq=setTimeout(()=>{if(st.q!==qq)return;const c=document.querySelector('#detailHead .cnt');BSA('search',qq,c?+c.textContent:0)},1500)}
}
function clearSearch(){$('#q').value='';st.q='';$('#pickHint').classList.add('hide');if(st.series)refresh();}
let qt;$('#q').oninput=e=>{clearTimeout(qt);qt=setTimeout(()=>doSearch(e.target.value),220)};
$('#q').onkeydown=e=>{if(e.key=='Enter'){clearTimeout(qt);doSearch(e.target.value);if(matchMedia('(pointer:coarse)').matches)e.target.blur()}else if(e.key=='Escape'){clearSearch();e.target.blur()}};
document.addEventListener('keydown',e=>{
  if(e.key=='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)&&!document.activeElement.isContentEditable){e.preventDefault();$('#q').focus();$('#q').select();}
});

// tabs
function showTab(id){document.querySelectorAll('.tab').forEach(x=>x.setAttribute('aria-selected',x.dataset.t==id));['tabTorque','tabService'].forEach(t=>$('#'+t).classList.toggle('hide',t!=id));if(id=='tabService')renderService();}
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>showTab(t.dataset.t));
$('.tabs').onkeydown=e=>{if(e.key!='ArrowRight'&&e.key!='ArrowLeft')return;const ts=[...document.querySelectorAll('.tab')];let i=ts.indexOf(document.activeElement);if(i<0)return;i=(i+(e.key=='ArrowRight'?1:-1)+ts.length)%ts.length;ts[i].focus();showTab(ts[i].dataset.t)};

// header height -> CSS var (sticky breadcrumb + scroll offsets)
const hdr=$('#hdr');const setHH=()=>document.documentElement.style.setProperty('--hh',hdr.offsetHeight+'px');
if(window.ResizeObserver)new ResizeObserver(setHH).observe(hdr);setHH();

// ---------- service ----------
const INTV=[
 // [item, km normal, months, fuel filter (b/d/h/all), severe km, note]
 ['Engine oil + oil filter',15000,12,'all',10000,'BMW official (CBS) up to 30,000 km / 2 years; 10–15,000 km recommended for longevity (turbo, timing chain).'],
 ['Cabin filter (microfilter / activated carbon)',30000,24,'all',15000,'With every second oil change.'],
 ['Engine air filter',60000,48,'all',30000,'More often in dusty areas.'],
 ['Spark plugs',60000,48,'b',45000,'Turbo engines (N54/N55/N20/B48/B58…): 40,000–60,000 km.'],
 ['Spark plugs',60000,48,'h',45000,''],
 ['Diesel fuel filter',60000,48,'d',40000,'Some models: 90,000 km; check CBS.'],
 ['Brake fluid (DOT 4 LV)',0,24,'all',0,'Every 2 years regardless of mileage.'],
 ['Brake pads / discs',0,0,'all',0,'Per wear sensor / CBS; check at every service.'],
 ['Coolant (antifreeze)',0,48,'all',0,'BMW: “lifetime”; recommended every 4–5 years; check concentration yearly.'],
 ['Automatic transmission oil (ZF) + pan/filter',100000,96,'all',80000,'BMW: “lifetime”; ZF recommends 80–120,000 km / 8 years.'],
 ['Differential / xDrive transfer box oil',100000,0,'all',60000,'More often when towing / driving hard.'],
 ['Accessory belt + tensioner',120000,72,'all',90000,'Visual check at every service.'],
 ['Power steering fluid (where fitted)',0,0,'all',0,'Check level; no fixed interval.'],
 ['Air conditioning (refrigerant check + disinfection)',0,24,'all',0,''],
 ['Wipers + washer fluid',0,12,'all',0,''],
 ['12V battery (test / register when replaced)',0,12,'all',0,'When replaced: code/register with ISTA.'],
 ['High-voltage system (check)',0,24,'h',0,'HV-certified workshops only.']
];
const fmtKm=n=>n.toLocaleString('en-GB')+' km';
function renderService(){
  $('#svcCar').textContent=$('#pCar').textContent=`${st.series}${NAMES[st.series]?' '+NAMES[st.series]:''}${st.engine?' · '+st.engine:''}`;
  const fuel=$('#fuel').value, sev=$('#use').value=='s', km=+$('#kmNow').value||0;
  const items=INTV.filter(i=>i[3]=='all'||i[3]==fuel);
  $('#intervals').innerHTML='<tr><th>Task</th><th>Interval (km)</th><th>Interval (time)</th><th>Next due at</th><th>Notes</th></tr>'+items.map(i=>{
    const k=sev&&i[4]?i[4]:i[1];
    let nxt=km||!k?'—':'<span class="muted">enter km</span>';if(k&&km){const n=Math.ceil((km+1)/k)*k;const left=n-km;nxt=`<span class="${left<=1000?'due':left<=k*.15?'soon':'okk'}">${fmtKm(n)}</span><span class="left">${left<=1000?'now / very soon':'in '+fmtKm(left)}</span>`;}
    return `<tr><td><b>${i[0]}</b></td><td>${k?fmtKm(k):'—'}</td><td>${i[2]?(i[2]%12?i[2]+' months':i[2]/12+(i[2]==12?' year':' years')):'—'}</td><td>${nxt}</td><td class="muted">${i[5]}</td></tr>`}).join('');
  // capacities
  const s=st.series, se=SE[s]||[];
  const caps=C.filter(c=>{
    if(c.s.length && !c.s.includes(s)) return false;
    if(!c.s.length && !c.e.length) return false;
    if(c.e.length){ if(st.engine) return c.e.includes(st.engine); if(!c.s.length) return c.e.some(e=>se.includes(e)); }
    return true;});
  const ord={'11':1,'17':2,'24':3,'23':3,'28':3,'27':4,'31':5,'33':5,'64':6,'16':7,'61':8};
  caps.sort((a,b)=>(ord[a.g]||9)-(ord[b.g]||9));
  $('#capsBox').innerHTML=caps.length?'<div class="caps">'+caps.map(c=>`<div class="capc"><h4>${lbl(c.n)}</h4><div class="muted" style="font-size:12.5px;margin-bottom:6px">${esc(c.b.join('/'))} ${esc(c.s.slice(0,12).join(', '))}${c.s.length>12?'…':''}${c.x?' · '+esc(c.x):''}</div><table>${c.r.map((r,ri)=>'<tr>'+r.map((x,ci)=>`<td>${(c.rr&&c.rr[ri]&&c.rr[ri][ci])?lbl(x):esc(x)}</td>`).join('')+'</tr>').join('')}</table></div>`).join('')+'</div>':`<div class="empty">ISTA has no capacity tables for this selection.${st.engine?' <button class="chip" id="capAll">Show for all engines</button>':''}<br>Also check the label in the engine bay.</div>`;
  const ca=$('#capAll');if(ca)ca.onclick=()=>{setEngine(null);renderService()};
  // checklist
  const chk=[['Engine','Change engine oil + filter','Check for oil leaks (valve cover, sump, filter)','Check coolant level + concentration','Check the accessory belt','Air filter','Spark plugs / diesel filter (per interval)','Read fault codes with ISTA'],
   ['Brakes & wheels','Pad and disc thickness front/rear','Brake fluid (moisture test / change)','Tyre pressure + wear, DOT date','Wheel bolt torque (see group 36)'],
   ['Axles & steering','Bushes, ball joints, links, tie rod ends','Drive shaft / prop shaft boots','Shock absorbers – leaks','Steering play'],
   ['Interior & electrics','Cabin filter','Exterior lights + headlights','Wipers + washer fluid','12V battery – test','Air conditioning operation','Reset CBS after service'],
   ['Underneath','Exhaust – mounts, leaks','Gearbox / differential – leaks','Brake / fuel lines']];
  let ci=0;
  $('#checklist').innerHTML=chk.map(g=>`<tr><th colspan="3">${g[0]}</th></tr>`+g.slice(1).map(i=>{ci++;return `<tr><td><input type="checkbox" id="ck${ci}"></td><td><label for="ck${ci}">${i}</label></td><td style="width:40%;border-bottom:1px dotted var(--line)"></td></tr>`}).join('')).join('');
}
['fuel','use','kmNow'].forEach(id=>$('#'+id).addEventListener('input',renderService));
$('#chkDate').valueAsDate=new Date();
function doPrint(chkOnly){
  $('#pCar').textContent=$('#svcCar').textContent;
  const d=$('#chkDate').value,k=$('#chkKm').value||$('#kmNow').value;
  $('#pMeta').textContent=[d&&('Date: '+new Date(d).toLocaleDateString('en-GB')),k&&('Km: '+(+k).toLocaleString('en-GB')),$('#chkNote').value&&('Note: '+$('#chkNote').value)].filter(Boolean).join(' · ');
  document.body.classList.toggle('print-chk',chkOnly);window.print();
}
$('#printChk').onclick=()=>doPrint(true);$('#printAll').onclick=()=>doPrint(false);
addEventListener('afterprint',()=>document.body.classList.remove('print-chk'));

$('#foot').innerHTML=`Source: ${esc(D.meta.src)} · ${D.meta.docs.toLocaleString('en-GB')} “Tightening torques” documents · ${ROWS.length.toLocaleString('en-GB')} unique torque specs. Personal use. Always check the official documentation, especially for single-use bolts and angle tightening.`;


$('#bkExp').onclick=backupAll;$('#bkImpB').onclick=()=>$('#bkImp').click();$('#bkImp').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)restoreAll(f)};
renderBrands();renderPick();
try{const s=localStorage.getItem('tq_series');if(s&&allSeries.includes(s)){selectSeries(s,true);const e=localStorage.getItem('tq_engine');if(e&&ALLENG.includes(e)){st.engine=e;renderEngines();refresh();}window.scrollTo(0,0)}}catch(e){}
try{const P=new URLSearchParams(location.search);const ps=P.get('series');
  if(ps&&allSeries.includes(ps)){selectSeries(ps,true);const pe=P.get('engine');st.engine=(pe&&ALLENG.includes(pe))?pe:null;renderEngines();try{localStorage.setItem('tq_engine',st.engine||'')}catch(_){}refresh();}
  const pq=P.get('q');if(pq&&st.series){$('#q').value=pq;doSearch(pq);}
  if(P.toString())history.replaceState(history.state,'',location.pathname);}catch(e){}
try{if(!history.state)history.replaceState(snap(),'')}catch(e){}
window.addEventListener('car:change',ev=>{const d=ev.detail||{};if(!d.s){return}if(d.s!==st.series&&allSeries.includes(d.s))selectSeries(d.s,true);st.engine=(d.e&&ALLENG.includes(d.e))?d.e:null;renderEngines();refresh();try{localStorage.setItem('tq_engine',st.engine||'')}catch(e){}});
scrollEng();
(function(){const b=$('#drawTog');if(!b)return;b.onclick=()=>{const w=b.closest('.carwrap');const on=!w.classList.contains('showcar');w.classList.toggle('showcar',on);b.setAttribute('aria-expanded',on);b.lastChild.textContent=on?' Hide drawing':' Show on drawing';}})();
