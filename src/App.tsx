import {
  ArrowLeftRight,
  BarChart3,
  BookOpenCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  Flame,
  Layers3,
  Library,
  ListFilter,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Star,
  Target,
  UserRound,
  Volume2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type Level = '基础' | '高频' | '进阶';
type Status = 'new' | 'learning' | 'mastered';

type User = {
  id: number;
  name: string;
  targetBand: string;
  dailyTarget: number;
};

type Progress = {
  status: Status;
  seen: number;
  correct: number;
  lastSeen: string;
};

type Word = {
  id: number;
  word: string;
  phonetic: string;
  pos: string;
  meaning: string;
  english: string;
  example: string;
  exampleCn: string;
  collocations: string[];
  synonyms: string[];
  topic: string;
  level: Level;
  progress: Progress;
};

type BootstrapPayload = {
  user: User;
  words: Word[];
};

type StaticWord = Omit<Word, 'id' | 'progress'>;
type ProgressMap = Record<string, Progress>;
type DataMode = 'api' | 'static';

const filters = ['全部', '基础', '高频', '进阶'] as const;
const emptyProgress: Progress = { status: 'new', seen: 0, correct: 0, lastSeen: '' };
const defaultUser: User = { id: 1, name: 'IELTS Learner', targetBand: '7.0', dailyTarget: 12 };
const staticUserKey = 'lexora-static-user';
const staticProgressKey = 'lexora-static-progress';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<T>;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [draftUser, setDraftUser] = useState<User | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<(typeof filters)[number]>('全部');
  const [focusMode, setFocusMode] = useState<'review' | 'library'>('review');
  const [loading, setLoading] = useState(true);
  const [savingUser, setSavingUser] = useState(false);
  const [error, setError] = useState('');
  const [dataMode, setDataMode] = useState<DataMode>('api');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const payload = await request<BootstrapPayload>('/api/bootstrap');
      setDataMode('api');
      setUser(payload.user);
      setDraftUser(payload.user);
      setWords(payload.words);
      setActiveId((current) => current ?? payload.words[0]?.id ?? null);
    } catch (event) {
      const payload = await loadStaticBootstrap();
      setDataMode('static');
      setUser(payload.user);
      setDraftUser(payload.user);
      setWords(payload.words);
      setActiveId((current) => current ?? payload.words[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return words.filter((item) => {
      const matchesLevel = level === '全部' || item.level === level;
      const matchesQuery =
        !value ||
        item.word.toLowerCase().includes(value) ||
        item.meaning.includes(value) ||
        item.topic.includes(value);
      return matchesLevel && matchesQuery;
    });
  }, [level, query, words]);

  const active = words.find((word) => word.id === activeId) ?? filtered[0] ?? words[0];
  const activeIndex = active ? filtered.findIndex((word) => word.id === active.id) : -1;
  const visibleWords = filtered.slice(0, 240);
  const mastered = words.filter((word) => word.progress.status === 'mastered').length;
  const learning = words.filter((word) => word.progress.status === 'learning').length;
  const seen = words.filter((word) => word.progress.seen > 0).length;
  const retention = Math.round(
    (words.reduce((sum, word) => sum + word.progress.correct, 0) /
      Math.max(1, words.reduce((sum, word) => sum + word.progress.seen, 0))) *
      100,
  );
  const todayTarget = user?.dailyTarget ?? 12;
  const targetProgress = Math.round((seen / Math.max(1, todayTarget)) * 100);

  useEffect(() => {
    if (filtered.length > 0 && activeId !== null && !filtered.some((word) => word.id === activeId)) {
      setActiveId(filtered[0].id);
      setFlipped(false);
    }
  }, [activeId, filtered]);

  function chooseWord(nextId: number) {
    setActiveId(nextId);
    setFlipped(false);
  }

  function move(delta: number) {
    if (filtered.length === 0) return;
    const index = activeIndex < 0 ? 0 : activeIndex;
    const next = filtered[(index + delta + filtered.length) % filtered.length];
    chooseWord(next.id);
  }

  async function mark(correct: boolean) {
    if (!active) return;

    const previous = words;
    const nextProgress = computeProgress(active.progress ?? emptyProgress, correct);
    setWords((current) =>
      current.map((word) => (word.id === active.id ? { ...word, progress: nextProgress } : word)),
    );
    setFlipped(false);

    if (dataMode === 'static') {
      saveStaticProgress(active.word, nextProgress);
      setTimeout(() => move(1), 120);
      return;
    }

    try {
      const payload = await request<{ progress: Progress }>('/api/progress', {
        method: 'POST',
        body: JSON.stringify({ wordId: active.id, correct }),
      });
      setWords((current) =>
        current.map((word) => (word.id === active.id ? { ...word, progress: payload.progress } : word)),
      );
      setTimeout(() => move(1), 120);
    } catch (event) {
      saveStaticProgress(active.word, nextProgress);
      setDataMode('static');
      setError('后端暂不可用，已切换为浏览器本地保存模式。');
      setTimeout(() => move(1), 120);
    }
  }

  async function resetProgress() {
    setError('');
    if (dataMode === 'static') {
      localStorage.removeItem(staticProgressKey);
      setWords((current) => current.map((word) => ({ ...word, progress: emptyProgress })));
      setFlipped(false);
      return;
    }

    try {
      await request<{ ok: true }>('/api/progress/reset', { method: 'POST' });
      setWords((current) => current.map((word) => ({ ...word, progress: emptyProgress })));
      setFlipped(false);
    } catch (event) {
      localStorage.removeItem(staticProgressKey);
      setDataMode('static');
      setWords((current) => current.map((word) => ({ ...word, progress: emptyProgress })));
      setFlipped(false);
      setError('后端暂不可用，已在浏览器本地重置进度。');
    }
  }

  async function saveUser() {
    if (!draftUser) return;
    setSavingUser(true);
    setError('');
    if (dataMode === 'static') {
      localStorage.setItem(staticUserKey, JSON.stringify(draftUser));
      setUser(draftUser);
      setSavingUser(false);
      return;
    }

    try {
      const payload = await request<{ user: User }>('/api/user', {
        method: 'PATCH',
        body: JSON.stringify(draftUser),
      });
      setUser(payload.user);
      setDraftUser(payload.user);
    } catch (event) {
      localStorage.setItem(staticUserKey, JSON.stringify(draftUser));
      setUser(draftUser);
      setDataMode('static');
      setError('后端暂不可用，用户信息已保存到当前浏览器。');
    } finally {
      setSavingUser(false);
    }
  }

  if (loading) {
    return (
      <main className="app-shell loading-shell">
        <div className="loading-card">
          <Database size={24} />
          <strong>正在连接本地词库</strong>
          <span>初始化 SQLite 数据库、用户信息和雅思词汇表</span>
        </div>
      </main>
    );
  }

  if (error && words.length === 0) {
    return (
      <main className="app-shell loading-shell">
        <div className="loading-card error-card">
          <Database size={24} />
          <strong>数据库服务未连接</strong>
          <span>{error}</span>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={21} />
          </div>
          <div>
            <p>Lexora</p>
            <span>{dataMode === 'api' ? 'PostgreSQL Powered IELTS' : 'GitHub Pages IELTS'}</span>
          </div>
        </div>

        {draftUser && (
          <div className="profile-panel">
            <div className="panel-title">
              <UserRound size={18} />
              当前用户
            </div>
            <label>
              <span>姓名</span>
              <input
                value={draftUser.name}
                onChange={(event) => setDraftUser({ ...draftUser, name: event.target.value })}
              />
            </label>
            <div className="profile-row">
              <label>
                <span>目标分</span>
                <input
                  value={draftUser.targetBand}
                  onChange={(event) => setDraftUser({ ...draftUser, targetBand: event.target.value })}
                />
              </label>
              <label>
                <span>日目标</span>
                <input
                  type="number"
                  min="1"
                  max="80"
                  value={draftUser.dailyTarget}
                  onChange={(event) => setDraftUser({ ...draftUser, dailyTarget: Number(event.target.value) })}
                />
              </label>
            </div>
            <button className="save-profile" onClick={saveUser} disabled={savingUser}>
              <Save size={17} />
              {savingUser ? '保存中' : '保存用户信息'}
            </button>
          </div>
        )}

        <nav className="mode-tabs" aria-label="学习模式">
          <button className={focusMode === 'review' ? 'active' : ''} onClick={() => setFocusMode('review')}>
            <Layers3 size={18} />
            复习卡片
          </button>
          <button className={focusMode === 'library' ? 'active' : ''} onClick={() => setFocusMode('library')}>
            <Library size={18} />
            词库管理
          </button>
        </nav>

        <div className="daily-panel">
          <div className="panel-title">
            <Target size={18} />
            今日目标
          </div>
          <strong>
            {seen}/{todayTarget}
          </strong>
          <div className="progress-track">
            <span style={{ width: `${Math.min(100, targetProgress)}%` }} />
          </div>
          <p>{targetProgress >= 100 ? '今日任务已完成' : '学习进度会写入本地 SQLite 数据库。'}</p>
        </div>

        <div className="stats-grid">
          <Metric icon={<BookOpenCheck size={18} />} label="已掌握" value={mastered} />
          <Metric icon={<Clock3 size={18} />} label="学习中" value={learning} />
          <Metric icon={<BarChart3 size={18} />} label="正确率" value={`${retention}%`} />
          <Metric icon={<Flame size={18} />} label="连续" value={`${seen ? 1 : 0}天`} />
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Band {user?.targetBand ?? '7.0'} 高频表达</p>
            <h1>雅思单词记忆卡片</h1>
          </div>
          <div className="top-actions">
            <button className="icon-button" onClick={resetProgress} aria-label="重置学习进度" title="重置学习进度">
              <RotateCcw size={18} />
            </button>
          </div>
        </header>

        {error && <div className="notice">{error}</div>}
        {dataMode === 'static' && !error && (
          <div className="notice success-notice">当前为 GitHub Pages 静态模式，学习进度会保存在此浏览器中。</div>
        )}

        <div className="tools-row">
          <label className="search-box">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索单词、释义或主题" />
          </label>
          <div className="segmented" aria-label="等级筛选">
            <ListFilter size={18} />
            {filters.map((item) => (
              <button key={item} className={level === item ? 'active' : ''} onClick={() => setLevel(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>

        {active && (
          <div className={focusMode === 'review' ? 'content-grid' : 'content-grid library-first'}>
            <section className="study-stage" aria-label="记忆卡片">
              <div className={`flash-card ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped((value) => !value)}>
                <div className="card-face card-front">
                  <div className="card-meta">
                    <span>{active.topic}</span>
                    <span>{active.level}</span>
                  </div>
                  <button className="sound-button" aria-label="播放发音" title="播放发音" onClick={(event) => event.stopPropagation()}>
                    <Volume2 size={20} />
                  </button>
                  <div className="word-block">
                    <p>{active.pos}</p>
                    <h2>{active.word}</h2>
                    <span>{active.phonetic}</span>
                  </div>
                  <div className="hint-row">
                    <ArrowLeftRight size={18} />
                    点击翻面查看释义、例句和搭配
                  </div>
                </div>

                <div className="card-face card-back">
                  <div className="definition">
                    <span>
                      {active.pos} {active.meaning}
                    </span>
                    <p>{active.english}</p>
                  </div>
                  <blockquote>
                    {active.example}
                    <small>{active.exampleCn}</small>
                  </blockquote>
                  <div className="pill-group">
                    {active.collocations.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                  <div className="synonyms">
                    <Star size={17} />
                    近义词：{active.synonyms.join(' / ')}
                  </div>
                </div>
              </div>

              <div className="review-actions">
                <button className="nav-button" onClick={() => move(-1)} aria-label="上一个单词" title="上一个单词">
                  <ChevronLeft size={20} />
                </button>
                <button className="danger-action" onClick={() => mark(false)}>
                  <X size={20} />
                  模糊
                </button>
                <button className="primary-action" onClick={() => mark(true)}>
                  <Check size={20} />
                  记住了
                </button>
                <button className="nav-button" onClick={() => move(1)} aria-label="下一个单词" title="下一个单词">
                  <ChevronRight size={20} />
                </button>
              </div>
            </section>

            <section className="library-panel" aria-label="词库">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">SQLite Deck</p>
                  <h2>{filtered.length} 个词条</h2>
                </div>
                <span>
                  {mastered}/{words.length} mastered
                </span>
              </div>

              <div className="word-list">
                  {visibleWords.map((item) => (
                    <button
                      className={item.id === active.id ? 'word-row active' : 'word-row'}
                    key={item.id}
                    onClick={() => chooseWord(item.id)}
                  >
                    <span className={`status-dot ${item.progress.status}`} />
                    <span>
                      <strong>{item.word}</strong>
                      <small>{item.meaning}</small>
                    </span>
                    <em>{item.topic}</em>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

function computeProgress(progress: Progress, correct: boolean): Progress {
  const seen = progress.seen + 1;
  const right = progress.correct + (correct ? 1 : 0);
  const accuracy = right / seen;

  return {
    status: correct && seen >= 2 && accuracy >= 0.7 ? 'mastered' : 'learning',
    seen,
    correct: right,
    lastSeen: new Date().toISOString(),
  };
}

async function loadStaticBootstrap(): Promise<BootstrapPayload> {
  const [curated, expanded] = await Promise.all([
    requestStaticWords('ielts_curated_words.json'),
    requestStaticWords('ielts_5000_words.json'),
  ]);
  const progress = loadStaticProgress();
  const seenWords = new Set<string>();
  const words = [...curated, ...expanded]
    .filter((word) => {
      if (seenWords.has(word.word)) return false;
      seenWords.add(word.word);
      return true;
    })
    .map((word, index) => ({
      ...word,
      id: index + 1,
      progress: progress[word.word] ?? emptyProgress,
    }));

  return { user: loadStaticUser(), words };
}

async function requestStaticWords(fileName: string): Promise<StaticWord[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}${fileName}`);
  if (!response.ok) throw new Error(`Unable to load ${fileName}`);
  return response.json() as Promise<StaticWord[]>;
}

function loadStaticUser(): User {
  try {
    const stored = localStorage.getItem(staticUserKey);
    return stored ? { ...defaultUser, ...JSON.parse(stored) } : defaultUser;
  } catch {
    return defaultUser;
  }
}

function loadStaticProgress(): ProgressMap {
  try {
    const stored = localStorage.getItem(staticProgressKey);
    return stored ? (JSON.parse(stored) as ProgressMap) : {};
  } catch {
    return {};
  }
}

function saveStaticProgress(word: string, progress: Progress) {
  const current = loadStaticProgress();
  localStorage.setItem(staticProgressKey, JSON.stringify({ ...current, [word]: progress }));
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="metric">
      <span>{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

export default App;
