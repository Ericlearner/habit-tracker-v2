
const { useState, useEffect, useMemo, useRef } = React;

/* ---------------- constants & sample data ---------------- */

const CATEGORIES = {
  Health:       { color: '#06b6d4', soft: '#e0f7fb', icon: '❤️' },
  Fitness:      { color: '#f97316', soft: '#fef1e5', icon: '🏃' },
  Mindfulness:  { color: '#8b5cf6', soft: '#f1ecff', icon: '🧘' },
  Learning:     { color: '#eab308', soft: '#fdf6dd', icon: '📚' },
  Productivity: { color: '#3b82f6', soft: '#e7f0ff', icon: '📝' },
  Social:       { color: '#ec4899', soft: '#fde8f3', icon: '👥' },
};
const CATEGORY_NAMES = Object.keys(CATEGORIES);
const ICON_CHOICES = ['💧','🏃','🧘','📚','📝','📞','💊','🤸','🏋️','🚴','🎨','🎯','😴','🥗','✍️','🌱'];
const THEME_SWATCHES = ['#7c5cff','#ec4899','#06b6d4','#f97316','#22c55e','#eab308'];
const ACHIEVEMENTS = [
  { id: 'first',   name: 'First Step',    desc: 'Create a habit',        icon: '🌱', color: '#22c55e', target: 1 },
  { id: 'week',    name: '7-Day Streak',  desc: 'Hit a 7 day streak',    icon: '🔥', color: '#f97316', target: 7 },
  { id: 'month',   name: '30-Day Streak', desc: 'Hit a 30 day streak',   icon: '🏆', color: '#eab308', target: 30 },
  { id: 'hundred', name: '100 Check-ins', desc: '100 total completions', icon: '💯', color: '#3b82f6', target: 100 },
  { id: 'perfect', name: 'Perfect Week',  desc: 'All habits, 7 days straight', icon: '⭐', color: '#8b5cf6', target: 7 },
];

// tiny seeded RNG so sample data is stable across reloads
function mulberry32(seed){
  return function(){
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);

function seedHistory(recentStreak, rate){
  const arr = [];
  for (let i = 0; i < 30; i++){
    const daysAgo = 29 - i; // 0 = today
    if (daysAgo < recentStreak) arr.push(true);
    else arr.push(rand() < rate);
  }
  if (recentStreak === 0) arr[29] = false;
  return arr;
}

const SEED_HABITS = [
  { name: 'Drink 8 Glasses of Water',        category: 'Health',       icon: '💧', frequency: 'daily',  reminder: '08:00', note: 'Stay hydrated, stay sharp.',            streakTarget: 12, rate: 0.82 },
  { name: 'Morning Run',                     category: 'Fitness',      icon: '🏃', frequency: 'daily',  reminder: '06:30', note: 'Even a short jog counts.',              streakTarget: 5,  rate: 0.6 },
  { name: 'Meditate 10 Minutes',              category: 'Mindfulness', icon: '🧘', frequency: 'daily',  reminder: '07:00', note: 'Breathe in, breathe out.',              streakTarget: 21, rate: 0.85 },
  { name: 'Read 20 Pages',                    category: 'Learning',    icon: '📚', frequency: 'daily',  reminder: '21:00', note: 'A page a day keeps the mind sharp.',    streakTarget: 3,  rate: 0.55 },
  { name: 'Plan Tomorrow',                    category: 'Productivity',icon: '📝', frequency: 'daily',  reminder: '20:30', note: 'Future you will thank you.',            streakTarget: 8,  rate: 0.7 },
  { name: 'Call a Friend or Family Member',   category: 'Social',      icon: '📞', frequency: 'weekly', reminder: '18:00', note: 'Stay connected.',                       streakTarget: 2,  rate: 0.4 },
  { name: 'Take Vitamins',                    category: 'Health',      icon: '💊', frequency: 'daily',  reminder: '08:15', note: 'Small habit, big payoff.',              streakTarget: 30, rate: 0.97 },
  { name: 'Stretch Before Bed',                category: 'Fitness',     icon: '🤸', frequency: 'daily',  reminder: '22:00', note: 'Loosen up before sleep.',               streakTarget: 0,  rate: 0.5 },
];

function buildSeedData(){
  return SEED_HABITS.map((h, i) => ({
    id: 'habit_' + i,
    name: h.name,
    category: h.category,
    icon: h.icon,
    frequency: h.frequency,
    reminder: h.reminder,
    note: h.note,
    paused: false,
    history: seedHistory(h.streakTarget, h.rate),
    createdAt: Date.now() - (30 - i) * 86400000,
  }));
}

const STORAGE_KEY = 'habit-tracker-v1';

function loadState(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { habits: buildSeedData(), theme: '#7c5cff', onboarded: false, notifications: true };
}
function saveState(state){
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}

/* ---------------- date & stat helpers ---------------- */

function dateForIndex(idx){ // idx 0..29, 29 = today
  const d = new Date();
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() - (29 - idx));
  return d;
}
function fmtDay(d){ return d.toLocaleDateString(undefined, { weekday: 'short' }); }
function fmtLong(d){ return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }); }

