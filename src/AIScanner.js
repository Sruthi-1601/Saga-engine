// AIScanner.js — SAGA Engine AI Document Scanner
// 100% browser-based. No API key. No server. No cost.
// Stack:
//   • PDF.js       — extract text from PDFs
//   • Tesseract.js — OCR text from images
//   • Transformers.js (Xenova/flan-t5-base) — AI question generation
//   • Comprehension engine — grammar-pattern question extraction from real facts

import MessageBus from './MessageBus.js';

// ─── CDN urls (loaded lazily) ────────────────────────────────────────────────
const PDFJS_URL        = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER     = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const TESSERACT_URL    = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js';
const MAMMOTH_URL      = 'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js';

// ─── lazy script loader ──────────────────────────────────────────────────────
const _loaded = {};
function loadScript(url) {
  if (_loaded[url]) return _loaded[url];
  _loaded[url] = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.onload  = resolve;
    s.onerror = () => reject(new Error(`Failed to load: ${url}`));
    document.head.appendChild(s);
  });
  return _loaded[url];
}

// ─── PDF text extraction ─────────────────────────────────────────────────────
async function extractPDFText(file) {
  await loadScript(PDFJS_URL);
  const pdfjsLib = window['pdfjs-dist/build/pdf'];
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';
  const maxPages = Math.min(pdf.numPages, 8);
  for (let i = 1; i <= maxPages; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map(item => item.str).join(' ') + '\n';
  }
  return fullText.trim();
}

// ─── Image OCR ───────────────────────────────────────────────────────────────
async function extractImageText(file) {
  await loadScript(TESSERACT_URL);
  updateProgress('Running OCR on image…', 20);
  const result = await Tesseract.recognize(file, 'eng', {
    logger: m => {
      if (m.status === 'recognizing text') {
        updateProgress(`OCR: ${Math.round(m.progress * 100)}%`, 10 + Math.round(m.progress * 30));
      }
    }
  });
  return result.data.text.trim();
}

// ─── Word (.docx) extraction via mammoth.js ──────────────────────────────────
async function extractDocxText(file) {
  await loadScript(MAMMOTH_URL);
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value || '';
  if (!text.trim()) throw new Error('Could not extract text from this Word file. Make sure it is not password protected.');
  return text.trim();
}

// ─── Plain text (.txt etc.) ───────────────────────────────────────────────────
function extractPlainText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result || '');
    reader.onerror = () => reject(new Error('Cannot read file'));
    reader.readAsText(file);
  });
}

// ─── Transformers.js model ───────────────────────────────────────────────────
let _pipeline       = null;
let _pipelineLoading = false;

async function loadModel() {
  if (_pipeline) return _pipeline;
  if (_pipelineLoading) {
    while (_pipelineLoading) await new Promise(r => setTimeout(r, 300));
    return _pipeline;
  }
  _pipelineLoading = true;
  try {
    await loadScript(TRANSFORMERS_URL);
    // Transformers.js exposes itself as window.Transformers or transformers
    const lib = window.Transformers || window.transformers;
    if (!lib) throw new Error('Transformers.js not found on window');
    const { pipeline, env } = lib;
    env.backends.onnx.wasm.numThreads = 2;
    updateProgress('Downloading AI model (first time only, ~80 MB)…', 40);
    _pipeline = await pipeline('text2text-generation', 'Xenova/flan-t5-base', {
      progress_callback: (p) => {
        if (p.status === 'downloading' && p.total) {
          const pct = Math.round((p.loaded / p.total) * 30);
          updateProgress(`Downloading AI model… ${pct}%`, 40 + pct);
        }
      }
    });
    _pipelineLoading = false;
    return _pipeline;
  } catch (e) {
    _pipelineLoading = false;
    console.warn('[AIScanner] Transformers.js failed, using NLP fallback:', e.message);
    return null;
  }
}

async function generateWithModel(pipe, text, prompt) {
  const input = `${prompt}\n\nContext: ${text.slice(0, 600)}`;
  const out   = await pipe(input, { max_new_tokens: 100, num_beams: 2 });
  return out[0]?.generated_text?.trim() || '';
}

