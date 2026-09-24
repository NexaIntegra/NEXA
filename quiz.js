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

  const cleanText = html => String(html || '')
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
    .trim();

  const splitSentences = text => cleanText(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim().replace(/^[-•·]+\s*/, ''))
    .filter(s => s.length >= 35 && s.length <= 420);

  const keywords = text => {
    const count = new Map(), display = new Map();
    const words = cleanText(text).match(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9-]{4,}/g) || [];
    words.forEach(word => {
      const key = normalize(word);
      if (stopWords.has(key) || /^\d+$/.test(key)) return;
      count.set(key, (count.get(key) || 0) + 1);
      display.set(key, word);
    });
    return [...count.entries()]
      .sort((a,b) => b[1] - a[1] || b[0].length - a[0].length)
      .slice(0, 35)
      .map(x => display.get(x[0]));
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

  const escapeRegExp = value => {
    const specials = new Set(['.','*','+','?','^','=','!','(',')','|','[',']','{','}','/','\\','$']);
    return String(value || '').split('').map(char => specials.has(char) ? '\\' + char : char).join('');
  };

  const definitionFacts = sentences => sentences.map(sentence => {
    const match = sentence.match(/^(.{3,90}?)\s+(?:é|são|significa|representa|consiste em|é formado por|é formada por|é composto por|é composta por)\s+(.{8,260})$/i);
    return match ? { term: match[1].trim().replace(/[,:;.-]+$/, ''), answer: match[2].trim(), sentence } : null;
  }).filter(Boolean).filter(x => x.term.split(/\s+/).length <= 8);

  const clozeFacts = (sentences, keyList) => {
    const out = [], used = new Set();
    for (const sentence of sentences) {
      const ns = normalize(sentence);
      const key = keyList.find(item => ns.includes(normalize(item)));
      if (!key) continue;
      const nk = normalize(key);
      if (used.has(nk)) continue;
      const index = sentence.toLocaleLowerCase('pt-BR').indexOf(key.toLocaleLowerCase('pt-BR'));
      const original = index >= 0 ? sentence.slice(index, index + key.length) : key;
      if (!original) continue;
      used.add(nk);
      out.push({ keyword: original, sentence });
    }
    return out;
  };

  const makeQuestion = (question, answer, alternatives) => {
    const distractors = unique(alternatives).filter(item => normalize(item) !== normalize(answer)).slice(0, 3);
    return {
      question,
      answer,
      alternatives: shuffle([answer, ...distractors])
    };
  };

  const generateQuizFromText = (text, desiredCount) => {
    const source = cleanText(text);
    if (source.length < 140) throw new Error('Este resumo tem pouco conteúdo para gerar um quiz.');
    const sentences = splitSentences(source);
    if (sentences.length < 4) throw new Error('Preciso de pelo menos 4 informações completas no resumo.');
    const count = Math.max(5, Math.min(Number(desiredCount) || 6, 8));
    const keyList = keywords(source);
    const defs = definitionFacts(sentences);
    const clozes = clozeFacts(sentences, keyList);
    const questions = [];
    const used = new Set();

    for (const fact of shuffle(defs)) {
      if (questions.length >= Math.ceil(count / 2)) break;
      const alternatives = shuffle(defs.filter(x => x !== fact).map(x => x.answer).filter(x => x.length > 4)).slice(0, 5);
      if (alternatives.length >= 3) {
        questions.push(makeQuestion('De acordo com o resumo, o que é "' + fact.term + '"?', fact.answer, alternatives));
        used.add(normalize(fact.sentence));
      }
    }

    for (const fact of shuffle(clozes)) {
      if (questions.length >= count) break;
      if (used.has(normalize(fact.sentence))) continue;
      const questionText = fact.sentence.replace(new RegExp(escapeRegExp(fact.keyword), 'i'), '_____');
      const alternatives = shuffle(keyList.filter(x => normalize(x) !== normalize(fact.keyword))).slice(0, 5);
      if (alternatives.length >= 3) {
        questions.push(makeQuestion('Complete de acordo com o resumo: "' + questionText + '"', fact.keyword, alternatives));
        used.add(normalize(fact.sentence));
      }
    }

    const usedTopics = new Set();
    const usedRecognition = new Set();
    for (const sentence of shuffle(sentences)) {
      if (questions.length >= count) break;
      if (usedRecognition.has(normalize(sentence))) continue;
      const topic = keyList.find(key => normalize(sentence).includes(normalize(key)) && !usedTopics.has(normalize(key))) || sentence.split(/\s+/).slice(0, 3).join(' ');
      const alternatives = shuffle(sentences.filter(x => normalize(x) !== normalize(sentence))).slice(0, 5);
      if (alternatives.length >= 3) {
        questions.push(makeQuestion('Sobre "' + topic + '", qual alternativa está de acordo com o resumo?', sentence, alternatives));
        usedRecognition.add(normalize(sentence));
        usedTopics.add(normalize(topic));
      }
    }

    const result = shuffle(questions).filter(q => q.alternatives.length === 4 && q.alternatives.includes(q.answer));
    if (result.length < Math.min(4, count)) throw new Error('Não encontrei informações suficientes para montar um quiz confiável.');
    return result.slice(0, count).map((q, index) => ({ id: index + 1, ...q }));
  };

  window.nexaQuizEngine = { cleanText, keywords, generateQuizFromText };
  if (!window.document) return;

  const $ = selector => document.querySelector(selector);
  let quiz = null, index = 0, score = 0, locked = false;

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[c]));

  async function extractPdfText(url) {
    if (!url || !window.pdfjsLib) return '';
    const pdf = await pdfjsLib.getDocument(url).promise;
    const maxPages = Math.min(pdf.numPages, 30);
    const parts = [];
    let total = 0;
    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const data = await page.getTextContent();
      const pageText = data.items.map(item => item.str || '').join(' ');
      parts.push(pageText);
      total += pageText.length;
      if (total >= 80000) break;
    }
    return parts.join('\n');
  }

  function render(mode, message) {
    const body = $('#quizBody'), foot = $('#quizFooter');
    if (mode === 'loading') {
      body.innerHTML = '<div class="quiz-loading"><span class="quiz-spinner"></span><h3>Analisando seu resumo…</h3><p>Identificando palavras-chave, conceitos e informações importantes.</p></div>';
      foot.innerHTML = '';
      return;
    }
    if (mode === 'error') {
      body.innerHTML = '<div class="quiz-empty"><div>✦</div><h3>Não consegui montar o quiz</h3><p>' + esc(message) + '</p></div>';
      foot.innerHTML = '<button class="outline-button" id="quizCloseBottom">Fechar</button>';
      return;
    }
    if (mode === 'result') {
      const percent = Math.round(score * 100 / quiz.length);
      body.innerHTML = '<div class="quiz-result"><div class="quiz-result-icon">' + (percent >= 70 ? '✓' : '↻') + '</div><p class="eyebrow">RESULTADO</p><h3>' + score + ' de ' + quiz.length + ' acertos</h3><p>Você acertou ' + percent + '% das perguntas deste resumo.</p><div class="quiz-result-bar"><span style="width:' + percent + '%"></span></div></div>';
      foot.innerHTML = '<button class="outline-button" id="quizCloseBottom">Fechar</button><button class="ai-quiz-button" id="quizRetry">Gerar outro quiz</button>';
      return;
    }

    const q = quiz[index], letters = ['A','B','C','D'];
    body.innerHTML =
      '<div class="quiz-progress"><span>Pergunta ' + (index + 1) + ' de ' + quiz.length + '</span><div><i style="width:' + (((index + 1) / quiz.length) * 100) + '%"></i></div></div>' +
      '<p class="quiz-question">' + esc(q.question) + '</p>' +
      '<div class="quiz-options">' +
      q.alternatives.map((answer, i) =>
        '<button class="quiz-option" data-answer="' + esc(answer) + '"><b>' + letters[i] + '</b><span>' + esc(answer) + '</span></button>'
      ).join('') +
      '</div>';
    foot.innerHTML = index < quiz.length - 1
      ? '<span class="quiz-tip">Pergunta criada a partir do conteúdo deste resumo.</span>'
      : '<span class="quiz-tip">Última pergunta</span>';
  }

  async function openQuiz() {
    const context = window.NEXA_ACTIVE_SUMMARY;
    if (!context?.summary) return;
    if (!$('#quizDialog').open) $('#quizDialog').showModal();
    render('loading');
    score = 0;
    index = 0;
    locked = false;
    try {
      let source = [context.summary.introduction, context.summary.content].filter(Boolean).join('\n');
      if (context.summary.contentType === 'pdf') source = await extractPdfText(context.pdfUrl);
      quiz = generateQuizFromText(source, source.split(/\s+/).length > 700 ? 8 : 6);
      $('#quizTitle').textContent = context.summary.title || 'Quiz por IA';
      $('#quizSubtitle').textContent = 'Personalizado com base no conteúdo deste resumo';
      render('question');
    } catch (error) {
      quiz = null;
      render('error', error.message || 'Não foi possível gerar o quiz.');
    }
  }

  document.addEventListener('click', event => {
    if (event.target.closest('#aiQuizButton')) return openQuiz();
    if (event.target.closest('#quizCloseBottom') || event.target.closest('.quiz-close-dialog')) return $('#quizDialog').close();
    if (event.target.closest('#quizRetry')) return openQuiz();
    const option = event.target.closest('.quiz-option');
    if (!option || !quiz || locked) return;
    locked = true;
    const current = quiz[index];
    const correct = option.dataset.answer === current.answer;
    if (correct) score++;
    document.querySelectorAll('.quiz-option').forEach(button => {
      button.disabled = true;
      if (button.dataset.answer === current.answer) button.classList.add('correct');
    });
    if (!correct) option.classList.add('wrong');
    setTimeout(() => {
      locked = false;
      if (index < quiz.length - 1) {
        index++;
        render('question');
      } else {
        render('result');
      }
    }, 550);
  });
})();