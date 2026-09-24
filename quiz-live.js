(() => {
  const stopWords = new Set([
    'a','ao','aos','as','com','como','da','das','de','do','dos','e','é','em','entre','era','esse','essa','este','esta',
    'foi','foram','há','isso','mais','mas','na','nas','não','nem','no','nos','o','os','ou','para','pela','pelas','pelo',
    'pelos','por','que','se','sem','ser','são','sua','suas','seu','seus','um','uma','umas','uns','sobre','também','já',
    'até','quando','onde','porque','assim','muito','muita','muitos','muitas','cada','outro','outra','outros','outras',
    'num','numa','dessa','desse','deste','desta','deve','devem','pode','podem','após','antes','durante','ainda','apenas',
    'segundo','sendo','tendo','tem','têm','ter','teve','será','serão','fazer','feito','forma','tipo','parte','qual','quais',
    'capítulo','capitulo'
  ]);

  const normalize = value => String(value || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const decodeEntities = value => String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

  const htmlToText = html => {
    const source = String(html || '');
    if (typeof document !== 'undefined' && document.createElement) {
      const box = document.createElement('div');
      box.innerHTML = source;
      return (box.innerText || box.textContent || '')
        .replace(/[\t\r]+/g, ' ')
        .replace(/[ ]{2,}/g, ' ')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{2,}/g, '\n')
        .trim();
    }
    return decodeEntities(source
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<\/?(p|div|h[1-6]|li|br|hr|section|article|blockquote|tr)(?:\s[^>]*)?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
    ).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();
  };

  const splitFacts = text => {
    const raw = htmlToText(text);
    const pieces = [];
    raw.split(/\n+/).forEach(line => {
      let clean = line.replace(/^[\s•▪●◦\-–—]+/, '').replace(/^\d+[.)]\s*/, '').trim();
      if (!clean) return;
      clean.split(/(?<=[.!?])\s+/).forEach(part => {
        const fact = part.replace(/\s{2,}/g, ' ').trim();
        if (fact.length >= 24 && fact.length <= 500) pieces.push(fact);
      });
    });
    return [...new Map(pieces.map(item => [normalize(item), item])).values()];
  };

  const keywords = text => {
    const count = new Map();
    const display = new Map();
    const words = htmlToText(text).match(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9-]{4,}/g) || [];
    words.forEach(word => {
      const key = normalize(word);
      if (stopWords.has(key) || /^\d+$/.test(key)) return;
      count.set(key, (count.get(key) || 0) + 1);
      display.set(key, word);
    });
    return [...count.entries()].sort((a,b) => b[1]-a[1] || b[0].length-a[0].length).slice(0, 50).map(x => display.get(x[0]));
  };

  const shuffle = list => {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const unique = list => [...new Map(list.filter(Boolean).map(x => [normalize(x), x])).values()];

  const factParts = fact => {
    const clean = String(fact || '')
      .replace(/^\d+[.)]\s*/, '')
      .replace(/^[•▪●◦\-–—]+\s*/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const colon = clean.indexOf(':');
    const arrowParts = clean.split(/\s+[→⇒]\s+/).map(x => x.trim()).filter(Boolean);
    const dashParts = clean.split(/\s+[—–-]\s+/).map(x => x.trim()).filter(Boolean);
    const year = clean.match(/\b(?:1[5-9]\d{2}|20\d{2})\b/);

    if (arrowParts.length >= 2) {
      return { subject: arrowParts[0], detail: arrowParts.slice(1).join(' → '), relation: 'relation' };
    }
    if (colon > 4 && colon < 140) {
      return { subject: clean.slice(0, colon).trim(), detail: clean.slice(colon + 1).trim(), relation: 'detail' };
    }
    if (dashParts.length >= 2) {
      return { subject: dashParts[0], detail: dashParts.slice(1).join(' — '), relation: 'explanation' };
    }
    const change = clean.match(/^(.+?)\s+(mudou|passou de)\s+(.+)$/i);
    if (change) {
      return { subject: change[1].trim(), detail: change[2] + ' ' + change[3].trim(), relation: 'change' };
    }
    const markers = ['provocou','provocaram','causou','causaram','levou a','levou à','resultou em','permitiu','permitiram','prejudicou','prejudicaram','defendia','defendiam','proibia','proibido','ocorreu em','aconteceu em'];
    const marker = markers.find(item => normalize(clean).includes(normalize(item)));
    if (marker) {
      const idx = normalize(clean).indexOf(normalize(marker));
      return { subject: clean.slice(0, idx).trim(), detail: clean.slice(idx).trim(), relation: 'consequence' };
    }
    if (year) {
      return { subject: 'o acontecimento de ' + year[0], detail: clean, relation: 'date' };
    }
    const words = clean.split(/\s+/);
    return {
      subject: words.slice(0, Math.min(9, words.length)).join(' '),
      detail: clean,
      relation: 'general'
    };
  };

  const makeDetailedQuestion = (fact, facts, keyList) => {
    const parts = factParts(fact);
    const topic = parts.relation === 'general'
      ? (keyList.find(key => normalize(fact).includes(normalize(key))) || parts.subject)
      : parts.subject;

    let question = '';
    switch (parts.relation) {
      case 'relation':
        question = 'Qual alternativa explica corretamente a relação entre "' + parts.subject + '" e "' + parts.detail + '" apresentada no material?';
        break;
      case 'detail':
        question = 'Qual alternativa descreve corretamente "' + parts.subject + '" no contexto estudado, incluindo a função ou característica destacada no resumo?';
        break;
      case 'change':
        question = 'Como ocorreu a mudança em "' + parts.subject + '" e quais elementos ou regiões aparecem relacionados a essa transformação?';
        break;
      case 'consequence':
        question = 'Qual foi a consequência, característica ou resultado associado a "' + (parts.subject || topic) + '" de acordo com o conteúdo estudado?';
        break;
      case 'explanation':
        question = 'Considerando "' + parts.subject + '", qual explicação apresentada no resumo completa corretamente esse ponto do conteúdo?';
        break;
      case 'date':
        question = 'O que aconteceu em ' + parts.subject.replace('o acontecimento de ', '') + ' e qual informação do contexto estudado está associada a essa data?';
        break;
      default:
        question = 'Considerando "' + topic + '" e o contexto apresentado no material, qual afirmação está correta e explica esse ponto do conteúdo?';
    }

    const related = facts.filter(other => {
      if (normalize(other) === normalize(fact)) return false;
      const words = topic.split(/\s+/).filter(word => word.length >= 5).slice(0, 3);
      return words.length > 0 && words.some(word => normalize(other).includes(normalize(word)));
    });
    const fallback = facts.filter(other => normalize(other) !== normalize(fact));
    const pool = related.length >= 3 ? related : fallback;
    const alternatives = shuffle(unique([fact, ...shuffle(pool).slice(0, 3)])).slice(0, 4);

    if (alternatives.length !== 4 || !alternatives.some(item => normalize(item) === normalize(fact))) return null;

    return {
      question,
      answer: fact,
      alternatives,
      explanation: 'A resposta está baseada no trecho do resumo que diz: "' + fact + '"'
    };
  };

  const generateQuizFromText = (text, desiredCount) => {
    const facts = splitFacts(text);
    if (facts.length < 5) throw new Error('Não encontrei informações suficientes neste resumo para criar o quiz.');
    const count = Math.min(8, Math.max(5, Number(desiredCount) || 6));
    const keyList = keywords(text);
    const questions = [];
    const used = new Set();

    for (const fact of shuffle(facts)) {
      if (questions.length >= count) break;
      if (used.has(normalize(fact))) continue;
      const q = makeDetailedQuestion(fact, facts, keyList);
      if (!q) continue;
      questions.push(q);
      used.add(normalize(fact));
    }

    if (questions.length < 5) throw new Error('Não foi possível montar 5 perguntas confiáveis a partir do resumo.');
    return shuffle(questions).slice(0, count).map((q, i) => ({ id: i + 1, ...q }));
  };

  window.nexaQuizEngine = { htmlToText, splitFacts, keywords, generateQuizFromText };

  if (!window.document) return;

  const $ = selector => document.querySelector(selector);
  let quiz = [];
  let index = 0;
  let score = 0;
  let locked = false;

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[char]));

  const getFreshSummary = async context => {
    if (context && context.summary && context.summary.id && window.nexaApi && typeof window.nexaApi.getSummary === 'function') {
      try {
        const fresh = await window.nexaApi.getSummary(context.summary.id);
        if (fresh) return fresh;
      } catch {}
    }
    return context ? context.summary : null;
  };

  const extractPdfText = async pdfUrl => {
    if (!pdfUrl || !window.pdfjsLib) return '';
    const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
    const pages = Math.min(pdf.numPages, 30);
    const output = [];
    for (let pageNumber = 1; pageNumber <= pages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const data = await page.getTextContent({ normalizeWhitespace: true });
      const lineMap = new Map();
      for (const item of data.items) {
        const value = String(item.str || '').trim();
        if (!value) continue;
        const y = Math.round(Number(item.transform && item.transform[5] || 0));
        const x = Number(item.transform && item.transform[4] || 0);
        const key = Math.round(y / 2) * 2;
        if (!lineMap.has(key)) lineMap.set(key, []);
        lineMap.get(key).push({ value, x, width: Number(item.width || 0) });
      }
      const lines = [...lineMap.entries()]
        .sort((a,b) => b[0] - a[0])
        .map(entry => entry[1].sort((a,b) => a.x-b.x).map(item => item.value).join(' '));
      output.push(lines.join('\n'));
    }
    return output.join('\n');
  };

  const renderQuestion = () => {
    const body = $('#quizBody');
    const foot = $('#quizFooter');
    const q = quiz[index];
    if (!body || !foot || !q) return;
    const letters = ['A','B','C','D'];
    body.innerHTML =
      '<div class="quiz-progress"><span>Pergunta ' + (index + 1) + ' de ' + quiz.length + '</span><div><i style="width:' + (((index + 1) / quiz.length) * 100) + '%"></i></div></div>' +
      '<p class="quiz-question">' + esc(q.question) + '</p>' +
      '<div class="quiz-options">' +
      q.alternatives.map((answer, i) => '<button class="quiz-option" data-answer="' + esc(answer) + '"><b>' + letters[i] + '</b><span>' + esc(answer) + '</span></button>').join('') +
      '</div>';
    foot.innerHTML = '<button class="outline-button" id="quizSkip">Pular questão</button><span class="quiz-tip">Escolha uma alternativa para ver a explicação.</span>';
  };

  const renderFeedback = () => {
    const body = $('#quizBody');
    const foot = $('#quizFooter');
    const q = quiz[index];
    if (!body || !foot || !q) return;
    body.innerHTML =
      '<div class="quiz-feedback ' + (q.__correct ? 'is-correct' : 'is-wrong') + '">' +
      '<div class="quiz-feedback-icon">' + (q.__correct ? '✓' : '×') + '</div>' +
      '<p class="eyebrow">' + (q.__correct ? 'ACERTOU' : 'VOCÊ ERROU') + '</p>' +
      '<h3>' + (q.__correct ? 'Mandou bem!' : 'Vamos entender o erro.') + '</h3>' +
      (!q.__correct ? '<div class="quiz-correct-answer"><strong>Resposta correta:</strong><span>' + esc(q.answer) + '</span></div>' : '') +
      '<div class="quiz-explanation"><strong>Explicação baseada no resumo</strong><p>' + esc(q.explanation) + '</p></div>' +
      '</div>';
    foot.innerHTML = '<button class="ai-quiz-button" id="' + (index < quiz.length - 1 ? 'quizNext' : 'quizFinish') + '">' + (index < quiz.length - 1 ? 'Próxima questão →' : 'Ver resultado') + '</button>';
  };

  const renderResult = () => {
    const percent = Math.round(score * 100 / quiz.length);
    $('#quizBody').innerHTML =
      '<div class="quiz-result"><div class="quiz-result-icon">' + (percent >= 70 ? '✓' : '↻') + '</div><p class="eyebrow">RESULTADO</p><h3>' +
      score + ' de ' + quiz.length + ' acertos</h3><p>Você acertou ' + percent + '% das perguntas deste resumo.</p><div class="quiz-result-bar"><span style="width:' + percent + '%"></span></div></div>';
    $('#quizFooter').innerHTML = '<button class="outline-button" id="quizCloseBottom">Fechar</button><button class="ai-quiz-button" id="quizRetry">Gerar outro quiz</button>';
  };

  const showError = message => {
    $('#quizBody').innerHTML = '<div class="quiz-empty"><div>✦</div><h3>Não consegui montar o quiz</h3><p>' + esc(message) + '</p></div>';
    $('#quizFooter').innerHTML = '<button class="outline-button" id="quizCloseBottom">Fechar</button>';
  };

  const showLoading = () => {
    $('#quizBody').innerHTML = '<div class="quiz-loading"><span class="quiz-spinner"></span><h3>Analisando o resumo…</h3><p>Separando conceitos, datas e informações importantes.</p></div>';
    $('#quizFooter').innerHTML = '';
  };

  const openQuiz = async () => {
    const context = window.NEXA_ACTIVE_SUMMARY;
    if (!context || !context.summary) return;
    const dialog = $('#quizDialog');
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();

    showLoading();
    quiz = [];
    index = 0;
    score = 0;
    locked = false;

    try {
      const summary = await getFreshSummary(context);
      if (!summary) throw new Error('O resumo não está disponível no momento.');

      const stored = htmlToText([summary.introduction, summary.content].filter(Boolean).join('\n'));
      let source = stored;

      if (source.length < 140 && summary.contentType === 'pdf' && context.pdfUrl) {
        try {
          source = await extractPdfText(context.pdfUrl);
        } catch {}
      }

      if (source.length < 140) throw new Error('Este resumo não tem texto suficiente para criar um quiz.');

      quiz = generateQuizFromText(source, source.split(/\s+/).length > 700 ? 8 : 6);
      $('#quizTitle').textContent = summary.title || 'Quiz por IA';
      $('#quizSubtitle').textContent = 'Personalizado com base no conteúdo deste resumo';
      renderQuestion();
    } catch (error) {
      quiz = [];
      showError(error && error.message ? error.message : 'Não foi possível gerar o quiz.');
    }
  };

  const nextQuestion = () => {
    if (!quiz.length) return;
    if (index < quiz.length - 1) {
      index++;
      locked = false;
      renderQuestion();
    } else {
      renderResult();
    }
  };

  document.addEventListener('click', event => {
    const target = event.target;
    if (target.closest('#aiQuizButton')) return openQuiz();
    if (target.closest('#quizCloseBottom') || target.closest('.quiz-close-dialog')) return $('#quizDialog').close();
    if (target.closest('#quizRetry')) return openQuiz();
    if (target.closest('#quizNext')) return nextQuestion();
    if (target.closest('#quizFinish')) return renderResult();
    if (target.closest('#quizSkip')) return nextQuestion();

    const option = target.closest('.quiz-option');
    if (!option || !quiz.length || locked) return;

    locked = true;
    const current = quiz[index];
    const correct = normalize(option.dataset.answer) === normalize(current.answer);
    current.__correct = correct;
    if (correct) score++;

    document.querySelectorAll('.quiz-option').forEach(button => {
      button.disabled = true;
      if (normalize(button.dataset.answer) === normalize(current.answer)) button.classList.add('correct');
    });
    if (!correct) option.classList.add('wrong');
    setTimeout(renderFeedback, 180);
  });
})();