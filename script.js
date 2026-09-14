/* NEXA storageService
   IMPORTANTE: Esta versão utiliza localStorage apenas para desenvolvimento/protótipo.
   Para publicar a NEXA na internet e permitir que os resumos sejam compartilhados entre todos
   os visitantes, será necessário utilizar um backend e um banco de dados.
   Futuro ponto de integração: substitua os métodos deste serviço por chamadas à API segura. */
window.storageService = (() => {
  const SUPABASE_URL = 'https://uwtdhdbrzlowpxdhlprs.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_1mZ3gj9pF8j4qi8OCNYdLQ_hQDMhL2g';
  const sb = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);
  const initialExams = [
    { id:'espanhol', subject:'Espanhol', title:'Prova Bimestral de Espanhol', classTime:'2ª aula' },
    { id:'redacao', subject:'Redação', title:'Prova Bimestral de Redação', classTime:'2ª e 3ª aulas' },
    { id:'ingles', subject:'Inglês', title:'Prova Bimestral de Inglês', classTime:'2ª aula' },
    { id:'religioso', subject:'Ensino Religioso', title:'Prova Bimestral de Ensino Religioso', classTime:'3ª aula' },
    { id:'ciencias', subject:'Ciências', title:'Prova Bimestral de Ciências', classTime:'3ª aula' }
  ];
  const localRead=k=>JSON.parse(localStorage.getItem(k)||'[]');
  const localWrite=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const KEYS={session:'nexa_user_session_v1',exams:'nexa_exams_v1',summaries:'nexa_summaries_v1',ratings:'nexa_ratings_v1',reports:'nexa_reports_v1'};
  function currentUser(){try{return JSON.parse(localStorage.getItem(KEYS.session)||'null')}catch{return null}}
  async function getSessionUser(){if(!sb)return currentUser();const {data:{user}}=await sb.auth.getUser();if(!user)return null;const {data:p}=await sb.from('profiles').select('id,username,role,status').eq('id',user.id).single();return p?{...p,email:user.email}:null}
  function getExams(){return localRead(KEYS.exams).length?localRead(KEYS.exams):initialExams}
  function getSummaries(){return localRead(KEYS.summaries)}
  function getSummary(id){return getSummaries().find(x=>x.id===id)}
  function saveSummary(s){const a=getSummaries(),i=a.findIndex(x=>x.id===s.id);if(i>=0)a[i]=s;else a.unshift(s);localWrite(KEYS.summaries,a);return s}
  function deleteSummary(id){localWrite(KEYS.summaries,getSummaries().filter(x=>x.id!==id))}
  function saveExam(e){const a=getExams(),i=a.findIndex(x=>x.id===e.id);if(i>=0)a[i]={...a[i],...e};else a.push(e);localWrite(KEYS.exams,a);return e}
  function deleteExam(id){if(getSummaries().some(s=>s.examId===id))throw new Error('Esta prova possui resumos vinculados e não pode ser removida.');localWrite(KEYS.exams,getExams().filter(e=>e.id!==id))}
  const favoriteIds=()=>{const u=currentUser();return u?localRead('nexa_favorites_'+u.id+'_v1'):[]}
  const toggleFavorite=id=>{const u=currentUser();if(!u)return null;const k='nexa_favorites_'+u.id+'_v1',a=favoriteIds(),n=a.includes(id)?a.filter(x=>x!==id):[...a,id];localWrite(k,n);return n.includes(id)}
  return {getExams,getSummaries,getSummary,saveSummary,deleteSummary,saveExam,deleteExam,currentUser,favoriteIds,toggleFavorite,KEYS,getSessionUser,sb};
})();

/* Protótipo local: hashes e sessões ficam neste navegador. Em produção, troque por
   backend, cookies seguros, autorização no servidor e banco de dados. */
