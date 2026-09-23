(() => {
  const $ = s => document.querySelector(s);
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const renderFaqs = list => {
    const host = $('#faqList');
    if (!host) return;
    host.innerHTML = list.length ? list.map(item => `<details class="faq-item"><summary>${esc(item.question)}</summary><div class="faq-answer">${esc(item.answer).replace(/\n/g,'<br>')}</div></details>`).join('') : '<div class="empty">Ainda não há perguntas frequentes publicadas.</div>';
  };
  const renderTutorials = list => {
    const host = $('#tutorialList');
    if (!host) return;
    host.innerHTML = list.length ? list.map(item => {
      let media = '';
      if (item.video_url) {
        const poster = item.thumbnail_url ? ` poster="${esc(item.thumbnail_url)}"` : '';
        media = `<div class="tutorial-video"><video controls playsinline preload="metadata"${poster}><source src="${esc(item.video_url)}">Seu navegador não conseguiu reproduzir este vídeo.</video></div>`;
      } else {
        media = '<div class="tutorial-link">Vídeo não disponível.</div>';
      }
      return `<article class="tutorial-card">${media}<div class="tutorial-body"><p class="eyebrow">TUTORIAL</p><h3>${esc(item.title)}</h3><p>${esc(item.description || '')}</p></div></article>`;
    }).join('') : '<div class="empty">Ainda não há tutoriais publicados.</div>';
  };
  (async () => {
    try {
      const [faqs, tutorials] = await Promise.all([nexaApi.getFaqs(), nexaApi.getTutorials()]);
      renderFaqs(faqs);
      renderTutorials(tutorials);
    } catch (error) {
      $('#faqList') && ($('#faqList').innerHTML = `<div class="empty">${esc(error.message || 'Não foi possível carregar as dúvidas.')}</div>`);
      $('#tutorialList') && ($('#tutorialList').innerHTML = '<div class="empty">Não foi possível carregar os tutoriais.</div>');
    }
  })();
})();
