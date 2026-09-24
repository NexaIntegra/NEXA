const fs = require('fs');
const vm = require('vm');

global.document = undefined;
global.Element = class {};
global.window = { document: null };

require('./quiz-live.js');

const engine = window.nexaQuizEngine;
if (!engine) throw new Error('Quiz engine não carregou');
if (typeof engine.generateHybridQuiz !== 'function') throw new Error('Quiz híbrido ausente');
if (typeof engine.shortAnswerForFact !== 'function') throw new Error('Extrator de resposta curta ausente');
if (typeof engine.candidateLeaksCorrectAnswer !== 'function') throw new Error('Validador de distratores ausente');

const normalize = value => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const forbidden = /qual alternativa está de acordo com o resumo|qual afirmação descreve corretamente|\bSobre "/i;
const meta = /boa prova|para decorar|lembre-se|memorize|ideia para decorar/i;
const fragment = /\b(?:de|do|da|dos|das|e|ou|para|com|por|que|como|em|no|na|nos|nas|ao|a|à)\.?$/i;

const samples = [
  {
    name: 'historia',
    count: 8,
    guide: `Mineração
Abertura dos Portos
1815
Independência`,
    text: `Eixo econômico mudou do Nordeste (açúcar) para o Centro-Sul (Minas Gerais).
Povoamento do interior → fronteiras ampliadas.
Surgimento de vilas e cidades → vida urbana nova.
Tropeiros ligavam regiões → formação de mercado interno.
Intendência das Minas (1702): órgão de controle e fiscalização.
Quinto: 20% de todo ouro pertencia ao Rei.
Casas de Fundição: ouro derretido e tributado — proibido ouro em pó.
Abertura dos Portos (1808): fim do monopólio → comércio livre.
Tratados de 1810: produtos ingleses mais baratos → indústria brasileira prejudicada.
1815: Brasil = Reino Unido a Portugal → deixa de ser colônia.
1821: D. João volta; D. Pedro fica no Brasil.
7 Set 1822 — Independência: Grito do Ipiranga → Império do Brasil.`
  },
  {
    name: 'biologia',
    count: 6,
    guide: `Fotossíntese
Clorofila
Estômatos
Xilema`,
    text: `A fotossíntese ocorre nos cloroplastos das células vegetais.
A clorofila absorve energia luminosa e participa da produção de matéria orgânica.
O gás carbônico entra nas folhas pelos estômatos.
A água é absorvida principalmente pelas raízes e transportada pelo xilema.
Durante o processo, oxigênio é liberado para o ambiente.
A fotossíntese contribui para a cadeia alimentar porque produz matéria orgânica.
A respiração celular ocorre nas células e produz energia para seu funcionamento.`
  },
  {
    name: 'pergunta_embutida',
    count: 5,
    guide: `Família Real
Abertura dos Portos
Tratados de 1810`,
    text: `Por que a Família Real veio para o Brasil?: A Família Real portuguesa deixou Portugal por causa das invasões napoleônicas.
A Abertura dos Portos permitiu o comércio com outras nações.
Os Tratados de 1810 favoreceram produtos ingleses.
A chegada da Corte provocou mudanças políticas.
O comércio colonial era controlado por Portugal.`
  }
];

let generated = 0;

