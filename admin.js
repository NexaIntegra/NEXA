(() => {
  const $ = selector => document.querySelector(selector), esc = value => String(value || '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
  let user, exams = [], summaries = [], faqs = [], tutorials = [], currentView = 'dashboard', selectedPdf = null, savedPdfPath = null, savedPdfName = null, selectedTutorialVideo = null, selectedTutorialThumbnail = null, savedTutorialVideoPath = null, savedTutorialThumbnailPath = null;
  const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' });
  const setLogin = async state => { $('#loginView').hidden = state; $('#adminApp').hidden = !state; if (state) { await load(); showView('dashboard'); } };
  const load = async () => { [exams, summaries, faqs, tutorials] = await Promise.all([nexaApi.getExams(), nexaApi.getSummaries(), nexaApi.getFaqs(true), nexaApi.getTutorials(true)]); populateExams(); renderAdmin(); renderExams(); renderHelp(); };
  const showView = view => { currentView = view; ['dashboard','summaries','editor','exams','help'].forEach(name => { $(`#${name}View`).hidden = name !== view; document.querySelector(`[data-view="${name}"]`)?.classList.toggle('active', name === view); }); const labels = { dashboard:['PAINEL','Visão geral'], summaries:['CONTEÚDO','Meus resumos'], editor:['EDITOR','Criar resumo'], exams:['ORGANIZAÇÃO','Gerenciar provas'], help:['AJUDA','Dúvidas e tutoriais'] }; $('#pageEyebrow').textContent = labels[view][0]; $('#pageTitle').textContent = labels[view][1]; if (view === 'editor' && !$('#editingId').value) resetEditor(); };
  const examWhen = exam => [exam.examDate ? new Date(`${exam.examDate}T12:00:00`).toLocaleDateString('pt-BR') : '', exam.classTime].filter(Boolean).join(' · ');
  const populateExams = () => { $('#summaryExam').innerHTML = exams.map(exam => `<option value="${exam.id}">${esc(exam.subject)} — ${esc(exam.title)} (${esc(examWhen(exam))})</option>`).join(''); };
  const renderAdmin = () => { const published = summaries.filter(s => s.status === 'published'), drafts = summaries.filter(s => s.status === 'draft'), last = summaries.map(s => s.updatedAt).filter(Boolean).sort().at(-1); $('#totalExams').textContent = exams.length; $('#totalSummaries').textContent = summaries.length; $('#totalPublished').textContent = published.length; $('#totalDrafts').textContent = drafts.length; $('#lastUpdate').textContent = last ? `Último resumo atualizado em ${dateFormat.format(new Date(last))}.` : 'Nenhum resumo criado até agora.'; $('#adminSummaryList').innerHTML = summaries.length ? summaries.map(summary => { const exam = summary.exam || exams.find(item => item.id === summary.examId); return `<tr><td><strong>${esc(summary.title)}</strong></td><td>${esc(exam?.subject)}</td><td>${esc(exam?.title)}<br><small>${esc(exam?.classTime)}</small></td><td><span class="status ${summary.status}">${summary.status === 'published' ? 'Publicado' : 'Rascunho'}</span></td><td>${dateFormat.format(new Date(summary.updatedAt))}</td><td><div class="table-actions"><button data-action="edit" data-id="${summary.id}">Editar</button><button data-action="preview" data-id="${summary.id}">Visualizar</button><button data-action="toggle" data-id="${summary.id}">${summary.status === 'published' ? 'Despublicar' : 'Publicar'}</button><button class="danger" data-action="delete" data-id="${summary.id}">Excluir</button></div></td></tr>`; }).join('') : '<tr><td colspan="6" style="text-align:center;color:#64748b;padding:28px">Você ainda não criou nenhum resumo.</td></tr>'; };
  const renderExams = () => { $('#examAdminList').innerHTML = exams.map(exam => `<article class="exam-admin-card"><strong>${esc(exam.subject)}</strong><span>${esc(exam.title)}</span><small>${esc(examWhen(exam))}</small><div><button data-exam-action="edit" data-id="${exam.id}">Editar</button><button data-exam-action="delete" data-id="${exam.id}" class="danger">Excluir</button></div></article>`).join(''); };
  const renderHelp = () => {
    $('#faqAdminList').innerHTML = faqs.length ? faqs.map(item => `<article class="help-admin-item"><div><strong>${esc(item.question)}</strong><p>${esc(item.answer)}</p></div><span class="help-status ${item.active ? 'active' : 'inactive'}">${item.active ? 'Visível' : 'Oculta'}</span><div class="table-actions"><button data-help-action="faq-edit" data-id="${item.id}">Editar</button><button data-help-action="faq-toggle" data-id="${item.id}">${item.active ? 'Ocultar' : 'Mostrar'}</button><button class="danger" data-help-action="faq-delete" data-id="${item.id}">Excluir</button></div></article>`).join('') : '<div class="empty">Nenhuma pergunta cadastrada.</div>';
    $('#tutorialAdminList').innerHTML = tutorials.length ? tutorials.map(item => `<article class="help-admin-item"><div><strong>${esc(item.title)}</strong><p>${esc(item.description || item.video_url)}</p></div><span class="help-status ${item.active ? 'active' : 'inactive'}">${item.active ? 'Visível' : 'Oculto'}</span><div class="table-actions"><button data-help-action="tutorial-edit" data-id="${item.id}">Editar</button><button data-help-action="tutorial-toggle" data-id="${item.id}">${item.active ? 'Ocultar' : 'Mostrar'}</button><button class="danger" data-help-action="tutorial-delete" data-id="${item.id}">Excluir</button></div></article>`).join('') : '<div class="empty">Nenhum tutorial cadastrado.</div>';
  };
  const resetFaq = () => { $('#faqForm').reset(); $('#faqId').value = ''; $('#faqOrder').value = 0; $('#faqActive').checked = true; };
  const resetTutorial = () => { $('#tutorialForm').reset(); $('#tutorialId').value = ''; $('#tutorialActive').checked = true; selectedTutorialVideo = null; selectedTutorialThumbnail = null; savedTutorialVideoPath = null; savedTutorialThumbnailPath = null; $('#tutorialVideoStatus').textContent = 'No celular, você poderá escolher um vídeo da Fototeca/Galeria ou dos Arquivos.'; $('#tutorialThumbStatus').textContent = 'Aceita fotos da Fototeca/Galeria ou imagens dos Arquivos.'; };
  const ensureTutorialMediaApi = () => {
    if (!window.nexaApi) window.nexaApi = {};
    if (typeof window.nexaApi.uploadTutorialVideo !== 'function') {
      window.nexaApi.uploadTutorialVideo = async file => {
        if (!file) throw new Error('Escolha um vídeo.');
        if (!file.type || !file.type.startsWith('video/')) throw new Error('Escolha um arquivo de vídeo válido.');
        if (file.size > 100 * 1024 * 1024) throw new Error('O vídeo deve ter no máximo 100 MB.');
        const url = window.NEXA_SUPABASE_URL;
        const key = window.NEXA_SUPABASE_PUBLISHABLE_KEY || window.NEXA_SUPABASE_ANON_KEY;
        if (!url || !key) throw new Error('A conexão com o Supabase não está configurada.');
        const client = window.supabase.createClient(url, key);
        const { data: authData, error: authError } = await client.auth.getUser();
        if (authError || !authData?.user) throw new Error('Entre na conta de administrador novamente.');
        const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'mp4';
        const path = `${authData.user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await client.storage.from('tutorial-videos').upload(path, file, { contentType: file.type || 'video/mp4', cacheControl: '3600', upsert: false });
        if (error) throw error;
        return { path, url: client.storage.from('tutorial-videos').getPublicUrl(path).data.publicUrl, name: file.name };
      };
    }
    if (typeof window.nexaApi.uploadTutorialThumbnail !== 'function') {
      window.nexaApi.uploadTutorialThumbnail = async file => {
        if (!file) throw new Error('Escolha uma imagem para a capa.');
        if (!file.type || !file.type.startsWith('image/')) throw new Error('Escolha uma imagem válida para a capa.');
        if (file.size > 5 * 1024 * 1024) throw new Error('A capa deve ter no máximo 5 MB.');
        const url = window.NEXA_SUPABASE_URL;
        const key = window.NEXA_SUPABASE_PUBLISHABLE_KEY || window.NEXA_SUPABASE_ANON_KEY;
        if (!url || !key) throw new Error('A conexão com o Supabase não está configurada.');
        const client = window.supabase.createClient(url, key);
        const { data: authData, error: authError } = await client.auth.getUser();
        if (authError || !authData?.user) throw new Error('Entre na conta de administrador novamente.');
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'jpg';
        const path = `${authData.user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await client.storage.from('tutorial-thumbnails').upload(path, file, { contentType: file.type || 'image/jpeg', cacheControl: '3600', upsert: false });
        if (error) throw error;
        return { path, url: client.storage.from('tutorial-thumbnails').getPublicUrl(path).data.publicUrl, name: file.name };
      };
    }
  };
  ensureTutorialMediaApi();
  const resetEditor = () => { $('#summaryForm').reset(); $('#editingId').value = ''; $('#contentEditor').innerHTML = ''; selectedPdf = null; savedPdfPath = null; savedPdfName = null; $('#pdfStatus').textContent = ''; toggleMaterialType(); updatePreview(); };
  const toggleMaterialType = () => { const pdf = $('#summaryType').value === 'pdf'; $('#writtenEditor').hidden = pdf; $('#pdfEditor').hidden = !pdf; };
  const draftData = status => ({ id: $('#editingId').value || undefined, examId: $('#summaryExam').value, title: $('#summaryTitle').value.trim(), introduction: $('#summaryIntro').value.trim(), contentType: $('#summaryType').value, content: $('#contentEditor').innerHTML.trim(), pdfPath: savedPdfPath, pdfName: savedPdfName, authorId: user.id, status });
  const materialPreview = data => data.contentType === 'pdf' ? (data.pdfName ? `<div class="pdf-preview">📄 <strong>${esc(data.pdfName)}</strong><span>Arquivo PDF armazenado no Supabase.</span></div>` : '<p class="preview-empty">Anexe um arquivo PDF para publicar este resumo.</p>') : (data.content || '<p class="preview-empty">Escreva o conteúdo do resumo para ver a pré-visualização.</p>');
  const updatePreview = () => { const data = draftData('draft'), exam = exams.find(item => item.id === data.examId); $('#previewContent').innerHTML = data.title ? `<p class="eyebrow">${esc(exam?.subject)} · ${esc(exam?.classTime)}</p><h1>${esc(data.title)}</h1><p class="meta">${esc(exam?.title)}</p>${data.introduction ? `<p>${esc(data.introduction)}</p>` : ''}${materialPreview(data)}` : '<p class="preview-empty">Preencha o resumo para ver como ele ficará para o aluno.</p>'; };
  async function save(status) { try { let data = draftData(status); if (!data.title) return $('#summaryTitle').focus(); if (data.contentType === 'pdf' && selectedPdf) { const uploaded = await nexaApi.uploadPdf(selectedPdf); data.pdfPath = savedPdfPath = uploaded.path; data.pdfName = savedPdfName = uploaded.name; } if (data.contentType === 'pdf' && !data.pdfPath) throw new Error('Escolha um arquivo PDF antes de salvar.'); await nexaApi.saveSummary(data); await load(); $('#editingId').value = data.id || ''; updatePreview(); if (status === 'published') showView('summaries'); } catch (error) { $('#pdfStatus').textContent = error.message || 'Não foi possível salvar o material.'; } }
  $('#loginForm').onsubmit = async event => { event.preventDefault(); try { await authService.login($('#email').value, $('#password').value); user = await nexaApi.currentUser(); if (user?.role !== 'admin') { await authService.logout(); throw new Error('Este e-mail não possui acesso administrativo.'); } await setLogin(true); } catch (error) { $('#loginError').textContent = error.message || 'Não foi possível entrar.'; } };
  $('#logoutButton').onclick = async () => { await authService.logout(); user = null; setLogin(false); $('#password').value = ''; };
  document.addEventListener('click', async event => { const tab = event.target.closest('[data-view]'); if (tab) showView(tab.dataset.view); if (event.target.matches('.close-dialog')) $('#previewDialog').close(); const action = event.target.closest('[data-action]'); if (action) { const summary = summaries.find(item => item.id === action.dataset.id); if (!summary) return; if (action.dataset.action === 'edit') { $('#editingId').value = summary.id; $('#summaryExam').value = summary.examId; $('#summaryTitle').value = summary.title; $('#summaryIntro').value = summary.introduction; $('#summaryType').value = summary.contentType; $('#contentEditor').innerHTML = summary.content; savedPdfPath = summary.pdfPath; savedPdfName = summary.pdfName; selectedPdf = null; $('#pdfStatus').textContent = savedPdfName ? `PDF salvo: ${savedPdfName}` : ''; toggleMaterialType(); showView('editor'); $('#pageTitle').textContent = 'Editar resumo'; updatePreview(); } if (action.dataset.action === 'preview') { const exam = summary.exam || exams.find(item => item.id === summary.examId); $('#fullPreview').innerHTML = `<p class="eyebrow">${esc(exam?.subject)} · ${esc(exam?.classTime)}</p><h1>${esc(summary.title)}</h1>${materialPreview(summary)}`; $('#previewDialog').showModal(); } if (action.dataset.action === 'toggle') { await nexaApi.saveSummary({ ...summary, status: summary.status === 'published' ? 'draft' : 'published' }); await load(); } if (action.dataset.action === 'delete' && confirm(`Excluir o resumo “${summary.title}”?`)) { await nexaApi.deleteSummary(summary.id); await load(); } } const helpAction = event.target.closest('[data-help-action]');
    if (helpAction) {
      const id = helpAction.dataset.id;
      if (helpAction.dataset.helpAction.startsWith('faq-')) {
        const item = faqs.find(x => x.id === id); if (!item) return;
        if (helpAction.dataset.helpAction === 'faq-edit') { $('#faqId').value = item.id; $('#faqQuestion').value = item.question; $('#faqAnswer').value = item.answer; $('#faqOrder').value = item.display_order ?? item.displayOrder ?? 0; $('#faqActive').checked = item.active !== false; showView('help'); }
        if (helpAction.dataset.helpAction === 'faq-toggle') { await nexaApi.saveFaq({ id:item.id, question:item.question, answer:item.answer, displayOrder:item.display_order ?? 0, active:!item.active }); await load(); }
        if (helpAction.dataset.helpAction === 'faq-delete' && confirm(`Excluir a pergunta “${item.question}”?`)) { await nexaApi.deleteFaq(item.id); await load(); }
      } else {
        const item = tutorials.find(x => x.id === id); if (!item) return;
        if (helpAction.dataset.helpAction === 'tutorial-edit') { $('#tutorialId').value = item.id; $('#tutorialTitle').value = item.title; $('#tutorialDescription').value = item.description || ''; $('#tutorialActive').checked = item.active !== false; selectedTutorialVideo = null; selectedTutorialThumbnail = null; savedTutorialVideoPath = item.video_path || null; savedTutorialThumbnailPath = item.thumbnail_path || null; $('#tutorialVideoFile').value = ''; $('#tutorialThumbFile').value = ''; $('#tutorialVideoStatus').textContent = item.video_path ? 'Vídeo enviado: arquivo salvo no Supabase. Escolha outro arquivo para substituir.' : (item.video_url ? 'Este tutorial usa um link de vídeo. Escolha um arquivo para trocar por um vídeo enviado.' : 'Nenhum vídeo selecionado.'); $('#tutorialThumbStatus').textContent = item.thumbnail_path ? 'Capa enviada: imagem salva no Supabase. Escolha outra para substituir.' : (item.thumbnail_url ? 'Este tutorial usa uma URL de capa. Escolha uma imagem para substituir.' : 'Capa opcional: você pode enviar uma foto ou usar uma URL.'); showView('help'); }
        if (helpAction.dataset.helpAction === 'tutorial-toggle') { await nexaApi.saveTutorial({ id:item.id, title:item.title, description:item.description, videoUrl:item.video_url, videoPath:item.video_path, thumbnailUrl:item.thumbnail_url, thumbnailPath:item.thumbnail_path, active:!item.active }); await load(); }
        if (helpAction.dataset.helpAction === 'tutorial-delete' && confirm(`Excluir o tutorial “${item.title}”?`)) { await nexaApi.deleteTutorial(item.id); await load(); }
      }
      return;
    }
 const examAction = event.target.closest('[data-exam-action]'); if (examAction) { const exam = exams.find(item => item.id === examAction.dataset.id); if (examAction.dataset.examAction === 'edit') { $('#examId').value = exam.id; $('#examSubject').value = exam.subject; $('#examTitle').value = exam.title; $('#examStudyGuide').value = exam.studyGuide || ''; $('#examClassTime').value = exam.classTime; } if (examAction.dataset.examAction === 'delete') try { await nexaApi.deleteExam(exam.id); await load(); } catch { $('#examMessage').textContent = 'Esta prova possui resumos vinculados e não pode ser removida.'; } } });
  ['input','change'].forEach(type => $('#summaryForm').addEventListener(type, updatePreview)); $('#summaryType').onchange = () => { toggleMaterialType(); updatePreview(); }; $('#pdfFile').onchange = event => { selectedPdf = event.target.files[0] || null; if (selectedPdf) { savedPdfPath = null; savedPdfName = selectedPdf.name; $('#pdfStatus').textContent = `PDF selecionado: ${selectedPdf.name}`; } updatePreview(); }; document.querySelectorAll('.toolbar [data-command]').forEach(button => button.onclick = () => { document.execCommand(button.dataset.command, false, button.dataset.value || null); $('#contentEditor').focus(); updatePreview(); }); $('#calloutButton').onclick = () => { document.execCommand('insertHTML', false, '<div class="callout"><strong>Importante:</strong> Escreva uma informação que o aluno não pode esquecer.</div><p><br></p>'); updatePreview(); }; $('#separatorButton').onclick = () => { document.execCommand('insertHTML', false, '<hr><p><br></p>'); updatePreview(); }; $('#summaryForm').onsubmit = event => { event.preventDefault(); save('published'); }; $('#saveDraft').onclick = () => save('draft'); $('#previewButton').onclick = () => { updatePreview(); $('#fullPreview').innerHTML = $('#previewContent').innerHTML; $('#previewDialog').showModal(); };
  $('#faqForm').onsubmit = async event => { event.preventDefault(); try { const question=$('#faqQuestion').value.trim(), answer=$('#faqAnswer').value.trim(); if(!question||!answer) throw new Error('Preencha a pergunta e a resposta.'); await nexaApi.saveFaq({ id:$('#faqId').value || undefined, question, answer, displayOrder:Number($('#faqOrder').value||0), active:$('#faqActive').checked }); resetFaq(); await load(); } catch(error) { alert(error.message || 'Não foi possível salvar a pergunta.'); } };
  $('#clearFaq').onclick = resetFaq;
  $('#tutorialVideoFile').onchange = event => {
    selectedTutorialVideo = event.target.files[0] || null;
    if (selectedTutorialVideo) $('#tutorialVideoStatus').textContent = `Vídeo selecionado: ${selectedTutorialVideo.name}`;
  };
  $('#tutorialThumbFile').onchange = event => {
    selectedTutorialThumbnail = event.target.files[0] || null;
    if (selectedTutorialThumbnail) $('#tutorialThumbStatus').textContent = `Capa selecionada: ${selectedTutorialThumbnail.name}`;
  };
  $('#tutorialForm').onsubmit = async event => { event.preventDefault(); try {
    ensureTutorialMediaApi();
    const title = $('#tutorialTitle').value.trim();
    if (!title) throw new Error('Preencha o título do tutorial.');
    if (!selectedTutorialVideo) throw new Error('Escolha o arquivo de vídeo.');
    let uploaded = await window.nexaApi.uploadTutorialVideo(selectedTutorialVideo);
    let thumbnailUrl = null, thumbnailPath = null;
    if (selectedTutorialThumbnail) {
      const thumb = await window.nexaApi.uploadTutorialThumbnail(selectedTutorialThumbnail);
      thumbnailUrl = thumb.url; thumbnailPath = thumb.path;
    }
    await nexaApi.saveTutorial({
      id: $('#tutorialId').value || undefined,
      title,
      description: $('#tutorialDescription').value.trim(),
      videoUrl: uploaded.url,
      videoPath: uploaded.path,
      thumbnailUrl,
      thumbnailPath,
      displayOrder: 0,
      active: $('#tutorialActive').checked
    });
    resetTutorial();
    await load();
  } catch(error) {
    alert(error.message || 'Não foi possível salvar o tutorial.');
  } };
  $('#clearTutorial').onclick = resetTutorial;
  $('#examForm').onsubmit = async event => { event.preventDefault(); try { await nexaApi.saveExam({ id: $('#examId').value || undefined, subject: $('#examSubject').value.trim(), title: $('#examTitle').value.trim(), studyGuide: $('#examStudyGuide').value.trim(), examDate: $('#examDate').value, classTime: $('#examClassTime').value.trim() }); $('#examForm').reset(); $('#examId').value = ''; $('#examMessage').textContent = 'Prova salva com sucesso.'; await load(); } catch (error) { $('#examMessage').textContent = error.message; } }; $('#clearExam').onclick = () => { $('#examForm').reset(); $('#examId').value = ''; };
  (async () => { user = await nexaApi.currentUser(); if (user?.role === 'admin') setLogin(true); else setLogin(false); })();
  // Mantém a data ao reabrir uma prova existente para edição.
  document.addEventListener('click', event => { const button = event.target.closest('[data-exam-action="edit"]'); if (!button) return; const exam = exams.find(item => item.id === button.dataset.id); if (exam) $('#examDate').value = exam.examDate || ''; });
})();