function currentStreak(history){
  let s = 0;
  for (let i = history.length - 1; i >= 0; i--){
    if (history[i]) s++; else break;
  }
  return s;
}
function bestStreak(history){
  let best = 0, cur = 0;
  for (const v of history){ cur = v ? cur + 1 : 0; best = Math.max(best, cur); }
  return best;
}
function completionRate(history){
  const done = history.filter(Boolean).length;
  return Math.round((done / history.length) * 100);
}
function totalCompletions(habits){
  return habits.reduce((sum, h) => sum + h.history.filter(Boolean).length, 0);
}

/* ---------------- small shared components ---------------- */

function CategoryIcon({ category, size = 22 }){
  const c = CATEGORIES[category] || { color: '#7c5cff', soft: '#efeaff', icon: '⭐' };
  return (
    <span style={{
      width: size + 20, height: size + 20, borderRadius: 14, background: c.soft,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size, flexShrink: 0,
    }}>{c.icon}</span>
  );
}

function StreakBadge({ count }){
  return <span className="streak-badge">🔥 {count}</span>;
}

function ProgressRing({ value, max, size = 54 }){
  const pct = max ? Math.min(1, value / max) : 0;
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} stroke="#eceafb" strokeWidth="7" fill="none" />
      <circle cx={size/2} cy={size/2} r={r} stroke="url(#g1)" strokeWidth="7" fill="none"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7c5cff" />
          <stop offset="100%" stopColor="#ff6fb0" />
        </linearGradient>
      </defs>
      <text x="50%" y="53%" textAnchor="middle" fontSize="13" fontWeight="800" fill="#1f2233">{value}/{max}</text>
    </svg>
  );
}

function CategoryChip({ name, active, onClick }){
  const c = CATEGORIES[name];
  const style = active ? { background: c.color } : {};
  return (
    <button className={"chip" + (active ? " active" : "")} style={style} onClick={onClick}>
      <span>{c.icon}</span><span>{name}</span>
    </button>
  );
}

function HabitCard({ habit, onToggle, onOpen }){
  const c = CATEGORIES[habit.category];
  const doneToday = habit.history[29];
  const streak = currentStreak(habit.history);
  return (
    <div className="habit-card" style={{ '--cat-color': c.color, '--cat-soft': c.soft }} onClick={() => onOpen(habit.id)}>
      <span className="habit-icon" style={{ background: c.soft }}>{habit.icon}</span>
      <div className="habit-info">
        <div className="habit-name">{habit.name}{habit.paused ? ' ⏸' : ''}</div>
        <div className="habit-meta">
          <span className="cat-pill" style={{ background: c.color }}>{habit.category}</span>
          <StreakBadge count={streak} />
        </div>
      </div>
      <div className={"check-circle" + (doneToday ? " done" : "")} style={{ '--cat-color': c.color }}
        onClick={(e) => { e.stopPropagation(); onToggle(habit.id); }}>
        {doneToday ? '✓' : ''}
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }){
  return (
    <button className={"toggle" + (checked ? " on" : "")} onClick={() => onChange(!checked)}>
      <span className="knob"></span>
    </button>
  );
}