// ─── Comprehension-based Question Engine ─────────────────────────────────────
// Generates exam-revision questions from actual facts in the document.
// 5 extractors parse grammatical patterns (definition, cause, composition,
// numeric fact, process). Distractors come from other answers in the same
// document so they are plausible, not random.

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getSentences(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, ' . ')
    .replace(/([.!?])\s+/g, '$1\n')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 30 && s.split(/\s+/).length >= 5 && s.split(/\s+/).length <= 60);
}

// ── 5 fact extractors ─────────────────────────────────────────────────────────

function tryDefinition(sent) {
  const m = sent.match(/^([A-Z][\w\s,()-]{2,40})\s+(?:is|are|was|were|refers to|means|defined as)\s+(.{15,120})/i);
  if (!m) return null;
  const subject    = m[1].trim();
  const definition = m[2].replace(/[.!?]+$/, '').trim();
  if (subject.split(' ').length > 6) return null;
  return { question: `What is ${subject}?`, answer: definition.slice(0, 80), hint: sent, type: 'definition', subject };
}

function tryCause(sent) {
  const m = sent.match(/([A-Z][\w\s,]{2,50})\s+(?:causes?|leads? to|results? in|produces?|triggers?|creates?)\s+(.{10,100})/i);
  if (!m) return null;
  const cause  = m[1].trim();
  const effect = m[2].replace(/[.!?]+$/, '').trim();
  if (cause.split(' ').length > 7) return null;
  return { question: `What does ${cause} cause or lead to?`, answer: effect.slice(0, 80), hint: sent, type: 'cause', subject: cause };
}

function tryComposition(sent) {
  const m = sent.match(/([A-Z][\w\s,]{2,50})\s+(?:contains?|consists? of|has|have|includes?|is made of|is composed of)\s+(.{10,100})/i);
  if (!m) return null;
  const subject = m[1].trim();
  const content = m[2].replace(/[.!?]+$/, '').trim();
  if (subject.split(' ').length > 7) return null;
  return { question: `What does ${subject} contain or consist of?`, answer: content.slice(0, 80), hint: sent, type: 'composition', subject };
}

function tryNumericFact(sent) {
  const m = sent.match(/([A-Z][\w\s,()-]{2,50})\s+(?:is|was|are|were)\s+((?:approximately|about|around|nearly|exactly|over|under)?\s*[\d,./\-]+[\w%°$]*[\w\s]{0,40})/i);
  if (!m) return null;
  const subject = m[1].trim();
  const value   = m[2].trim().replace(/[.!?]+$/, '');
  if (!/\d/.test(value)) return null;
  if (subject.split(' ').length > 7) return null;
  return { question: `What is the ${subject.toLowerCase()}?`, answer: value, hint: sent, type: 'numeric', subject };
}

function tryProcess(sent) {
  const m = sent.match(/^(?:In|During|After|Before|When|While)\s+([\w\s,]{3,40}),\s+(.{15,120})/i);
  if (!m) return null;
  const context = m[1].trim();
  const event   = m[2].replace(/[.!?]+$/, '').trim();
  return { question: `What happens during ${context}?`, answer: event.slice(0, 80), hint: sent, type: 'process', subject: context };
}

// ── Distractor builder ────────────────────────────────────────────────────────
function buildDistractors(correct, allFacts, type, n = 3) {
  const sameType = allFacts.filter(f => f.type === type && f.answer !== correct).map(f => f.answer);
  const anyType  = allFacts.filter(f => f.answer !== correct).map(f => f.answer);
  const pool     = [...new Set([...sameType, ...anyType])].sort(() => Math.random() - 0.5);

  const result = [];
  for (const d of pool) {
    if (result.length >= n) break;
    const lenRatio = d.length / Math.max(correct.length, 1);
    if (lenRatio < 0.25 || lenRatio > 4) continue;
    result.push(d);
  }

  const fallbacks = ['None of the above', 'All of the above', 'Cannot be determined', 'Not stated in the document'];
  let fi = 0;
  while (result.length < n) result.push(fallbacks[fi++ % fallbacks.length]);
  return result;
}

