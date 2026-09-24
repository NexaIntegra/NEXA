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

  const studyMetaPatterns = [
    /\bboa prova\b/i,
    /\b(?:ideia|ideia central)\s+para\s+decorar\b/i,
    /\bpara decorar\b/i,
    /\bo mais importante (?:é|e) entender\b/i,
    /\blembre-se\b/i,
    /\blembre\b/i,
    /\bnão esqueça\b/i,
    /\bn[ãa]o deixe de memorizar\b/i,
    /\bmemorize\b/i,
    /\bdecore\b/i,
    /\bdica(?:s)?\s+de\s+prova\b/i,
    /\bdica(?:s)?\s+para\s+a\s+prova\b/i,
    /\bmacete(?:s)?\b/i,
    /\bvale lembrar\b/i,
    /\batenção\b/i,
    /\bresumindo\b/i,
    /\bem resumo\b/i,
    /\bcai\s+na\s+prova\b/i,
    /\bo que cai\s+na\s+prova\b/i,
    /\bguarde\s+isso\b/i,
    /\bna\s+hora\s+da\s+prova\b/i
  ];

  const isStudyMeta = text => studyMetaPatterns.some(pattern => pattern.test(String(text || '')));

  const isFragment = text => {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return true;
    if (/[→⇒—–:-]\s*$/.test(clean)) return true;
    if (/(?:^|\s)(?:de|do|da|dos|das|e|ou|para|com|por|que|como|em|no|na|nos|nas|ao|à|aos|às|um|uma|o|a)$/i.test(clean)) return true;
    return false;
  };

  const ensureSentence = text => {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    return /[.!?]$/.test(clean) ? clean : clean + '.';
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
      .replace(/<\/?(p|div|h[1-6]|li|br|hr|section|article|blockquote|tr)(?:\s[^>]*)?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
    ).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();
  };

  const splitFacts = text => {
    const raw = htmlToText(text);
    const pieces = [];

    raw.split(/\n+/).forEach(line => {
      const cleanLine = line
        .replace(/^[\s•▪●◦\-–—]+/, '')
        .replace(/^\d+[.)]\s*/, '')
        .replace(/\bD\.\s+/g, 'D§ ')
        .trim();

      if (!cleanLine || isStudyMeta(cleanLine)) return;

      cleanLine.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý])/).forEach(part => {
        const fact = part
          .replace(/D§\s+/g, 'D. ')
          .replace(/\s{2,}/g, ' ')
          .trim();

        if (
          fact.length >= 24 &&
          fact.length <= 500 &&
          !isStudyMeta(fact) &&
          !isFragment(fact)
        ) {
          pieces.push(fact);
        }
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
    return [...count.entries()]
      .sort((a,b) => b[1]-a[1] || b[0].length-a[0].length)
      .slice(0, 60)
      .map(x => display.get(x[0]));
  };

  const splitStudyGuide = guide => {
    const raw = htmlToText(guide);
    const lines = raw
      .split(/\n+/)
      .map(line => line.replace(/^[\s•▪●◦\-–—]+/, '').replace(/^\d+[.)]\s*/, '').trim())
      .filter(Boolean);

    const topics = [];
    for (const line of lines) {
      if (isStudyMeta(line)) continue;
      const chunks = line.split(/\s*;\s*/).map(x => x.trim()).filter(Boolean);
      for (const chunk of chunks) {
        if (chunk.length >= 3 && chunk.length <= 180 && !isFragment(chunk)) topics.push(chunk);
      }
    }

    return unique(topics);
  };

  const scoreFactAgainstGuide = (fact, guideTopics) => {
    if (!guideTopics.length) return { score: 0, topic: '' };
    const factNorm = normalize(fact);
    const factWords = new Set(meaningfulWords(fact));
    let best = { score: 0, topic: '' };

    for (const topic of guideTopics) {
      if (isStudyMeta(topic)) continue;
      const topicNorm = normalize(topic).trim();
      const topicWords = [...new Set(meaningfulWords(topic))];
      const topicYears = topic.match(/\b(?:1[5-9]\d{2}|20\d{2})\b/g) || [];
      const factYears = fact.match(/\b(?:1[5-9]\d{2}|20\d{2})\b/g) || [];
      if (!topicWords.length && !topicYears.length) continue;

      let score = 0;
      if (topicNorm.length >= 6 && factNorm.includes(topicNorm)) score += 12;

      const matchingYears = topicYears.filter(year => factYears.includes(year));
      if (matchingYears.length) score += matchingYears.length * 12;

      const shared = topicWords.filter(word => factWords.has(word)).length;
      score += shared * 3;

      const coverage = shared / topicWords.length;
      if (coverage >= 0.5) score += 5;
      if (coverage >= 0.8) score += 5;

      if (score > best.score) best = { score, topic };
    }

    return best;
  };

  const rankFactsByGuide = (facts, guideTopics) => facts
    .map(fact => ({ fact, ...scoreFactAgainstGuide(fact, guideTopics) }))
    .sort((a,b) => b.score - a.score || a.fact.length - b.fact.length);

  const unique = list => [...new Map(list.filter(Boolean).map(x => [normalize(x), x])).values()];

  const shuffle = list => {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

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

    return [...lineMap.entries()]
      .sort((a,b) => b[0] - a[0])
      .map(entry => {
        const itemsInLine = entry[1].sort((a,b) => a.x-b.x);
        let line = '';
        itemsInLine.forEach((item, idx) => {
          const prev = itemsInLine[idx - 1];
          const gap = prev ? item.x - (prev.x + prev.width) : Infinity;
          const gluedLetters =
            prev &&
            prev.value.length === 1 &&
            item.value.length === 1 &&
            gap <= Math.max(2, prev.width * 0.6);
          line += (idx && !gluedLetters ? ' ' : '') + item.value;
        });
        return line;
      })
      .join('\n');
  };



  const factParts = fact => {
    const clean = String(fact || '')
      .replace(/^\d+[.)]\s*/, '')
      .replace(/^[•▪●◦\-–—]+\s*/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const yearAtStart = clean.match(/^\s*(1[5-9]\d{2}|20\d{2})\b/);
    const dateAtStart = clean.match(/^\s*(?:(?:Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)[a-z]*\s+)?\d{1,2}\s+(?:de\s+)?[A-Za-zÀ-ÿ]+\s+(?:de\s+)?(1[5-9]\d{2}|20\d{2})\b/i);
    const dayMonthYearAtStart = clean.match(/^\s*(\d{1,2})\s+(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)[a-z]*\s+(1[5-9]\d{2}|20\d{2})\b/i);
    const monthYearAtStart = clean.match(/^\s*(?:Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)[a-z]*\s+(1[5-9]\d{2}|20\d{2})\b/i);
    const colon = clean.indexOf(':');
    const arrowParts = clean.split(/\s+[→⇒]\s+/).map(x => x.trim()).filter(Boolean);
    const dashParts = clean.split(/\s+[—–-]\s+/).map(x => x.trim()).filter(Boolean);
    const year = clean.match(/\b(?:1[5-9]\d{2}|20\d{2})\b/);
    const change = clean.match(/^(.+?)\s+(mudou|passou de|foi substitu[ií]do por|deixou de)\s+(.+)$/i);
    const cause = clean.match(/^(.*?)(porque|pois|devido a|por causa de|em razão de)\s+(.+)$/i);
    const markerList = ['provocou','provocaram','causou','causaram','levou a','levou à','resultou em','permitiu','permitiram','prejudicou','prejudicaram','defendia','defendiam','proibia','proibido'];
    const marker = markerList.find(item => normalize(clean).includes(normalize(item)));

    if (dayMonthYearAtStart || dateAtStart || monthYearAtStart) {
      const dateMatch = dayMonthYearAtStart || dateAtStart || monthYearAtStart;
      const yearValue = dayMonthYearAtStart ? dayMonthYearAtStart[3] : (dateAtStart ? dateAtStart[1] : monthYearAtStart[1]);
      const detail = clean.replace(dateMatch[0], '').replace(/^\s*[-—:]+\s*/, '').trim();
      const subject = detail.split(/\s*:\s*|\s+[→⇒]\s+/)[0].trim() || detail;
      return { subject, detail: detail || clean, relation: 'date', year: yearValue };
    }

    if (yearAtStart) {
      const rest = clean.replace(yearAtStart[0], '').replace(/^\s*[:—–-]\s*/, '').trim();
      return { subject: rest.split(/\s*[→⇒]\s*/)[0].trim(), detail: rest || clean, relation: 'date', year: yearAtStart[1] };
    }

    if (arrowParts.length >= 3) {
      return { subject: arrowParts[0], detail: arrowParts.slice(1).join(' → '), sequence: arrowParts, relation: 'sequence' };
    }

    if (change) {
      return { subject: change[1].trim(), detail: change[3].trim(), relation: 'change', verb: change[2] };
    }

    if (cause) {
      return { subject: cause[1].trim(), detail: cause[3].trim(), relation: 'cause', connector: cause[2] };
    }

    if (colon > 4 && colon < 140) {
      const subject = clean.slice(0, colon).trim();
      const rest = clean.slice(colon + 1).trim();
      const restArrow = rest.split(/\s+[→⇒]\s+/).map(x => x.trim()).filter(Boolean);
      if (restArrow.length >= 3) return { subject, detail: restArrow.join(' → '), sequence: [subject, ...restArrow], relation: 'sequence' };
      if (restArrow.length >= 2) return { subject, detail: restArrow.join(' → '), relation: 'relation' };
      const restDash = rest.split(/\s+[—–-]\s+/).map(x => x.trim()).filter(Boolean);
      if (restDash.length >= 2) return { subject, detail: restDash.join(' — '), relation: 'explanation' };
      return { subject, detail: rest, relation: 'detail' };
    }

    if (arrowParts.length >= 2) {
      return { subject: arrowParts[0], detail: arrowParts.slice(1).join(' → '), relation: 'relation' };
    }

    if (dashParts.length >= 2) {
      return { subject: dashParts[0], detail: dashParts.slice(1).join(' — '), relation: 'explanation' };
    }

    if (marker && clean.length > normalize(marker).length + 5) {
      const idx = normalize(clean).indexOf(normalize(marker));
      const subject = clean
        .slice(0, idx)
        .replace(/[,:;-]\s*$/, '')
        .replace(/\s+(?:e|que|porque|pois)\s*$/i, '')
        .trim();
      return { subject, detail: clean.slice(idx).trim(), relation: 'consequence' };
    }

    if (year) {
      return { subject: 'o acontecimento de ' + year[0], detail: clean, relation: 'date', year: year[0] };
    }

    const lead = clean.match(/^(Durante|Nesse|Neste|Nesta|Assim|Por isso|Além disso|Em seguida|No processo|Nesse processo|Durante esse processo)\s+([^,]+),\s*(.+)$/i);
    const withoutLead = lead ? lead[3].trim() : clean;

    const punctuationParts = withoutLead.split(/\s*[,;]\s*/).map(x => x.trim()).filter(Boolean);
    if (punctuationParts.length >= 2 && punctuationParts[0].split(/\s+/).length <= 5) {
      return { subject: punctuationParts[0], detail: punctuationParts.slice(1).join(', '), relation: 'general' };
    }

    const words = withoutLead.split(/\s+/);
    const verbWords = new Set([
      'é','e','são','sao','foi','foram','era','eram','está','esta','estão','estao','estava','estavam','ocorre','ocorreu','ocorrem',
      'acontece','aconteceu','acontecem','absorve','absorveu','absorvem','entra','entrou','entram','participa',
      'participou','participam','contribui','contribuiu','contribuem','aumenta','aumentou','aumentam','cresce','cresceram',
      'cresceu','crescem','começou','comecou','começam','comecam','envolveu','envolve','envolvem','facilitou','facilitam','facilita','facilitaram',
      'provoca','provocou','provocam','defende','defendia','defendem','defenderam','pertence','pertencia','pertencem',
      'transporta','transportou','transportam','libera','liberou','liberam','produz','produziu','produzem',
      'resultou','resulta','resultaram','levou','leva','levaram','permite','permitiu','permitiram','prejudica','prejudicou',
      'ficou','fica','ficam','voltou','volta','voltam','decidiu','decide','decidem','recebeu','recebe','recebem'
    ].map(normalize));

    let verbIndex = -1;
    for (let i = 1; i < words.length; i++) {
      const word = normalize(words[i]).replace(/[.,!?;:]/g,'');
      if (verbWords.has(word)) {
        verbIndex = i;
        break;
      }
    }

    if (verbIndex >= 1) {
      return {
        subject: words.slice(0, verbIndex).join(' '),
        detail: words.slice(verbIndex).join(' '),
        relation: 'general'
      };
    }

    if (words.length >= 6) {
      const splitAt = Math.min(4, Math.max(2, Math.floor(words.length * 0.35)));
      return {
        subject: words.slice(0, splitAt).join(' '),
        detail: words.slice(splitAt).join(' '),
        relation: 'general'
      };
    }

    return {
      subject: words.slice(0, Math.min(2, words.length)).join(' '),
      detail: words.slice(Math.min(2, words.length)).join(' ') || clean,
      relation: 'general'
    };
  };

  const relatedFacts = (fact, facts) => {
    const parts = factParts(fact);
    const seedWords = parts.subject
      .split(/\s+/)
      .map(w => normalize(w).replace(/[^a-z0-9]/g,''))
      .filter(w => w.length >= 5 && !stopWords.has(w))
      .slice(0, 4);

    return facts
      .filter(other => normalize(other) !== normalize(fact))
      .map(other => {
        const otherNorm = normalize(other);
        const score = seedWords.reduce((sum, word) => sum + (otherNorm.includes(word) ? 1 : 0), 0);
        return { other, score };
      })
      .filter(item => item.score > 0)
      .sort((a,b) => b.score - a.score || a.other.length - b.other.length)
      .map(item => item.other);
  };

  const shorten = text => {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (clean.length <= 180) return clean;
    return clean.slice(0, 177).replace(/\s+\S*$/, '') + '…';
  };

  const naturalizeAnswer = (fact, parts) => {
    const original = ensureSentence(fact);
    const detail = ensureSentence(parts.detail || '');

    if (parts.relation === 'sequence' && Array.isArray(parts.sequence) && parts.sequence.length >= 2) {
      return ensureSentence('A sequência apresentada foi: ' + parts.sequence.join(' → '));
    }

    const arrowBits = String(parts.detail || '')
      .split(/\s+[→⇒]\s+/)
      .map(x => x.replace(/[.]$/, '').trim())
      .filter(Boolean);

    if (parts.relation === 'relation' && arrowBits.length >= 2) {
      const left = arrowBits[0];
      const right = arrowBits.slice(1).join(' e ');
      const leftNorm = normalize(left);

      if (/fim do monopolio/i.test(leftNorm) && /comercio livre/i.test(normalize(right))) {
        return 'O fim do monopólio abriu espaço para o comércio livre.';
      }
      if (/povoamento do interior/i.test(leftNorm) && /fronteiras ampliadas/i.test(normalize(right))) {
        return 'O povoamento do interior levou à ampliação das fronteiras.';
      }
      if (/surgimento de vilas e cidades/i.test(leftNorm) && /vida urbana nova/i.test(normalize(right))) {
        return 'O surgimento de vilas e cidades deu origem a uma nova vida urbana.';
      }
      if (/tropeiros ligavam regioes/i.test(leftNorm) && /formacao de mercado interno/i.test(normalize(right))) {
        return 'A atuação dos tropeiros contribuiu para a formação de um mercado interno.';
      }
      if (/produtos ingleses mais baratos/i.test(leftNorm) && /industria brasileira prejudicada/i.test(normalize(right))) {
        return 'Produtos ingleses mais baratos prejudicaram a indústria brasileira.';
      }

      return cleanAnswer(left + ' levou a ' + right);
    }

    if (parts.relation === 'change') {
      const subject = cleanLabel(parts.subject || '');
      const changeDetail = String(parts.detail || '').replace(/[.]$/, '').trim();
      if (subject && changeDetail) {
        return cleanAnswer(subject + ' ' + (parts.verb || 'mudou') + ' ' + changeDetail);
      }
    }

    if (parts.relation === 'explanation') {
      const bits = String(parts.detail || '')
        .split(/\s+[—–-]\s+/)
        .map(x => x.trim())
        .filter(Boolean);

      if (bits.length >= 2 && /proibido|proibia/i.test(bits[1])) {
        const first = bits[0].replace(/^o\s+/i, '').trim();
        const second = bits[1].replace(/^proibido\s+/i, 'o ').trim();
        return cleanAnswer('O ' + first + ', e ' + second);
      }
      if (bits.length >= 2) {
        return ensureSentence(bits[0] + ', e ' + bits.slice(1).join(', e '));
      }
    }

    if (parts.relation === 'consequence') {
      const consequence = cleanAnswer(parts.detail || '');
      if (consequence) return consequence;
    }

    if (parts.relation === 'date') {
      let body = String(parts.detail || fact || '').trim();
      body = body.replace(/^\s*[^:]+:\s*/, '').replace(/^\s*[-—:]+\s*/, '').trim();
      const arrow = body.split(/\s+[→⇒]\s+/).map(x => x.trim()).filter(Boolean);

      if (/^Brasil\s*=\s*Reino Unido a Portugal/i.test(body)) {
        return 'Em ' + parts.year + ', o Brasil tornou-se Reino Unido a Portugal e deixou de ser colônia.';
      }
      if (/^Independência\s*:/i.test(body)) {
        return 'Em ' + parts.year + ', a Independência foi marcada pelo Grito do Ipiranga e deu origem ao Império do Brasil.';
      }
      if (/^D\.\s*João volta/i.test(body) || /^D\.\s*João voltou/i.test(body)) {
        return 'Em ' + parts.year + ', D. João voltou e D. Pedro permaneceu no Brasil.';
      }
      if (arrow.length >= 2) {
        body = arrow[0].replace(/[.]$/, '') + ' e ' + arrow.slice(1).join(' e ');
      }
      body = body.replace(/\s*=\s*/g, ' passou a ser ');
      return ensureSentence(body);
    }

    if (parts.relation === 'detail' && /^órgão\b/i.test(detail)) {
      return cleanAnswer(cleanLabel(parts.subject) + ' era ' + detail);
    }

    if (parts.relation === 'detail' && /^20% de todo ouro pertencia ao Rei/i.test(detail)) {
      return cleanAnswer('No Quinto, ' + detail.charAt(0).toLowerCase() + detail.slice(1));
    }

    if (['detail','cause','general'].includes(parts.relation) && detail.length >= 14) {
      return detail;
    }

    return original;
  };

  const answerUnit = naturalizeAnswer;

  const cleanAnswer = value => {
    let clean = String(value || '')
      .replace(/^\s*[•▪●◦\-–—]+/, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\.{2,}/g, '.')
      .replace(/\s+([,.;:!?])/g, '$1')
      .trim();

    if (!clean) return '';
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
    if (!/[.!?]$/.test(clean)) clean += '.';
    return clean;
  };

  const cleanLabel = value => cleanAnswer(value)
    .replace(/[.:;]+$/, '')
    .trim();

  const combineLabelAndDetail = (label, detail) => {
    const left = cleanLabel(label);
    const right = cleanAnswer(detail).replace(/[.]$/, '');
    if (!left) return cleanAnswer(right);
    if (!right) return cleanAnswer(left);
    return cleanAnswer(left + ': ' + right);
  };

  const questionTemplates = {
    sequence: [
      p => 'Qual sequência resume os acontecimentos apresentados a partir de "' + p.subject + '"?',
      p => 'Ao analisar "' + p.subject + '", qual sequência de acontecimentos aparece no conteúdo?',
      p => 'Qual cadeia de acontecimentos é descrita no resumo começando por "' + p.subject + '"?'
    ],
    relation: [
      p => 'O que aconteceu a partir de "' + p.subject + '"?',
      p => 'Que mudança no processo está diretamente ligada a "' + p.subject + '"?',
      p => 'Qual resultado aparece associado a "' + p.subject + '" no conteúdo estudado?'
    ],
    detail: [
      p => p.detail && /%/.test(p.detail)
        ? 'Qual valor está associado a "' + p.subject + '" e o que ele representa?'
        : p.detail && /órgão|controle|função|fiscalização/i.test(p.detail)
          ? 'Qual era a função de "' + p.subject + '" no período estudado?'
          : p.detail && /proibido|proibia/i.test(p.detail)
            ? 'O que era proibido em relação a "' + p.subject + '"?'
            : 'Qual característica ou informação define "' + p.subject + '" nesse contexto?',
      p => 'Como "' + p.subject + '" é caracterizado no conteúdo?',
      p => 'Que informação específica ajuda a explicar "' + p.subject + '"?'
    ],
    change: [
      p => 'Como "' + p.subject + '" mudou segundo o conteúdo estudado?',
      p => 'Qual transformação é descrita em "' + p.subject + '"?',
      p => 'O que mudou em "' + p.subject + '" ao longo do processo apresentado?'
    ],
    cause: [
      p => 'Que explicação o conteúdo apresenta para o que ocorreu com "' + p.subject + '"?',
      p => 'Qual motivo ajuda a explicar "' + p.subject + '" segundo o resumo?',
      p => 'O que explica o acontecimento envolvendo "' + p.subject + '"?'
    ],
    consequence: [
      p => 'Qual foi a consequência de "' + p.subject + '"?',
      p => 'O que "' + p.subject + '" provocou segundo o conteúdo?',
      p => 'Que efeito aparece associado a "' + p.subject + '"?'
    ],
    explanation: [
      p => 'Como o conteúdo caracteriza "' + p.subject + '"?',
      p => 'Que explicação ajuda a entender "' + p.subject + '"?',
      p => 'Qual característica do conteúdo ajuda a explicar "' + p.subject + '"?'
    ],
    date: [
      p => 'O que aconteceu em ' + p.year + ' segundo o conteúdo?',
      p => 'Qual acontecimento importante está associado a ' + p.year + '?',
      p => 'Que fato do tema é localizado em ' + p.year + '?'
    ],
    general: [
      p => 'Qual característica ou função define "' + p.subject + '" no conteúdo?',
      p => 'Que informação específica ajuda a compreender "' + p.subject + '"?',
      p => 'Qual aspecto de "' + p.subject + '" é destacado no conteúdo?'
    ]
  };

  const meaningfulWords = value => (String(value || '').match(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9-]{3,}/g) || [])
    .map(word => normalize(word))
    .filter(word => !stopWords.has(word) && word.length >= 4);

  const questionLeaksAnswer = (question, answer) => {
    const qNorm = normalize(question);
    const aNorm = normalize(answer);
    if (!aNorm || aNorm.length < 6) return false;
    if (qNorm.includes(aNorm)) return true;

    const answerWords = [...new Set(meaningfulWords(answer))];
    const questionWords = new Set(meaningfulWords(question));
    if (answerWords.length < 3) return false;

    const overlap = answerWords.filter(word => questionWords.has(word)).length / answerWords.length;
    return overlap >= 0.72;
  };

  const answerSimilarity = (a, b) => {
    const aw = new Set(meaningfulWords(a));
    const bw = new Set(meaningfulWords(b));
    if (!aw.size || !bw.size) return 0;
    const intersection = [...aw].filter(word => bw.has(word)).length;
    const union = new Set([...aw, ...bw]).size;
    return intersection / union;
  };

  const candidateLeaksCorrectAnswer = (candidate, answer) => {
    const candidateNorm = normalize(candidate);
    const answerNorm = normalize(answer);
    if (!answerNorm || answerNorm.length < 8) return false;
    if (candidateNorm.includes(answerNorm)) return true;

    const answerWords = [...new Set(meaningfulWords(answer))];
    const candidateWords = new Set(meaningfulWords(candidate));
    if (answerWords.length < 3) return false;

    const overlap = answerWords.filter(word => candidateWords.has(word)).length / answerWords.length;
    return overlap >= 0.88;
  };

  const makeNearMiss = (fact, parts, otherFact) => {
    const otherParts = factParts(otherFact);
    if (normalize(otherFact) === normalize(fact)) return '';

    const targetSubject = cleanLabel(parts.subject || '');
    const otherDetail = cleanAnswer(otherParts.detail || naturalizeAnswer(otherFact, otherParts));

    if (!targetSubject || !otherDetail) return '';

    if (parts.relation === 'sequence' && otherParts.relation === 'sequence' && otherParts.sequence?.length >= 3) {
      return cleanAnswer('A sequência apresentada foi: ' + [parts.sequence[0], ...otherParts.sequence.slice(1)].join(' → '));
    }

    if (parts.relation === 'relation' && otherParts.relation === 'relation') {
      const targetBits = String(parts.detail || '').split(/\s+[→⇒]\s+/).map(x => x.trim()).filter(Boolean);
      const otherBits = String(otherParts.detail || '').split(/\s+[→⇒]\s+/).map(x => x.trim()).filter(Boolean);
      if (targetBits.length >= 2 && otherBits.length >= 2) {
        return cleanAnswer(otherBits[0] + ' levou a ' + otherBits.slice(1).join(' e '));
      }
    }

    if (parts.relation === 'date' && otherParts.relation === 'date') {
      const body = cleanAnswer(naturalizeAnswer(otherFact, otherParts)).replace(/^Em\s+\d{4}[,:-]?\s*/i, '');
      if (body) return cleanAnswer('Em ' + parts.year + ', ' + body);
    }

    if (parts.relation === 'consequence' && otherParts.relation === 'consequence') {
      const otherSentence = cleanAnswer(naturalizeAnswer(otherFact, otherParts));
      const otherDetailPart = otherSentence.split(/\s+provoc(?:ou|aram|am|a)|\s+caus(?:ou|aram|am|a)|\s+lev(?:ou|aram|a)|\s+result(?:ou|aram|a)|\s+permit(?:iu|iram|e)/i).pop().trim();
      if (otherDetailPart && otherDetailPart !== otherSentence) {
        return cleanAnswer(targetSubject + ' ' + otherDetailPart);
      }
    }

    if (['detail','explanation','general','change','relation','consequence'].includes(parts.relation)) {
      return combineLabelAndDetail(targetSubject, otherDetail);
    }

    if (parts.relation === 'date' && otherParts.relation === 'date') {
      const body = cleanAnswer(naturalizeAnswer(otherFact, otherParts)).replace(/^Em\s+\d{4}[,:-]?\s*/i, '');
      if (body) return cleanAnswer('Em ' + parts.year + ', ' + body);
    }

    return cleanAnswer(naturalizeAnswer(otherFact, otherParts));
  };

  const scoreDistractor = (answer, question, candidate) => {
    const similarity = answerSimilarity(answer, candidate);
    const lengthDelta = Math.abs(answer.length - candidate.length);
    const wordOverlap = [...new Set(meaningfulWords(candidate))].filter(word => normalize(question).includes(word)).length;
    return similarity * 10 + Math.max(0, 8 - lengthDelta / 25) + wordOverlap * 0.2;
  };

  const makeDetailedQuestion = (fact, facts, seed, preferredFacts = facts) => {
    const parts = factParts(fact);
    const answer = cleanAnswer(naturalizeAnswer(fact, parts));
    const templates = questionTemplates[parts.relation] || questionTemplates.general;

    let question = '';
    for (let attempt = 0; attempt < templates.length; attempt++) {
      const templateIndex = (Math.abs(Number(seed) || 0) + attempt) % templates.length;
      const candidateQuestion = templates[templateIndex](parts);
      if (
        candidateQuestion.length >= 45 &&
        !isStudyMeta(candidateQuestion) &&
        !questionLeaksAnswer(candidateQuestion, answer)
      ) {
        question = candidateQuestion;
        break;
      }
    }

    if (!question || !answer || isFragment(answer)) return null;

    const targetSubject = cleanLabel(parts.subject || '');
    const pool = unique([...preferredFacts, ...facts])
      .filter(other => normalize(other) !== normalize(fact))
      .map(other => {
        const otherParts = factParts(other);
        const otherAnswer = cleanAnswer(naturalizeAnswer(other, otherParts));
        const nearMiss = makeNearMiss(fact, parts, other);
        const candidate = cleanAnswer(nearMiss || otherAnswer);
        const subjectBoost = targetSubject.length >= 5 && normalize(candidate).includes(normalize(targetSubject)) ? 4 : 0;
        return { other, candidate, similarity: scoreDistractor(answer, question, candidate) + subjectBoost };
      })
      .filter(item => item.candidate)
      .filter(item => !isStudyMeta(item.candidate))
      .filter(item => !isFragment(item.candidate))
      .filter(item => normalize(item.candidate) !== normalize(answer))
      .filter(item => !candidateLeaksCorrectAnswer(item.candidate, answer))
      .sort((a,b) => b.similarity - a.similarity);

    const distinct = [];
    for (const item of pool) {
      if (distinct.some(existing => normalize(existing) === normalize(item.candidate))) continue;
      // Evita que todos os distratores sejam praticamente iguais à correta.
      if (answerSimilarity(answer, item.candidate) > 0.94) continue;
      distinct.push(item);
      if (distinct.length === 3) break;
    }

    // Complete a cota usando respostas integrais do próprio resumo.
    if (distinct.length < 3) {
      for (const item of pool) {
        if (distinct.some(existing => normalize(existing) === normalize(item.candidate))) continue;
        if (answerSimilarity(answer, item.candidate) > 0.97) continue;
        distinct.push(item);
        if (distinct.length === 3) break;
      }
    }

    const alternatives = shuffle(unique([answer, ...distinct.map(item => item.candidate)]));
    if (alternatives.length !== 4) return null;

    return {
      question,
      answer,
      alternatives,
      sourceFact: fact,
      explanation: 'A resposta é sustentada diretamente pelo trecho do resumo: "' + shorten(fact) + '"'
    };
  };

  const generateQuizFromText = (text, desiredCount) => {
    const facts = splitFacts(text);
    if (facts.length < 5) throw new Error('Não encontrei informações suficientes neste resumo para criar o quiz.');

    const count = Math.min(facts.length, 8, Math.max(5, Number(desiredCount) || 6));
    const questions = [];
    const used = new Set();
    const usedQuestions = new Set();

    const relationRank = {
      sequence: 8,
      relation: 7,
      change: 6,
      consequence: 6,
      cause: 6,
      detail: 5,
      explanation: 5,
      date: 5,
      general: 3
    };

    const orderedFacts = shuffle(facts).sort((a,b) => {
      return (relationRank[factParts(b).relation] || 0) - (relationRank[factParts(a).relation] || 0);
    });

    for (let i = 0; i < orderedFacts.length && questions.length < count; i++) {
      const fact = orderedFacts[i];
      const key = normalize(fact);
      if (used.has(key)) continue;

      let q = null;
      for (let attempt = 0; attempt < 16; attempt++) {
        const candidate = makeDetailedQuestion(
          fact,
          facts,
          i * 17 + attempt + Math.floor(Math.random() * 1000)
        );
        if (!candidate) continue;
        const questionKey = normalize(candidate.question);
        if (usedQuestions.has(questionKey)) continue;
        q = candidate;
        break;
      }

      if (!q) continue;

      questions.push(q);
      used.add(key);
      usedQuestions.add(normalize(q.question));
    }

    if (questions.length < 5) throw new Error('Não foi possível montar 5 perguntas confiáveis a partir do resumo.');
    return shuffle(questions).slice(0, count).map((q, i) => ({ id: i + 1, ...q }));
  };

  const generateHybridQuiz = (summaryText, guideText, desiredCount) => {
    const facts = splitFacts(summaryText);
    if (facts.length < 5) throw new Error('Não encontrei informações suficientes neste resumo para criar o quiz.');

    const count = Math.min(facts.length, 8, Math.max(5, Number(desiredCount) || 6));
    const guideTopics = splitStudyGuide(guideText);

    if (!guideTopics.length) {
      return generateQuizFromText(summaryText, count);
    }

    const ranked = rankFactsByGuide(facts, guideTopics);
    const targeted = ranked.filter(item => item.score > 0).map(item => item.fact);
    const nonTargeted = facts.filter(fact => !targeted.includes(fact));
    const targetQuota = Math.min(targeted.length, Math.max(1, Math.ceil(count * 0.7)));

    const selectedFacts = unique([
      ...shuffle(targeted).slice(0, targetQuota),
      ...shuffle(nonTargeted).slice(0, count - targetQuota)
    ]);

    if (selectedFacts.length < count) {
      const remaining = ranked
        .map(item => item.fact)
        .filter(fact => !selectedFacts.includes(fact));
      selectedFacts.push(...shuffle(remaining).slice(0, count - selectedFacts.length));
    }

    // A lista de fallback garante que uma questão inválida não reduza o quiz inteiro.
    const candidateFacts = unique([
      ...selectedFacts,
      ...ranked.map(item => item.fact),
      ...facts
    ]);

    const questions = [];
    const usedQuestions = new Set();
    const usedFacts = new Set();

    for (let i = 0; i < candidateFacts.length && questions.length < count; i++) {
      const fact = candidateFacts[i];
      const factKey = normalize(fact);
      if (usedFacts.has(factKey)) continue;

      for (let attempt = 0; attempt < 18; attempt++) {
        const guideMatch = scoreFactAgainstGuide(fact, guideTopics);
        const preferredFacts = ranked
          .filter(item => guideMatch.topic && item.topic === guideMatch.topic)
          .map(item => item.fact);

        const q = makeDetailedQuestion(
          fact,
          facts,
          i * 31 + attempt + Math.floor(Math.random() * 3000),
          preferredFacts.length ? preferredFacts : facts
        );
        if (!q) continue;

        const questionKey = normalize(q.question);
        if (usedQuestions.has(questionKey)) continue;

        q.guideTopic = guideMatch.score > 0 ? guideMatch.topic : '';
        questions.push(q);
        usedQuestions.add(questionKey);
        usedFacts.add(factKey);
        break;
      }
    }

    if (questions.length < Math.min(5, count)) {
      return generateQuizFromText(summaryText, count);
    }

    return shuffle(questions).slice(0, count).map((q, i) => ({ id: i + 1, ...q }));
  };

  window.nexaQuizEngine = {
    htmlToText,
    splitFacts,
    keywords,
    factParts,
    answerUnit,
    questionLeaksAnswer,
    assemblePdfText,
    generateQuizFromText,
    generateHybridQuiz,
    candidateLeaksCorrectAnswer,
    splitStudyGuide,
    scoreFactAgainstGuide,
    rankFactsByGuide,
    isStudyMeta,
    isFragment,
    answerSimilarity
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