/* ---------------- Dashboard ---------------- */

function Dashboard({ habits, onToggle, onOpenHabit, onAdd, filter, setFilter }){
  const shown = filter ? habits.filter(h => h.category === filter) : habits;
  const doneCount = habits.filter(h => h.history[29]).length;
  const today = new Date();

  if (habits.length === 0){
    return <EmptyState onAdd={onAdd} />;
  }

  return (
    <div>
      <div className="top-header">
        <div>
          <div className="date">{today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <h1>Good day! 👋</h1>
        </div>
        <button className="avatar-btn">🙂</button>
      </div>

      <div className="progress-top">
        <ProgressRing value={doneCount} max={habits.length} />
        <div>
          <div className="label">{doneCount}/{habits.length} habits done today</div>
          <div className="sub">Keep the streak alive!</div>
        </div>
      </div>

      <div className="chip-row">
        <button className={"chip" + (!filter ? " active" : "")} style={filter ? {} : { background: '#7c5cff', color: '#fff', borderColor: 'transparent' }} onClick={() => setFilter(null)}>✨ All</button>
        {CATEGORY_NAMES.map(name => (
          <CategoryChip key={name} name={name} active={filter === name} onClick={() => setFilter(filter === name ? null : name)} />
        ))}
      </div>

      <div className="section-title">📋 Today's Habits</div>
      {shown.map(h => (
        <HabitCard key={h.id} habit={h} onToggle={onToggle} onOpen={onOpenHabit} />
      ))}

      <button className="fab" onClick={onAdd}>➕</button>
    </div>
  );
}

function EmptyState({ onAdd }){
  return (
    <div>
      <div className="top-header">
        <div><div className="date">Today</div><h1>Habit Tracker</h1></div>
        <button className="avatar-btn">🙂</button>
      </div>
      <div className="empty-state">
        <div className="ic">🌱</div>
        <h3>No habits yet</h3>
        <p>Small steps every day add up to big changes.<br/>Add your first habit to get started.</p>
        <button className="empty-cta" onClick={onAdd}>➕ Add your first habit</button>
      </div>
    </div>
  );
}

/* ---------------- Add / Edit Habit ---------------- */

function AddEditHabitForm({ initial, onSave, onCancel, onDelete }){
  const [name, setName] = useState(initial ? initial.name : '');
  const [icon, setIcon] = useState(initial ? initial.icon : ICON_CHOICES[0]);
  const [category, setCategory] = useState(initial ? initial.category : CATEGORY_NAMES[0]);
  const [frequency, setFrequency] = useState(initial ? initial.frequency : 'daily');
  const [reminder, setReminder] = useState(initial ? initial.reminder : '09:00');
  const [note, setNote] = useState(initial ? initial.note : '');

  return (
    <div>
      <div className="overlay-header">
        <button className="icon-btn" onClick={onCancel}>←</button>
        <div className="overlay-title">{initial ? 'Edit Habit' : 'Add Habit'}</div>
      </div>
      <div style={{ padding: '0 16px' }}>
        <label className="field-label">Habit name</label>
        <input className="text-input" placeholder="e.g. Drink water" value={name} onChange={e => setName(e.target.value)} />

        <label className="field-label">🎨 Pick an icon</label>
        <div className="icon-grid">
          {ICON_CHOICES.map(ic => (
            <div key={ic} className={"icon-choice" + (icon === ic ? " selected" : "")} onClick={() => setIcon(ic)}>{ic}</div>
          ))}
        </div>

        <label className="field-label">🏷️ Category</label>
        <div className="color-grid">
          {CATEGORY_NAMES.map(name2 => {
            const c = CATEGORIES[name2];
            const sel = category === name2;
            return (
              <div key={name2} className={"color-choice" + (sel ? " selected" : "")}
                style={{ '--chip-color': c.color, '--chip-soft': c.soft }}
                onClick={() => setCategory(name2)}>
                <span className="color-dot" style={{ background: c.color }}>{c.icon}</span>
                {name2}
              </div>
            );
          })}
        </div>

        <label className="field-label">📅 Frequency</label>
        <div className="seg-row">
          {['daily','weekly','custom'].map(f => (
            <button key={f} className={"seg-btn" + (frequency === f ? " selected" : "")} onClick={() => setFrequency(f)}>
              <span>{f === 'daily' ? '📆' : f === 'weekly' ? '🗓️' : '⚙️'}</span>
              <span style={{ textTransform: 'capitalize' }}>{f}</span>
            </button>
          ))}
        </div>

        <label className="field-label">⏰ Reminder time</label>
        <input className="text-input" type="time" value={reminder} onChange={e => setReminder(e.target.value)} />

        <label className="field-label">🗒️ Note (optional)</label>
        <input className="text-input" placeholder="A little motivation..." value={note} onChange={e => setNote(e.target.value)} />

        <button className="save-btn" disabled={!name.trim()} style={{ opacity: name.trim() ? 1 : .5 }}
          onClick={() => name.trim() && onSave({ name: name.trim(), icon, category, frequency, reminder, note })}>
          💾 Save Habit
        </button>
        {initial && (
          <button className="danger-btn" onClick={onDelete}>🗑️ Delete Habit</button>
        )}
      </div>
    </div>
  );
}

/* ---------------- Habit Detail ---------------- */

function HeatmapGrid({ history }){
  return (
    <div className="heatmap">
      {history.map((v, i) => {
        const d = dateForIndex(i);
        return <div key={i} className="heat-cell" title={d.toDateString()}
          style={{ background: v ? '#7c5cff' : '#eceafb', opacity: v ? (0.5 + (i/30)*0.5) : 1 }} />;
      })}
    </div>
  );
}

function HabitDetail({ habit, onBack, onEdit, onDelete, onTogglePause }){
  const c = CATEGORIES[habit.category];
  const streak = currentStreak(habit.history);
  const best = bestStreak(habit.history);
  return (
    <div>
      <div className="detail-hero" style={{ background: `linear-gradient(135deg, ${c.color}, ${c.color}cc)` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <button className="icon-btn" style={{ background: 'rgba(255,255,255,.25)', border: 'none', color: '#fff' }} onClick={onBack}>←</button>
          <button className="icon-btn" style={{ background: 'rgba(255,255,255,.25)', border: 'none', color: '#fff' }} onClick={() => onEdit(habit.id)}>✏️</button>
        </div>
        <div className="big-icon">{habit.icon}</div>
        <h2>{habit.name}</h2>
        <div className="cat">{c.icon} {habit.category} · {habit.frequency}</div>
      </div>

      <div className="stat-badges">
        <div className="stat-badge"><div className="ic">🔥</div><div className="val">{streak}</div><div className="lbl">Current streak</div></div>
        <div className="stat-badge"><div className="ic">🏆</div><div className="val">{best}</div><div className="lbl">Best streak</div></div>
        <div className="stat-badge"><div className="ic">📈</div><div className="val">{completionRate(habit.history)}%</div><div className="lbl">30-day rate</div></div>
      </div>

      <div className="section-title" style={{ padding: '0 16px' }}>🗓️ Last 30 days</div>
      <HeatmapGrid history={habit.history} />

      <div className="quick-actions">
        <button className="quick-action" onClick={() => onEdit(habit.id)}><span className="circle">✏️</span>Edit</button>
        <button className="quick-action" onClick={() => onTogglePause(habit.id)}><span className="circle">{habit.paused ? '▶️' : '⏸️'}</span>{habit.paused ? 'Resume' : 'Pause'}</button>
        <button className="quick-action" onClick={() => alert('Sharing "' + habit.name + '" 🎉 (demo only)')}><span className="circle">📤</span>Share</button>
        <button className="quick-action" onClick={() => onDelete(habit.id)}><span className="circle">🗑️</span>Delete</button>
      </div>

      {habit.note && (
        <div className="note-box"><span>💬</span><span>{habit.note}</span></div>
      )}
    </div>
  );
}

/* ---------------- Calendar ---------------- */

function CalendarView({ habits }){
  const [view, setView] = useState('month');
  const [selected, setSelected] = useState(null);
  const today = new Date(); today.setHours(0,0,0,0);

  const historyByDate = useMemo(() => {
    const map = {};
    for (let i = 0; i < 30; i++){
      const key = dateForIndex(i).toDateString();
      map[key] = i;
    }
    return map;
  }, []);

  function dotsFor(date){
    const idx = historyByDate[date.toDateString()];
    if (idx === undefined) return [];
    return habits.filter(h => h.history[idx]).map(h => CATEGORIES[h.category].color);
  }

  function habitsFor(date){
    const idx = historyByDate[date.toDateString()];
    if (idx === undefined) return null;
    return habits.map(h => ({ habit: h, done: h.history[idx] }));
  }

  let cells = [];
  if (view === 'month'){
    const y = today.getFullYear(), m = today.getMonth();
    const first = new Date(y, m, 1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
  } else {
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
    for (let i = 0; i < 7; i++){
      const d = new Date(start); d.setDate(start.getDate() + i);
      cells.push(d);
    }
  }

  const monthLabel = today.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="top-header">
        <div><div className="date">History</div><h1>📅 {monthLabel}</h1></div>
      </div>
      <div className="cal-toggle">
        <button className={view === 'month' ? 'active' : ''} onClick={() => setView('month')}>🗓️ Month</button>
        <button className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>📆 Week</button>
      </div>
      <div className="cal-grid">
        {['S','M','T','W','T','F','S'].map((d,i) => <div key={i} className="cal-dow">{d}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="cal-day empty" />;
          const dots = dotsFor(d);
          const isToday = d.toDateString() === today.toDateString();
          return (
            <div key={i} className={"cal-day" + (isToday ? " today" : "")} onClick={() => setSelected(d)}>
              <span>{d.getDate()}</span>
              <div className="dots">
                {dots.slice(0,5).map((c,j) => <span key={j} className="cal-dot" style={{ background: c }} />)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="legend">
        {CATEGORY_NAMES.map(name => (
          <div key={name} className="legend-item"><span className="legend-dot" style={{ background: CATEGORIES[name].color }} />{CATEGORIES[name].icon} {name}</div>
        ))}
      </div>

      {selected && (() => {
        const list = habitsFor(selected);
        return (
          <div className="day-panel">
            <div className="section-title" style={{ margin: '0 0 8px' }}>{fmtLong(selected)}</div>
            {!list && <div style={{ color: 'var(--muted)', fontSize: 13 }}>No data outside the last 30 days.</div>}
            {list && list.map(({ habit, done }) => (
              <div key={habit.id} className="day-panel-row">
                <span>{habit.icon}</span>
                <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{habit.name}</span>
                <span>{done ? '✅' : '❌'}</span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

/* ---------------- Stats ---------------- */

function BarChart({ habits }){
  const last7 = [];
  for (let idx = 23; idx <= 29; idx++){
    const count = habits.filter(h => h.history[idx]).length;
    last7.push({ d: dateForIndex(idx), count });
  }
  const max = Math.max(1, habits.length);
  return (
    <div className="bar-chart">
      {last7.map((item, i) => (
        <div key={i} className="bar-col">
          <div className="bar" style={{ height: (item.count / max) * 90 + '%' }} title={item.count + ' done'} />
          <span className="dow">{fmtDay(item.d)[0]}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ habits }){
  const totals = CATEGORY_NAMES.map(name => {
    const t = habits.filter(h => h.category === name).reduce((s,h) => s + h.history.filter(Boolean).length, 0);
    return { name, total: t, color: CATEGORIES[name].color };
  }).filter(x => x.total > 0);
  const grand = totals.reduce((s,x) => s + x.total, 0) || 1;
  let acc = 0;
  const stops = totals.map(x => {
    const start = (acc / grand) * 360;
    acc += x.total;
    const end = (acc / grand) * 360;
    return `${x.color} ${start}deg ${end}deg`;
  });
  const bg = stops.length ? `conic-gradient(${stops.join(',')})` : '#eceafb';
  return (
    <div className="donut-wrap">
      <div className="donut" style={{ background: bg }} />
      <div className="donut-legend">
        {totals.map(x => (
          <div key={x.name} className="legend-item">
            <span className="legend-dot" style={{ background: x.color }} />
            {CATEGORIES[x.name].icon} {x.name} · {Math.round((x.total/grand)*100)}%
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsView({ habits }){
  const [range, setRange] = useState('week');
  const totalStreak = habits.reduce((s,h) => s + currentStreak(h.history), 0);
  const longest = habits.reduce((m,h) => Math.max(m, bestStreak(h.history)), 0);
  const avgRate = habits.length ? Math.round(habits.reduce((s,h) => s + completionRate(h.history), 0) / habits.length) : 0;

  return (
    <div>
      <div className="top-header">
        <div><div className="date">Overview</div><h1>📊 Stats</h1></div>
      </div>

      <div className="filter-row">
        {['week','month','year'].map(r => (
          <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)} style={{ textTransform: 'capitalize' }}>{r === 'week' ? '📅' : r === 'month' ? '🗓️' : '📆'} {r}</button>
        ))}
      </div>

      <div className="stat-cards">
        <div className="stat-card"><div className="ic">🔥</div><div className="val">{totalStreak}</div><div className="lbl">Total streak days</div></div>
        <div className="stat-card"><div className="ic">📈</div><div className="val">{avgRate}%</div><div className="lbl">Completion rate</div></div>
        <div className="stat-card"><div className="ic">🏆</div><div className="val">{longest}</div><div className="lbl">Longest streak</div></div>
        <div className="stat-card"><div className="ic">🎯</div><div className="val">{habits.length}</div><div className="lbl">Habits tracked</div></div>
      </div>

      <div className="chart-card">
        <h3>📉 Weekly completion trend</h3>
        <BarChart habits={habits} />
      </div>

      <div className="chart-card">
        <h3>🍩 Category breakdown</h3>
        <DonutChart habits={habits} />
      </div>
    </div>
  );
}

/* ---------------- Settings ---------------- */

function SettingsView({ theme, setTheme, notifications, setNotifications, onReplayOnboarding, onReset, habits }){
  function exportData(){
    const blob = new Blob([JSON.stringify(habits, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'habit-data.json'; a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div>
      <div className="top-header">
        <div><div className="date">You</div><h1>⚙️ Settings</h1></div>
      </div>

      <div className="profile-header">
        <div className="profile-avatar">🙂</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Habit Builder</div>
          <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Member since today</div>
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-row">
          <span className="ic">🔔</span><span className="lbl">Notifications</span>
          <ToggleSwitch checked={notifications} onChange={setNotifications} />
        </div>
        <div className="settings-row" onClick={onReplayOnboarding}>
          <span className="ic">🎬</span><span className="lbl">Replay onboarding</span><span className="chev">›</span>
        </div>
        <div className="settings-row" onClick={exportData}>
          <span className="ic">⬇️</span><span className="lbl">Export data</span><span className="chev">›</span>
        </div>
        <div className="settings-row" onClick={onReset}>
          <span className="ic">🔄</span><span className="lbl">Reset sample data</span><span className="chev">›</span>
        </div>
        <div className="settings-row" onClick={() => alert('Habit Tracker v1.0\nA demo app for design exploration.')}>
          <span className="ic">ℹ️</span><span className="lbl">About</span><span className="chev">›</span>
        </div>
        <div className="settings-row" onClick={() => alert('Need help? This is a demo app — no real support exists yet 🙂')}>
          <span className="ic">❓</span><span className="lbl">Help</span><span className="chev">›</span>
        </div>
      </div>

      <div className="section-title">🎨 Theme color</div>
      <div className="settings-group">
        <div className="theme-swatches">
          {THEME_SWATCHES.map(c => (
            <div key={c} className={"swatch" + (theme === c ? " selected" : "")} style={{ background: c, '--sw-color': c }} onClick={() => setTheme(c)} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Onboarding ---------------- */

const OB_SLIDES = [
  { icon: '🌱', title: 'Build habits that stick', body: 'Track daily routines across health, fitness, mindfulness and more — all in one colorful place.' },
  { icon: '🔥', title: 'Watch your streaks grow', body: 'Every check-in builds momentum. See your streaks, history and progress at a glance.' },
  { icon: '🏆', title: 'Celebrate the wins', body: 'Unlock achievements as you go, and stay motivated with stats that show real progress.' },
];

function OnboardingOverlay({ onDone }){
  const [i, setI] = useState(0);
  const slide = OB_SLIDES[i];
  const bg = ['#7c5cff', '#f97316', '#22c55e'][i];
  return (
    <div className="onboarding" style={{ background: `linear-gradient(160deg, ${bg}, ${bg}cc)` }}>
      <div className="ob-slide">
        <div className="ob-icon">{slide.icon}</div>
        <h2>{slide.title}</h2>
        <p>{slide.body}</p>
      </div>
      <div className="ob-dots">
        {OB_SLIDES.map((_, idx) => <span key={idx} className={"ob-dot" + (idx === i ? " active" : "")} />)}
      </div>
      <div className="ob-actions">
        <button className="ob-skip" onClick={onDone}>Skip</button>
        <button className="ob-next" onClick={() => i < OB_SLIDES.length - 1 ? setI(i + 1) : onDone()}>
          {i < OB_SLIDES.length - 1 ? 'Next' : "Let's go 🚀"}
        </button>
      </div>
    </div>
  );
}

/* ---------------- Achievements ---------------- */

function AchievementsView({ habits }){
  const maxStreak = habits.reduce((m,h) => Math.max(m, currentStreak(h.history)), 0);
  const maxBest = habits.reduce((m,h) => Math.max(m, bestStreak(h.history)), 0);
  const total = totalCompletions(habits);
  const perfectWeek = habits.length > 0 && habits.every(h => h.history.slice(23,30).every(Boolean));

  const progressFor = (a) => {
    if (a.id === 'first') return habits.length > 0 ? 1 : 0;
    if (a.id === 'week' || a.id === 'month') return Math.min(1, maxBest / a.target);
    if (a.id === 'hundred') return Math.min(1, total / a.target);
    if (a.id === 'perfect') return perfectWeek ? 1 : 0;
    return 0;
  };
  const unlockedFor = (a) => progressFor(a) >= 1;

  const next = ACHIEVEMENTS.find(a => !unlockedFor(a)) || ACHIEVEMENTS[ACHIEVEMENTS.length - 1];
  const nextProgress = progressFor(next);

  return (
    <div>
      <div className="top-header">
        <div><div className="date">Milestones</div><h1>🏆 Achievements</h1></div>
      </div>

      <div className="badge-grid">
        {ACHIEVEMENTS.map(a => {
          const unlocked = unlockedFor(a);
          return (
            <div key={a.id} className={"badge-card" + (unlocked ? "" : " locked")}>
              {!unlocked && <span className="lock-pill">🔒</span>}
              <div className="bic" style={{ background: unlocked ? a.color : '#eceafb', color: unlocked ? '#fff' : '#a3a7bd' }}>{a.icon}</div>
              <div className="bname">{a.name}</div>
              <div className="bdesc">{a.desc}</div>
            </div>
          );
        })}
      </div>

      <div className="next-progress">
        <div className="row"><span>Next: {next.icon} {next.name}</span><span>{Math.round(nextProgress*100)}%</span></div>
        <div className="bar-track"><div className="bar-fill" style={{ width: (nextProgress*100) + '%' }} /></div>
      </div>
    </div>
  );
}

/* ---------------- Bottom nav ---------------- */

function BottomNav({ tab, setTab }){
  const tabs = [
    { id: 'dashboard', ic: '🏠', label: 'Home' },
    { id: 'calendar',  ic: '📅', label: 'Calendar' },
    { id: 'stats',     ic: '📊', label: 'Stats' },
    { id: 'achievements', ic: '🏆', label: 'Awards' },
    { id: 'settings',  ic: '⚙️', label: 'Settings' },
  ];
  return (
    <div className="bottom-nav">
      {tabs.map(t => (
        <button key={t.id} className={"nav-btn" + (tab === t.id ? " active" : "")} onClick={() => setTab(t.id)}>
          <span className="ic">{t.ic}</span><span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------------- App root ---------------- */

function App(){
  const [state, setState] = useState(loadState);
  const [tab, setTab] = useState('dashboard');
  const [overlay, setOverlay] = useState(null); // {type:'add'|'edit'|'detail', habitId}
  const [filter, setFilter] = useState(null);

  useEffect(() => { saveState(state); }, [state]);
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', state.theme);
  }, [state.theme]);
  useEffect(() => {
    if (!state.onboarded) setOverlay({ type: 'onboarding' });
  }, []);

  function toggleHabit(id){
    setState(s => ({
      ...s,
      habits: s.habits.map(h => h.id === id ? {
        ...h, history: h.history.map((v,i) => i === 29 ? !v : v)
      } : h),
    }));
  }
  function addHabit(data){
    setState(s => ({
      ...s,
      habits: [...s.habits, { id: 'habit_' + Date.now(), ...data, paused: false, history: new Array(30).fill(false), createdAt: Date.now() }],
    }));
    setOverlay(null);
  }
  function updateHabit(id, data){
    setState(s => ({ ...s, habits: s.habits.map(h => h.id === id ? { ...h, ...data } : h) }));
    setOverlay(null);
  }
  function deleteHabit(id){
    if (!confirm('Delete this habit? This cannot be undone.')) return;
    setState(s => ({ ...s, habits: s.habits.filter(h => h.id !== id) }));
    setOverlay(null);
  }
  function togglePause(id){
    setState(s => ({ ...s, habits: s.habits.map(h => h.id === id ? { ...h, paused: !h.paused } : h) }));
  }
  function finishOnboarding(){
    setState(s => ({ ...s, onboarded: true }));
    setOverlay(null);
  }
  function resetSample(){
    if (!confirm('Reset to sample data? Your changes will be lost.')) return;
    setState(s => ({ ...s, habits: buildSeedData() }));
  }

  const editingHabit = overlay && overlay.type === 'edit' ? state.habits.find(h => h.id === overlay.habitId) : null;
  const detailHabit = overlay && overlay.type === 'detail' ? state.habits.find(h => h.id === overlay.habitId) : null;

  return (
    <div className="app-shell">
      {tab === 'dashboard' && (
        <Dashboard
          habits={state.habits}
          onToggle={toggleHabit}
          onOpenHabit={(id) => setOverlay({ type: 'detail', habitId: id })}
          onAdd={() => setOverlay({ type: 'add' })}
          filter={filter}
          setFilter={setFilter}
        />
      )}
      {tab === 'calendar' && <CalendarView habits={state.habits} />}
      {tab === 'stats' && <StatsView habits={state.habits} />}
      {tab === 'achievements' && <AchievementsView habits={state.habits} />}
      {tab === 'settings' && (
        <SettingsView
          theme={state.theme}
          setTheme={(c) => setState(s => ({ ...s, theme: c }))}
          notifications={state.notifications}
          setNotifications={(v) => setState(s => ({ ...s, notifications: v }))}
          onReplayOnboarding={() => setOverlay({ type: 'onboarding' })}
          onReset={resetSample}
          habits={state.habits}
        />
      )}

      <BottomNav tab={tab} setTab={setTab} />

      {overlay && overlay.type === 'add' && (
        <div className="overlay"><AddEditHabitForm onSave={addHabit} onCancel={() => setOverlay(null)} /></div>
      )}
      {overlay && overlay.type === 'edit' && editingHabit && (
        <div className="overlay">
          <AddEditHabitForm initial={editingHabit} onSave={(data) => updateHabit(editingHabit.id, data)}
            onCancel={() => setOverlay(null)} onDelete={() => deleteHabit(editingHabit.id)} />
        </div>
      )}
      {overlay && overlay.type === 'detail' && detailHabit && (
        <div className="overlay">
          <HabitDetail habit={detailHabit} onBack={() => setOverlay(null)}
            onEdit={(id) => setOverlay({ type: 'edit', habitId: id })}
            onDelete={deleteHabit} onTogglePause={togglePause} />
        </div>
      )}
      {overlay && overlay.type === 'onboarding' && (
        <OnboardingOverlay onDone={finishOnboarding} />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
