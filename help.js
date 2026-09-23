(() => {
  const $ = s => document.querySelector(s);
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const toYouTubeEmbed = value => {
    try {
      const url = new URL(value);
      let id = '';
      if (url.hostname.includes('youtu.be')) id = url.pathname.slice(1).split('/')[0];
      if (!id && url.hostname.includes('youtube.com')) {
        if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
        else if (url.pathname.startsWith('/shorts/')) id = url.pathname.split('/')[2] || '';
        else if (url.pathname.startsWith('/embed/')) id = url.pathname.split('/')[2] || '';
      }
      return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : '';
    } catch { return ''; }
  };
  const renderFaqs = list => {
    const host = $('#faqList');
    if (!host) return;
    host.innerHTML = list.length ? list.map(item => `<details class="faq-item"><summary>${esc(item.question)}</summary><div class="faq-answer">${esc(item.answer).replace(/\n/g,'<br>')}</div></details>`).join('') : '<div class="empty">Ainda não há perguntas frequentes publicadas.</div>';
  };
  const renderTutorials = list => {
    const host = $('#tutorialList');
    if (!host) return;
    host.innerHTML = list.length ? list.map(item => {
      const embed = toYouTubeEmbed(item.video_url);
      const media = embed ? `<div class="tutorial-video"><iframe src="${esc(embed)}" title="${esc(item.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>` : `<a class="tutorial-link" href="${esc(item.video_url)}" target="_blank" rel="noopener">Abrir vídeo</a>`;
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
