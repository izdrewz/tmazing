const STORE_KEY="tmazing-uni-hub-v1";
const DEFAULT_IGNORE=`a
an
and
are
as
at
be
because
been
but
by
for
from
has
have
he
her
his
i
in
is
it
its
of
on
or
our
she
so
that
the
their
them
then
there
these
they
this
to
was
we
were
which
with
you
your`;
let state=loadState();
let selectedMatch=null;
const $=id=>document.getElementById(id);
const els={deadlineList:$('deadlineList'),goalList:$('goalList'),sourceLibrary:$('sourceLibrary'),moduleFilter:$('moduleFilter'),librarySearch:$('librarySearch'),sourceForm:$('sourceForm'),sourceFile:$('sourceFile'),sourceText:$('sourceText'),draftInput:$('draftInput'),highlightedDraft:$('highlightedDraft'),matchPanel:$('matchPanel'),citedDraft:$('citedDraft'),bibliography:$('bibliography'),ignoreWords:$('ignoreWords')};
init();
function init(){normalise();bind();renderAll();}
function bind(){
 $('addDeadline').addEventListener('click',()=>{state.deadlines.push({id:id(),title:'',module:'',date:'',notes:'',done:false});save();renderDeadlines();});
 $('addGoal').addEventListener('click',()=>{state.goals.push({id:id(),title:'',type:'Study',status:'Not started',notes:''});save();renderGoals();});
 els.sourceForm.addEventListener('submit',addSource);
 els.sourceFile.addEventListener('change',readSourceFile);
 els.librarySearch.addEventListener('input',renderLibrary);
 els.moduleFilter.addEventListener('change',renderLibrary);
 $('analyseDraft').addEventListener('click',analyseDraft);
 $('clearDraft').addEventListener('click',()=>{els.draftInput.value='';state.draft='';state.citations=[];save();analyseDraft();renderCitedDraft();});
 $('copyCitedDraft').addEventListener('click',()=>copyText(els.citedDraft.value));
 $('copyBibliography').addEventListener('click',()=>copyText(els.bibliography.innerText));
 $('saveIgnore').addEventListener('click',()=>{state.ignoreWords=parseIgnore(els.ignoreWords.value);save();analyseDraft();});
 $('resetIgnore').addEventListener('click',()=>{state.ignoreWords=parseIgnore(DEFAULT_IGNORE);els.ignoreWords.value=state.ignoreWords.join('\n');save();analyseDraft();});
 $('exportData').addEventListener('click',exportData);
 $('importData').addEventListener('change',importData);
 els.draftInput.addEventListener('input',()=>{state.draft=els.draftInput.value;save();renderCitedDraft();});
}
function loadState(){try{return JSON.parse(localStorage.getItem(STORE_KEY))||defaultState();}catch{return defaultState();}}
function defaultState(){return{deadlines:[],goals:[],sources:[],ignoreWords:parseIgnore(DEFAULT_IGNORE),draft:'',citations:[]};}
function normalise(){state.deadlines ||= [];state.goals ||= [];state.sources ||= [];state.ignoreWords ||= parseIgnore(DEFAULT_IGNORE);state.draft ||= '';state.citations ||= [];}
function save(){localStorage.setItem(STORE_KEY,JSON.stringify(state));}
function renderAll(){els.ignoreWords.value=state.ignoreWords.join('\n');els.draftInput.value=state.draft;renderDeadlines();renderGoals();renderModuleFilter();renderLibrary();analyseDraft(false);renderCitedDraft();}
function renderDeadlines(){els.deadlineList.innerHTML='';if(!state.deadlines.length){els.deadlineList.innerHTML='<div class="empty-box">No deadlines yet.</div>';return;}state.deadlines.sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')).forEach(d=>{const tpl=$('deadlineTemplate').content.firstElementChild.cloneNode(true);tpl.classList.toggle('done',d.done);const days=daysUntil(d.date);if(days!==null&&days<0)tpl.classList.add('overdue');else if(days!==null&&days<=7)tpl.classList.add('due-soon');bindField(tpl,'.deadline-title',d,'title');bindField(tpl,'.deadline-module',d,'module');bindField(tpl,'.deadline-date',d,'date');bindField(tpl,'.deadline-notes',d,'notes');const done=document.createElement('button');done.type='button';done.className='ghost';done.textContent=d.done?'Mark active':'Mark done';done.onclick=()=>{d.done=!d.done;save();renderDeadlines();};tpl.querySelector('.card-actions').prepend(done);tpl.querySelector('.remove-card').onclick=()=>removeItem(state.deadlines,d.id,renderDeadlines);els.deadlineList.appendChild(tpl);});}
function renderGoals(){els.goalList.innerHTML='';if(!state.goals.length){els.goalList.innerHTML='<div class="empty-box">No goals yet.</div>';return;}state.goals.forEach(g=>{const tpl=$('goalTemplate').content.firstElementChild.cloneNode(true);tpl.classList.toggle('done',g.status==='Done');bindField(tpl,'.goal-title',g,'title');bindField(tpl,'.goal-type',g,'type');bindField(tpl,'.goal-status',g,'status');bindField(tpl,'.goal-notes',g,'notes');tpl.querySelector('.remove-card').onclick=()=>removeItem(state.goals,g.id,renderGoals);els.goalList.appendChild(tpl);});}
function bindField(root,sel,obj,key){const el=root.querySelector(sel);el.value=obj[key]||'';el.addEventListener('input',()=>{obj[key]=el.value;save();});}
function removeItem(arr,itemId,after){if(!confirm('Remove this item?'))return;const i=arr.findIndex(x=>x.id===itemId);if(i>-1)arr.splice(i,1);save();after();}
function daysUntil(dateStr){if(!dateStr)return null;const today=new Date();today.setHours(0,0,0,0);const d=new Date(dateStr);d.setHours(0,0,0,0);return Math.round((d-today)/86400000);}
async function readSourceFile(){const file=els.sourceFile.files?.[0];if(!file)return;const ok=/\.(txt|md|csv|html|htm|json|rtf)$/i.test(file.name);if(!ok){alert('This version reads text-like files only. For PDF or Word files, copy and paste the useful text into the source text box.');return;}els.sourceText.value=await file.text();}
function addSource(e){e.preventDefault();const text=els.sourceText.value.trim();if(!text){alert('Add source text so the checker can search it.');return;}state.sources.push({id:id(),module:val('moduleCode').toUpperCase(),unit:val('unitBlock'),title:val('sourceTitle'),authors:val('sourceAuthors'),year:val('sourceYear'),publisher:val('sourcePublisher'),url:val('sourceUrl'),pages:val('sourcePages'),text,created:new Date().toISOString()});save();e.target.reset();renderModuleFilter();renderLibrary();analyseDraft(false);}
function val(idName){return $(idName).value.trim();}
function renderModuleFilter(){const current=els.moduleFilter.value;const mods=[...new Set(state.sources.map(s=>s.module).filter(Boolean))].sort();els.moduleFilter.innerHTML='<option value="">All modules</option>'+mods.map(m=>`<option>${esc(m)}</option>`).join('');els.moduleFilter.value=mods.includes(current)?current:'';}
function renderLibrary(){const q=norm(els.librarySearch.value||'');const mod=els.moduleFilter.value;els.sourceLibrary.innerHTML='';const list=state.sources.filter(s=>(!mod||s.module===mod)&&(!q||norm([s.module,s.unit,s.title,s.authors,s.year,s.publisher,s.url,s.pages,s.text].join(' ')).includes(q)));if(!list.length){els.sourceLibrary.innerHTML='<div class="empty-box">No matching sources yet.</div>';return;}list.forEach(s=>{const card=document.createElement('article');card.className='source-card';const snips=q?snippets(s.text,q,3):[];card.innerHTML=`<h3>${esc(s.title)}</h3><p class="source-meta">${esc(s.module)} • ${esc(s.unit)} • ${esc(s.authors)} (${esc(s.year)}) ${s.pages?`• ${esc(s.pages)}`:''}</p><p class="source-meta">${esc(harvardRef(s))}</p><div>${snips.map(x=>`<div class="snippet">${x}</div>`).join('')}</div><div class="source-actions"><button class="ghost" data-act="copy">Copy Harvard ref</button><button class="ghost" data-act="view">View text</button><button class="danger" data-act="remove">Remove</button></div>`;card.querySelector('[data-act="copy"]').onclick=()=>copyText(harvardRef(s));card.querySelector('[data-act="view"]').onclick=()=>alert(s.text.slice(0,8000));card.querySelector('[data-act="remove"]').onclick=()=>{if(!confirm('Remove this source?'))return;state.sources=state.sources.filter(x=>x.id!==s.id);state.citations=state.citations.filter(c=>c.sourceId!==s.id);save();renderModuleFilter();renderLibrary();analyseDraft(false);renderCitedDraft();};els.sourceLibrary.appendChild(card);});}
function analyseDraft(showEmpty=true){const draft=els.draftInput.value;state.draft=draft;save();selectedMatch=null;els.matchPanel.className='match-panel empty-box';els.matchPanel.textContent='Select a highlighted word or phrase.';if(!draft.trim()){els.highlightedDraft.className='draft-output empty-box';els.highlightedDraft.textContent=showEmpty?'Paste a draft and run the checker.':'Run the checker to see linked words and phrases here.';return;}const matches=findDraftMatches(draft);els.highlightedDraft.className='draft-output';els.highlightedDraft.innerHTML=buildHighlightedHtml(draft,matches);els.highlightedDraft.querySelectorAll('.linked-word').forEach(btn=>btn.addEventListener('click',()=>showMatches(btn.dataset.key,Number(btn.dataset.start),Number(btn.dataset.end))));renderCitedDraft();}
function findDraftMatches(text){const ignore=new Set(state.ignoreWords.map(norm));const mode=$('matchMode').value;const min=Number($('minWordLength').value)||5;const tokens=tokenise(text);const out=[];let i=0;while(i<tokens.length){const t=tokens[i];if(!/\w/.test(t.text)){i++;continue;}let found=null;if(mode==='phrase'){for(let len=4;len>=2;len--){const slice=tokens.slice(i,i+len);if(slice.length<len)continue;if(!slice.every(x=>/\w/.test(x.text)))continue;const phrase=slice.map(x=>x.text).join(' ');const words=phrase.split(/\s+/).map(norm);if(words.some(w=>ignore.has(w)||w.length<min))continue;const sources=findSourcesFor(phrase);if(sources.length){found={key:phrase,start:slice[0].start,end:slice[slice.length-1].end,type:'phrase',sources};break;}}}
 if(!found){const word=t.text;const n=norm(word);if(n.length>=min&&!ignore.has(n)){const sources=findSourcesFor(word);if(sources.length)found={key:word,start:t.start,end:t.end,type:'word',sources};}}
 if(found){out.push(found);i+=found.type==='phrase'?found.key.split(/\s+/).length:1;}else i++;}
return out;}
function tokenise(text){const re=/[A-Za-zÀ-ÖØ-öø-ÿ0-9'-]+|\s+|[^\sA-Za-zÀ-ÖØ-öø-ÿ0-9'-]+/g;let m,arr=[];while((m=re.exec(text))){arr.push({text:m[0],start:m.index,end:m.index+m[0].length});}return arr;}
function findSourcesFor(term){const n=norm(term);if(!n)return[];return state.sources.map(s=>{const tx=norm(s.text);const idx=tx.indexOf(n);if(idx<0)return null;return{source:s,score:n.split(' ').length,snippet:snippetAround(s.text,term)}}).filter(Boolean).sort((a,b)=>b.score-a.score).slice(0,8);}
function buildHighlightedHtml(text,matches){let html='',pos=0;matches.forEach(m=>{html+=esc(text.slice(pos,m.start));html+=`<button class="linked-word ${m.type==='phrase'?'phrase':''}" data-key="${escAttr(m.key)}" data-start="${m.start}" data-end="${m.end}" title="${m.sources.length} source match(es)">${esc(text.slice(m.start,m.end))}</button>`;pos=m.end;});html+=esc(text.slice(pos));return html;}
function showMatches(key,start,end){const found=findSourcesFor(key);selectedMatch={key,start,end,sources:found};els.matchPanel.className='match-panel';if(!found.length){els.matchPanel.textContent='No source matches found.';return;}els.matchPanel.innerHTML=`<p><span class="citation-chip">${esc(key)}</span> matched ${found.length} source(s).</p>`+found.map((m,i)=>`<div class="match-item"><div class="match-title">${esc(m.source.title)}</div><div class="source-meta">${esc(m.source.module)} • ${esc(m.source.unit)} • ${esc(m.source.authors)} (${esc(m.source.year)})</div><div class="snippet">${m.snippet}</div><div class="source-actions"><button data-add="${m.source.id}">Add citation ${esc(inlineCitation(m.source))}</button><button class="ghost" data-copy="${m.source.id}">Copy ref</button><button class="ghost" data-ignore="${escAttr(key)}">Ignore this term</button></div></div>`).join('');els.matchPanel.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>addCitation(start,end,b.dataset.add));els.matchPanel.querySelectorAll('[data-copy]').forEach(b=>{const s=sourceById(b.dataset.copy);b.onclick=()=>copyText(harvardRef(s));});els.matchPanel.querySelectorAll('[data-ignore]').forEach(b=>b.onclick=()=>ignoreTerm(b.dataset.ignore));}
function addCitation(start,end,sourceId){const existing=state.citations.find(c=>c.start===start&&c.end===end&&c.sourceId===sourceId);if(!existing)state.citations.push({id:id(),start,end,sourceId});save();renderCitedDraft();}
function renderCitedDraft(){const text=state.draft||els.draftInput.value||'';if(!text){els.citedDraft.value='';els.bibliography.className='bibliography empty-box';els.bibliography.textContent='No selected citations yet.';return;}const cites=state.citations.filter(c=>sourceById(c.sourceId)&&c.end<=text.length).sort((a,b)=>b.end-a.end);let out=text;cites.forEach(c=>{const s=sourceById(c.sourceId);out=out.slice(0,c.end)+` ${inlineCitation(s)}`+out.slice(c.end);});els.citedDraft.value=out;const refs=[...new Map(cites.map(c=>[c.sourceId,sourceById(c.sourceId)])).values()].filter(Boolean).sort((a,b)=>harvardSort(a).localeCompare(harvardSort(b)));if(!refs.length){els.bibliography.className='bibliography empty-box';els.bibliography.textContent='No selected citations yet.';return;}els.bibliography.className='bibliography';els.bibliography.innerHTML=refs.map(s=>`<p>${esc(harvardRef(s))}</p>`).join('');}
function inlineCitation(s){return `(${citationName(s.authors)}, ${s.year||'n.d.'})`;}
function citationName(authors){const a=(authors||'Unknown author').split(/\s+and\s+|;/i).filter(Boolean);const surname=x=>{x=x.trim();if(x.includes(','))return x.split(',')[0].trim();const parts=x.split(/\s+/);return parts[parts.length-1]||x;};if(a.length===1)return surname(a[0]);if(a.length===2)return `${surname(a[0])} and ${surname(a[1])}`;return `${surname(a[0])} et al.`;}
function harvardRef(s){const auth=s.authors||'Unknown author';const year=s.year||'n.d.';const title=s.title||'Untitled source';const pub=s.publisher?` ${s.publisher}.`:'';const loc=s.pages?` ${s.pages}.`:'';const url=s.url?` Available at: ${s.url}.`:'';return `${auth} (${year}) ${title}.${pub}${loc}${url}`.replace(/\s+/g,' ').trim();}
function harvardSort(s){return `${s.authors||s.title||''} ${s.year||''}`.toLowerCase();}
function sourceById(sourceId){return state.sources.find(s=>s.id===sourceId);}
function ignoreTerm(term){const parts=term.split(/\s+/).map(norm).filter(Boolean);state.ignoreWords=[...new Set([...state.ignoreWords,...parts])].sort();els.ignoreWords.value=state.ignoreWords.join('\n');save();analyseDraft();}
function parseIgnore(value){return[...new Set(String(value).split(/[\s,]+/).map(norm).filter(Boolean))].sort();}
function snippets(text,q,count=3){const n=norm(text),needle=norm(q);let idx=0,out=[];while(out.length<count&&(idx=n.indexOf(needle,idx))>-1){out.push(snippetAround(text,q));idx+=needle.length;}return out;}
function snippetAround(text,term){const lower=text.toLowerCase();const n=term.toLowerCase();let idx=lower.indexOf(n);if(idx<0)idx=norm(text).indexOf(norm(term));const start=Math.max(0,idx-110);const end=Math.min(text.length,idx+term.length+130);let sn=esc(text.slice(start,end));const safe=esc(term);try{sn=sn.replace(new RegExp(safe.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'ig'),m=>`<mark>${m}</mark>`);}catch{}return `${start>0?'…':''}${sn}${end<text.length?'…':''}`;}
function copyText(text){navigator.clipboard?.writeText(text).then(()=>alert('Copied.')).catch(()=>alert('Copy failed. Select and copy manually.'));}
function exportData(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='tmazing-uni-hub-backup.json';a.click();URL.revokeObjectURL(url);}
function importData(e){const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(String(reader.result));if(!data||!Array.isArray(data.sources))throw new Error('Invalid backup');if(!confirm('Import this backup? It will replace the data in this browser.'))return;state=data;normalise();save();renderAll();}catch{alert('Could not import that file.');}finally{e.target.value='';}};reader.readAsText(file);}
function norm(s){return String(s||'').toLowerCase().replace(/[’]/g,"'").replace(/[^a-z0-9'\s-]/g,' ').replace(/\s+/g,' ').trim();}
function esc(s){return String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
function escAttr(s){return esc(s).replaceAll('\n',' ');}
function id(){return crypto?.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;}