for (const sample of samples) {
  const facts = engine.splitFacts(sample.text);
  if (facts.length < sample.count) throw new Error(sample.name + ': fatos insuficientes');

  for (let run = 0; run < 600; run++) {
    const quiz = engine.generateHybridQuiz(sample.text, sample.guide, sample.count);

    if (quiz.length !== sample.count) throw new Error(sample.name + ': quantidade incorreta');
    if (new Set(quiz.map(q => normalize(q.question))).size !== quiz.length) {
      throw new Error(sample.name + ': pergunta repetida');
    }

    for (const q of quiz) {
      generated++;

      if (q.alternatives.length !== 4) throw new Error(sample.name + ': não há 4 alternativas');
      if (new Set(q.alternatives.map(normalize)).size !== 4) throw new Error(sample.name + ': alternativa repetida');
      if (!q.alternatives.some(option => normalize(option) === normalize(q.answer))) {
        throw new Error(sample.name + ': resposta correta ausente');
      }

      const subject = engine.factParts(q.sourceFact).subject || '';
      if (engine.questionLeaksAnswer(q.question, q.answer, subject)) {
        throw new Error(sample.name + ': resposta vazou no enunciado');
      }

      const wrong = q.alternatives.filter(option => normalize(option) !== normalize(q.answer));
      if (wrong.some(option => engine.candidateLeaksCorrectAnswer(option, q.answer))) {
        throw new Error(sample.name + ': distrator contém a resposta');
      }

      if (forbidden.test(q.question)) throw new Error(sample.name + ': pergunta antiga');
      if (meta.test(q.question) || q.alternatives.some(option => meta.test(option))) {
        throw new Error(sample.name + ': texto de decoração entrou no quiz');
      }
      if (q.alternatives.some(option => String(option).trim().length < 14 || fragment.test(String(option).trim()))) {
        throw new Error(sample.name + ': alternativa cortada');
      }
    }
  }
}

for (let run = 0; run < 300; run++) {
  const quiz = engine.generateHybridQuiz(samples[1].text, '', 6);
  if (quiz.length !== 6 || quiz.some(q => q.guideTopic)) throw new Error('fallback sem roteiro falhou');
}

const promptProbe = engine.generateHybridQuiz(samples[2].text, samples[2].guide, 5);
if (!promptProbe.some(q => /^Por que a Família Real veio para o Brasil\?$/i.test(q.question))) {
  throw new Error('pergunta pronta do resumo não foi preservada');
}
if (promptProbe.some(q => /^Por que a:/i.test(q.question) || q.alternatives.some(a => /^Por que a:/i.test(a)))) {
  throw new Error('fragmento "Por que a:" encontrado');
}

const parsedExamples = [
  'A fotossíntese ocorre nos cloroplastos das células vegetais.',
  'A clorofila absorve energia luminosa e participa da produção de matéria orgânica.',
  'O gás carbônico entra nas folhas pelos estômatos.',
  'A água é absorvida principalmente pelas raízes e transportada pelo xilema.',
  'Durante o processo, oxigênio é liberado para o ambiente.'
];

for (const factText of parsedExamples) {
  const fact = engine.splitFacts(factText)[0];
  const answer = engine.shortAnswerForFact(fact);
  if (!answer || answer.length < 10) throw new Error('resposta curta inválida: ' + factText);
}

const indexHtml = fs.readFileSync('index.html', 'utf8');
if ((indexHtml.match(/id="aiQuizButton"/g) || []).length !== 1) throw new Error('botão do quiz inválido');
if ((indexHtml.match(/id="quizDialog"/g) || []).length !== 1) throw new Error('dialog do quiz inválido');

const bootstrapSource = fs.readFileSync('quiz-bootstrap.js', 'utf8');
const handlers = [];
class FakeElement {
  closest(selector) {
    return selector === '#aiQuizButton' ? this : null;
  }
}

vm.runInNewContext(bootstrapSource, {
  document: {
    querySelector() { return null; },
    addEventListener(type, handler, capture) {
      if (type === 'click' && capture === true) handlers.push(handler);
    }
  },
  window: {
    nexaQuizOpen() {
      global.__openCalled = true;
    }
  },
  Element: FakeElement,
  console
});

if (handlers.length !== 1) throw new Error('listener do botão não foi registrado');

global.__openCalled = false;
handlers[0]({
  target: new FakeElement(),
  preventDefault() {},
  stopImmediatePropagation() {}
});

if (!global.__openCalled) throw new Error('clique do botão não chamou o quiz');

console.log('QUIZ TEST OK - ' + generated + ' gerações, parser, alternativas, anti-vazamento e botão');
