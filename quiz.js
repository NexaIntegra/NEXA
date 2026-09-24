(() => {
  const stopWords = new Set([
    'a','ao','aos','as','com','como','da','das','de','do','dos','e','é','em','entre','era','esse','esta','este','foi','foram',
    'há','isso','mais','mas','na','nas','não','nem','no','nos','o','os','ou','para','pela','pelas','pelo','pelos','por','que',
    'se','sem','ser','são','sua','suas','seu','seus','um','uma','umas','uns','sobre','também','já','até','quando','onde',
    'porque','assim','muito','muita','muitos','muitas','cada','outro','outra','outros','outras','num','numa','dessa','desse',
    'deste','desta','deve','devem','pode','podem','após','antes','durante','ainda','apenas','segundo','sendo','tendo','tem',
    'têm','ter','teve','for','será','serão','fazer','feito','forma','tipo','parte','qual','quais'
  ]);

  const normalize = value => String(value || '').toLocaleLowerCase('pt-BR')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const repairPdfSpacing = text => {
    const input = String(text || '');
    const tokens = input.split(/(\s+)/);
    const output = [];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const prev = tokens[i - 1] || '';
      const next = tokens[i + 1] || '';
      if (
        /^\s+$/.test(token) &&
        prev.length === 1 &&
        next.length === 1 &&
        /^[A-Za-zÀ-ÿ0-9]$/.test(prev) &&
        /^[A-Za-zÀ-ÿ0-9]$/.test(next)
      ) continue;
      output.push(token);
    }
    return output.join('').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
  };

  const cleanText = html => repairPdfSpacing(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/?(p|div|h[1-6]|li|br|hr|section|article|blockquote|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
  );

  const splitSentences = text => cleanText(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim().replace(/^[-•·]+\s*/, ''))
    .filter(s => s.length >= 35 && s.length <= 420);

  const getKeywords = text => {
    const count = new Map();
    const display = new Map();
    const words = cleanText(text).match(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9-]{4,}/g) || [];
    words.forEach(word => {
      const key = normalize(word);
      if (stopWords.has(key) || /^\d+$/.test(key)) return;
      count.set(key, (count.get(key) || 0) + 1);
      display.set(key, word);
    });
    return [...count.entries()]
      .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
      .slice(0, 40)
      .map(([key]) => display.get(key));
  };

  const shuffle = list => {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const unique = list => [...new Map(list.map(x => [normalize(x), x])).values()];

  const escapeRegExp = value => String(value || '').replace(/[.*+?^()|[\]\\/]/g, '\\$&');

  const findDefinitionFacts = sentences => sentences.map(sentence => {
    const match = sentence.match(/^(.{3,90}?)\s+(?:é|são|significa|representa|consiste em|é formado por|é formada por|é composto por|é composta por)\s+(.{8,260})$/i);
    if (!match) return null;
    return {
      term: match[1].trim().replace(/[,:;.-]+$/, ''),
      answer: match[2].trim(),
      source: sentence
    };
  }).filter(Boolean).filter(item => item.term.split(/\s+/).length <= 8);

  const findClozeFacts = (sentences, keyList) => {
    const facts = [];
    const used = new Set();
    for (const sentence of sentences) {
      const ns = normalize(sentence);
      const key = keyList.find(item => ns.includes(normalize(item)));
      if (!key) continue;
      const nk = normalize(key);
      if (used.has(nk)) continue;
      const index = normalize(sentence).indexOf(nk);
      if (index < 0) continue;
      used.add(nk);
      facts.push({ keyword: sentence.slice(index, index + key.length), source: sentence });
    }
    return facts;
  };

  const makeQuestion = (question, answer, distractors, explanation) => {
    const options = shuffle(unique([answer, ...distractors])).slice(0, 4);
    if (options.length !== 4 || !options.some(item => normalize(item) === normalize(answer))) return null;
    return { question, answer, alternatives: options, explanation: explanation || 'A resposta está apoiada pelo conteúdo do resumo.' };
  };

  const generateQuizFromText = (text, desiredCount = 6) => {
    const source = cleanText(text);
    if (source.length < 140) throw new Error('Este resumo tem pouco conteúdo para gerar um quiz.');
    const sentences = splitSentences(source);
    if (sentences.length < 4) throw new Error('Preciso de pelo menos 4 informações completas no resumo.');

    const count = Math.max(5, Math.min(Number(desiredCount) || 6, 8));
    const keyList = getKeywords(source);
    const definitions = findDefinitionFacts(sentences);
    const clozes = findClozeFacts(sentences, keyList);
    const questions = [];
    const usedSources = new Set();

    for (const fact of shuffle(definitions)) {
      if (questions.length >= Math.ceil(count / 2)) break;
      const distractors = shuffle(definitions.filter(item => item !== fact).map(item => item.answer)).slice(0, 3);
      const q = makeQuestion(
        'De acordo com o resumo, o que é "' + fact.term + '"?',
        fact.answer,
        distractors,
        'O resumo explica: "' + fact.source + '"'
      );
      if (q) {
        questions.push(q);
        usedSources.add(normalize(fact.source));
      }
    }

    for (const fact of shuffle(clozes)) {
      if (questions.length >= count) break;
      if (usedSources.has(normalize(fact.source))) continue;
      const blanked = fact.source.replace(new RegExp(escapeRegExp(fact.keyword), 'i'), '_____');
      const distractors = shuffle(keyList.filter(item => normalize(item) !== normalize(fact.keyword))).slice(0, 3);
      const q = makeQuestion(
        'Complete de acordo com o resumo: "' + blanked + '"',
        fact.keyword,
        distractors,
        'No resumo, a informação aparece assim: "' + fact.source + '"'
      );
      if (q) {
        questions.push(q);
        usedSources.add(normalize(fact.source));
      }
    }

    const usedTopics = new Set();
    for (const sentence of shuffle(sentences)) {
      if (questions.length >= count) break;
      if (usedSources.has(normalize(sentence))) continue;
      const topic = keyList.find(key => normalize(sentence).includes(normalize(key)) && !usedTopics.has(normalize(key))) || sentence.split(/\s+/).slice(0, 3).join(' ');
      const alternatives = shuffle(sentences.filter(other => normalize(other) !== normalize(sentence))).slice(0, 3);
      const q = makeQuestion(
        'Sobre "' + topic + '", qual alternativa está de acordo com o resumo?',
        sentence,
        alternatives,
        'Essa alternativa está correta porque o resumo afirma: "' + sentence + '"'
      );
      if (q) {
        questions.push(q);
        usedSources.add(normalize(sentence));
        usedTopics.add(normalize(topic));
      }
    }

    const result = shuffle(questions).slice(0, count).map((q, index) => ({ id: index + 1, ...q }));
    if (result.length < Math.min(5, count)) throw new Error('Não encontrei informações suficientes para montar um quiz confiável.');
    return result;
  };

  window.nexaQuizEngine = {
    cleanText,
    repairPdfSpacing,
    keywords: getKeywords,
    generateQuizFromText
  };

  if (!window.document) return;

  const $ = selector => document.querySelector(selector);
  let quiz = null;
  let index = 0;
  let score = 0;
  let locked = false;

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[char]));

  const extractPdfText = async pdfUrl => {
    if (!pdfUrl || !window.pdfjsLib) return '';
    const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
    const maxPages = Math.min(pdf.numPages, 40);
    const parts = [];
    let total = 0;
    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const data = await page.getTextContent();
      const pageText = data.items.map(item => item.str || '').join(' ');
      parts.push(repairPdfSpacing(pageText));
      total += pageText.length;
      if (total >= 100000) break;
    }
    return cleanText(parts.join('\n'));
  };

  const renderQuestion = () => {
    const body = $('#quizBody');
    const foot = $('#quizFooter');
    const q = quiz[index];
    const letters = ['A','B','C','D'];

    body.innerHTML =
      '<div class="quiz-progress"><span>Pergunta ' + (index + 1) + ' de ' + quiz.length + '</span><div><i style="width:' + (((index + 1) / quiz.length) * 100) + '%"></i></div></div>' +
      '<p class="quiz-question">' + esc(q.question) + '</p>' +
      '<div class="quiz-options">' +
        q.alternatives.map((answer, i) =>
          '<button class="quiz-option" data-answer="' + esc(answer) + '"><b>' + letters[i] + '</b><span>' + esc(answer) + '</span></button>'
        ).join('') +
      '</div>';

    foot.innerHTML = '<button class="outline-button" id="quizSkip">Pular questão</button><span class="quiz-tip">Escolha uma alternativa para ver a explicação.</span>';
  };

  const renderFeedback = () => {
    const body = $('#quizBody');
    const foot = $('#quizFooter');
    const q = quiz[index];
    const correct = q.__correct;

    body.innerHTML =
      '<div class="quiz-feedback ' + (correct ? 'is-correct' : 'is-wrong') + '">' +
        '<div class="quiz-feedback-icon">' + (correct ? '✓' : '×') + '</div>' +
        '<p class="eyebrow">' + (correct ? 'ACERTOU' : 'VOCÊ ERROU') + '</p>' +
        '<h3>' + (correct ? 'Mandou bem!' : 'Vamos entender o erro.') + '</h3>' +
        (!correct ? '<div class="quiz-correct-answer"><strong>Resposta correta:</strong><span>' + esc(q.answer) + '</span></div>' : '') +
        '<div class="quiz-explanation"><strong>Explicação baseada no resumo</strong><p>' + esc(q.explanation) + '</p></div>' +
      '</div>';

    foot.innerHTML = index < quiz.length - 1
      ? '<button class="ai-quiz-button" id="quizNext">Próxima questão →</button>'
      : '<button class="ai-quiz-button" id="quizFinish">Ver resultado</button>';
  };

  const renderResult = () => {
    const percent = Math.round(score * 100 / quiz.length);
    $('#quizBody').innerHTML =
      '<div class="quiz-result"><div class="quiz-result-icon">' + (percent >= 70 ? '✓' : '↻') + '</div><p class="eyebrow">RESULTADO</p><h3>' +
      score + ' de ' + quiz.length + ' acertos</h3><p>Você acertou ' + percent + '% das perguntas deste resumo.</p><div class="quiz-result-bar"><span style="width:' + percent + '%"></span></div></div>';
    $('#quizFooter').innerHTML = '<button class="outline-button" id="quizCloseBottom">Fechar</button><button class="ai-quiz-button" id="quizRetry">Gerar outro quiz</button>';
  };

  const showLoading = () => {
    $('#quizBody').innerHTML = '<div class="quiz-loading"><span class="quiz-spinner"></span><h3>Analisando o resumo…</h3><p>Identificando conceitos e informações importantes.</p></div>';
    $('#quizFooter').innerHTML = '';
  };

  const openQuiz = async () => {
    const context = window.NEXA_ACTIVE_SUMMARY;
    if (!context?.summary) return;
    if (!$('#quizDialog').open) $('#quizDialog').showModal();

    showLoading();
    score = 0;
    index = 0;
    locked = false;

    try {
      let source = [context.summary.introduction, context.summary.content].filter(Boolean).join('\n');
      if (context.summary.contentType === 'pdf') source = await extractPdfText(context.pdfUrl);
      quiz = generateQuizFromText(source, source.split(/\s+/).length > 700 ? 8 : 6);
      $('#quizTitle').textContent = context.summary.title || 'Quiz por IA';
      $('#quizSubtitle').textContent = 'Personalizado com base no conteúdo deste resumo';
      renderQuestion();
    } catch (error) {
      quiz = null;
      $('#quizBody').innerHTML = '<div class="quiz-empty"><div>✦</div><h3>Não consegui montar o quiz</h3><p>' + esc(error.message || 'Não foi possível gerar o quiz.') + '</p></div>';
      $('#quizFooter').innerHTML = '<button class="outline-button" id="quizCloseBottom">Fechar</button>';
    }
  };

  const nextQuestion = () => {
    if (!quiz) return;
    if (index < quiz.length - 1) {
      index++;
      locked = false;
      renderQuestion();
    } else {
      renderResult();
    }
  };

  document.addEventListener('click', event => {
    if (event.target.closest('#aiQuizButton')) return openQuiz();
    if (event.target.closest('#quizCloseBottom') || event.target.closest('.quiz-close-dialog')) return $('#quizDialog').close();
    if (event.target.closest('#quizRetry')) return openQuiz();
    if (event.target.closest('#quizNext')) return nextQuestion();
    if (event.target.closest('#quizFinish')) return renderResult();
    if (event.target.closest('#quizSkip')) {
      nextQuestion();
      return;
    }

    const option = event.target.closest('.quiz-option');
    if (!option || !quiz || locked) return;

    locked = true;
    const current = quiz[index];
    const correct = normalize(option.dataset.answer) === normalize(current.answer);
    if (correct) score++;
    current.__correct = correct;

    document.querySelectorAll('.quiz-option').forEach(button => {
      button.disabled = true;
      if (normalize(button.dataset.answer) === normalize(current.answer)) button.classList.add('correct');
    });
    if (!correct) option.classList.add('wrong');

    setTimeout(renderFeedback, 250);
  });
})();