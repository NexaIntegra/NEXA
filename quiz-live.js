(() => {
  const STOP = new Set([
    'a','ao','aos','as','com','como','da','das','de','do','dos','e','é','em','entre','era','esse','essa','este','esta',
    'foi','foram','há','isso','mais','mas','na','nas','não','nem','no','nos','o','os','ou','para','pela','pelas','pelo',
    'pelos','por','que','se','sem','ser','são','sua','suas','seu','seus','um','uma','umas','uns','sobre','também','já',
    'até','quando','onde','porque','assim','muito','muita','muitos','muitas','cada','outro','outra','outros','outras',
    'num','numa','dessa','desse','deste','desta','deve','devem','pode','podem','após','antes','durante','ainda','apenas',
    'segundo','sendo','tendo','tem','têm','ter','teve','será','serão','fazer','feito','forma','tipo','parte','qual','quais',
    'capítulo','capitulo','conteúdo','conteudo','resumo','informação','informacao'
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

  const clean = value => {
    const text = decodeEntities(value)
      .replace(/\bD\.\s+/g, 'D§ ')
      .replace(/\s+/g, ' ')
      .replace(/D§\s+/g, 'D. ')
      .trim();
    return text.replace(/\.{2,}/g, '.').trim();
  };

  const addPeriod = value => {
    const text = clean(value);
    if (!text) return '';
    return /[.!?]$/.test(text) ? text : text + '.';
  };

  const isStudyMeta = text => /\b(?:boa prova|para decorar|ideia para decorar|ideia central|o mais importante|lembre-?se|memorize|decore|dica(?:s)? (?:de|para) (?:a )?prova|macete(?:s)?|vale lembrar|na hora da prova|guarde isso|resumindo|em resumo)\b/i.test(String(text || ''));

  const isQuestionLike = text => /^(?:por\s+que|por\s+quê|o\s+que|qual(?:\s+(?:foi|era|é))?|quais|como|quando|onde|quem)\b/i.test(String(text || '').trim());

  const isFragment = text => {
    const value = clean(text);
    if (!value) return true;
    if (/[→⇒—–:-]\s*$/.test(value)) return true;
    return /(?:^|\s)(?:de|do|da|dos|das|e|ou|para|com|por|que|como|em|no|na|nos|nas|ao|à|aos|às|um|uma|o|a)$/i.test(value);
  };

  const isOutline = text => {
    const value = clean(text);
    return /\s*[+=>]\s*/.test(value) &&
      !/\b(?:é|são|foi|era|eram|ocorre|ocorreu|provocou|causou|levou|permitiu|deixou|ficou|volta|voltou|começou|aumentou|reduziu|produz|produziu|entra|entrou|defendia|defende|representa|significa)\b/i.test(value);
  };

  const htmlToText = html => {
    const source = String(html || '');
    if (typeof document !== 'undefined' && document.createElement) {
      const box = document.createElement('div');
      box.innerHTML = source;
      return (box.innerText || box.textContent || '')
        .replace(/[\t\r]+/g, ' ')
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

  const splitSentences = line => clean(line)
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý])/)
    .map(part => part.trim())
    .filter(Boolean);

  const splitFacts = input => {
    const lines = htmlToText(input).split(/\n+/).map(clean).filter(Boolean);
    const facts = [];
    let pendingPrompt = null;

    const pushStatement = statement => {
      const value = addPeriod(statement);
      if (!value || value.length < 24 || value.length > 500) return;
      if (isStudyMeta(value) || isFragment(value) || isOutline(value)) return;
      facts.push({ text: value, kind: 'statement', prompt: '', answerText: value });
    };

    const pushPrompt = (prompt, answer) => {
      const q = addPeriod(prompt).replace(/\.$/, '?');
      const a = addPeriod(answer);
      if (!q.endsWith('?') || !a || a.length < 12) return;
      if (isStudyMeta(a) || isFragment(a) || isOutline(a)) return;
      facts.push({ text: q + ' ' + a, kind: 'prompt', prompt: q, answerText: a });
    };

    for (const line of lines) {
      if (isStudyMeta(line)) continue;

      if (pendingPrompt) {
        if (!isQuestionLike(line) && line.length >= 12 && !isStudyMeta(line)) {
          const parts = splitSentences(line);
          pushPrompt(pendingPrompt, parts.shift() || line);
          parts.forEach(pushStatement);
          pendingPrompt = null;
          continue;
        }
        pendingPrompt = null;
      }

      const questionMark = line.indexOf('?');
      if (questionMark >= 8) {
        const prompt = line.slice(0, questionMark + 1).trim();
        const rest = line.slice(questionMark + 1).replace(/^\s*[:—–-]+\s*/, '').trim();

        if (isQuestionLike(prompt)) {
          if (rest) {
            const parts = splitSentences(rest);
            pushPrompt(prompt, parts.shift() || rest);
            parts.forEach(pushStatement);
          } else {
            pendingPrompt = prompt;
          }
          continue;
        }
      }

      splitSentences(line).forEach(pushStatement);
    }

    return [...new Map(facts.map(f => [normalize(f.text), f])).values()];
  };

  const meaningfulWords = value => (String(value || '').match(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9-]{3,}/g) || [])
    .map(normalize)
    .filter(word => word && !STOP.has(word) && word.length >= 4);

  const unique = values => [...new Map(values.filter(Boolean).map(value => [normalize(value), value])).values()];

  const shuffle = values => {
    const out = [...values];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  const splitStudyGuide = guide => {
    const topics = [];
    for (const raw of htmlToText(guide).split(/\n+/)) {
      const line = clean(raw);
      if (!line || isStudyMeta(line) || isFragment(line)) continue;
      for (const topic of line.split(/\s*;\s*/).map(clean).filter(Boolean)) {
        if (topic.length >= 3 && topic.length <= 180 && !isStudyMeta(topic) && !isFragment(topic) && !isOutline(topic)) {
          topics.push(topic);
        }
      }
    }
    return unique(topics);
  };

  const relationData = fact => {
    const obj = typeof fact === 'string'
      ? { text: addPeriod(fact), kind: 'statement', prompt: '', answerText: addPeriod(fact) }
      : fact;

    if (obj.kind === 'prompt') {
      return {
        type: 'prompt',
        subject: obj.prompt,
        answer: addPeriod(obj.answerText),
        prompt: obj.prompt,
        fullAnswer: obj.answerText
      };
    }

    const text = obj.text;
    const years = text.match(/\b(?:1[5-9]\d{2}|20\d{2})\b/g) || [];

    const arrow = text.split(/\s+[→⇒]\s+/).map(clean).filter(Boolean);
    if (arrow.length >= 2) {
      return {
        type: arrow.length >= 3 ? 'sequence' : 'relation',
        subject: clean(arrow[0]),
        answer: clean(arrow.slice(1).join(' → ')),
        parts: arrow,
        fullAnswer: text,
        years
      };
    }

    const change = text.match(/^(.+?)\s+(mudou|passou de|foi substitu[ií]do por|deixou de)\s+(.+)$/i);
    if (change) return {
      type: 'change',
      subject: clean(change[1]),
      answer: clean(change[3]),
      verb: clean(change[2]),
      fullAnswer: text,
      years
    };

    const consequence = text.match(/^(.+?)\s+(provocou|causou|levou a|levou à|resultou em|permitiu|prejudicou|provocaram|causaram|favoreceu|favoreceram|aumentou|aumentaram|reduziu|reduziram|ampliou|ampliaram|gerou|geraram|facilitou|facilitaram|contribuiu|contribuíram)\s+(.+)$/i);
    if (consequence) return {
      type: 'consequence',
      subject: clean(consequence[1]),
      answer: clean(consequence[3]),
      verb: clean(consequence[2]),
      fullAnswer: text,
      years
    };

    const location = text.match(/^(.+?)\s+(ocorre|ocorrem|acontece|acontecem|se passa|aconteceu|ocorreu)\s+(?:em|no|na|nos|nas|dentro|pelas|pelos|pela|pelo)\s+(.+)$/i);
    if (location) return {
      type: 'location',
      subject: clean(location[1]),
      answer: clean(location[3]),
      verb: clean(location[2]),
      fullAnswer: text,
      years
    };

    const activity = text.match(/^(.+?)\s+(absorve|absorveu|entra|entrou|participa|participou|produz|produziu|libera|liberou|transporta|transportou|começou|comecou|começa|comeca|cresce|cresceu|aumenta|aumentou|facilita|facilitou|contribui|contribuiu|defende|defendia|representa|representava|significa|significava|é|são|era|eram|foi|foram|é absorvida|é transportada|é liberado|foi absorvida|foi transportada|foi liberado)\s+(.+)$/i);
    if (activity) return {
      type: 'activity',
      subject: clean(activity[1]),
      answer: clean(activity[3]),
      verb: clean(activity[2]),
      fullAnswer: text,
      years
    };

    const colon = text.match(/^(.+?)\s*:\s*(.+)$/);
    if (colon && colon[1].length <= 120) return {
      type: 'detail',
      subject: clean(colon[1]),
      answer: clean(colon[2]),
      fullAnswer: text,
      years
    };

    const definition = text.match(/^(.+?)\s+(é|são|era|eram|foi|foram|significa|representa|corresponde a)\s+(.+)$/i);
    if (definition) return {
      type: 'definition',
      subject: clean(definition[1]),
      answer: clean(definition[3]),
      verb: clean(definition[2]),
      fullAnswer: text,
      years
    };

    return {
      type: 'general',
      subject: clean(text.replace(/[.]$/, '')),
      answer: clean(text),
      fullAnswer: text,
      years
    };
  };

  const answerForFact = fact => {
    const r = relationData(fact);
    switch (r.type) {
      case 'prompt': return addPeriod(r.answer);
      case 'sequence': return addPeriod(r.parts.join(' → '));
      case 'relation': return addPeriod(r.subject + ' → ' + r.answer);
      case 'change': return addPeriod(r.subject + ' ' + r.verb + ' ' + r.answer);
      case 'consequence': return addPeriod(r.subject + ' ' + r.verb + ' ' + r.answer);
      case 'location': return addPeriod(r.subject + ' ' + r.verb + ' ' + r.answer);
      case 'activity': return addPeriod(r.subject + ' ' + r.verb + ' ' + r.answer);
      case 'definition': return addPeriod(r.subject + ' ' + r.verb + ' ' + r.answer);
      case 'detail': return addPeriod(r.subject + ': ' + r.answer);
      default: return addPeriod(r.fullAnswer);
    }
  };

  const shortAnswerForFact = fact => {
    const r = relationData(fact);
    switch (r.type) {
      case 'prompt': return addPeriod(r.answer);
      case 'sequence': return addPeriod(r.parts.join(' → '));
      case 'relation': return addPeriod(r.answer);
      case 'change': return addPeriod(r.answer);
      case 'consequence': return addPeriod(r.answer);
      case 'location': return addPeriod(r.answer);
      case 'activity': return addPeriod(r.answer);
      case 'definition': return addPeriod(r.answer);
      case 'detail': return addPeriod(r.answer);
      default: return addPeriod(r.fullAnswer);
    }
  };

  const questionVariants = fact => {
    const r = relationData(fact);
    if (r.type === 'prompt') return [r.prompt];

    switch (r.type) {
      case 'sequence':
        return [
          'Qual sequência de acontecimentos é apresentada a partir de "' + r.subject + '"?',
          'Como os acontecimentos ligados a "' + r.subject + '" se encadeiam?'
        ];
      case 'relation':
        return [
          'O que ocorreu a partir de "' + r.subject + '"?',
          'Qual resultado o conteúdo associa a "' + r.subject + '"?'
        ];
      case 'change':
        return [
          'Que transformação ocorreu em "' + r.subject + '"?',
          'Como "' + r.subject + '" mudou segundo o conteúdo?'
        ];
      case 'consequence':
        return [
          'Que efeito "' + r.subject + '" provocou?',
          'Qual consequência o conteúdo apresenta para "' + r.subject + '"?'
        ];
      case 'location':
        return [
          'Onde ocorre "' + r.subject + '" segundo o conteúdo?',
          'Em que local ou estrutura "' + r.subject + '" acontece?'
        ];
      case 'activity':
        return [
          'Qual ação ou característica do conteúdo é associada a "' + r.subject + '"?',
          'Que papel "' + r.subject + '" exerce no processo estudado?'
        ];
      case 'definition':
        return [
          'Como "' + r.subject + '" é definido no conteúdo?',
          'Que definição caracteriza "' + r.subject + '"?'
        ];
      case 'detail':
        if (/%/.test(r.answer)) return ['Qual valor está associado a "' + r.subject + '"?'];
        if (/órgão|controle|fiscalização|função/i.test(r.answer)) return ['Qual era a função de "' + r.subject + '" no período estudado?'];
        if (/proibido|proibia/i.test(r.answer)) return ['O que era proibido em relação a "' + r.subject + '"?'];
        return [
          'Que característica específica define "' + r.subject + '" nesse contexto?',
          'Que informação do conteúdo ajuda a explicar "' + r.subject + '"?'
        ];
      default:
        return [
          'Que informação específica o conteúdo apresenta sobre "' + r.subject + '"?',
          'Como "' + r.subject + '" é apresentado no contexto estudado?'
        ];
    }
  };

  const answerSimilarity = (a, b) => {
    const aw = new Set(meaningfulWords(a));
    const bw = new Set(meaningfulWords(b));
    if (!aw.size || !bw.size) return 0;
    const inter = [...aw].filter(word => bw.has(word)).length;
    const union = new Set([...aw, ...bw]).size;
    return inter / union;
  };

  const leaksAnswer = (question, answer, subject = '') => {
    const q = normalize(question);
    const a = normalize(answer);
    if (!a) return true;
    if (q.includes(a)) return true;

    const qWords = new Set(meaningfulWords(question));
    const subjectWords = new Set(meaningfulWords(subject));
    const aWords = [...new Set(meaningfulWords(answer))]
      .filter(word => !subjectWords.has(word));

    if (aWords.length < 3) return false;
    return aWords.filter(word => qWords.has(word)).length / aWords.length >= 0.72;
  };

  const candidateLeaksCorrectAnswer = (candidate, answer) => {
    const c = normalize(candidate);
    const a = normalize(answer);
    if (!a) return false;
    if (c.includes(a)) return true;

    const aw = [...new Set(meaningfulWords(answer))];
    const cw = new Set(meaningfulWords(candidate));
    if (aw.length < 3) return false;
    return aw.filter(word => cw.has(word)).length / aw.length >= 0.88;
  };

  const scoreGuide = (fact, topics) => {
    if (!topics.length) return { score: 0, topic: '' };
    const text = typeof fact === 'string' ? fact : fact.text;
    const fn = normalize(text);
    const fw = new Set(meaningfulWords(text));
    const years = fn.match(/\b(?:1[5-9]\d{2}|20\d{2})\b/g) || [];
    let best = { score: 0, topic: '' };

    for (const topic of topics) {
      const tn = normalize(topic);
      const tw = meaningfulWords(topic);
      let score = tn.length >= 5 && fn.includes(tn) ? 14 : 0;
      const shared = tw.filter(word => fw.has(word)).length;
      score += shared * 4;
      if (tw.length && shared / tw.length >= 0.5) score += 6;
      const topicYears = tn.match(/\b(?:1[5-9]\d{2}|20\d{2})\b/g) || [];
      score += topicYears.filter(year => years.includes(year)).length * 16;
      if (score > best.score) best = { score, topic };
    }
    return best;
  };

  const rankFactsByGuide = (facts, topics) => facts
    .map(fact => ({ fact, ...scoreGuide(fact, topics) }))
    .sort((a,b) => b.score - a.score || a.fact.text.length - b.fact.text.length);

  const compatibilityScore = (target, candidate, targetType, candidateType) => {
    const tw = new Set(meaningfulWords(target));
    const cw = new Set(meaningfulWords(candidate));
    const shared = [...tw].filter(word => cw.has(word)).length;
    const union = new Set([...tw, ...cw]).size || 1;
    const similarity = shared / union;
    const length = Math.max(0, 8 - Math.abs(target.length - candidate.length) / 25);
    const sameType = targetType === candidateType ? 16 : 0;
    return sameType + similarity * 10 + length;
  };

  const makeDistractors = (fact, allFacts, answer, guideTopic) => {
    const target = relationData(fact);
    const targetShort = shortAnswerForFact(fact);
    const candidates = [];

    for (const other of allFacts) {
      if (normalize(other.text) === normalize(fact.text)) continue;

      const candidate = shortAnswerForFact(other);
      const otherRelation = relationData(other);

      if (!candidate || candidate.length < 18) continue;
      if (isStudyMeta(candidate) || isFragment(candidate) || isOutline(candidate)) continue;
      if (normalize(candidate) === normalize(targetShort)) continue;
      if (candidateLeaksCorrectAnswer(candidate, answer) || candidateLeaksCorrectAnswer(candidate, targetShort)) continue;

      const score =
        compatibilityScore(targetShort, candidate, target.type, otherRelation.type) +
        (guideTopic && normalize(other.text).includes(normalize(guideTopic)) ? 5 : 0);

      candidates.push({ candidate, score });
    }

    candidates.sort((a,b) => b.score - a.score);

    const picked = [];
    for (const item of candidates) {
      if (picked.some(value => normalize(value) === normalize(item.candidate))) continue;
      if (answerSimilarity(item.candidate, targetShort) > 0.94) continue;
      picked.push(item.candidate);
      if (picked.length === 3) break;
    }

    return picked;
  };

  const buildQuestion = (fact, allFacts, seed, guideTopic = '') => {
    const r = relationData(fact);
    // Usa o alvo da informação como resposta; a frase completa fica apenas na explicação.
    const answer = shortAnswerForFact(fact);
    if (!answer || answer.length < 14 || isStudyMeta(answer) || isFragment(answer)) return null;

    const variants = questionVariants(fact);
    let question = '';

    for (let i = 0; i < variants.length; i++) {
      const candidate = variants[(Math.abs(seed) + i) % variants.length];
      if (!candidate || isStudyMeta(candidate)) continue;
      if (r.type === 'prompt' && candidate.trim() === r.prompt.trim()) {
        question = candidate;
        break;
      }
      if (candidate.length >= 35 && !leaksAnswer(candidate, answer, r.subject)) {
        question = candidate;
        break;
      }
    }

    if (!question) return null;

    const distractors = makeDistractors(fact, allFacts, answer, guideTopic);
    if (distractors.length < 3) return null;

    const alternatives = shuffle(unique([answer, ...distractors]));
    if (alternatives.length !== 4) return null;

    return {
      question,
      answer,
      alternatives,
      sourceFact: fact.text,
      guideTopic,
      explanation: 'Esta resposta vem diretamente do conteúdo do resumo: "' + fact.text + '"'
    };
  };

  const generateQuizFromText = (text, desiredCount = 6) => {
    const facts = splitFacts(text);
    if (facts.length < 4) throw new Error('Não há informações suficientes para montar um quiz confiável.');

    const count = Math.min(8, facts.length, Math.max(4, Number(desiredCount) || 6));
    const questions = [];
    const usedFacts = new Set();

    for (const [i, fact] of shuffle(facts).entries()) {
      if (questions.length >= count) break;
      if (usedFacts.has(normalize(fact.text))) continue;

      const built = buildQuestion(fact, facts, i * 41 + Math.floor(Math.random() * 2000));
      if (!built) continue;
      if (questions.some(q => normalize(q.question) === normalize(built.question))) continue;

      questions.push(built);
      usedFacts.add(normalize(fact.text));
    }

    if (questions.length < Math.min(4, count)) {
      throw new Error('Não foi possível montar perguntas confiáveis a partir deste resumo.');
    }

    return shuffle(questions).slice(0, count).map((q, i) => ({ id: i + 1, ...q }));
  };

  const generateHybridQuiz = (summaryText, guideText, desiredCount = 6) => {
    const facts = splitFacts(summaryText);
    if (facts.length < 4) throw new Error('Não há informações suficientes para montar um quiz confiável.');

    const topics = splitStudyGuide(guideText);
    if (!topics.length) return generateQuizFromText(summaryText, desiredCount);

    const count = Math.min(8, facts.length, Math.max(4, Number(desiredCount) || 6));
    const ranked = rankFactsByGuide(facts, topics);
    const selected = [];

    const target = ranked.filter(item => item.score > 0).map(item => item.fact);
    const targetQuota = Math.min(target.length, Math.max(2, Math.ceil(count * 0.7)));

    for (const fact of shuffle(target)) {
      if (selected.length >= targetQuota) break;
      selected.push(fact);
    }

    for (const fact of shuffle(facts)) {
      if (selected.length >= count) break;
      if (!selected.some(x => normalize(x.text) === normalize(fact.text))) selected.push(fact);
    }

    for (const item of ranked) {
      if (selected.length >= count) break;
      if (!selected.some(x => normalize(x.text) === normalize(item.fact.text))) selected.push(item.fact);
    }

    const questions = [];
    const usedQuestions = new Set();

    for (let i = 0; i < selected.length && questions.length < count; i++) {
      const fact = selected[i];
      const match = scoreGuide(fact, topics);

      for (let attempt = 0; attempt < 10; attempt++) {
        const built = buildQuestion(
          fact,
          facts,
          i * 53 + attempt + Math.floor(Math.random() * 2000),
          match.score > 0 ? match.topic : ''
        );
        if (!built) continue;
        if (usedQuestions.has(normalize(built.question))) continue;
        questions.push(built);
        usedQuestions.add(normalize(built.question));
        break;
      }
    }

    if (questions.length < Math.min(4, count)) return generateQuizFromText(summaryText, count);

    return shuffle(questions).slice(0, count).map((q, i) => ({ id: i + 1, ...q }));
  };

  const assemblePdfText = items => {
    const lines = new Map();

    for (const item of Array.isArray(items) ? items : []) {
      const value = String(item?.str || '').trim();
      if (!value) continue;
      const y = Math.round(Number(item?.transform?.[5] || 0));
      const x = Number(item?.transform?.[4] || 0);
      const key = Math.round(y / 2) * 2;
      if (!lines.has(key)) lines.set(key, []);
      lines.get(key).push({ value, x, width: Number(item?.width || 0) });
    }

    return [...lines.entries()]
      .sort((a,b) => b[0] - a[0])
      .map(([, row]) => {
        row.sort((a,b) => a.x - b.x);
        let line = '';
        row.forEach((item, index) => {
          const prev = row[index - 1];
          const gap = prev ? item.x - (prev.x + prev.width) : Infinity;
          const glued = prev && prev.value.length === 1 && item.value.length === 1 && gap <= Math.max(2, prev.width * 0.6);
          line += (index && !glued ? ' ' : '') + item.value;
        });
        return line;
      })
      .join('\n');
  };

  window.nexaQuizEngine = {
    htmlToText,
    splitFacts,
    relationData,
    factParts: relationData,
    sentenceAnswer: answerForFact,
    answerUnit: answerForFact,
    shortAnswerForFact,
    questionVariants,
    questionLeaksAnswer: leaksAnswer,
    leaksAnswer,
    candidateLeaksCorrectAnswer,
    answerSimilarity,
    assemblePdfText,
    splitStudyGuide,
    scoreFactAgainstGuide: scoreGuide,
    rankFactsByGuide,
    generateQuizFromText,
    generateHybridQuiz,
    isStudyMeta,
    isFragment,
    isOutline
  };
})();

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