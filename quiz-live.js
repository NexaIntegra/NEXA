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

  const normalize = value => String(value || '')
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const decodeEntities = value => String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

  const isStudyMeta = text => /\b(?:boa prova|para decorar|ideia para decorar|ideia central|o mais importante|lembre-?se|memorize|decore|dica(?:s)?(?: de| para)\s+(?:a\s+)?prova|macete(?:s)?|vale lembrar|na hora da prova|guarde isso|resumindo|em resumo)\b/i.test(String(text || ''));

  const isQuestionLike = text => /^(?:por\s+que|por\s+quê|o\s+que|qual(?:\s+(?:foi|era|é))?|quais|como|quando|onde|quem)\b/i.test(String(text || '').trim());

  const isOutline = text => {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return false;
    if (/\s*[+=>]\s*/.test(clean) && !/\b(?:é|são|foi|era|eram|ocorre|ocorreu|provocou|causou|levou|permitiu|deixou|ficou|volta|voltou|começou|aumentou|reduziu|produz|produziu|entra|entrou|defendia|defende|representa|significa)\b/i.test(clean)) return true;
    return false;
  };

  const isFragment = text => {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return true;
    if (/[→⇒—–:-]\s*$/.test(clean)) return true;
    return /(?:^|\s)(?:de|do|da|dos|das|e|ou|para|com|por|que|como|em|no|na|nos|nas|ao|à|aos|às|um|uma|o|a)$/i.test(clean);
  };

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
      .replace(/<\/?(?:p|div|h[1-6]|li|br|hr|section|article|blockquote|tr)(?:\s[^>]*)?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
    ).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();
  };

  const cleanLine = line => String(line || '')
    .replace(/^[\s•▪●◦\-–—]+/, '')
    .replace(/^\d+[.)]\s*/, '')
    .replace(/\bD\.\s+/g, 'D§ ')
    .replace(/\s{2,}/g, ' ')
    .replace(/D§\s+/g, 'D. ')
    .trim();

  const splitFacts = text => {
    const lines = htmlToText(text).split(/\n+/).map(cleanLine).filter(Boolean);
    const facts = [];
    let pendingQuestion = null;

    const addStatement = value => {
      const fact = cleanLine(value);
      if (!fact || fact.length < 24 || fact.length > 500) return;
      if (isStudyMeta(fact) || isFragment(fact) || isOutline(fact)) return;
      facts.push({ text: fact, kind: 'statement', answerText: fact });
    };

    for (const line of lines) {
      if (isStudyMeta(line)) continue;

      if (pendingQuestion) {
        if (!isQuestionLike(line) && !isOutline(line) && line.length >= 10) {
          facts.push({
            text: pendingQuestion + ' ' + line,
            kind: 'prompt',
            prompt: pendingQuestion,
            answerText: line
          });
          pendingQuestion = null;
          continue;
        }
        pendingQuestion = null;
      }

      const qMark = line.indexOf('?');
      if (qMark >= 8) {
        const prompt = line.slice(0, qMark + 1).trim();
        const rest = line.slice(qMark + 1).replace(/^\s*[:—–-]+\s*/, '').trim();

        if (isQuestionLike(prompt)) {
          if (rest.length >= 10 && !isStudyMeta(rest) && !isOutline(rest)) {
            facts.push({ text: line, kind: 'prompt', prompt, answerText: rest });
          } else {
            pendingQuestion = prompt;
          }
          continue;
        }
      }

      addStatement(line);
    }

    if (pendingQuestion) addStatement(pendingQuestion);

    return [...new Map(facts.map(f => [normalize(f.text), f])).values()];
  };

  const meaningfulWords = value => (String(value || '').match(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9-]{3,}/g) || [])
    .map(normalize)
    .filter(word => word && !stopWords.has(word) && word.length >= 4);

  const unique = list => [...new Map(list.filter(Boolean).map(x => [normalize(x), x])).values()];

  const shuffle = list => {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const keywords = text => [...new Set(meaningfulWords(text))].slice(0, 60);

  const splitStudyGuide = guide => {
    const topics = [];
    for (const line of htmlToText(guide).split(/\n+/).map(cleanLine).filter(Boolean)) {
      if (isStudyMeta(line) || isFragment(line) || isOutline(line)) continue;
      for (const chunk of line.split(/\s*;\s*/).map(x => x.trim()).filter(Boolean)) {
        if (chunk.length >= 3 && chunk.length <= 180 && !isFragment(chunk)) topics.push(chunk);
      }
    }
    return unique(topics);
  };

  const scoreFactAgainstGuide = (fact, guideTopics) => {
    const factText = typeof fact === 'string' ? fact : fact.text;
    if (!guideTopics.length || !factText) return { score: 0, topic: '' };

    const factNorm = normalize(factText);
    const factWords = new Set(meaningfulWords(factText));
    let best = { score: 0, topic: '' };

    for (const topic of guideTopics) {
      const topicNorm = normalize(topic);
      const topicWords = meaningfulWords(topic);
      let score = 0;

      if (topicNorm.length >= 5 && factNorm.includes(topicNorm)) score += 14;

      const shared = topicWords.filter(word => factWords.has(word)).length;
      score += shared * 4;
      if (topicWords.length && shared / topicWords.length >= 0.5) score += 6;

      const years = topicNorm.match(/\b(?:1[5-9]\d{2}|20\d{2})\b/g) || [];
      const factYears = factNorm.match(/\b(?:1[5-9]\d{2}|20\d{2})\b/g) || [];
      score += years.filter(year => factYears.includes(year)).length * 14;

      if (score > best.score) best = { score, topic };
    }

    return best;
  };

  const rankFactsByGuide = (facts, guideTopics) => facts
    .map(fact => ({ fact, ...scoreFactAgainstGuide(fact, guideTopics) }))
    .sort((a,b) => b.score - a.score || a.fact.text.length - b.fact.text.length);

  const assemblePdfText = items => {
    const lineMap = new Map();
    for (const item of Array.isArray(items) ? items : []) {
      const value = String(item && item.str || '').trim();
      if (!value) continue;
      const y = Math.round(Number(item && item.transform && item.transform[5] || 0));
      const x = Number(item && item.transform && item.transform[4] || 0);
      const key = Math.round(y / 2) * 2;
      if (!lineMap.has(key)) lineMap.set(key, []);
      lineMap.get(key).push({ value, x, width: Number(item && item.width || 0) });
    }
    return [...lineMap.entries()].sort((a,b) => b[0] - a[0]).map(entry => {
      const row = entry[1].sort((a,b) => a.x - b.x);
      let line = '';
      row.forEach((item, i) => {
        const prev = row[i - 1];
        const gap = prev ? item.x - (prev.x + prev.width) : Infinity;
        const glued = prev && prev.value.length === 1 && item.value.length === 1 && gap <= Math.max(2, prev.width * 0.6);
        line += (i && !glued ? ' ' : '') + item.value;
      });
      return line;
    }).join('\n');
  };

  const extractRelation = fact => {
    const obj = typeof fact === 'string' ? { text: fact, kind: 'statement', answerText: fact } : fact;
    const text = obj.text;
    const years = text.match(/\b(?:1[5-9]\d{2}|20\d{2})\b/g) || [];

    if (obj.kind === 'prompt') return { type: 'prompt', prompt: obj.prompt, detail: obj.answerText, subject: obj.prompt };

    const date = text.match(/^\s*(?:(\d{1,2})\s+)?(?:(?:Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)[a-z]*\s+)?(1[5-9]\d{2}|20\d{2})\b\s*[:—–-]\s*(.+)$/i);
    if (date) return { type: 'date', year: date[2], subject: date[3].trim(), detail: date[3].trim() };

    const arrow = text.split(/\s+[→⇒]\s+/).map(x => x.trim()).filter(Boolean);
    if (arrow.length >= 2) return { type: arrow.length >= 3 ? 'sequence' : 'relation', subject: arrow[0], parts: arrow, detail: arrow.slice(1).join(' → ') };

    const change = text.match(/^(.+?)\s+(mudou|passou de|foi substitu[ií]do por|deixou de)\s+(.+)$/i);
    if (change) return { type: 'change', subject: change[1].trim(), verb: change[2], detail: change[3].trim() };

    const cause = text.match(/^(.+?)\s+(?:ocorreu|aconteceu)\s+porque\s+(.+)$/i);
    if (cause) return { type: 'cause', subject: cause[1].trim(), detail: cause[2].trim() };

    const consequence = text.match(/^(.+?)\s+(provocou|causou|levou a|levou à|resultou em|permitiu|prejudicou|provocaram|causaram)\s+(.+)$/i);
    if (consequence) return { type: 'consequence', subject: consequence[1].trim(), verb: consequence[2], detail: consequence[3].trim() };

    const location = text.match(/^(.+?)\s+(ocorre|ocorrem|acontece|acontecem|se passa|aconteceu|ocorreu)\s+(em|no|na|nos|nas|dentro|pelas|pelos|pela|pelo)\s+(.+)$/i);
    if (location) return {
      type: 'location',
      subject: location[1].trim(),
      verb: location[2].trim(),
      preposition: location[3].trim(),
      answer: location[4].trim(),
      fullAnswer: text,
      years
    };

    const activity = text.match(/^(.+?)\s+(absorve|absorveu|entra|entrou|participa|participou|produz|produziu|libera|liberou|transporta|transportou|começou|comecou|começa|comeca|cresce|cresceu|aumenta|aumentou|facilita|facilitou|contribui|contribuiu|defende|defendia|representa|representava|significa|significava|é|são|era|eram|foi|foram|é absorvida|é transportada|é liberado|foi absorvida|foi transportada|foi liberado)\s+(.+)$/i);
    if (activity) return {
      type: 'activity',
      subject: activity[1].trim(),
      verb: activity[2].trim(),
      answer: activity[3].trim(),
      fullAnswer: text,
      years
    };

    const colon = text.indexOf(':');
    if (colon > 3 && colon < 120) {
      const subject = text.slice(0, colon).trim();
      const detail = text.slice(colon + 1).trim();
      if (subject && detail) return { type: 'detail', subject, detail };
    }

    const definition = text.match(/^(.+?)\s+(é|são|era|eram|foi|foram|significa|representa|corresponde a)\s+(.+)$/i);
    if (definition) return { type: 'definition', subject: definition[1].trim(), verb: definition[2], detail: definition[3].trim() };

    return { type: 'general', subject: text.replace(/[.]$/, '').trim(), detail: text };
  };

  const cleanSentence = value => {
    const text = String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/\.{2,}/g, '.')
      .replace(/\s+([,.;:!?])/g, '$1')
      .trim();
    if (!text) return '';
    return /[.!?]$/.test(text) ? text : text + '.';
  };

  const addPeriod = cleanSentence;

  const cleanAnswer = value => {
    let text = cleanSentence(value).replace(/^[•▪●◦\-–—]+\s*/, '').trim();
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  const answerForFact = fact => {
    const obj = typeof fact === 'string' ? { text: fact, kind: 'statement', answerText: fact } : fact;
    if (obj.kind === 'prompt') return cleanAnswer(obj.answerText);

    const p = extractRelation(obj);
    if (p.type === 'sequence') return cleanAnswer('A sequência apresentada é: ' + p.parts.join(' → '));
    return cleanAnswer(obj.answerText || obj.text);
  };

  const shortAnswerForFact = fact => {
    const p = extractRelation(fact);
    switch (p.type) {
      case 'prompt': return addPeriod(p.answer);
      case 'sequence': return addPeriod(p.parts.slice(1).join(' → '));
      case 'relation': return addPeriod(p.answer);
      case 'change': return addPeriod(p.answer);
      case 'consequence': return addPeriod(p.answer);
      case 'location': return addPeriod(p.answer);
      case 'activity': return addPeriod(p.answer);
      case 'definition': return addPeriod(p.answer);
      case 'detail': return addPeriod(p.answer);
      case 'date': return addPeriod(p.detail || p.subject || p.fullAnswer);
      default: return addPeriod(p.fullAnswer);
    }
  };

  const questionForFact = fact => {
    const p = extractRelation(fact);
    if (p.type === 'prompt') return [p.prompt];

    switch (p.type) {
      case 'sequence':
        return [
          'Qual sequência de acontecimentos é apresentada a partir de "' + p.subject + '"?',
          'Como os acontecimentos ligados a "' + p.subject + '" se encadeiam?'
        ];
      case 'relation':
        return [
          'O que aconteceu a partir de "' + p.subject + '"?',
          'Qual resultado é apresentado após "' + p.subject + '"?'
        ];
      case 'change':
        return [
          'Como "' + p.subject + '" mudou segundo o conteúdo?',
          'Qual transformação ocorreu em "' + p.subject + '"?'
        ];
      case 'cause':
        return [
          'Por que "' + p.subject + '" aconteceu?',
          'Que causa explica "' + p.subject + '"?'
        ];
      case 'consequence':
        return [
          'O que "' + p.subject + '" provocou?',
          'Qual foi o efeito de "' + p.subject + '"?'
        ];
      case 'date':
        return [
          'O que aconteceu em ' + p.year + '?',
          'Qual acontecimento está associado a ' + p.year + '?'
        ];
      case 'definition':
        return [
          'O que significa "' + p.subject + '" no contexto estudado?',
          'Qual definição explica "' + p.subject + '"?'
        ];
      case 'detail':
        if (/%/.test(p.detail)) return ['Qual valor ou porcentagem está associado a "' + p.subject + '"?'];
        if (/órgão|controle|fiscalização|função/i.test(p.detail)) return ['Qual era a função de "' + p.subject + '" no período estudado?'];
        if (/proibido|proibia/i.test(p.detail)) return ['O que era proibido em relação a "' + p.subject + '"?'];
        return [
          'Qual característica define "' + p.subject + '" no contexto estudado?',
          'Que informação específica ajuda a compreender "' + p.subject + '"?'
        ];
      default:
        return [
          'Qual afirmação descreve corretamente "' + p.subject + '"?',
          'Que característica ajuda a compreender "' + p.subject + '"?'
        ];
    }
  };

  const questionLeaksAnswer = (question, answer, subject = '') => {
    const qNorm = normalize(question);
    const aNorm = normalize(answer);
    if (!aNorm) return false;
    if (qNorm.includes(aNorm)) return true;

    const qWords = new Set(meaningfulWords(question));
    const subjectWords = new Set(meaningfulWords(subject));
    const answerWords = [...new Set(meaningfulWords(answer))]
      .filter(word => !subjectWords.has(word));
    if (answerWords.length < 3) return false;

    const overlap = answerWords.filter(word => qWords.has(word)).length / answerWords.length;
    return overlap >= 0.75;
  };

  const candidateLeaksCorrectAnswer = (candidate, answer) => {
    const cNorm = normalize(candidate);
    const aNorm = normalize(answer);
    if (!aNorm) return false;
    if (cNorm.includes(aNorm)) return true;

    const aWords = [...new Set(meaningfulWords(answer))];
    const cWords = new Set(meaningfulWords(candidate));
    if (aWords.length < 3) return false;

    return aWords.filter(word => cWords.has(word)).length / aWords.length >= 0.88;
  };

  const answerSimilarity = (a, b) => {
    const aw = new Set(meaningfulWords(a));
    const bw = new Set(meaningfulWords(b));
    if (!aw.size || !bw.size) return 0;
    const inter = [...aw].filter(word => bw.has(word)).length;
    const union = new Set([...aw, ...bw]).size;
    return inter / union;
  };

  const scoreDistractor = (answer, question, candidate, type, candidateType, guideTopic) => {
    const sim = answerSimilarity(answer, candidate);
    const lengthScore = Math.max(0, 8 - Math.abs(answer.length - candidate.length) / 22);
    const sameType = type === candidateType ? 12 : 0;
    const questionWords = new Set(meaningfulWords(question));
    const sharedContext = meaningfulWords(candidate).filter(word => questionWords.has(word)).length;
    const guideBonus = guideTopic && normalize(candidate).includes(normalize(guideTopic)) ? 6 : 0;
    return sameType + sharedContext * 1.5 + lengthScore + guideBonus - sim * 3;
  };

  const makeDistractors = (fact, allFacts, answer, question, guideTopic) => {
    const target = extractRelation(fact);
    const ranked = [];

    for (const other of allFacts) {
      if (normalize(other.text) === normalize(fact.text)) continue;
      const candidate = answerForFact(other);
      if (!candidate || candidate.length < 18 || isStudyMeta(candidate) || isFragment(candidate)) continue;
      if (normalize(candidate) === normalize(answer)) continue;
      if (candidateLeaksCorrectAnswer(candidate, answer)) continue;

      const type = extractRelation(other).type;
      ranked.push({
        candidate,
        score: scoreDistractor(answer, question, candidate, target.type, type, guideTopic)
      });
    }

    ranked.sort((a,b) => b.score - a.score);
    const result = [];
    for (const item of ranked) {
      if (result.some(value => normalize(value) === normalize(item.candidate))) continue;
      if (answerSimilarity(answer, item.candidate) > 0.94) continue;
      result.push(item.candidate);
      if (result.length === 3) break;
    }
    return result;
  };

  const buildQuestion = (fact, allFacts, seed, guideTopic = '') => {
    // A alternativa correta responde somente ao que a pergunta pede.
    // A frase inteira continua disponível em sourceFact/explanation.
    const answer = shortAnswerForFact(fact);
    if (!answer || answer.length < 14 || isStudyMeta(answer) || isFragment(answer)) return null;

    const subject = extractRelation(fact).subject || '';
    const variants = questionForFact(fact);
    let question = '';
    for (let i = 0; i < variants.length; i++) {
      const candidate = variants[(Math.abs(seed) + i) % variants.length];
      if (candidate && candidate.length >= 40 && !isStudyMeta(candidate) && !questionLeaksAnswer(candidate, answer, subject)) {
        question = candidate;
        break;
      }
    }
    if (!question) return null;

    const distractors = makeDistractors(fact, allFacts, answer, question, guideTopic);
    if (distractors.length < 3) return null;

    return {
      question,
      answer,
      alternatives: shuffle(unique([answer, ...distractors])),
      sourceFact: fact.text,
      guideTopic,
      explanation: 'A resposta é sustentada pelo conteúdo do resumo: "' + fact.text + '"'
    };
  };

  const generateQuizFromText = (text, desiredCount = 6) => {
    const facts = splitFacts(text);
    if (facts.length < 4) throw new Error('Não há informações suficientes para montar um quiz confiável.');

    const count = Math.min(8, facts.length, Math.max(4, Number(desiredCount) || 6));
    const questions = [];
    const used = new Set();

    for (const [i, fact] of shuffle(facts).entries()) {
      if (questions.length >= count || used.has(normalize(fact.text))) continue;
      const built = buildQuestion(fact, facts, i * 41 + Math.floor(Math.random() * 1000));
      if (!built || questions.some(q => normalize(q.question) === normalize(built.question))) continue;
      questions.push(built);
      used.add(normalize(fact.text));
    }

    if (questions.length < Math.min(4, count)) {
      throw new Error('Não foi possível montar perguntas confiáveis a partir deste resumo.');
    }

    return shuffle(questions).slice(0, count).map((q, i) => ({ id: i + 1, ...q }));
  };

  const generateHybridQuiz = (summaryText, guideText, desiredCount = 6) => {
    const facts = splitFacts(summaryText);
    if (facts.length < 4) throw new Error('Não há informações suficientes para montar um quiz confiável.');

    const guideTopics = splitStudyGuide(guideText);
    if (!guideTopics.length) return generateQuizFromText(summaryText, desiredCount);

    const count = Math.min(8, facts.length, Math.max(4, Number(desiredCount) || 6));
    const ranked = rankFactsByGuide(facts, guideTopics);
    const targeted = ranked.filter(x => x.score > 0).map(x => x.fact);
    const targetQuota = Math.min(targeted.length, Math.max(2, Math.ceil(count * 0.7)));

    const selected = [];
    for (const fact of shuffle(targeted)) {
      if (selected.length >= targetQuota) break;
      selected.push(fact);
    }
    for (const fact of shuffle(facts)) {
      if (selected.length >= count) break;
      if (!selected.includes(fact)) selected.push(fact);
    }

    const questions = [];
    const used = new Set();

    for (const [i, fact] of selected.entries()) {
      if (questions.length >= count || used.has(normalize(fact.text))) continue;
      const match = scoreFactAgainstGuide(fact, guideTopics);
      const built = buildQuestion(fact, facts, i * 53 + Math.floor(Math.random() * 2000), match.score > 0 ? match.topic : '');
      if (!built || questions.some(q => normalize(q.question) === normalize(built.question))) continue;
      questions.push(built);
      used.add(normalize(fact.text));
    }

    // Fill remaining slots with the best-ranked facts instead of falling back prematurely.
    if (questions.length < count) {
      for (const item of ranked) {
        if (questions.length >= count || used.has(normalize(item.fact.text))) continue;
        const match = item.score > 0 ? item.topic : '';
        const built = buildQuestion(item.fact, facts, questions.length * 67, match);
        if (!built || questions.some(q => normalize(q.question) === normalize(built.question))) continue;
        questions.push(built);
        used.add(normalize(item.fact.text));
      }
    }

    if (questions.length < Math.min(4, count)) return generateQuizFromText(summaryText, count);

    return shuffle(questions).slice(0, count).map((q, i) => ({ id: i + 1, ...q }));
  };

  window.nexaQuizEngine = {
    htmlToText,
    splitFacts,
    keywords,
    extractRelation,
    factParts: extractRelation,
    answerUnit: answerForFact,
    questionLeaksAnswer,
    candidateLeaksCorrectAnswer,
    answerSimilarity,
    assemblePdfText,
    splitStudyGuide,
    scoreFactAgainstGuide,
    rankFactsByGuide,
    generateQuizFromText,
    generateHybridQuiz,
    isStudyMeta,
    isFragment
  };

  if (typeof document === 'undefined') return;
  const $ = selector => document.querySelector(selector);

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));

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
      output.push(assemblePdfText(data.items));
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

  let readerClosedForQuiz = false;

  const reopenReaderAfterQuiz = () => {
    const reader = $('#readerDialog');
    if (reader && readerClosedForQuiz && !reader.open) {
      try { reader.showModal(); } catch {}
    }
    readerClosedForQuiz = false;
  };

  const openQuiz = async () => {
    const context = window.NEXA_ACTIVE_SUMMARY;
    if (!context || !context.summary) {
      const dialog = $('#quizDialog');
      if (dialog && !dialog.open) {
        dialog.showModal();
        showError('Abra um resumo primeiro para gerar um quiz personalizado.');
      }
      return;
    }

    const dialog = $('#quizDialog');
    const reader = $('#readerDialog');
    if (!dialog) return;

    try {
      if (reader && reader.open) {
        reader.close();
        readerClosedForQuiz = true;
      }
      if (!dialog.open) dialog.showModal();
    } catch (error) {
      console.error('[NEXA Quiz] Não foi possível abrir o quiz:', error);
      return;
    }

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

      const studyGuide = (summary.exam && summary.exam.studyGuide) || (context.exam && context.exam.studyGuide) || '';
      quiz = generateHybridQuiz(source, studyGuide, source.split(/\s+/).length > 700 ? 8 : 6);
      $('#quizTitle').textContent = summary.title || 'Quiz por IA';
      $('#quizSubtitle').textContent = studyGuide.trim()
        ? 'Personalizado com base no roteiro de estudos e no resumo'
        : 'Personalizado com base no conteúdo deste resumo';
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

  window.nexaQuizOpen = openQuiz;

  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('#quizCloseBottom') || target.closest('.quiz-close-dialog')) {
      const dialog = $('#quizDialog');
      if (dialog && dialog.open) dialog.close();
      reopenReaderAfterQuiz();
      return;
    }
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