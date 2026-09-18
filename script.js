(() => {
  if (!document.getElementById('examGrid')) return;
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value || '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  let exams = [], summaries = [], favorites = [], activeQuery = '', subjectQuery = '', authorQuery = '', order = 'recent', pdfState = null;
  const examFor = id => exams.find(exam => exam.id === id);
  const examWhen = exam => [exam.examDate ? new Date(`${exam.examDate}T12:00:00`).toLocaleDateString('pt-BR') : '', exam.classTime].filter(Boolean).join(' · ');
  const summaryMarkup = summary => {
    const exam = summary.exam || examFor(summary.examId); if (!exam) return '';
    const excerpt = (summary.introduction || String(summary.content || '').replace(/<[^>]+>/g, '') || 'Material preparado para revisão.').slice(0, 115);
    return `<article class="summary-card preview-card"><div class="subject-dot">${esc(exam.subject[0])}</div><div class="summary-details"><h3>${esc(summary.title)}</h3><p class="excerpt">${esc(excerpt)}${excerpt.length >= 115 ? '…' : ''}</p><p>👤 Autor: <strong>${esc(summary.authorName)}</strong> · ${esc(exam.subject)} · ${esc(exam.classTime)}</p><small>${summary.contentType === 'pdf' ? '📄 Material em PDF · ' : ''}${summary.updatedAt ? new Date(summary.updatedAt).toLocaleDateString('pt-BR') : ''}</small></div><div class="summary-actions"><button class="outline-button favorite-button" data-id="${summary.id}">${favorites.includes(summary.id) ? '★ Favoritado' : '☆ Favoritar'}</button><button class="outline-button read-button" data-id="${summary.id}">Abrir resumo →</button></div></article>`;
  };
  const filtered = () => {
    const q = activeQuery.trim().toLocaleLowerCase('pt-BR');
    return summaries.filter(summary => {
      const exam = summary.exam || examFor(summary.examId); if (!exam) return false;
      const text = [summary.title, exam.subject, exam.title, summary.authorName, summary.introduction, String(summary.content || '').replace(/<[^>]+>/g, '')].join(' ').toLocaleLowerCase('pt-BR');
      return (!q || text.includes(q)) && (!subjectQuery || exam.subject === subjectQuery) && (!authorQuery || summary.authorId === authorQuery);
    }).sort((a, b) => order === 'recent' ? new Date(b.updatedAt) - new Date(a.updatedAt) : 0);
  };
  const render = () => {
    const published = filtered().filter(summary => summary.status === 'published');
    $('#examCount').textContent = exams.length; $('#publishedCount').textContent = summaries.filter(summary => summary.status === 'published').length;
    $('#examGrid').innerHTML = exams.map(exam => `<article class="exam-card" data-exam="${exam.id}" tabindex="0"><div class="exam-icon">▤</div><p>${esc(exam.subject)}</p><h3>${esc(exam.title)}</h3><p>${esc(examWhen(exam))}</p></article>`).join('');
    $('#summaryList').innerHTML = published.length ? published.map(summaryMarkup).join('') : `<div class="empty">${activeQuery ? 'Nenhum resumo encontrado para esta pesquisa.' : 'Ainda não há resumos publicados.'}</div>`;
    $('#favoritesList').innerHTML = summaries.filter(summary => favorites.includes(summary.id)).map(summaryMarkup).join('') || '<div class="empty">Você ainda não salvou nenhum resumo.</div>';
    $('#subjectFilter').innerHTML = '<option value="">Todas as matérias</option>' + exams.map(exam => `<option value="${esc(exam.subject)}">${esc(exam.subject)}</option>`).join(''); $('#subjectFilter').value = subjectQuery;
    const authors = [...new Map(summaries.map(summary => [summary.authorId, summary.authorName])).entries()];
    $('#authorFilter').innerHTML = '<option value="">Todos os autores</option>' + authors.map(([id, name]) => `<option value="${id}">${esc(name)}</option>`).join(''); $('#authorFilter').value = authorQuery; $('#clearSearch').hidden = !activeQuery;
  };
  async function renderPdf(fit = false) {
    if (!pdfState) return; const host = $('#pdfCanvasHost'), page = await pdfState.pdf.getPage(pdfState.page), base = page.getViewport({ scale: 1 });
    if (fit) pdfState.scale = Math.max(.65, Math.min(2.2, (host.clientWidth - 28) / base.width));
    const viewport = page.getViewport({ scale: pdfState.scale }), canvas = $('#pdfCanvas'), context = canvas.getContext('2d'); canvas.width = viewport.width; canvas.height = viewport.height;
    await page.render({ canvasContext: context, viewport }).promise; $('#pdfPageInfo').textContent = `Página ${pdfState.page} / ${pdfState.pdf.numPages}`; $('#pdfZoom').textContent = `${Math.round(pdfState.scale * 100)}%`;
  }
  async function openReader(id) {
    const summary = summaries.find(item => item.id === id) || await nexaApi.getSummary(id); if (!summary) return;
    const exam = summary.exam || examFor(summary.examId); if (!exam) return;
    const pdfUrl = summary.contentType === 'pdf' ? nexaApi.publicPdfUrl(summary.pdfPath) : '';
    const material = summary.contentType === 'pdf' ? `<div class="pdf-reader"><p>📄 <strong>${esc(summary.pdfName || 'Resumo em PDF')}</strong></p><div class="pdf-controls"><button id="pdfPrev">← Página</button><button id="pdfNext">Próxima →</button><button id="pdfMinus">−</button><button id="pdfZoom">100%</button><button id="pdfPlus">+</button><button id="pdfFit">Ajustar</button></div><div id="pdfPageInfo">Carregando PDF…</div><div id="pdfCanvasHost"><canvas id="pdfCanvas"></canvas></div><a class="outline-button" href="${esc(pdfUrl)}" target="_blank" rel="noopener" download>Baixar PDF</a></div>` : (summary.content || '<p>Resumo ainda não publicado.</p>');
    $('#readerContent').innerHTML = `<p class="eyebrow">${esc(exam.subject)} · ${esc(exam.classTime)}</p><h1>${esc(summary.title)}</h1><p class="meta">${esc(exam.title)} · Publicado por <strong>${esc(summary.authorName)}</strong></p>${summary.introduction ? `<p>${esc(summary.introduction)}</p>` : ''}<div class="content-body">${material}</div>`;
    $('#readerFavorite').dataset.id = id; $('#readerFavorite').textContent = favorites.includes(id) ? '★ Favoritado' : '☆ Favoritar'; $('#readerDialog').showModal();
    if (pdfUrl && window.pdfjsLib) try { const pdf = await pdfjsLib.getDocument(pdfUrl).promise; pdfState = { pdf, page: 1, scale: 1 }; await renderPdf(true); } catch { $('#pdfCanvasHost').innerHTML = '<p>Não foi possível abrir a prévia. Use o botão para baixar o PDF.</p>'; }
  }
  async function refresh() { try { [exams, summaries, favorites] = await Promise.all([nexaApi.getExams(), nexaApi.getSummaries(), nexaApi.favoriteIds()]); render(); } catch (error) { $('#summaryList').innerHTML = `<div class="empty">${esc(error.message || 'Não foi possível carregar a NEXA.')}</div>`; } }
  document.addEventListener('click', async event => {
    const read = event.target.closest('.read-button'), favorite = event.target.closest('.favorite-button'), exam = event.target.closest('.exam-card');
    if (read) return openReader(read.dataset.id);
    if (favorite || event.target.id === 'readerFavorite') { const id = (favorite || event.target).dataset.id; const result = await nexaApi.toggleFavorite(id); if (result === null) { location.href = 'auth.html'; return; } await refresh(); return; }
    if (exam) { activeQuery = examFor(exam.dataset.exam).subject; $('#searchInput').value = activeQuery; render(); location.hash = 'resumos'; }
    if (event.target.matches('[data-scroll]')) location.hash = event.target.dataset.scroll;
    if (event.target.matches('.close-dialog')) $('#readerDialog').close();
    if (event.target.id === 'pdfPrev' && pdfState?.page > 1) { pdfState.page--; renderPdf(); }
    if (event.target.id === 'pdfNext' && pdfState?.page < pdfState.pdf.numPages) { pdfState.page++; renderPdf(); }
    if (event.target.id === 'pdfMinus' && pdfState) { pdfState.scale = Math.max(.5, pdfState.scale - .15); renderPdf(); }
    if (event.target.id === 'pdfPlus' && pdfState) { pdfState.scale = Math.min(3, pdfState.scale + .15); renderPdf(); }
    if (event.target.id === 'pdfFit' && pdfState) renderPdf(true);
  });
  $('#searchInput').oninput = event => { activeQuery = event.target.value; render(); }; $('#clearSearch').onclick = () => { activeQuery = ''; $('#searchInput').value = ''; render(); };
  $('#subjectFilter').onchange = event => { subjectQuery = event.target.value; render(); }; $('#authorFilter').onchange = event => { authorQuery = event.target.value; render(); }; $('#orderFilter').onchange = event => { order = event.target.value; render(); };
  $('.menu-button').onclick = () => { const nav = $('.main-nav'); nav.classList.toggle('open'); $('.menu-button').setAttribute('aria-expanded', nav.classList.contains('open')); };
  document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#searchInput').focus(); } });
  (async () => { const user = await nexaApi.currentUser(); if (user) { $('#accountLink').textContent = `Olá, ${user.username}`; $('#accountLink').href = user.role === 'admin' ? 'admin.html' : 'studio.html'; } $('#year').textContent = new Date().getFullYear(); refresh(); })();
})();