window.authService=(()=>{
  const users=()=>JSON.parse(localStorage.getItem(storageService.KEYS.users)||'[]');
  const save=items=>localStorage.setItem(storageService.KEYS.users,JSON.stringify(items));
  const hash=async value=>{const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');};
  async function create(username,password){const name=username.trim();if(name.length<3)throw new Error('Use ao menos 3 caracteres no nome.');if(users().some(u=>u.username.toLowerCase()===name.toLowerCase()))throw new Error('Este nome de usuário já existe.');const user={id:crypto.randomUUID(),username:name,passwordHash:await hash(password),createdAt:new Date().toISOString()};save([...users(),user]);return user;}
  async function login(username,password){const user=users().find(u=>u.username.toLowerCase()===username.trim().toLowerCase());if(!user||user.passwordHash!==await hash(password))throw new Error('Nome de usuário ou senha inválidos.');const session={id:user.id,username:user.username,createdAt:user.createdAt};localStorage.setItem(storageService.KEYS.session,JSON.stringify(session));return session;}
  function logout(){localStorage.removeItem(storageService.KEYS.session);}
  return {create,login,logout,users};
})();

(() => {
  if (!document.getElementById('examGrid')) return;
  const $ = selector => document.querySelector(selector);
  const examGrid=$('#examGrid'), summaryList=$('#summaryList'), favoritesList=$('#favoritesList'), search=$('#searchInput'), dialog=$('#readerDialog');
  let activeQuery=''; let subjectQuery=''; let authorQuery=''; let order='recent'; let pdfState=null;
  const escapeHtml=value=>String(value||'').replace(/[&<>'"]/g, char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const examFor=id=>storageService.getExams().find(exam=>exam.id===id);
  const summaryMarkup=summary=>{ const exam=examFor(summary.examId);const excerpt=(summary.introduction||String(summary.content||'').replace(/<[^>]+>/g,'')||'Material preparado para revisão.').slice(0,115);return `<article class="summary-card preview-card"><div class="subject-dot">${escapeHtml(exam.subject[0])}</div><div class="summary-details"><h3>${escapeHtml(summary.title)}</h3><p class="excerpt">${escapeHtml(excerpt)}${excerpt.length>=115?'…':''}</p><p>👤 Autor: <strong>${escapeHtml(summary.authorName||'NEXA')}</strong> · ${escapeHtml(exam.subject)} · ${escapeHtml(exam.classTime)}</p><small>${summary.contentType==='pdf'?'📄 Material em PDF · ':''}${summary.updatedAt?new Date(summary.updatedAt).toLocaleDateString('pt-BR'):''}</small></div><div class="summary-actions"><button class="outline-button favorite-button" data-id="${summary.id}">${storageService.favoriteIds().includes(summary.id)?'★ Favoritado':'☆ Favoritar'}</button><button class="outline-button read-button" data-id="${summary.id}">Abrir resumo →</button></div></article>`; };
  function filteredSummaries(){ const q=activeQuery.trim().toLocaleLowerCase('pt-BR'); const results=storageService.getSummaries().filter(s=>s.status==='published').filter(s=>{const e=examFor(s.examId);const searchable=[s.title,e.subject,e.title,s.authorName,s.introduction,String(s.content||'').replace(/<[^>]+>/g,'')].join(' ').toLocaleLowerCase('pt-BR');return (!q||searchable.includes(q))&&(!subjectQuery||e.subject===subjectQuery)&&(!authorQuery||s.authorId===authorQuery);});return results.sort((a,b)=>order==='popular'?0:new Date(b.updatedAt)-new Date(a.updatedAt)); }
  function render(){ const exams=storageService.getExams(), all=storageService.getSummaries(), published=filteredSummaries(); $('#examCount').textContent=exams.length; $('#publishedCount').textContent=all.filter(s=>s.status==='published').length;const authors=[...new Map(all.filter(s=>s.authorId).map(s=>[s.authorId,s.authorName])).entries()];$('#subjectFilter').innerHTML='<option value="">Todas as matérias</option>'+exams.map(e=>`<option value="${escapeHtml(e.subject)}">${escapeHtml(e.subject)}</option>`).join('');$('#subjectFilter').value=subjectQuery;$('#authorFilter').innerHTML='<option value="">Todos os autores</option>'+authors.map(([id,name])=>`<option value="${id}">${escapeHtml(name)}</option>`).join('');$('#authorFilter').value=authorQuery;
    examGrid.innerHTML=exams.map(exam=>`<article class="exam-card" data-exam="${exam.id}" tabindex="0"><div class="exam-icon">▤</div><p>${escapeHtml(exam.subject)}</p><h3>${escapeHtml(exam.title)}</h3><p>${escapeHtml(exam.classTime)}</p></article>`).join('');
    summaryList.innerHTML=published.length ? published.map(summaryMarkup).join('') : `<div class="empty">${activeQuery?'Nenhum resumo encontrado para esta pesquisa.':'Resumo ainda não publicado.'}</div>`;
    const favoriteSummaries=storageService.getSummaries().filter(s=>s.status==='published'&&storageService.favoriteIds().includes(s.id));
    favoritesList.innerHTML=favoriteSummaries.length?favoriteSummaries.map(summaryMarkup).join(''):'<div class="empty">Você ainda não salvou nenhum resumo.</div>';
    $('#clearSearch').hidden=!activeQuery;
  }
  async function renderPdf(fit=false){if(!pdfState)return;const host=$('#pdfCanvasHost'),page=await pdfState.pdf.getPage(pdfState.page);let base=page.getViewport({scale:1});if(fit)pdfState.scale=Math.max(.65,Math.min(2.2,(host.clientWidth-28)/base.width));const view=page.getViewport({scale:pdfState.scale});const canvas=$('#pdfCanvas');const ctx=canvas.getContext('2d');canvas.width=view.width;canvas.height=view.height;await page.render({canvasContext:ctx,viewport:view}).promise;$('#pdfPageInfo').textContent=`Página ${pdfState.page} / ${pdfState.pdf.numPages}`;$('#pdfZoom').textContent=`${Math.round(pdfState.scale*100)}%`;}
  async function loadPdf(data){const host=$('#pdfCanvasHost');if(!window.pdfjsLib){host.innerHTML='<p>O leitor de PDF precisa de conexão para carregar seus controles. Use o botão Baixar PDF.</p>';return;}try{const pdf=await pdfjsLib.getDocument(data).promise;pdfState={pdf,page:1,scale:1};await renderPdf(true);}catch{host.innerHTML='<p>Não foi possível abrir este PDF.</p>';}}
  function openReader(id){ const s=storageService.getSummary(id); if(!s) return; const e=examFor(s.examId); const pdfContent=s.contentType==='pdf'?s.pdfData?`<div class="pdf-reader"><p>📄 <strong>${escapeHtml(s.pdfName||'Resumo em PDF')}</strong></p><div class="pdf-controls"><button id="pdfPrev">← Página</button><button id="pdfNext">Próxima →</button><button id="pdfMinus">−</button><button id="pdfZoom">100%</button><button id="pdfPlus">+</button><button id="pdfFit">Ajustar</button><button id="pdfFullscreen">Tela cheia</button></div><div id="pdfPageInfo">Carregando PDF…</div><div id="pdfCanvasHost"><canvas id="pdfCanvas"></canvas></div><a class="outline-button" href="${s.pdfData}" download="${escapeHtml(s.pdfName||'resumo-nexa.pdf')}">Baixar PDF</a></div>`:'<p>Arquivo PDF não encontrado neste navegador.</p>':(s.content||'<p>Resumo ainda não publicado.</p>'); $('#readerContent').innerHTML=`<p class="eyebrow">${escapeHtml(e.subject)} · ${escapeHtml(e.classTime)}</p><h1>${escapeHtml(s.title)}</h1><p class="meta">${escapeHtml(e.title)} · Publicado por <strong>${escapeHtml(s.authorName||'NEXA')}</strong></p>${s.introduction?`<p>${escapeHtml(s.introduction)}</p>`:''}<div class="content-body">${pdfContent}</div>`; $('#readerFavorite').dataset.id=id; $('#readerFavorite').textContent=storageService.favoriteIds().includes(id)?'★ Favoritado':'☆ Favoritar'; dialog.showModal();if(s.contentType==='pdf'&&s.pdfData)setTimeout(()=>loadPdf(s.pdfData),80); }
  document.addEventListener('click', event=>{ const read=event.target.closest('.read-button'); const fav=event.target.closest('.favorite-button'); const exam=event.target.closest('.exam-card'); if(read) openReader(read.dataset.id); if(fav){if(storageService.toggleFavorite(fav.dataset.id)===null){location.href='auth.html';return;}render();} if(exam){activeQuery=examFor(exam.dataset.exam).subject;search.value=activeQuery;render();location.hash='resumos';} if(event.target.matches('[data-scroll]')) location.hash=event.target.dataset.scroll; if(event.target.matches('.close-dialog')) dialog.close(); if(event.target.id==='readerFavorite'){if(storageService.toggleFavorite(event.target.dataset.id)===null){location.href='auth.html';return;}event.target.textContent=storageService.favoriteIds().includes(event.target.dataset.id)?'★ Favoritado':'☆ Favoritar';render();} if(event.target.id==='studyMode'){$('.reader').classList.toggle('study');event.target.textContent=$('.reader').classList.contains('study')?'Sair do modo de estudo':'Modo de estudo';} if(event.target.dataset.size){const content=$('#readerContent');const current=parseFloat(getComputedStyle(content).fontSize);content.style.fontSize=`${Math.max(14,Math.min(23,current+(event.target.dataset.size==='larger'?1:-1))) }px`;}if(event.target.id==='pdfPrev'&&pdfState&&pdfState.page>1){pdfState.page--;renderPdf();}if(event.target.id==='pdfNext'&&pdfState&&pdfState.page<pdfState.pdf.numPages){pdfState.page++;renderPdf();}if(event.target.id==='pdfMinus'&&pdfState){pdfState.scale=Math.max(.5,pdfState.scale-.15);renderPdf();}if(event.target.id==='pdfPlus'&&pdfState){pdfState.scale=Math.min(3,pdfState.scale+.15);renderPdf();}if(event.target.id==='pdfFit'&&pdfState)renderPdf(true);if(event.target.id==='pdfFullscreen')$('#pdfCanvasHost')?.requestFullscreen?.();});
  search.addEventListener('input',event=>{activeQuery=event.target.value;render();}); $('#clearSearch').onclick=()=>{activeQuery='';search.value='';render();search.focus();};
  $('#subjectFilter').addEventListener('change',e=>{subjectQuery=e.target.value;render();});$('#authorFilter').addEventListener('change',e=>{authorQuery=e.target.value;render();});$('#orderFilter').addEventListener('change',e=>{order=e.target.value;render();});
  $('.menu-button').onclick=()=>{const nav=$('.main-nav');nav.classList.toggle('open');$('.menu-button').setAttribute('aria-expanded',nav.classList.contains('open'));};
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();search.focus();}});const user=storageService.currentUser();const account=$('#accountLink');if(user){account.textContent=`Olá, ${user.username}`;account.href='studio.html';}$('#year').textContent=new Date().getFullYear(); render();
})();