'use strict';
(() => {
  const $ = (selector) => document.querySelector(selector);
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const score = value => value == null ? '—' : Number(value).toFixed(1);
  const bytes = value => value == null ? 'Unknown' : value < 1024 ? `${value} B` : value < 1048576 ? `${(value/1024).toFixed(1)} KiB` : `${(value/1048576).toFixed(1)} MiB`;
  const label = track => track === 'real-apps' ? 'REAL APPLICATION' : 'HTML EXPERIENCE';
  const state = {data:null, modelSettings:new Map(), view:'gallery', selected:null, categoryTask:null, categoryTrigger:null, categoryAllModels:false, tab:'preview', promptText:'', promptToken:0, loading:false};
  const headings = {
    gallery:['THE SHOWCASE','Show me what it <em>built.</em>','Same prompts. Different models. Put the results next to each other and look closer.'],
    catalog:['THE PROMPTS','One prompt.<br><em>Go build.</em>','Simulations, games, creative tools and real applications. The brief, the checks and the delivery requirements are all here.'],
    leaderboard:['THE EVALUATIONS','Bring the<br><em>receipts.</em>','Independent checks on the finished artifact. Keep the tasks, tools and budgets comparable.'],
    guide:['THE FIELD GUIDE','From prompt<br>to <em>proof.</em>','Choose a challenge. Let the agent build and test. Keep the result. Take a closer look.'],
    why:['WHY THIS PROJECT?','You can’t play<br>a <em>percentage.</em>','Scores help. I still want to try what the model built.']
  };
  const filterIDs=['search','track-filter','model-filter','task-filter','status-filter','sort'];
  const storageKey='trial-by-pyro-ui-v1';
  const isPublic=()=>state.data?.mode==='public';
  const modelName=row=>state.modelSettings.get(row.model_key)?.label||row.model||row.model_key;
  function modelColor(row) {
    const configured=state.modelSettings.get(row.model_key)?.color;if(configured)return configured;
    let hash=0;for(const char of row.model_key)hash=(Math.imul(hash,31)+char.codePointAt(0))>>>0;
    return `hsl(${hash%360} 55% 72%)`;
  }
  function compareModels(a,b) {
    const orderA=state.modelSettings.get(a.model_key)?.order??Infinity;
    const orderB=state.modelSettings.get(b.model_key)?.order??Infinity;
    return (orderA===orderB?0:orderA-orderB)||modelName(a).localeCompare(modelName(b))||a.model_key.localeCompare(b.model_key);
  }
  async function readModelSettings() {
    const response=await fetch('/appsettings.json',{cache:'no-store'});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const config=await response.json();
    if(!Array.isArray(config?.models))throw new Error('Expected a models array');
    const settings=new Map();
    config.models.forEach((model,order)=>{
      if(!model||typeof model.key!=='string'||!model.key.trim()||settings.has(model.key)||typeof model.label!=='string'||!model.label.trim()||typeof model.color!=='string'||!/^#[0-9a-f]{6}$/i.test(model.color)){
        throw new Error('Each model needs a unique key, a label, and a six-digit hex color');
      }
      settings.set(model.key,{label:model.label.trim(),color:model.color,order});
    });
    return settings;
  }
  function modelProfile(row) {
    const profile=state.data?.model_profiles?.[row.model_key];
    return profile&&typeof profile==='object'&&!Array.isArray(profile)?profile:{};
  }
  const profileText=value=>typeof value==='string'?value.trim():'';
  function modelIdentity(row) {
    const name=modelName(row);const initials=name.replace(/[^a-z0-9]/ig,'').slice(0,2).toUpperCase();
    const profile=modelProfile(row);const setup=[profile.harness,profile.setting].map(profileText).filter(Boolean).join(' · ');
    return `<div class="model-identity"><span class="model-avatar" aria-hidden="true">${escape(initials||'AI')}</span><div><span class="model-name">${escape(name)}</span>${setup?`<span class="model-setup">${escape(setup)}</span>`:''}${row.model_version?`<span class="model-version">${escape(row.model_version)}</span>`:''}</div></div>`;
  }
  let saved={};
  try {saved=JSON.parse(localStorage.getItem(storageKey)||'{}')||{};} catch {saved={};}
  function saveSettings() {
    const settings={view:state.view};filterIDs.forEach(id=>settings[id]=$('#'+id).value);
    try {localStorage.setItem(storageKey,JSON.stringify(settings));} catch { /* Browser storage can be disabled. */ }
  }
  function toast(text) {
    const dialogs=[...document.querySelectorAll('dialog[open]')];
    (dialogs.at(-1)||document.body).append($('#toast'));
    $('#toast').textContent=text;$('#toast').hidden=false;
    clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,2600);
  }
  const playHash=row=>'#play/'+row.id.split('/').map(encodeURIComponent).join('/');
  const comparisonHash=key=>'#compare/'+encodeURIComponent(key);
  function copyLinkButton(row, className='button quiet') {
    return row.artifact.url?`<button class="${className}" data-copy-run="${escape(row.id)}" aria-label="Copy link to ${escape(modelName(row))}: ${escape(row.task_title)}">Copy link</button>`:'';
  }
  async function copyRunLink(id) {
    const row=state.data?.results.find(r=>r.id===id);if(!row?.artifact.url)return;
    const share=isPublic()&&typeof row.share_url==='string'&&row.share_url.startsWith('/share/');
    const url=new URL(share?row.share_url:location.pathname,location.origin);if(!share)url.hash=playHash(row);
    try{await navigator.clipboard.writeText(url.href);toast('Link copied. Opens the app at full size.');}
    catch{window.prompt('Copy this link to the live app:',url.href);}
  }
  function copyCategoryButton(key) {
    const task=state.data.catalog.find(task=>task.id===key);
    return task?`<button class="button" data-copy-task="${escape(key)}" aria-label="Copy link to comparison: ${escape(task.title)}">Copy link</button>`:'';
  }
  async function copyCategoryLink(key) {
    if(!state.data.catalog.some(task=>task.id===key)||!state.data.results.some(row=>row.task_id===key))return;
    const share=state.data.comparison_urls?.[key];
    const publicLink=isPublic()&&typeof share==='string'&&share.startsWith('/compare/');
    const url=new URL(publicLink?share:location.pathname,location.origin);if(!publicLink)url.hash=comparisonHash(key);
    try{await navigator.clipboard.writeText(url.href);toast('Link copied. Opens the full prompt comparison.');}
    catch{window.prompt('Copy this link to the prompt comparison:',url.href);}
  }
  function clearPlayLink() {
    if(location.hash.startsWith('#play/')){
      const comparison=$('#category-viewer').open&&state.data.catalog.some(task=>task.id===state.categoryTask)?comparisonHash(state.categoryTask):'';
      try{history.replaceState(null,'',location.pathname+location.search+(comparison||(state.view==='gallery'?'':'#'+state.view)));}catch{ /* Browser history may be unavailable when embedded. */ }
    }
  }
  function finishViewerClose() {
    if($('#viewer').open)return;
    state.selected=null;$('#viewer').classList.remove('is-live');$('#viewer-content').replaceChildren();clearPlayLink();
  }
  function closeViewer() {$('#viewer').close();finishViewerClose();}
  function followRoute(fallback='gallery') {
    if(!state.data)return;
    $('#prompt-dialog').close();$('#link-error').hidden=true;
    const route=location.hash.slice(1);
    if(route.startsWith('compare/')){
      let key;try{key=decodeURIComponent(route.slice(8));}catch{ /* Invalid links use the unavailable-comparison message. */ }
      closeViewer();
      if(state.data.catalog.some(task=>task.id===key)&&state.data.results.some(row=>row.task_id===key)){
        if(state.categoryTask===key&&$('#category-viewer').open)return;
        closeCategory(false);setView('gallery',false);openCategory(key,null,true,false);return;
      }
      closeCategory(false);setView('gallery',false);
      $('#link-error').textContent='This shared comparison is unavailable. Choose a prompt with submitted builds from the showcase.';
      $('#link-error').hidden=false;return;
    }
    if(route.startsWith('play/')){
      let id;try{id=decodeURIComponent(route.slice(5));}catch{ /* Malformed shared links use the unavailable-build message. */ }
      const row=state.data.results.find(r=>r.id===id&&r.artifact.url);
      if(row){
        if(state.categoryTask!==groupKey(row)){closeCategory(false);setView('gallery',false);}
        if(state.selected?.id===row.id&&$('#viewer').open&&$('#viewer').classList.contains('is-live'))return;
        const viewport=$('#viewer').classList.contains('is-live')?$('#viewport-size').value:'fit';
        openRun(row.id);$('#viewport-size').value=viewport;launchPreview(false);return;
      }
      closeCategory(false);closeViewer();setView('gallery');
      $('#link-error').textContent='This shared build is unavailable. It may have been moved or removed. Choose a build from the showcase.';
      $('#link-error').hidden=false;
      return;
    }
    closeCategory(false);closeViewer();setView(route||fallback);
  }
  function setView(view, updateUrl=true) {
    if (!Object.hasOwn(headings,view)||(isPublic()&&view==='leaderboard')) view='gallery';
    if(state.view!==view)closeCategory();
    $('#link-error').hidden=true;
    if(state.view!==view)window.scrollTo({top:0,behavior:'instant'});
    state.view=view;
    if(updateUrl)try{history.replaceState(null,'',view==='gallery'?location.pathname+location.search:'#'+view);}catch{ /* Embedded documents may not expose browser history. */ }
    document.body.dataset.section=view;
    Object.keys(headings).forEach(name=>$('#view-'+name).hidden=name!==view);
    document.querySelectorAll('.nav-button').forEach(button=>{
      const active=button.dataset.view===view;button.classList.toggle('active',active);
      if(active) button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
    });
    $('#current-section').textContent=headings[view][0];$('#hero-title').innerHTML=headings[view][1];$('#hero-description').textContent=headings[view][2];
    $('#filters').hidden=view==='guide'||view==='why';$('#run-filters').hidden=view==='catalog';
    $('.stats').hidden=view==='why';$('.workspace-tools').hidden=view==='why';
    render();saveSettings();
  }
  function fillSelect(id, entries, firstLabel, desired) {
    const el=$(id);const prior=desired??el.value;
    el.innerHTML=`<option value="all">${escape(firstLabel)}</option>`+entries.map(([value,text])=>`<option value="${escape(value)}">${escape(text)}</option>`).join('');
    el.value=[...el.options].some(option=>option.value===prior)?prior:'all';
  }
  function matchingRuns() {
    if(!state.data)return [];
    const search=$('#search').value.trim().toLowerCase();const track=$('#track-filter').value;const model=$('#model-filter').value;const task=$('#task-filter').value;const status=isPublic()?'all':$('#status-filter').value;
    const rows=state.data.results.filter(row=>{
      if(track!=='all'&&row.track!==track)return false;
      if(model!=='all'&&row.model_key!==model)return false;
      if(task!=='all'&&row.task_id!==task)return false;
      if(status==='scored'&&row.score==null)return false;
      if(status==='unscored'&&row.score!=null)return false;
      if(status==='fail'&&!row.checks.fail)return false;
      if(status==='blocked'&&!row.checks.blocked)return false;
      if(status==='stale'&&row.report_binding!=='stale')return false;
      return !search||[modelName(row),row.model,row.model_key,row.model_version,row.run_id,row.task_id,row.task_title,row.category,row.notes,...row.tags].join(' ').toLowerCase().includes(search);
    });
    const sortMode=$('#sort').value;
    return rows.sort((a,b)=>{
      if(sortMode==='score')return (b.score??-1)-(a.score??-1)||compareModels(a,b);
      if(sortMode==='task')return String(a.task_id).localeCompare(String(b.task_id))||compareModels(a,b);
      return b.modified_at.localeCompare(a.modified_at)||compareModels(a,b);
    });
  }
  function checksSummary(row) {
    if(row.report_binding==='stale')return '<span class="stale">Stale report</span>';
    const c=row.checks;const count=c.pass+c.fail+c.blocked+c['not-run'];
    if(!count)return 'No check report';
    return `<span class="pass">${c.pass} passed</span>${c.fail?` · <span class="fail">${c.fail} failed</span>`:''}${c.blocked?` · <span class="blocked">${c.blocked} blocked</span>`:''}`;
  }
  function runCard(row, repeated=false) {
    const a=row.artifact;const status=row.score==null?'Not scored':`${score(row.score)} / 100`;
    const image=a.screenshot_url?`<img src="${escape(a.screenshot_url)}" alt="${escape(modelName(row))}: ${escape(row.task_title)}" loading="lazy" decoding="async" width="1280" height="800">`:`<div class="card-placeholder"><span class="visual-icon" aria-hidden="true">${escape(row.icon)}</span><span class="visual-label">${a.kind==='html'?'READY TO EXPLORE':a.exists?'SOURCE AVAILABLE':'NO ARTIFACT'}</span></div>`;
    const footer=repeated?escape(row.run_id):!isPublic()&&row.report_binding!=='none'?checksSummary(row):`${bytes(a.bytes)} · ${a.demo?'Session demo':a.kind==='html'?'HTML build':'Source project'}`;
    return `<article class="run-card"><div class="card-model">${modelIdentity(row)}${isPublic()?'':`<span class="card-status ${row.score==null?'':'scored'}">${status}</span>`}</div><div class="card-visual"><button class="screenshot-button" data-open-run="${escape(row.id)}" aria-label="Inspect ${escape(modelName(row))}: ${escape(row.task_title)}">${image}<span class="screenshot-hint">Take a closer look ↗</span></button></div><div class="card-bottom"><span class="check-summary">${footer}</span><div class="card-actions">${copyLinkButton(row,'copy-link')}<button class="card-open" data-open-run="${escape(row.id)}">Inspect build ↗</button></div></div></article>`;
  }
  const groupKey=row=>row.task_id||`unassigned:${row.id}`;
  function promptGroup(key,runs,expanded=false,allModels=false) {
    const first=runs[0];const known=state.data.catalog.find(task=>task.id===key);
    const selectedModel=allModels?'all':$('#model-filter').value;
    const models=[...new Map(state.data.results.filter(row=>selectedModel==='all'||row.model_key===selectedModel).map(row=>[row.model_key,row])).values()].sort(compareModels);
    const comparisonModels=known?models:models.filter(model=>runs.some(row=>row.model_key===model.model_key));
    const lookFor=known?.look_for;
    const guidance=typeof lookFor==='string'&&lookFor.trim()?`<dl class="prompt-guide"><div><dt>Look for</dt><dd>${escape(lookFor)}</dd></div></dl>`:'';
    const columns=comparisonModels.map(model=>{
      const builds=runs.filter(row=>row.model_key===model.model_key);
      if(builds.length)return `<div class="model-column" data-model="${escape(model.model_key)}" style="--model-color:${modelColor(model)}">${builds.map(row=>runCard(row,builds.length>1)).join('')}</div>`;
      const exists=state.data.results.some(row=>groupKey(row)===key&&row.model_key===model.model_key);
      return `<div class="model-column" data-model="${escape(model.model_key)}" style="--model-color:${modelColor(model)}"><div class="missing-build"><div class="card-model">${modelIdentity(model)}</div><div class="missing-visual"><span aria-hidden="true">/ /</span>${exists?'No matching build':'No build recorded'}</div><div class="missing-foot">${exists?'Hidden by the current filters.':'This model has not submitted this prompt.'}</div></div></div>`;
    }).join('');
    const title=escape(first.task_title);
    return `<section class="prompt-group" data-task="${escape(key)}"><header class="prompt-header${guidance?' has-guidance':''}"><div class="prompt-heading"><span class="prompt-number">${known?escape(key.slice(0,2)):'??'}</span><div><div class="prompt-category">${escape(first.category)} <span aria-hidden="true">/</span> ${first.track==='real-apps'?'REAL APPLICATION':'HTML EXPERIENCE'}</div><h3${expanded?' id="category-title"':''}>${title}</h3></div></div>${guidance}<div class="prompt-header-actions">${known?`<button class="button" data-open-prompt="${escape(key)}">Read the prompt ↗</button>`:''}${expanded?'':`<button class="button expand-comparison" data-expand-task="${escape(key)}" aria-label="Expand ${title}">Expand <span aria-hidden="true">↗</span></button>`}</div></header><div class="comparison-toolbar"><span class="comparison-range" aria-live="polite" aria-atomic="true"></span><div class="comparison-actions">${copyCategoryButton(key)}<div class="model-navigation" role="group" aria-label="Browse models for ${title}"><button class="button model-arrow" data-shift-models="-1" aria-label="Previous models for ${title}">←</button><button class="button model-arrow" data-shift-models="1" aria-label="Next models for ${title}">→</button></div></div></div><div class="group-builds" style="--columns:${Math.max(1,comparisonModels.length)}" tabindex="0" role="group" aria-label="${title} model builds">${columns}</div></section>`;
  }
  function comparisonPosition(group) {
    const viewport=group.querySelector('.group-builds');const columns=[...viewport.children];
    const gap=parseFloat(getComputedStyle(viewport).columnGap)||0;
    const step=(columns[0]?.getBoundingClientRect().width||viewport.clientWidth)+gap;
    const visible=Math.max(1,Math.min(columns.length,Math.round((viewport.clientWidth+gap)/step)||1));
    const first=Math.max(0,Math.min(columns.length-visible,Math.round(viewport.scrollLeft/step)||0));
    return {viewport,columns,step,visible,first};
  }
  function updateComparison(group) {
    const {viewport,columns,visible,first}=comparisonPosition(group);
    const overflow=viewport.scrollWidth>viewport.clientWidth+2;
    group.querySelector('.model-navigation').hidden=!overflow;
    group.querySelector('[data-shift-models="-1"]').disabled=viewport.scrollLeft<=2;
    group.querySelector('[data-shift-models="1"]').disabled=viewport.scrollLeft>=viewport.scrollWidth-viewport.clientWidth-2;
    const range=group.querySelector('.comparison-range');
    const text=overflow?`${visible===1?'Model':'Models'} ${first+1}${visible===1?'':'–'+Math.min(columns.length,first+visible)} of ${columns.length}`:`${columns.length} ${columns.length===1?'model':'models'}`;
    if(range.textContent!==text)range.textContent=text;
  }
  function positionComparison(group,index) {
    const {viewport,columns,visible,step}=comparisonPosition(group);
    viewport.scrollTo({left:Math.max(0,Math.min(columns.length-visible,index))*step,behavior:'instant'});updateComparison(group);
  }
  function shiftComparison(group,direction) {
    const {first}=comparisonPosition(group);positionComparison(group,first+direction);
  }
  function renderCategory() {
    if(!$('#category-viewer').open)return;
    const runs=(state.categoryAllModels?state.data.results:matchingRuns()).filter(row=>groupKey(row)===state.categoryTask);
    if(!runs.length){closeCategory();return;}
    const scrollTop=$('#category-content').scrollTop;
    $('#category-content').innerHTML=promptGroup(state.categoryTask,runs,true,state.categoryAllModels);
    updateComparison($('#category-content .prompt-group'));$('#category-content').scrollTop=scrollTop;
  }
  function openCategory(key,trigger=null,allModels=false,updateUrl=true) {
    const runs=(allModels?state.data.results:matchingRuns()).filter(row=>groupKey(row)===key);if(!runs.length)return;
    state.categoryTask=key;state.categoryTrigger=trigger;state.categoryAllModels=allModels;
    $('#category-content').innerHTML=promptGroup(key,runs,true,allModels);
    $('#category-viewer').showModal();$('#category-content').scrollTop=0;updateComparison($('#category-content .prompt-group'));
    if(updateUrl&&state.data.catalog.some(task=>task.id===key)&&location.hash!==comparisonHash(key))try{history.pushState(null,'',comparisonHash(key));}catch{ /* Copy link remains available in embedded browsers. */ }
    $('#close-category').focus();
  }
  function finishCategoryClose() {
    if($('#category-viewer').open)return;
    const key=state.categoryTask;const trigger=state.categoryTrigger;
    state.categoryTask=null;state.categoryTrigger=null;state.categoryAllModels=false;$('#category-content').replaceChildren();
    if(!$('#viewer').open&&!$('#prompt-dialog').open){
      const fallback=[...document.querySelectorAll('#cards [data-expand-task]')].find(button=>button.dataset.expandTask===key);
      (trigger?.isConnected?trigger:fallback)?.focus({preventScroll:true});
    }
  }
  function closeCategory(updateUrl=true) {
    if(updateUrl&&$('#category-viewer').open&&location.hash.startsWith('#compare/'))try{history.replaceState(null,'',location.pathname+location.search+(state.view==='gallery'?'':'#'+state.view));}catch{ /* The dialog can still close without browser history access. */ }
    $('#category-viewer').close();finishCategoryClose();
  }
  function renderGallery() {
    const rows=matchingRuns();const groups=new Map();
    for(const row of rows){const key=groupKey(row);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
    const positions=new Map([...document.querySelectorAll('#cards .prompt-group')].map(group=>[group.dataset.task,comparisonPosition(group).first]));
    const ordered=[...groups.entries()].sort(([keyA,a],[keyB,b])=>{
      const mode=$('#sort').value;
      if(mode==='recent'){const latest=r=>r.reduce((last,x)=>x.modified_at>last?x.modified_at:last,'');const diff=latest(b).localeCompare(latest(a));if(diff)return diff;}
      if(mode==='score'){const max=r=>Math.max(...r.map(x=>x.score??-1));const diff=max(b)-max(a);if(diff)return diff;}
      return keyA.localeCompare(keyB);
    });
    $('#cards').innerHTML=ordered.map(([key,runs])=>promptGroup(key,runs)).join('');
    document.querySelectorAll('#cards .prompt-group').forEach(group=>positionComparison(group,positions.get(group.dataset.task)||0));
    $('#result-count').textContent=rows.length;$('#group-count').textContent=ordered.filter(([key])=>state.data.catalog.some(task=>task.id===key)).length;
    $('#empty-results').hidden=rows.length>0;
    if(!rows.length){
      const hasRuns=Boolean(state.data?.results.length);
      $('#empty-results h2').textContent=hasRuns?'Nothing matches this combination.':'The next experiment starts here.';
      $('#empty-results p').innerHTML=hasRuns?'Reset a filter or try another model, prompt or search.':'Give an agent a prompt. Let it build and test.<br>Bring back what it made.';
    }
  }
  function renderCatalog() {
    if(!state.data)return;
    const term=$('#search').value.trim().toLowerCase();const track=$('#track-filter').value;
    const tasks=state.data.catalog.filter(t=>(track==='all'||t.track===track)&&(!term||[t.id,t.title,t.description,t.category].join(' ').toLowerCase().includes(term)));
    $('#catalog-count').textContent=tasks.length;
    $('#catalog-grid').innerHTML=tasks.map(t=>{
      const count=state.data.results.filter(r=>r.task_id===t.id).length;
      return `<article class="task-card ${escape(t.track)}"><div class="task-top"><span class="task-icon" aria-hidden="true">${escape(t.icon)}</span><span class="pill ${escape(t.track)}">${label(t.track)}</span></div><h3>${escape(t.id.slice(0,2))} · ${escape(t.title)}</h3><p>${escape(t.description)}</p><button class="button" data-open-prompt="${escape(t.id)}">Read &amp; copy prompt <span>↗</span></button><div class="task-foot"><span>${escape(t.category)}</span><span>${count} ${count===1?'run':'runs'}</span></div></article>`;
    }).join('')||'<div class="notice">No tasks match this search.</div>';
  }
  function renderLeaderboard() {
    const rows=matchingRuns();let content='';
    for(const track of ['html','real-apps']){
      const trackRows=rows.filter(r=>r.track===track);if(!trackRows.length)continue;
      const groups=new Map();
      for(const row of trackRows){
        if(!groups.has(row.model_key))groups.set(row.model_key,{model:row,runs:0,scored:0,tasks:new Map(),scoredTasks:new Map(),stale:0});
        const g=groups.get(row.model_key);g.runs++;g.stale+=Number(row.report_binding==='stale');
        if(row.task_id)g.tasks.set(row.task_id,true);
        if(row.score!=null&&row.task_id&&state.data.catalog.some(t=>t.id===row.task_id)){
          g.scored++;if(!g.scoredTasks.has(row.task_id))g.scoredTasks.set(row.task_id,[]);g.scoredTasks.get(row.task_id).push(row.score);
        }
      }
      const entries=[...groups.values()].map(g=>{
        const means=[...g.scoredTasks.values()].map(values=>values.reduce((a,b)=>a+b,0)/values.length);
        return {...g,mean:means.length?means.reduce((a,b)=>a+b,0)/means.length:null};
      }).sort((a,b)=>(b.mean??-1)-(a.mean??-1)||compareModels(a.model,b.model));
      content+=`<h3 class="leader-title">${track==='html'?'HTML experiences':'Real applications'}</h3><div class="table-wrap"><table><thead><tr><th>Model</th><th>Task-weighted score</th><th>Scored tasks</th><th>Scored runs</th><th>Total runs</th><th>Coverage</th></tr></thead><tbody>${entries.map(g=>`<tr><td class="score-model" style="--model-color:${modelColor(g.model)}">${escape(modelName(g.model))}${g.stale?`<div class="tiny stale">${g.stale} stale report(s) excluded</div>`:''}</td><td class="table-score">${score(g.mean)}</td><td>${g.scoredTasks.size}</td><td>${g.scored}</td><td>${g.runs}</td><td class="tiny">${[...g.tasks.keys()].sort().map(id=>escape(id.slice(0,2))).join(', ')||'Unassigned'}</td></tr>`).join('')}</tbody></table></div>`;
    }
    $('#leaderboard-content').innerHTML=content||'<div class="empty"><h2>No matching runs yet.</h2><p>Import results and attach independent evaluator scores to see model summaries.</p></div>';
  }
  function render() {
    renderGallery();renderCatalog();renderLeaderboard();renderCategory();
  }
  async function loadData() {
    if(state.loading)return;state.loading=true;$('#refresh').disabled=true;$('#connection-status').textContent='Scanning…';
    $('#link-error').hidden=true;
    try{
      const [inventory,settings]=await Promise.allSettled([
        fetch('/api/data',{cache:'no-store'}).then(response=>{if(!response.ok)throw new Error(`HTTP ${response.status}`);return response.json();}),
        readModelSettings()
      ]);
      if(inventory.status==='rejected')throw inventory.reason;
      const data=inventory.value;if(!Array.isArray(data.results)||!Array.isArray(data.catalog))throw new Error('Invalid gallery response');
      state.modelSettings=settings.status==='fulfilled'?settings.value:new Map();
      data.results=data.results.map(row=>({...row,tags:Array.isArray(row.tags)?row.tags:[]}));
      const first=state.data===null;state.data=data;
      document.querySelector('.nav-button[data-view="leaderboard"]').hidden=isPublic();
      document.querySelector('[data-tab="evidence"]').hidden=isPublic();
      document.querySelector('.status-select').hidden=isPublic();
      $('#stat-scored').parentElement.hidden=isPublic();
      document.querySelector('.stats').classList.toggle('public-stats',isPublic());
      const models=[...new Map(data.results.map(r=>[r.model_key,r])).values()].sort(compareModels).map(row=>[row.model_key,modelName(row)]);
      fillSelect('#model-filter',models,'All models',first?saved['model-filter']:undefined);
      fillSelect('#task-filter',data.catalog.map(t=>[t.id,`${t.id.slice(0,2)} · ${t.title}`]),'All prompts',first?saved['task-filter']:undefined);
      if(first)for(const id of ['search','track-filter','status-filter','sort'])if(saved[id]!==undefined){const el=$('#'+id);el.value=saved[id];if(el.tagName==='SELECT'&&el.selectedIndex<0)el.selectedIndex=0;}
      document.querySelector('#sort option[value="score"]').hidden=isPublic();
      if(isPublic()&&$('#sort').value==='score')$('#sort').value='task';
      $('#stat-models').textContent=data.summary.models;$('#stat-runs').textContent=data.summary.runs;
      $('#stat-tasks').innerHTML=`${data.summary.tasks} <small>/ ${data.catalog.length}</small>`;
      $('#stat-scored').textContent=data.summary.scored_runs;$('#nav-count').textContent=data.summary.runs;
      $('#error-banner').hidden=settings.status==='fulfilled';
      if(settings.status==='rejected')$('#error-banner').textContent=`Model settings could not be loaded: ${settings.reason.message}. Using default names, alphabetical order, and fallback colors. Check appsettings.json and refresh.`;
      $('#connection-status').textContent=isPublic()?'● Public snapshot · ready':'● Local · ready';
      $('#footer-status').textContent=`${data.results.length} runs · ${data.catalog.length} prompts · refreshed ${new Date(data.generated_at).toLocaleTimeString()}`;
      if(first)followRoute(saved.view||'gallery');
      else{
        render();
        if(state.selected){const fresh=data.results.find(r=>r.id===state.selected.id);if(fresh){const live=$('#viewer').classList.contains('is-live');state.selected=fresh;renderViewer();if(live)launchPreview(false);}else closeViewer();}
      }
    }catch(error){
      $('#error-banner').textContent=`Could not read the gallery: ${error.message}. Start the Python gallery server and retry.`;$('#error-banner').hidden=false;$('#connection-status').textContent='Connection error';
    }finally{state.loading=false;$('#refresh').disabled=false;}
  }
  async function openPrompt(taskId) {
    const task=state.data?.catalog.find(t=>t.id===taskId);if(!task)return;
    const token=++state.promptToken;state.promptText='';$('#prompt-title').textContent=task.title;$('#prompt-content').textContent='Loading prompt…';$('#copy-status').textContent='';$('#copy-prompt').disabled=true;
    const url=`/prompts/${encodeURIComponent(taskId)}/prompt.md`;$('#download-prompt').href=url;$('#download-prompt').target='_blank';$('#download-prompt').rel='noopener';
    if(!$('#prompt-dialog').open)$('#prompt-dialog').showModal();
    try{const response=await fetch(url);if(!response.ok)throw new Error(`HTTP ${response.status}`);const text=await response.text();if(token!==state.promptToken)return;state.promptText=text;$('#prompt-content').textContent=text;$('#copy-prompt').disabled=false;}
    catch(error){if(token===state.promptToken)$('#prompt-content').textContent=`Could not load prompt: ${error.message}`;}
  }
  async function copyPrompt() {
    try{await navigator.clipboard.writeText(state.promptText);$('#copy-status').textContent='Copied complete prompt.';}
    catch{
      const area=document.createElement('textarea');area.value=state.promptText;area.style.cssText='position:fixed;left:-10000px;top:0';$('#prompt-dialog').append(area);area.select();
      let copied=false;try{copied=document.execCommand('copy');}catch{copied=false;}area.remove();
      $('#copy-status').textContent=copied?'Copied complete prompt.':'Clipboard unavailable. Select the prompt text and copy it manually.';
    }
  }
  function openRun(id) {
    const row=state.data?.results.find(r=>r.id===id);if(!row)return;state.selected=row;state.tab='preview';
    $('#link-error').hidden=true;
    renderViewer();if(!$('#viewer').open)$('#viewer').showModal();
  }
  function sourceLink(a) {return a.source_url?(isPublic()||a.kind==='project'?a.source_url:a.source_url+'?download=1'):null;}
  function previewContent(row) {
    const a=row.artifact;
    const start=a.url?`<button id="launch-preview" class="button primary">Launch live preview ↗</button>`:'';
    return `<div class="preview-controls"><span>${escape(a.demo?'Disposable gallery demo':a.kind==='html'?'Self-contained HTML':a.kind==='project'?'Multi-file source project':a.kind==='archive'?'Source archive':'No artifact supplied')} · ${bytes(a.bytes)}</span><div><label for="viewport-size">Viewport</label><select id="viewport-size"><option value="fit">Full viewport</option><option value="1280x800">Desktop · 1280 × 800</option><option value="768x1024">Tablet · 768 × 1024</option><option value="390x844">Mobile · 390 × 844</option></select></div></div>${a.warning?`<div class="notice">${escape(a.warning)}</div>`:''}<div id="preview-area" class="preview-area">${a.screenshot_url?`<div><img class="preview-image" src="${escape(a.screenshot_url)}" alt="Submitted screenshot"><div class="preview-prompt">${start}<p>Submitted screenshot. Launch the live artifact to inspect behavior.</p></div></div>`:`<div class="preview-prompt"><span class="visual-icon" aria-hidden="true">${escape(row.icon)}</span><h3>${a.url?'Ready when you are.':a.exists?'Source is ready to inspect.':'No artifact was recorded.'}</h3><p>${a.url?'Live previews run only when you explicitly open them. Inspect the controls, interactions and actual application state.':'No application is launched automatically. Review the source and its startup instructions, launch it manually in a disposable environment, then provide its loopback URL in metadata.json.'}</p>${start}${!a.url&&a.source_url?`<a class="button" href="${escape(sourceLink(a))}" download>Download source ↓</a>`:''}</div>`}</div><p class="viewer-note">${a.demo?'This demo keeps changes only while it is open. Reset or reload starts fresh. Backend durability and security are evaluated in the full local app.':isPublic()?'Public previews have restricted browser storage. Download the HTML to test persistence and file-based workflows locally.':'Inspect the actual interactions. For persistence or authentication checks, use Open app in a separate browser context.'}</p>`;
  }
  function evidenceContent(row) {
    const a=row.artifact;const c=row.checks;
    const binding=row.report_binding==='stale'?'This report belongs to different source bytes. Its score is excluded until the artifact is evaluated again.':row.report_binding==='unbound'?'This report has no artifact hash. Its provenance is not bound to the displayed source.':row.report_binding==='match'?'Report hash matches the displayed source. The observations are evaluator-supplied.':'No evaluator report was supplied.';
    return `<div class="notice ${row.report_binding==='stale'?'danger':''}">${escape(binding)}</div><div class="evidence-counts"><span class="pass">${c.pass} passed</span><span class="fail">${c.fail} failed</span><span class="blocked">${c.blocked} blocked</span><span>${c['not-run']} not run</span></div>${a.checks.length?`<div class="table-wrap"><table><thead><tr><th>Check</th><th>Status</th><th>Observed evidence</th></tr></thead><tbody>${a.checks.map(check=>`<tr><td><code>${escape(check.id)}</code><span class="check-title">${escape(check.label||'')}</span></td><td class="${escape(check.status)}">${escape(check.status)}</td><td class="check-evidence">${escape(check.evidence||check.notes||'No evidence supplied.')}${check.evidence&&check.notes?'<br>'+escape(check.notes):''}</td></tr>`).join('')}</tbody></table></div>`:'<div class="notice">No check outcomes recorded. Add evaluator observations in report.json; absence of errors or a screenshot alone does not prove a pass.</div>'}<div class="detail-section"><h3>Run notes</h3><pre>${escape(row.notes||'No notes supplied.')}</pre></div><p class="viewer-note">Agent-authored logs remain in evidence/ on disk and are separate from evaluator-owned reports.</p>`;
  }
  function detailSection(title,value,wide=false){return `<section class="detail-section${wide?' wide':''}"><h3>${escape(title)}</h3><pre>${escape(typeof value==='string'?value:JSON.stringify(value??{},null,2))}</pre></section>`;}
  function profileLink(label,url) {
    const text=escape(label);
    try {
      const link=new URL(url);
      if(['http:','https:'].includes(link.protocol)&&!link.username&&!link.password&&!/[\s\\]/.test(url))return `<a href="${escape(link.href)}" target="_blank" rel="noopener noreferrer">${text} <span aria-hidden="true">↗</span></a>`;
    } catch { /* Optional homepages may be absent. */ }
    return text;
  }
  function modelSetupContent(row) {
    const profile=modelProfile(row);
    const fields=[['Provider','provider'],['Harness','harness'],['Setting','setting']].filter(([,key])=>profileText(profile[key]));
    if(!fields.length)return '';
    return `<dl class="setup-facts">${fields.map(([label,key])=>`<div><dt>${label}</dt><dd>${profileLink(profileText(profile[key]),profile[key+'_url'])}</dd></div>`).join('')}</dl><p class="setup-note">Shared setup for this model’s current collection, as I ran it. These labels aren’t equivalent budgets across tools or a complete record of every run.</p>`;
  }
  function detailsContent(row) {
    const a=row.artifact;const setup=modelSetupContent(row);
    const profile=setup?`<section class="detail-section model-setup-details"><h3>Model setup</h3>${setup}</section>`:'';
    if(isPublic())return profile+detailSection('Build identity',{model:modelName(row),prompt:row.task_title,file:a.filename,bytes:a.bytes,sha256:a.sha256})+'<p class="viewer-note">The public showcase contains HTML builds, thumbnails, and any reported model setup. Evaluation records and development evidence are excluded from this website export.</p>';
    return `${profile}<div class="detail-grid">${detailSection('Artifact identity',{file:a.filename,kind:a.kind,bytes:a.bytes,authored_files:a.file_count,sha256:a.sha256,digest_version:a.digest_version||'SHA-256 of file bytes'})}${detailSection('Score & rubric',{score:row.score,reported_score:row.reported_score,rubric:row.rubric,report_binding:row.report_binding,dimensions:row.score_details})}${a.manifest?detailSection('Declared project manifest — display only, never executed',a.manifest,true):''}${detailSection('Execution metrics',row.metrics)}${detailSection('Environment & parameters',{environment:row.environment,parameters:row.parameters})}${detailSection('Metadata',row.metadata,true)}</div><p class="viewer-note">Project downloads omit known dependency, runtime, database and secret-file patterns. This is not a complete secret scanner; inspect all source before sharing it.</p>`;
  }
  function renderViewer() {
    const row=state.selected;if(!row)return;
    $('#viewer').classList.remove('is-live');
    $('#viewer').style.setProperty('--model-color',modelColor(row));
    $('#viewer-title').textContent=row.task_title;$('#viewer-kicker').textContent=`${modelName(row)} / ${row.run_id}`;
    document.querySelectorAll('[data-tab]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.tab===state.tab)));
    const a=row.artifact;
    $('#viewer-actions').innerHTML=`${copyLinkButton(row)}${row.prompts.prompt?`<button class="button quiet" data-open-prompt="${escape(row.task_id)}">Prompt</button>`:''}${a.source_url?`<a class="button quiet" href="${escape(sourceLink(a))}" download>Source ↓</a>`:''}${a.url&&!isPublic()?`<a class="button quiet" href="${escape(a.url)}" target="_blank" rel="noopener noreferrer">Open app ↗</a>`:''}`;
    $('#viewer-content').innerHTML=state.tab==='preview'?previewContent(row):state.tab==='evidence'?evidenceContent(row):detailsContent(row);
  }
  function resizeFrame() {
    const frame=$('#artifact-frame');if(!frame)return;
    const value=$('#viewport-size').value;
    if(value==='fit'){frame.style.width='100%';frame.style.height='100%';}
    else{const [width,height]=value.split('x');frame.style.width=width+'px';frame.style.height=height+'px';}
  }
  function comparableBuilds(row) {
    if(!row.task_id||!state.data.catalog.some(task=>task.id===row.task_id))return [row];
    return state.data.results.filter(run=>run.task_id===row.task_id&&run.artifact.url)
      .sort((a,b)=>compareModels(a,b)||a.run_id.localeCompare(b.run_id));
  }
  function liveModelControl(row) {
    const builds=comparableBuilds(row);
    const options=builds.map(run=>{
      const repeated=builds.filter(other=>other.model_key===run.model_key).length>1;
      return `<option value="${escape(run.id)}"${run.id===row.id?' selected':''}>${escape(modelName(run))}${repeated?' · '+escape(run.run_id):''}</option>`;
    }).join('');
    return `<label class="live-model"><span class="sr-only">Model for this prompt</span><select id="live-model"${builds.length<2?' disabled':''}>${options}</select></label>`;
  }
  function liveGuidance(row) {
    const hint=state.data.catalog.find(task=>task.id===row.task_id)?.look_for;
    if(typeof hint!=='string'||!hint.trim())return '';
    return `<details class="live-info live-guide"><summary class="button">Look for</summary><div class="live-info-panel live-guide-panel"><div class="live-info-heading"><strong>${escape(row.task_title)}</strong><button id="close-live-guide" class="icon-button" aria-label="Close Look for">×</button></div><p>${escape(hint)}</p></div></details>`;
  }
  function liveSetup(row) {
    const setup=modelSetupContent(row);if(!setup)return '';
    return `<details class="live-info live-setup"><summary class="button">Setup</summary><div class="live-info-panel live-setup-panel"><div class="live-info-heading"><strong>${escape(modelName(row))} · Setup</strong><button id="close-live-setup" class="icon-button" aria-label="Close setup">×</button></div>${setup}</div></details>`;
  }
  function closeLiveInfo() {
    const info=$('.live-info[open]');if(!info)return false;
    info.open=false;info.querySelector('summary').focus();return true;
  }
  function switchLiveModel(id) {
    if(!state.selected||!$('#viewer').classList.contains('is-live'))return;
    const row=comparableBuilds(state.selected).find(run=>run.id===id);
    if(!row||row.id===state.selected.id)return;
    state.selected=row;launchPreview(true,'live-model');
  }
  function launchPreview(updateUrl=true, focusTarget='back-to-build') {
    const row=state.selected;if(!row?.artifact.url)return;
    if(updateUrl&&location.hash!==playHash(row))try{history.pushState(null,'',playHash(row));}catch{ /* The copy button still provides a link when history is unavailable. */ }
    const viewport=$('#viewport-size')?.value||'fit';
    $('#viewer').classList.add('is-live');
    $('#viewer').style.setProperty('--model-color',modelColor(row));
    $('#viewer-title').textContent=`${row.task_title} · ${modelName(row)}`;
    $('#viewer-content').innerHTML=`<div class="live-bar"><button id="back-to-build" class="button" aria-label="Back to build details">← Build</button>${liveModelControl(row)}<span class="live-title">${escape(row.task_title)}</span><div class="live-tools">${row.artifact.demo?`<button id="reset-demo" class="button" title="Discard changes and start a fresh demo">Reset demo</button>`:""}${liveSetup(row)}${liveGuidance(row)}${copyLinkButton(row,'button')}<label class="live-size"><span class="sr-only">Preview viewport</span><select id="viewport-size"><option value="fit">Full viewport</option><option value="1280x800">Desktop · 1280 × 800</option><option value="768x1024">Tablet · 768 × 1024</option><option value="390x844">Mobile · 390 × 844</option></select></label></div><button id="close-live" class="icon-button" aria-label="Close live preview">×</button></div><div id="preview-area" class="preview-area live-area"></div>`;
    $('#viewport-size').value=viewport;
    const frame=document.createElement('iframe');frame.id='artifact-frame';frame.title=`Live ${row.task_title}`;
    frame.setAttribute('sandbox',row.artifact.demo?'allow-scripts allow-downloads':isPublic()?'allow-scripts allow-downloads allow-modals allow-pointer-lock':'allow-scripts allow-same-origin allow-forms allow-modals allow-downloads allow-pointer-lock allow-popups');
    frame.allow='autoplay; fullscreen';frame.referrerPolicy='no-referrer';frame.src=row.artifact.url;
    $('#preview-area').replaceChildren(frame);resizeFrame();$('#'+focusTarget).focus();
  }
  document.addEventListener('click',event=>{
    document.querySelectorAll('.live-info[open]').forEach(info=>{if(!info.contains(event.target))info.open=false;});
    const target=event.target.closest('button,[data-view]');if(!target)return;
    if(target.dataset.view){event.preventDefault();setView(target.dataset.view);}
    if(target.dataset.openRun)openRun(target.dataset.openRun);
    if(target.dataset.copyRun)copyRunLink(target.dataset.copyRun);
    if(target.dataset.copyTask)copyCategoryLink(target.dataset.copyTask);
    if(target.dataset.openPrompt)openPrompt(target.dataset.openPrompt);
    if(target.dataset.expandTask)openCategory(target.dataset.expandTask,target);
    if(target.dataset.shiftModels)shiftComparison(target.closest('.prompt-group'),Number(target.dataset.shiftModels));
    if(target.dataset.tab){state.tab=target.dataset.tab;renderViewer();}
    if(target.id==='launch-preview')launchPreview();
    if(target.id==='reset-demo')launchPreview(false,'reset-demo');
    if(target.id==='back-to-build'){renderViewer();clearPlayLink();$('#launch-preview')?.focus();}
    if(target.id==='close-live')closeViewer();
    if(target.id==='close-live-guide'||target.id==='close-live-setup')closeLiveInfo();
  });
  filterIDs.forEach(id=>$('#'+id).addEventListener(id==='search'?'input':'change',()=>{render();saveSettings();}));
  document.addEventListener('change',event=>{
    if(event.target.id==='viewport-size')resizeFrame();
    if(event.target.id==='live-model')switchLiveModel(event.target.value);
  });
  $('#refresh').addEventListener('click',loadData);
  $('#clear-filters').addEventListener('click',()=>{for(const id of filterIDs)$('#'+id).value=id==='search'?'':id==='sort'?'task':'all';render();saveSettings();});
  $('#close-viewer').addEventListener('click',closeViewer);
  $('#close-category').addEventListener('click',()=>closeCategory());
  $('#category-viewer').addEventListener('cancel',event=>{event.preventDefault();closeCategory();});
  $('#category-viewer').addEventListener('close',finishCategoryClose);
  $('#viewer').addEventListener('close',finishViewerClose);
  $('#viewer').addEventListener('cancel',event=>{event.preventDefault();if(!closeLiveInfo())closeViewer();});
  $('#close-prompt').addEventListener('click',()=>$('#prompt-dialog').close());
  $('#prompt-dialog').addEventListener('close',()=>{state.promptToken++;});
  $('#copy-prompt').addEventListener('click',copyPrompt);
  document.addEventListener('keydown',event=>{
    if(event.target.matches('#cards .group-builds')&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
      event.preventDefault();const group=event.target.closest('.prompt-group');
      if(event.key==='Home'||event.key==='End')positionComparison(group,event.key==='Home'?0:Infinity);
      else shiftComparison(group,event.key==='ArrowRight'?1:-1);
    }
    if(event.key==='Escape'&&$('#viewer').open&&closeLiveInfo()){event.preventDefault();return;}
    if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('#viewer').open&&!$('#category-viewer').open&&!$('#prompt-dialog').open){event.preventDefault();$('#search').focus();}
  });
  window.addEventListener('hashchange',()=>followRoute());
  document.addEventListener('scroll',event=>{
    if(event.target.matches?.('.group-builds'))updateComparison(event.target.closest('.prompt-group'));
  },true);
  let comparisonResize;
  window.addEventListener('resize',()=>{
    cancelAnimationFrame(comparisonResize);
    comparisonResize=requestAnimationFrame(()=>document.querySelectorAll('.prompt-group').forEach(updateComparison));
  });
  window.addEventListener('blur',()=>{
    if(document.activeElement===$('#artifact-frame')){
      document.querySelectorAll('.live-info[open]').forEach(info=>info.open=false);
    }
  });
  loadData();
})();
