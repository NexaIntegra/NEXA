/* CONFIGURAÇÃO DO ADMINISTRADOR ÚNICO = EU
   Altere estas credenciais antes de disponibilizar o projeto. Em produção, elas NUNCA
   devem ficar no JavaScript: use autenticação segura no backend. */
const ADMIN_CONFIG = { username: "beberwwq@gmail.com", password: "berber211" };

(() => {
  const $ = selector => document.querySelector(selector);
  const loginView=$('#loginView'), adminApp=$('#adminApp');
  let currentView='dashboard';
  // PDFs são convertidos para Data URL somente nesta versão local (limite: 3 MB).
  let selectedPdfData=null;
  let selectedPdfName='';
  const dateFormat=new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium'});
  const esc=value=>String(value||'').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  function loggedIn(){return sessionStorage.getItem('nexa_admin_session')==='true';}
  function setLogin(state){loginView.hidden=state;adminApp.hidden=!state;if(state){populateExams();renderAdmin();showView('dashboard');}}
  $('#loginForm').addEventListener('submit', event=>{
    event.preventDefault();
    const user=$('#username').value.trim();
    const pass=$('#password').value;
    // O nome não diferencia maiúsculas/minúsculas; a senha continua sendo exata.
    if(user.toLowerCase()===ADMIN_CONFIG.username.toLowerCase()&&pass===ADMIN_CONFIG.password){
      sessionStorage.setItem('nexa_admin_session','true');
      $('#loginError').textContent='Acesso liberado. Abrindo o painel…';
      $('#loginError').style.color='#166534';
      setLogin(true);
    }else{
      $('#loginError').style.color='#b91c1c';
      $('#loginError').textContent='Usuário ou senha inválidos. Confira os dados e tente novamente.';
    }
  });
  $('#logoutButton').onclick=()=>{sessionStorage.removeItem('nexa_admin_session');setLogin(false);$('#password').value='';};
  function populateExams(){ $('#summaryExam').innerHTML=storageService.getExams().map(e=>`<option value="${e.id}">${esc(e.subject)} — ${esc(e.title)} (${esc(e.classTime)})</option>`).join(''); }
  function showView(view){currentView=view; ['dashboard','summaries','editor','exams'].forEach(name=>{$(`#${name}View`).hidden=name!==view;document.querySelector(`[data-view="${name}"]`)?.classList.toggle('active',name===view);}); const titles={dashboard:['PAINEL','Visão geral'],summaries:['CONTEÚDO','Meus resumos'],editor:['EDITOR','Criar resumo'],exams:['ORGANIZAÇÃO','Gerenciar provas']};$('#pageEyebrow').textContent=titles[view][0];$('#pageTitle').textContent=titles[view][1]; if(view==='editor'&&!$('#editingId').value) resetEditor();if(view==='exams')renderExams();}
  document.addEventListener('click', event=>{const tab=event.target.closest('[data-view]');if(tab)showView(tab.dataset.view);});
  function renderAdmin(){const all=storageService.getSummaries(), published=all.filter(s=>s.status==='published'), drafts=all.filter(s=>s.status==='draft');$('#totalExams').textContent=storageService.getExams().length;$('#totalSummaries').textContent=all.length;$('#totalPublished').textContent=published.length;$('#totalDrafts').textContent=drafts.length;const last=all.map(s=>s.updatedAt).filter(Boolean).sort().at(-1);$('#lastUpdate').textContent=last?`Último resumo atualizado em ${dateFormat.format(new Date(last))}.`:'Nenhum resumo criado até agora.';
    $('#adminSummaryList').innerHTML=all.length?all.map(s=>{const e=storageService.getExams().find(x=>x.id===s.examId);return `<tr><td><strong>${esc(s.title)}</strong></td><td>${esc(e.subject)}</td><td>${esc(e.title)}<br><small>${esc(e.classTime)}</small></td><td><span class="status ${s.status}">${s.status==='published'?'Publicado':'Rascunho'}</span></td><td>${dateFormat.format(new Date(s.updatedAt))}</td><td><div class="table-actions"><button data-action="edit" data-id="${s.id}">Editar</button><button data-action="preview" data-id="${s.id}">Visualizar</button><button data-action="toggle" data-id="${s.id}">${s.status==='published'?'Despublicar':'Publicar'}</button><button class="danger" data-action="delete" data-id="${s.id}">Excluir</button></div></td></tr>`}).join(''):'<tr><td colspan="6" style="text-align:center;color:#64748b;padding:28px">Você ainda não criou nenhum resumo.</td></tr>';
  }
  function renderExams(){const list=storageService.getExams();$('#examAdminList').innerHTML=list.map(exam=>`<article class="exam-admin-card"><strong>${esc(exam.subject)}</strong><span>${esc(exam.title)}</span><small>${esc(exam.classTime)}</small><div><button data-exam-action="edit" data-id="${exam.id}">Editar</button><button data-exam-action="delete" data-id="${exam.id}" class="danger">Excluir</button></div></article>`).join('');}
  function resetExamForm(){$('#examForm').reset();$('#examId').value='';$('#examMessage').textContent='';}
  function resetEditor(){ $('#summaryForm').reset();$('#editingId').value='';$('#contentEditor').innerHTML='';selectedPdfData=null;selectedPdfName='';$('#pdfStatus').textContent='';toggleMaterialType();$('#previewContent').innerHTML='<p class="preview-empty">Preencha o resumo para ver como ele ficará para o aluno.</p>';$('#pageTitle').textContent='Criar resumo'; }
  function materialType(){return $('#summaryType').value;}
  function toggleMaterialType(){const isPdf=materialType()==='pdf';$('#writtenEditor').hidden=isPdf;$('#pdfEditor').hidden=!isPdf;}
  function draftData(status){return {id:$('#editingId').value||crypto.randomUUID(),examId:$('#summaryExam').value,title:$('#summaryTitle').value.trim(),introduction:$('#summaryIntro').value.trim(),contentType:materialType(),content:$('#contentEditor').innerHTML.trim(),pdfData:selectedPdfData,pdfName:selectedPdfName,status,updatedAt:new Date().toISOString()};}
  function materialPreview(data){if(data.contentType==='pdf')return data.pdfData?`<div class="pdf-preview">📄 <strong>${esc(data.pdfName||'Resumo em PDF')}</strong><span>Arquivo PDF anexado e pronto para o aluno.</span></div>`:'<p class="preview-empty">Anexe um arquivo PDF para publicar este resumo.</p>';return data.content||'<p class="preview-empty">Escreva o conteúdo do resumo para ver a pré-visualização.</p>';}
  function updatePreview(){const data=draftData('draft');const e=storageService.getExams().find(x=>x.id===data.examId); $('#previewContent').innerHTML=data.title?`<p class="eyebrow">${esc(e.subject)} · ${esc(e.classTime)}</p><h1>${esc(data.title)}</h1><p class="meta">${esc(e.title)}</p>${data.introduction?`<p>${esc(data.introduction)}</p>`:''}${materialPreview(data)}`:'<p class="preview-empty">Preencha o resumo para ver como ele ficará para o aluno.</p>';}
  ['input','change'].forEach(type=>$('#summaryForm').addEventListener(type,updatePreview));
  $('#summaryType').addEventListener('change',()=>{toggleMaterialType();updatePreview();});
  $('#pdfFile').addEventListener('change',event=>{const file=event.target.files[0];if(!file)return;if(file.type!=='application/pdf'){event.target.value='';$('#pdfStatus').textContent='Escolha somente arquivos em PDF.';return;}if(file.size>3*1024*1024){event.target.value='';$('#pdfStatus').textContent='O arquivo ultrapassa o limite local de 3 MB.';return;}const reader=new FileReader();reader.onload=()=>{selectedPdfData=reader.result;selectedPdfName=file.name;$('#pdfStatus').textContent=`PDF selecionado: ${file.name}`;updatePreview();};reader.readAsDataURL(file);});
  document.querySelectorAll('.toolbar [data-command]').forEach(button=>button.onclick=()=>{document.execCommand(button.dataset.command,false,button.dataset.value||null);$('#contentEditor').focus();updatePreview();});
  $('#calloutButton').onclick=()=>{document.execCommand('insertHTML',false,'<div class="callout"><strong>Importante:</strong> Escreva uma informação que o aluno não pode esquecer.</div><p><br></p>');$('#contentEditor').focus();updatePreview();};
  $('#separatorButton').onclick=()=>{document.execCommand('insertHTML',false,'<hr><p><br></p>');$('#contentEditor').focus();updatePreview();};
  function save(status){const data=draftData(status);if(!data.title){$('#summaryTitle').focus();return;}if(data.contentType==='pdf'&&!data.pdfData){$('#pdfStatus').textContent='Escolha um arquivo PDF antes de salvar.';$('#pdfFile').focus();return;}try{storageService.saveSummary(data);}catch(error){$('#pdfStatus').textContent='Não foi possível salvar. Tente um PDF menor.';return;}renderAdmin();$('#editingId').value=data.id;updatePreview();}
  $('#summaryForm').addEventListener('submit',event=>{event.preventDefault();save('published');showView('summaries');});$('#saveDraft').onclick=()=>save('draft');
  $('#previewButton').onclick=()=>{updatePreview();$('#fullPreview').innerHTML=$('#previewContent').innerHTML;$('#previewDialog').showModal();};
  document.addEventListener('click',event=>{if(event.target.matches('.close-dialog'))$('#previewDialog').close();const button=event.target.closest('[data-action]');if(!button)return;const summary=storageService.getSummary(button.dataset.id);if(!summary)return;const action=button.dataset.action;if(action==='edit'){ $('#editingId').value=summary.id;$('#summaryExam').value=summary.examId;$('#summaryTitle').value=summary.title;$('#summaryIntro').value=summary.introduction||'';$('#summaryType').value=summary.contentType||'written';$('#contentEditor').innerHTML=summary.content||'';selectedPdfData=summary.pdfData||null;selectedPdfName=summary.pdfName||'';$('#pdfStatus').textContent=selectedPdfName?`PDF salvo: ${selectedPdfName}`:'';toggleMaterialType();showView('editor');$('#pageTitle').textContent='Editar resumo';updatePreview();}if(action==='preview'){const e=storageService.getExams().find(x=>x.id===summary.examId);$('#fullPreview').innerHTML=`<p class="eyebrow">${esc(e.subject)} · ${esc(e.classTime)}</p><h1>${esc(summary.title)}</h1><p class="meta">${esc(e.title)}</p>${summary.introduction?`<p>${esc(summary.introduction)}</p>`:''}${materialPreview(summary)}`;$('#previewDialog').showModal();}if(action==='toggle'){summary.status=summary.status==='published'?'draft':'published';summary.updatedAt=new Date().toISOString();storageService.saveSummary(summary);renderAdmin();}if(action==='delete'){if(confirm(`Excluir o resumo “${summary.title}”? Esta ação não pode ser desfeita.`)){storageService.deleteSummary(summary.id);renderAdmin();}}});
  $('#examForm').addEventListener('submit',event=>{event.preventDefault();const id=$('#examId').value||crypto.randomUUID();const subject=$('#examSubject').value.trim(),title=$('#examTitle').value.trim(),classTime=$('#examClassTime').value.trim(),examDate=$('#examDate').value;storageService.saveExam({id,subject,title,classTime,examDate});populateExams();renderAdmin();renderExams();resetExamForm();$('#examMessage').style.color='#166534';$('#examMessage').textContent='Prova salva com sucesso.';});
  $('#clearExam').onclick=resetExamForm;
  document.addEventListener('click',event=>{const button=event.target.closest('[data-exam-action]');if(!button)return;const exam=storageService.getExams().find(item=>item.id===button.dataset.id);if(!exam)return;if(button.dataset.examAction==='edit'){$('#examId').value=exam.id;$('#examSubject').value=exam.subject;$('#examTitle').value=exam.title;$('#examClassTime').value=exam.classTime;$('#examDate').value=exam.examDate||'';$('#examMessage').textContent='Editando esta prova.';}if(button.dataset.examAction==='delete'){try{storageService.deleteExam(exam.id);populateExams();renderAdmin();renderExams();}catch(error){$('#examMessage').style.color='#b91c1c';$('#examMessage').textContent=error.message;}}});
  setLogin(loggedIn());
})();