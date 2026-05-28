import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import natural from 'natural';
import wordList from 'word-list-json';
import commonWords from 'common-english-words';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const outputPath = join(rootDir, 'data', 'ielts_5000_words.json');
const targetSize = 5200;
const wordNet = new natural.WordNet();

const importantWords = [
  'analyse',
  'approach',
  'assessment',
  'assumption',
  'authority',
  'benefit',
  'capacity',
  'community',
  'complex',
  'consequence',
  'consistent',
  'context',
  'criteria',
  'decline',
  'demonstrate',
  'derive',
  'distinct',
  'economy',
  'environment',
  'establish',
  'evidence',
  'factor',
  'function',
  'indicate',
  'individual',
  'interpret',
  'involve',
  'issue',
  'labour',
  'method',
  'occur',
  'policy',
  'principle',
  'process',
  'require',
  'research',
  'response',
  'sector',
  'significant',
  'similar',
  'specific',
  'structure',
  'theory',
  'variable',
];

const banned = new Set([
  'aint',
  'arse',
  'ass',
  'bitch',
  'bollocks',
  'crap',
  'damn',
  'fuck',
  'hell',
  'porn',
  'sex',
]);

const lexTopics = [
  '学术表达',
  '教育与学习',
  '科技与社会',
  '政府与政策',
  '环境与能源',
  '经济与工作',
  '健康与生活',
  '文化与媒体',
  '城市与交通',
  '研究与数据',
];

const posMap = {
  a: 'adj.',
  r: 'adv.',
  n: 'n.',
  v: 'v.',
  s: 'adj.',
};

const common = await getCommonWords();
const candidates = buildCandidates(common);
const entries = [];
const seen = new Set();

for (let index = 0; index < candidates.length && entries.length < targetSize; index += 120) {
  const batch = candidates.slice(index, index + 120).filter((word) => !seen.has(word));
  const results = await Promise.all(
    batch.map(async (word) => {
      const synsets = await lookup(word);
      const best = chooseSynset(synsets, word);
      return best ? { word, best } : null;
    }),
  );

  for (const result of results) {
    if (!result || seen.has(result.word) || entries.length >= targetSize) continue;
    entries.push(toEntry(result.word, result.best, entries.length));
    seen.add(result.word);
  }

  if (entries.length && entries.length % 600 < 120) {
    console.log(`Collected ${entries.length}/${targetSize} words...`);
  }
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(entries, null, 2));
console.log(`Generated ${entries.length} IELTS-oriented words at ${outputPath}`);

function getCommonWords() {
  return new Promise((resolve, reject) => {
    commonWords.getWords((error, words) => {
      if (error) reject(error);
      else resolve(words.filter(Boolean));
    });
  });
}

function buildCandidates(common) {
  const normalized = new Set();
  const ranked = [];

  for (const word of [...importantWords, ...common, ...wordList]) {
    const item = String(word).toLowerCase().trim();
    if (!isCandidate(item) || normalized.has(item)) continue;
    normalized.add(item);
    ranked.push(item);
  }

  return ranked.sort((left, right) => score(right) - score(left) || left.localeCompare(right));
}

function isCandidate(word) {
  return (
    /^[a-z]+$/.test(word) &&
    word.length >= 4 &&
    word.length <= 14 &&
    !banned.has(word) &&
    !word.endsWith('nesses') &&
    !word.endsWith('ships') &&
    !word.endsWith('lessly')
  );
}

function score(word) {
  let value = 0;
  if (importantWords.includes(word)) value += 1000;
  if (word.length >= 6 && word.length <= 10) value += 12;
  if (/(tion|sion|ment|ance|ence|ity|ism|ist|ive|able|ible|al|ary|ate|ise|ize|ous|ic)$/.test(word)) value += 18;
  if (/(ing|ed|er|est|ly)$/.test(word)) value -= 4;
  if (word.length < 5) value -= 5;
  return value;
}

function lookup(word) {
  return new Promise((resolve) => {
    wordNet.lookup(word, (results) => resolve(results ?? []));
  });
}

function chooseSynset(synsets, word) {
  return synsets
    .filter((item) => item.def && item.synonyms?.length)
    .map((item, index) => ({ item, index }))
    .sort((left, right) => synsetScore(right.item, word, right.index) - synsetScore(left.item, word, left.index))[0]?.item;
}

function synsetScore(item, word, index) {
  let value = Math.max(0, 16 - index * 3);
  const def = String(item.def).toLowerCase();
  if (item.lemma === word) value += 8;
  if (['n', 'v', 'a', 's'].includes(item.pos)) value += 5;
  if (item.exp?.length) value += 3;
  if (def.length >= 45 && def.length <= 160) value += 3;
  if (/(analyse|analysis|consider|judge|assess|condition|environment|effect|process|system|method|policy|social|economic|scientific|research|evidence|change|develop|quality|value|important|necessary)/.test(def)) {
    value += 6;
  }
  if (/(psychoanalytic|payable|church|slang|obsolete)/.test(def)) value -= 12;
  return value;
}

function toEntry(word, synset, index) {
  const topic = lexTopics[index % lexTopics.length];
  const level = index < 1800 ? '基础' : index < 3800 ? '高频' : '进阶';
  const synonyms = [...new Set((synset.synonyms ?? []).map((item) => item.replaceAll('_', ' ')).filter((item) => item !== word))];
  const exp = synset.exp?.[0]?.replaceAll('_', ' ');

  return {
    word,
    phonetic: `/${word}/`,
    pos: posMap[synset.pos] ?? 'n.',
    meaning: `英语释义：${synset.def}`,
    english: synset.def,
    example: exp || `In IELTS tasks, candidates may use "${word}" to express an academic idea clearly.`,
    exampleCn: '雅思语境：该词可用于写作、阅读或听力中的观点表达。',
    collocations: buildCollocations(word, synset.pos),
    synonyms: synonyms.slice(0, 4).length ? synonyms.slice(0, 4) : ['related term', 'academic expression'],
    topic,
    level,
  };
}

function buildCollocations(word, pos) {
  if (pos === 'v') return [`${word} effectively`, `${word} the issue`, `${word} in practice`];
  if (pos === 'a' || pos === 's') return [`${word} approach`, `${word} factor`, `${word} outcome`];
  if (pos === 'r') return [`argue ${word}`, `change ${word}`, `respond ${word}`];
  return [`${word} in society`, `${word} policy`, `${word} research`];
}