// ── Main builders ─────────────────────────────────────────────────────────────
function buildSmartQuestions(text, count = 10) {
  const sentences  = getSentences(text);
  const extractors = [tryDefinition, tryCause, tryComposition, tryNumericFact, tryProcess];

  const allFacts = [];
  for (const sent of sentences) {
    for (const fn of extractors) {
      const fact = fn(sent);
      if (fact) { allFacts.push(fact); break; }
    }
  }

  if (allFacts.length === 0) return [];

  // Deduplicate by answer
  const seen   = new Set();
  const unique = allFacts.filter(f => {
    const key = f.answer.toLowerCase().slice(0, 25);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, count).map((fact, i) => {
    const distractors = buildDistractors(fact.answer, unique, fact.type, 3);
    const options     = shuffle([fact.answer, ...distractors]);
    const diff        = i < Math.floor(count * 0.35) ? 'easy' : i < Math.floor(count * 0.70) ? 'medium' : 'hard';
    return {
      id:         i + 1,
      question:   fact.question,
      options,
      answer:     fact.answer,
      points:     diff === 'easy' ? 10 : diff === 'medium' ? 15 : 20,
      timeLimit:  diff === 'easy' ? 30 : diff === 'medium' ? 25 : 20,
      difficulty: diff,
      hint:       fact.hint.slice(0, 120),
      nodeStory:  `The path depends on what you know about: ${fact.subject || 'this topic'}.`,
    };
  });
}

function buildSmartPairs(text, count = 8) {
  const sentences = getSentences(text);
  const pairs     = [];
  const usedTerms = new Set();

  for (const sent of sentences) {
    if (pairs.length >= count) break;
    const fact = tryDefinition(sent);
    if (!fact) continue;
    const term = fact.subject;
    if (usedTerms.has(term.toLowerCase())) continue;
    usedTerms.add(term.toLowerCase());
    pairs.push({ term, definition: fact.answer });
  }
  return pairs;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function deriveTitle(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  return lines.find(l => l.length > 3 && l.length < 80) || 'Uploaded Document';
}

function deriveIcon(title) {
  const t = title.toLowerCase();
  if (/science|bio|chem|physic|lab/.test(t))    return '🔬';
  if (/history|war|ancient|civil/.test(t))       return '🏛️';
  if (/math|algebra|calculus|geometry/.test(t))  return '📐';
  if (/geo|earth|climate|environ/.test(t))       return '🌍';
  if (/law|legal|court|constit/.test(t))         return '⚖️';
  if (/tech|comp|software|code/.test(t))         return '💻';
  if (/econ|finance|market|trade/.test(t))       return '📈';
  if (/lit|novel|poem|story|book/.test(t))       return '📚';
  return '📄';
}

function updateProgress(msg, pct) {
  MessageBus.emit('ai:progress', { message: msg, percent: pct });
  const el = document.getElementById('ai-status');
  if (!el) return;
  el.innerHTML = `
    <div class="ai-status-scanning">
      <div class="ai-spinner"></div>
      <div style="flex:1">
        <div class="ai-status-title">${msg}</div>
        <div class="ai-status-bar-wrap">
          <div class="ai-status-bar" style="width:${pct}%"></div>
        </div>
      </div>
    </div>`;
}

// ─── SAGA config builder ──────────────────────────────────────────────────────
const QUEST_TITLES = [
  'Launch Pad','Orbit Station','Moon Base','Asteroid Belt',
  'Deep Space','Nebula Gate','Star Forge','Galactic Core'
];

function buildNodes(questions) {
  return questions.map((q, i) => ({
    id:      i + 1,
    title:   QUEST_TITLES[i] || `Sector ${i + 1}`,
    story:   q.nodeStory || `Challenge ${i + 1}: answer to advance!`,
    question: q.question,
    options:  q.options,
    answer:   q.answer,
    points:   q.points || 10,
    hint:     q.hint   || '',
    unlocks:  i + 1 < questions.length ? (QUEST_TITLES[i + 1] || `Sector ${i + 2}`) : 'Victory',
  }));
}

function buildSagaConfig(questions, pairs, title) {
  return {
    engine: 'saga',
    mode:   'NeuronRush',
    metadata: {
      title,
      subject: title,
      grade:   window._sagaConfig?.metadata?.grade || 9,
      author:  'SAGA AI Scanner',
    },
    theme:     window._sagaConfig?.theme     || 'space',
    mechanics: window._sagaConfig?.mechanics || {
      timer: true, timerSeconds: 30, lives: 3,
      adaptiveDifficulty: true, messageBus: true,
      streakBonus: true, scoreMultiplier: 1.5,
    },
    subjects: window._sagaConfig?.subjects || {},
    content: { questions, nodes: buildNodes(questions), pairs: pairs.slice(0, 8) },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────
const AIScanner = {

  init() {
    console.log('[AIScanner] ready — Transformers.js (no API key, fully browser-based)');
    // Pre-warm model silently in background after 3s
    setTimeout(() => loadModel().catch(() => {}), 3000);
  },

  async scanDocument(file) {
    MessageBus.emit('ai:scanning', { fileName: file.name });

    try {
      // ── 1. Extract text ───────────────────────────────────
      const ext  = file.name.split('.').pop().toLowerCase();
      const mime = file.type || '';
      let text   = '';

      if (ext === 'pdf' || mime === 'application/pdf') {
        updateProgress('Extracting text from PDF…', 10);
        text = await extractPDFText(file);
      } else if (['png','jpg','jpeg','webp'].includes(ext) || mime.startsWith('image/')) {
        updateProgress('Starting OCR on image…', 10);
        text = await extractImageText(file);
      } else if (['doc','docx'].includes(ext) || mime.includes('wordprocessingml') || mime.includes('msword')) {
        updateProgress('Extracting text from Word document…', 15);
        text = await extractDocxText(file);
      } else {
        updateProgress('Reading document text…', 15);
        text = await extractPlainText(file);
      }

      if (!text || text.trim().length < 50) {
        throw new Error('Could not extract enough text. Try a text-based PDF or a clearer image.');
      }

      const title = deriveTitle(text);
      const icon  = deriveIcon(title);

      // ── 2. Try AI model, fall back to NLP ────────────────
      updateProgress('Loading AI model…', 35);
      const pipe = await loadModel();
      let questions, pairs;

      // Extract comprehension questions from document facts
      // (Transformers model not needed — grammar-pattern engine handles this)
      updateProgress('Extracting facts and building questions…', 65);
      questions = buildSmartQuestions(text, 10);
      pairs     = buildSmartPairs(text, 8);

      // If model loaded, optionally use it to rephrase ambiguous questions
      if (pipe && questions.length > 0) {
        updateProgress('Polishing questions with AI…', 82);
        for (let i = 0; i < Math.min(3, questions.length); i++) {
          try {
            const prompt   = `Rewrite this exam question more clearly: ${questions[i].question}`;
            const improved = await generateWithModel(pipe, text, prompt);
            if (improved && improved.length > 15 && improved.includes('?')) {
              questions[i].question = improved;
            }
          } catch (_) { /* keep original */ }
        }
      }

      if (questions.length < 2) {
        throw new Error(
          'Not enough factual sentences found. Make sure your document has clear statements like ' +
          '"X is Y", "X causes Y", or "X consists of Y" — revision notes, textbooks, and articles work best.'
        );
      }

      updateProgress('Building your game…', 96);
      const config = buildSagaConfig(questions, pairs, title);
      MessageBus.emit('ai:done', { config });
      return config;

    } catch (err) {
      MessageBus.emit('ai:error', { message: err.message });
      throw err;
    }
  },
};

export default AIScanner;
