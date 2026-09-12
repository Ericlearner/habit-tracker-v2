const {
  useState,
  useEffect,
  useMemo,
  useRef
} = React;

/* ---------------- constants & sample data ---------------- */

const CATEGORIES = {
  Health: {
    color: '#06b6d4',
    soft: '#e0f7fb',
    icon: '❤️'
  },
  Fitness: {
    color: '#f97316',
    soft: '#fef1e5',
    icon: '🏃'
  },
  Mindfulness: {
    color: '#8b5cf6',
    soft: '#f1ecff',
    icon: '🧘'
  },
  Learning: {
    color: '#eab308',
    soft: '#fdf6dd',
    icon: '📚'
  },
  Productivity: {
    color: '#3b82f6',
    soft: '#e7f0ff',
    icon: '📝'
  },
  Social: {
    color: '#ec4899',
    soft: '#fde8f3',
    icon: '👥'
  }
};
const CATEGORY_NAMES = Object.keys(CATEGORIES);
const ICON_CHOICES = ['💧', '🏃', '🧘', '📚', '📝', '📞', '💊', '🤸', '🏋️', '🚴', '🎨', '🎯', '😴', '🥗', '✍️', '🌱'];
const THEME_SWATCHES = ['#7c5cff', '#ec4899', '#06b6d4', '#f97316', '#22c55e', '#eab308'];
const ACHIEVEMENTS = [{
  id: 'first',
  name: 'First Step',
  desc: 'Create a habit',
  icon: '🌱',
  color: '#22c55e',
  target: 1
}, {
  id: 'week',
  name: '7-Day Streak',
  desc: 'Hit a 7 day streak',
  icon: '🔥',
  color: '#f97316',
  target: 7
}, {
  id: 'month',
  name: '30-Day Streak',
  desc: 'Hit a 30 day streak',
  icon: '🏆',
  color: '#eab308',
  target: 30
}, {
  id: 'hundred',
  name: '100 Check-ins',
  desc: '100 total completions',
  icon: '💯',
  color: '#3b82f6',
  target: 100
}, {
  id: 'perfect',
  name: 'Perfect Week',
  desc: 'All habits, 7 days straight',
  icon: '⭐',
  color: '#8b5cf6',
  target: 7
}];

// tiny seeded RNG so sample data is stable across reloads
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
function seedHistory(recentStreak, rate) {
  const arr = [];
  for (let i = 0; i < 30; i++) {
    const daysAgo = 29 - i; // 0 = today
    if (daysAgo < recentStreak) arr.push(true);else arr.push(rand() < rate);
  }
  if (recentStreak === 0) arr[29] = false;
  return arr;
}
const SEED_HABITS = [{
  name: 'Drink 8 Glasses of Water',
  category: 'Health',
  icon: '💧',
  frequency: 'daily',
  reminder: '08:00',
  note: 'Stay hydrated, stay sharp.',
  streakTarget: 12,
  rate: 0.82
}, {
  name: 'Morning Run',
  category: 'Fitness',
  icon: '🏃',
  frequency: 'daily',
  reminder: '06:30',
  note: 'Even a short jog counts.',
  streakTarget: 5,
  rate: 0.6
}, {
  name: 'Meditate 10 Minutes',
  category: 'Mindfulness',
  icon: '🧘',
  frequency: 'daily',
  reminder: '07:00',
  note: 'Breathe in, breathe out.',
  streakTarget: 21,
  rate: 0.85
}, {
  name: 'Read 20 Pages',
  category: 'Learning',
  icon: '📚',
  frequency: 'daily',
  reminder: '21:00',
  note: 'A page a day keeps the mind sharp.',
  streakTarget: 3,
  rate: 0.55
}, {
  name: 'Plan Tomorrow',
  category: 'Productivity',
  icon: '📝',
  frequency: 'daily',
  reminder: '20:30',
  note: 'Future you will thank you.',
  streakTarget: 8,
  rate: 0.7
}, {
  name: 'Call a Friend or Family Member',
  category: 'Social',
  icon: '📞',
  frequency: 'weekly',
  reminder: '18:00',
  note: 'Stay connected.',
  streakTarget: 2,
  rate: 0.4
}, {
  name: 'Take Vitamins',
  category: 'Health',
  icon: '💊',
  frequency: 'daily',
  reminder: '08:15',
  note: 'Small habit, big payoff.',
  streakTarget: 30,
  rate: 0.97
}, {
  name: 'Stretch Before Bed',
  category: 'Fitness',
  icon: '🤸',
  frequency: 'daily',
  reminder: '22:00',
  note: 'Loosen up before sleep.',
  streakTarget: 0,
  rate: 0.5
}];
function buildSeedData() {
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
    createdAt: Date.now() - (30 - i) * 86400000
  }));
}
const STORAGE_KEY = 'habit-tracker-v1';
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    habits: buildSeedData(),
    theme: '#7c5cff',
    onboarded: false,
    notifications: true
  };
}
function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}
}

/* ---------------- date & stat helpers ---------------- */

function dateForIndex(idx) {
  // idx 0..29, 29 = today
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (29 - idx));
  return d;
}
function fmtDay(d) {
  return d.toLocaleDateString(undefined, {
    weekday: 'short'
  });
}
function fmtLong(d) {
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
}
function currentStreak(history) {
  let s = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]) s++;else break;
  }
  return s;
}
function bestStreak(history) {
  let best = 0,
    cur = 0;
  for (const v of history) {
    cur = v ? cur + 1 : 0;
    best = Math.max(best, cur);
  }
  return best;
}
function completionRate(history) {
  const done = history.filter(Boolean).length;
  return Math.round(done / history.length * 100);
}
function totalCompletions(habits) {
  return habits.reduce((sum, h) => sum + h.history.filter(Boolean).length, 0);
}

/* ---------------- small shared components ---------------- */

function CategoryIcon({
  category,
  size = 22
}) {
  const c = CATEGORIES[category] || {
    color: '#7c5cff',
    soft: '#efeaff',
    icon: '⭐'
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      width: size + 20,
      height: size + 20,
      borderRadius: 14,
      background: c.soft,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size,
      flexShrink: 0
    }
  }, c.icon);
}
function StreakBadge({
  count
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "streak-badge"
  }, "\uD83D\uDD25 ", count);
}
function ProgressRing({
  value,
  max,
  size = 54
}) {
  const pct = max ? Math.min(1, value / max) : 0;
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return /*#__PURE__*/React.createElement("svg", {
    className: "ring",
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`
  }, /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    stroke: "#eceafb",
    strokeWidth: "7",
    fill: "none"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    stroke: "url(#g1)",
    strokeWidth: "7",
    fill: "none",
    strokeDasharray: c,
    strokeDashoffset: c * (1 - pct),
    strokeLinecap: "round",
    transform: `rotate(-90 ${size / 2} ${size / 2})`
  }), /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: "g1",
    x1: "0",
    y1: "0",
    x2: "1",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: "#7c5cff"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: "#ff6fb0"
  }))), /*#__PURE__*/React.createElement("text", {
    x: "50%",
    y: "53%",
    textAnchor: "middle",
    fontSize: "13",
    fontWeight: "800",
    fill: "#1f2233"
  }, value, "/", max));
}
function CategoryChip({
  name,
  active,
  onClick
}) {
  const c = CATEGORIES[name];
  const style = active ? {
    background: c.color
  } : {};
  return /*#__PURE__*/React.createElement("button", {
    className: "chip" + (active ? " active" : ""),
    style: style,
    onClick: onClick
  }, /*#__PURE__*/React.createElement("span", null, c.icon), /*#__PURE__*/React.createElement("span", null, name));
}
function HabitCard({
  habit,
  onToggle,
  onOpen
}) {
  const c = CATEGORIES[habit.category];
  const doneToday = habit.history[29];
  const streak = currentStreak(habit.history);
  return /*#__PURE__*/React.createElement("div", {
    className: "habit-card",
    style: {
      '--cat-color': c.color,
      '--cat-soft': c.soft
    },
    onClick: () => onOpen(habit.id)
  }, /*#__PURE__*/React.createElement("span", {
    className: "habit-icon",
    style: {
      background: c.soft
    }
  }, habit.icon), /*#__PURE__*/React.createElement("div", {
    className: "habit-info"
  }, /*#__PURE__*/React.createElement("div", {
    className: "habit-name"
  }, habit.name, habit.paused ? ' ⏸' : ''), /*#__PURE__*/React.createElement("div", {
    className: "habit-meta"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cat-pill",
    style: {
      background: c.color
    }
  }, habit.category), /*#__PURE__*/React.createElement(StreakBadge, {
    count: streak
  }))), /*#__PURE__*/React.createElement("div", {
    className: "check-circle" + (doneToday ? " done" : ""),
    style: {
      '--cat-color': c.color
    },
    onClick: e => {
      e.stopPropagation();
      onToggle(habit.id);
    }
  }, doneToday ? '✓' : ''));
}
function ToggleSwitch({
  checked,
  onChange
}) {
  return /*#__PURE__*/React.createElement("button", {
    className: "toggle" + (checked ? " on" : ""),
    onClick: () => onChange(!checked)
  }, /*#__PURE__*/React.createElement("span", {
    className: "knob"
  }));
}

/* ---------------- Dashboard ---------------- */

function Dashboard({
  habits,
  onToggle,
  onOpenHabit,
  onAdd,
  filter,
  setFilter
}) {
  const shown = filter ? habits.filter(h => h.category === filter) : habits;
  const doneCount = habits.filter(h => h.history[29]).length;
  const today = new Date();
  if (habits.length === 0) {
    return /*#__PURE__*/React.createElement(EmptyState, {
      onAdd: onAdd
    });
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "top-header"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "date"
  }, today.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })), /*#__PURE__*/React.createElement("h1", null, "Good day! \uD83D\uDC4B")), /*#__PURE__*/React.createElement("button", {
    className: "avatar-btn"
  }, "\uD83D\uDE42")), /*#__PURE__*/React.createElement("div", {
    className: "progress-top"
  }, /*#__PURE__*/React.createElement(ProgressRing, {
    value: doneCount,
    max: habits.length
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "label"
  }, doneCount, "/", habits.length, " habits done today"), /*#__PURE__*/React.createElement("div", {
    className: "sub"
  }, "Keep the streak alive!"))), /*#__PURE__*/React.createElement("div", {
    className: "chip-row"
  }, /*#__PURE__*/React.createElement("button", {
    className: "chip" + (!filter ? " active" : ""),
    style: filter ? {} : {
      background: '#7c5cff',
      color: '#fff',
      borderColor: 'transparent'
    },
    onClick: () => setFilter(null)
  }, "\u2728 All"), CATEGORY_NAMES.map(name => /*#__PURE__*/React.createElement(CategoryChip, {
    key: name,
    name: name,
    active: filter === name,
    onClick: () => setFilter(filter === name ? null : name)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "section-title"
  }, "\uD83D\uDCCB Today's Habits"), shown.map(h => /*#__PURE__*/React.createElement(HabitCard, {
    key: h.id,
    habit: h,
    onToggle: onToggle,
    onOpen: onOpenHabit
  })), /*#__PURE__*/React.createElement("button", {
    className: "fab",
    onClick: onAdd
  }, "\u2795"));
}
function EmptyState({
  onAdd
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "top-header"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "date"
  }, "Today"), /*#__PURE__*/React.createElement("h1", null, "Habit Tracker")), /*#__PURE__*/React.createElement("button", {
    className: "avatar-btn"
  }, "\uD83D\uDE42")), /*#__PURE__*/React.createElement("div", {
    className: "empty-state"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ic"
  }, "\uD83C\uDF31"), /*#__PURE__*/React.createElement("h3", null, "No habits yet"), /*#__PURE__*/React.createElement("p", null, "Small steps every day add up to big changes.", /*#__PURE__*/React.createElement("br", null), "Add your first habit to get started."), /*#__PURE__*/React.createElement("button", {
    className: "empty-cta",
    onClick: onAdd
  }, "\u2795 Add your first habit")));
}

/* ---------------- Add / Edit Habit ---------------- */

function AddEditHabitForm({
  initial,
  onSave,
  onCancel,
  onDelete
}) {
  const [name, setName] = useState(initial ? initial.name : '');
  const [icon, setIcon] = useState(initial ? initial.icon : ICON_CHOICES[0]);
  const [category, setCategory] = useState(initial ? initial.category : CATEGORY_NAMES[0]);
  const [frequency, setFrequency] = useState(initial ? initial.frequency : 'daily');
  const [reminder, setReminder] = useState(initial ? initial.reminder : '09:00');
  const [note, setNote] = useState(initial ? initial.note : '');
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "overlay-header"
  }, /*#__PURE__*/React.createElement("button", {
    className: "icon-btn",
    onClick: onCancel
  }, "\u2190"), /*#__PURE__*/React.createElement("div", {
    className: "overlay-title"
  }, initial ? 'Edit Habit' : 'Add Habit')), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px'
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "Habit name"), /*#__PURE__*/React.createElement("input", {
    className: "text-input",
    placeholder: "e.g. Drink water",
    value: name,
    onChange: e => setName(e.target.value)
  }), /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "\uD83C\uDFA8 Pick an icon"), /*#__PURE__*/React.createElement("div", {
    className: "icon-grid"
  }, ICON_CHOICES.map(ic => /*#__PURE__*/React.createElement("div", {
    key: ic,
    className: "icon-choice" + (icon === ic ? " selected" : ""),
    onClick: () => setIcon(ic)
  }, ic))), /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "\uD83C\uDFF7\uFE0F Category"), /*#__PURE__*/React.createElement("div", {
    className: "color-grid"
  }, CATEGORY_NAMES.map(name2 => {
    const c = CATEGORIES[name2];
    const sel = category === name2;
    return /*#__PURE__*/React.createElement("div", {
      key: name2,
      className: "color-choice" + (sel ? " selected" : ""),
      style: {
        '--chip-color': c.color,
        '--chip-soft': c.soft
      },
      onClick: () => setCategory(name2)
    }, /*#__PURE__*/React.createElement("span", {
      className: "color-dot",
      style: {
        background: c.color
      }
    }, c.icon), name2);
  })), /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "\uD83D\uDCC5 Frequency"), /*#__PURE__*/React.createElement("div", {
    className: "seg-row"
  }, ['daily', 'weekly', 'custom'].map(f => /*#__PURE__*/React.createElement("button", {
    key: f,
    className: "seg-btn" + (frequency === f ? " selected" : ""),
    onClick: () => setFrequency(f)
  }, /*#__PURE__*/React.createElement("span", null, f === 'daily' ? '📆' : f === 'weekly' ? '🗓️' : '⚙️'), /*#__PURE__*/React.createElement("span", {
    style: {
      textTransform: 'capitalize'
    }
  }, f)))), /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "\u23F0 Reminder time"), /*#__PURE__*/React.createElement("input", {
    className: "text-input",
    type: "time",
    value: reminder,
    onChange: e => setReminder(e.target.value)
  }), /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "\uD83D\uDDD2\uFE0F Note (optional)"), /*#__PURE__*/React.createElement("input", {
    className: "text-input",
    placeholder: "A little motivation...",
    value: note,
    onChange: e => setNote(e.target.value)
  }), /*#__PURE__*/React.createElement("button", {
    className: "save-btn",
    disabled: !name.trim(),
    style: {
      opacity: name.trim() ? 1 : .5
    },
    onClick: () => name.trim() && onSave({
      name: name.trim(),
      icon,
      category,
      frequency,
      reminder,
      note
    })
  }, "\uD83D\uDCBE Save Habit"), initial && /*#__PURE__*/React.createElement("button", {
    className: "danger-btn",
    onClick: onDelete
  }, "\uD83D\uDDD1\uFE0F Delete Habit")));
}

/* ---------------- Habit Detail ---------------- */

function HeatmapGrid({
  history
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "heatmap"
  }, history.map((v, i) => {
    const d = dateForIndex(i);
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "heat-cell",
      title: d.toDateString(),
      style: {
        background: v ? '#7c5cff' : '#eceafb',
        opacity: v ? 0.5 + i / 30 * 0.5 : 1
      }
    });
  }));
}
function HabitDetail({
  habit,
  onBack,
  onEdit,
  onDelete,
  onTogglePause
}) {
  const c = CATEGORIES[habit.category];
  const streak = currentStreak(habit.history);
  const best = bestStreak(habit.history);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "detail-hero",
    style: {
      background: `linear-gradient(135deg, ${c.color}, ${c.color}cc)`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "icon-btn",
    style: {
      background: 'rgba(255,255,255,.25)',
      border: 'none',
      color: '#fff'
    },
    onClick: onBack
  }, "\u2190"), /*#__PURE__*/React.createElement("button", {
    className: "icon-btn",
    style: {
      background: 'rgba(255,255,255,.25)',
      border: 'none',
      color: '#fff'
    },
    onClick: () => onEdit(habit.id)
  }, "\u270F\uFE0F")), /*#__PURE__*/React.createElement("div", {
    className: "big-icon"
  }, habit.icon), /*#__PURE__*/React.createElement("h2", null, habit.name), /*#__PURE__*/React.createElement("div", {
    className: "cat"
  }, c.icon, " ", habit.category, " \xB7 ", habit.frequency)), /*#__PURE__*/React.createElement("div", {
    className: "stat-badges"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-badge"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ic"
  }, "\uD83D\uDD25"), /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, streak), /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, "Current streak")), /*#__PURE__*/React.createElement("div", {
    className: "stat-badge"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ic"
  }, "\uD83C\uDFC6"), /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, best), /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, "Best streak")), /*#__PURE__*/React.createElement("div", {
    className: "stat-badge"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ic"
  }, "\uD83D\uDCC8"), /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, completionRate(habit.history), "%"), /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, "30-day rate"))), /*#__PURE__*/React.createElement("div", {
    className: "section-title",
    style: {
      padding: '0 16px'
    }
  }, "\uD83D\uDDD3\uFE0F Last 30 days"), /*#__PURE__*/React.createElement(HeatmapGrid, {
    history: habit.history
  }), /*#__PURE__*/React.createElement("div", {
    className: "quick-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "quick-action",
    onClick: () => onEdit(habit.id)
  }, /*#__PURE__*/React.createElement("span", {
    className: "circle"
  }, "\u270F\uFE0F"), "Edit"), /*#__PURE__*/React.createElement("button", {
    className: "quick-action",
    onClick: () => onTogglePause(habit.id)
  }, /*#__PURE__*/React.createElement("span", {
    className: "circle"
  }, habit.paused ? '▶️' : '⏸️'), habit.paused ? 'Resume' : 'Pause'), /*#__PURE__*/React.createElement("button", {
    className: "quick-action",
    onClick: () => alert('Sharing "' + habit.name + '" 🎉 (demo only)')
  }, /*#__PURE__*/React.createElement("span", {
    className: "circle"
  }, "\uD83D\uDCE4"), "Share"), /*#__PURE__*/React.createElement("button", {
    className: "quick-action",
    onClick: () => onDelete(habit.id)
  }, /*#__PURE__*/React.createElement("span", {
    className: "circle"
  }, "\uD83D\uDDD1\uFE0F"), "Delete")), habit.note && /*#__PURE__*/React.createElement("div", {
    className: "note-box"
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCAC"), /*#__PURE__*/React.createElement("span", null, habit.note)));
}

/* ---------------- Calendar ---------------- */

function CalendarView({
  habits
}) {
  const [view, setView] = useState('month');
  const [selected, setSelected] = useState(null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const historyByDate = useMemo(() => {
    const map = {};
    for (let i = 0; i < 30; i++) {
      const key = dateForIndex(i).toDateString();
      map[key] = i;
    }
    return map;
  }, []);
  function dotsFor(date) {
    const idx = historyByDate[date.toDateString()];
    if (idx === undefined) return [];
    return habits.filter(h => h.history[idx]).map(h => CATEGORIES[h.category].color);
  }
  function habitsFor(date) {
    const idx = historyByDate[date.toDateString()];
    if (idx === undefined) return null;
    return habits.map(h => ({
      habit: h,
      done: h.history[idx]
    }));
  }
  let cells = [];
  if (view === 'month') {
    const y = today.getFullYear(),
      m = today.getMonth();
    const first = new Date(y, m, 1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
  } else {
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push(d);
    }
  }
  const monthLabel = today.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric'
  });
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "top-header"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "date"
  }, "History"), /*#__PURE__*/React.createElement("h1", null, "\uD83D\uDCC5 ", monthLabel))), /*#__PURE__*/React.createElement("div", {
    className: "cal-toggle"
  }, /*#__PURE__*/React.createElement("button", {
    className: view === 'month' ? 'active' : '',
    onClick: () => setView('month')
  }, "\uD83D\uDDD3\uFE0F Month"), /*#__PURE__*/React.createElement("button", {
    className: view === 'week' ? 'active' : '',
    onClick: () => setView('week')
  }, "\uD83D\uDCC6 Week")), /*#__PURE__*/React.createElement("div", {
    className: "cal-grid"
  }, ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "cal-dow"
  }, d)), cells.map((d, i) => {
    if (!d) return /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "cal-day empty"
    });
    const dots = dotsFor(d);
    const isToday = d.toDateString() === today.toDateString();
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "cal-day" + (isToday ? " today" : ""),
      onClick: () => setSelected(d)
    }, /*#__PURE__*/React.createElement("span", null, d.getDate()), /*#__PURE__*/React.createElement("div", {
      className: "dots"
    }, dots.slice(0, 5).map((c, j) => /*#__PURE__*/React.createElement("span", {
      key: j,
      className: "cal-dot",
      style: {
        background: c
      }
    }))));
  })), /*#__PURE__*/React.createElement("div", {
    className: "legend"
  }, CATEGORY_NAMES.map(name => /*#__PURE__*/React.createElement("div", {
    key: name,
    className: "legend-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "legend-dot",
    style: {
      background: CATEGORIES[name].color
    }
  }), CATEGORIES[name].icon, " ", name))), selected && (() => {
    const list = habitsFor(selected);
    return /*#__PURE__*/React.createElement("div", {
      className: "day-panel"
    }, /*#__PURE__*/React.createElement("div", {
      className: "section-title",
      style: {
        margin: '0 0 8px'
      }
    }, fmtLong(selected)), !list && /*#__PURE__*/React.createElement("div", {
      style: {
        color: 'var(--muted)',
        fontSize: 13
      }
    }, "No data outside the last 30 days."), list && list.map(({
      habit,
      done
    }) => /*#__PURE__*/React.createElement("div", {
      key: habit.id,
      className: "day-panel-row"
    }, /*#__PURE__*/React.createElement("span", null, habit.icon), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        fontWeight: 600,
        fontSize: 13
      }
    }, habit.name), /*#__PURE__*/React.createElement("span", null, done ? '✅' : '❌'))));
  })());
}

/* ---------------- Stats ---------------- */

function BarChart({
  habits
}) {
  const last7 = [];
  for (let idx = 23; idx <= 29; idx++) {
    const count = habits.filter(h => h.history[idx]).length;
    last7.push({
      d: dateForIndex(idx),
      count
    });
  }
  const max = Math.max(1, habits.length);
  return /*#__PURE__*/React.createElement("div", {
    className: "bar-chart"
  }, last7.map((item, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "bar-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bar",
    style: {
      height: item.count / max * 90 + '%'
    },
    title: item.count + ' done'
  }), /*#__PURE__*/React.createElement("span", {
    className: "dow"
  }, fmtDay(item.d)[0]))));
}
function DonutChart({
  habits
}) {
  const totals = CATEGORY_NAMES.map(name => {
    const t = habits.filter(h => h.category === name).reduce((s, h) => s + h.history.filter(Boolean).length, 0);
    return {
      name,
      total: t,
      color: CATEGORIES[name].color
    };
  }).filter(x => x.total > 0);
  const grand = totals.reduce((s, x) => s + x.total, 0) || 1;
  let acc = 0;
  const stops = totals.map(x => {
    const start = acc / grand * 360;
    acc += x.total;
    const end = acc / grand * 360;
    return `${x.color} ${start}deg ${end}deg`;
  });
  const bg = stops.length ? `conic-gradient(${stops.join(',')})` : '#eceafb';
  return /*#__PURE__*/React.createElement("div", {
    className: "donut-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "donut",
    style: {
      background: bg
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "donut-legend"
  }, totals.map(x => /*#__PURE__*/React.createElement("div", {
    key: x.name,
    className: "legend-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "legend-dot",
    style: {
      background: x.color
    }
  }), CATEGORIES[x.name].icon, " ", x.name, " \xB7 ", Math.round(x.total / grand * 100), "%"))));
}
function StatsView({
  habits
}) {
  const [range, setRange] = useState('week');
  const totalStreak = habits.reduce((s, h) => s + currentStreak(h.history), 0);
  const longest = habits.reduce((m, h) => Math.max(m, bestStreak(h.history)), 0);
  const avgRate = habits.length ? Math.round(habits.reduce((s, h) => s + completionRate(h.history), 0) / habits.length) : 0;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "top-header"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "date"
  }, "Overview"), /*#__PURE__*/React.createElement("h1", null, "\uD83D\uDCCA Stats"))), /*#__PURE__*/React.createElement("div", {
    className: "filter-row"
  }, ['week', 'month', 'year'].map(r => /*#__PURE__*/React.createElement("button", {
    key: r,
    className: range === r ? 'active' : '',
    onClick: () => setRange(r),
    style: {
      textTransform: 'capitalize'
    }
  }, r === 'week' ? '📅' : r === 'month' ? '🗓️' : '📆', " ", r))), /*#__PURE__*/React.createElement("div", {
    className: "stat-cards"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ic"
  }, "\uD83D\uDD25"), /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, totalStreak), /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, "Total streak days")), /*#__PURE__*/React.createElement("div", {
    className: "stat-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ic"
  }, "\uD83D\uDCC8"), /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, avgRate, "%"), /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, "Completion rate")), /*#__PURE__*/React.createElement("div", {
    className: "stat-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ic"
  }, "\uD83C\uDFC6"), /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, longest), /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, "Longest streak")), /*#__PURE__*/React.createElement("div", {
    className: "stat-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ic"
  }, "\uD83C\uDFAF"), /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, habits.length), /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, "Habits tracked"))), /*#__PURE__*/React.createElement("div", {
    className: "chart-card"
  }, /*#__PURE__*/React.createElement("h3", null, "\uD83D\uDCC9 Weekly completion trend"), /*#__PURE__*/React.createElement(BarChart, {
    habits: habits
  })), /*#__PURE__*/React.createElement("div", {
    className: "chart-card"
  }, /*#__PURE__*/React.createElement("h3", null, "\uD83C\uDF69 Category breakdown"), /*#__PURE__*/React.createElement(DonutChart, {
    habits: habits
  })));
}

/* ---------------- Settings ---------------- */

function SettingsView({
  theme,
  setTheme,
  notifications,
  setNotifications,
  onReplayOnboarding,
  onReset,
  habits
}) {
  function exportData() {
    const blob = new Blob([JSON.stringify(habits, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'habit-data.json';
    a.click();
    URL.revokeObjectURL(url);
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "top-header"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "date"
  }, "You"), /*#__PURE__*/React.createElement("h1", null, "\u2699\uFE0F Settings"))), /*#__PURE__*/React.createElement("div", {
    className: "profile-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "profile-avatar"
  }, "\uD83D\uDE42"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 16
    }
  }, "Habit Builder"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--muted)',
      fontSize: 12.5
    }
  }, "Member since today"))), /*#__PURE__*/React.createElement("div", {
    className: "settings-group"
  }, /*#__PURE__*/React.createElement("div", {
    className: "settings-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ic"
  }, "\uD83D\uDD14"), /*#__PURE__*/React.createElement("span", {
    className: "lbl"
  }, "Notifications"), /*#__PURE__*/React.createElement(ToggleSwitch, {
    checked: notifications,
    onChange: setNotifications
  })), /*#__PURE__*/React.createElement("div", {
    className: "settings-row",
    onClick: onReplayOnboarding
  }, /*#__PURE__*/React.createElement("span", {
    className: "ic"
  }, "\uD83C\uDFAC"), /*#__PURE__*/React.createElement("span", {
    className: "lbl"
  }, "Replay onboarding"), /*#__PURE__*/React.createElement("span", {
    className: "chev"
  }, "\u203A")), /*#__PURE__*/React.createElement("div", {
    className: "settings-row",
    onClick: exportData
  }, /*#__PURE__*/React.createElement("span", {
    className: "ic"
  }, "\u2B07\uFE0F"), /*#__PURE__*/React.createElement("span", {
    className: "lbl"
  }, "Export data"), /*#__PURE__*/React.createElement("span", {
    className: "chev"
  }, "\u203A")), /*#__PURE__*/React.createElement("div", {
    className: "settings-row",
    onClick: onReset
  }, /*#__PURE__*/React.createElement("span", {
    className: "ic"
  }, "\uD83D\uDD04"), /*#__PURE__*/React.createElement("span", {
    className: "lbl"
  }, "Reset sample data"), /*#__PURE__*/React.createElement("span", {
    className: "chev"
  }, "\u203A")), /*#__PURE__*/React.createElement("div", {
    className: "settings-row",
    onClick: () => alert('Habit Tracker v1.0\nA demo app for design exploration.')
  }, /*#__PURE__*/React.createElement("span", {
    className: "ic"
  }, "\u2139\uFE0F"), /*#__PURE__*/React.createElement("span", {
    className: "lbl"
  }, "About"), /*#__PURE__*/React.createElement("span", {
    className: "chev"
  }, "\u203A")), /*#__PURE__*/React.createElement("div", {
    className: "settings-row",
    onClick: () => alert('Need help? This is a demo app — no real support exists yet 🙂')
  }, /*#__PURE__*/React.createElement("span", {
    className: "ic"
  }, "\u2753"), /*#__PURE__*/React.createElement("span", {
    className: "lbl"
  }, "Help"), /*#__PURE__*/React.createElement("span", {
    className: "chev"
  }, "\u203A"))), /*#__PURE__*/React.createElement("div", {
    className: "section-title"
  }, "\uD83C\uDFA8 Theme color"), /*#__PURE__*/React.createElement("div", {
    className: "settings-group"
  }, /*#__PURE__*/React.createElement("div", {
    className: "theme-swatches"
  }, THEME_SWATCHES.map(c => /*#__PURE__*/React.createElement("div", {
    key: c,
    className: "swatch" + (theme === c ? " selected" : ""),
    style: {
      background: c,
      '--sw-color': c
    },
    onClick: () => setTheme(c)
  })))));
}

/* ---------------- Onboarding ---------------- */

const OB_SLIDES = [{
  icon: '🌱',
  title: 'Build habits that stick',
  body: 'Track daily routines across health, fitness, mindfulness and more — all in one colorful place.'
}, {
  icon: '🔥',
  title: 'Watch your streaks grow',
  body: 'Every check-in builds momentum. See your streaks, history and progress at a glance.'
}, {
  icon: '🏆',
  title: 'Celebrate the wins',
  body: 'Unlock achievements as you go, and stay motivated with stats that show real progress.'
}];
function OnboardingOverlay({
  onDone
}) {
  const [i, setI] = useState(0);
  const slide = OB_SLIDES[i];
  const bg = ['#7c5cff', '#f97316', '#22c55e'][i];
  return /*#__PURE__*/React.createElement("div", {
    className: "onboarding",
    style: {
      background: `linear-gradient(160deg, ${bg}, ${bg}cc)`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "ob-slide"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ob-icon"
  }, slide.icon), /*#__PURE__*/React.createElement("h2", null, slide.title), /*#__PURE__*/React.createElement("p", null, slide.body)), /*#__PURE__*/React.createElement("div", {
    className: "ob-dots"
  }, OB_SLIDES.map((_, idx) => /*#__PURE__*/React.createElement("span", {
    key: idx,
    className: "ob-dot" + (idx === i ? " active" : "")
  }))), /*#__PURE__*/React.createElement("div", {
    className: "ob-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "ob-skip",
    onClick: onDone
  }, "Skip"), /*#__PURE__*/React.createElement("button", {
    className: "ob-next",
    onClick: () => i < OB_SLIDES.length - 1 ? setI(i + 1) : onDone()
  }, i < OB_SLIDES.length - 1 ? 'Next' : "Let's go 🚀")));
}

/* ---------------- Achievements ---------------- */

function AchievementsView({
  habits
}) {
  const maxStreak = habits.reduce((m, h) => Math.max(m, currentStreak(h.history)), 0);
  const maxBest = habits.reduce((m, h) => Math.max(m, bestStreak(h.history)), 0);
  const total = totalCompletions(habits);
  const perfectWeek = habits.length > 0 && habits.every(h => h.history.slice(23, 30).every(Boolean));
  const progressFor = a => {
    if (a.id === 'first') return habits.length > 0 ? 1 : 0;
    if (a.id === 'week' || a.id === 'month') return Math.min(1, maxBest / a.target);
    if (a.id === 'hundred') return Math.min(1, total / a.target);
    if (a.id === 'perfect') return perfectWeek ? 1 : 0;
    return 0;
  };
  const unlockedFor = a => progressFor(a) >= 1;
  const next = ACHIEVEMENTS.find(a => !unlockedFor(a)) || ACHIEVEMENTS[ACHIEVEMENTS.length - 1];
  const nextProgress = progressFor(next);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "top-header"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "date"
  }, "Milestones"), /*#__PURE__*/React.createElement("h1", null, "\uD83C\uDFC6 Achievements"))), /*#__PURE__*/React.createElement("div", {
    className: "badge-grid"
  }, ACHIEVEMENTS.map(a => {
    const unlocked = unlockedFor(a);
    return /*#__PURE__*/React.createElement("div", {
      key: a.id,
      className: "badge-card" + (unlocked ? "" : " locked")
    }, !unlocked && /*#__PURE__*/React.createElement("span", {
      className: "lock-pill"
    }, "\uD83D\uDD12"), /*#__PURE__*/React.createElement("div", {
      className: "bic",
      style: {
        background: unlocked ? a.color : '#eceafb',
        color: unlocked ? '#fff' : '#a3a7bd'
      }
    }, a.icon), /*#__PURE__*/React.createElement("div", {
      className: "bname"
    }, a.name), /*#__PURE__*/React.createElement("div", {
      className: "bdesc"
    }, a.desc));
  })), /*#__PURE__*/React.createElement("div", {
    className: "next-progress"
  }, /*#__PURE__*/React.createElement("div", {
    className: "row"
  }, /*#__PURE__*/React.createElement("span", null, "Next: ", next.icon, " ", next.name), /*#__PURE__*/React.createElement("span", null, Math.round(nextProgress * 100), "%")), /*#__PURE__*/React.createElement("div", {
    className: "bar-track"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bar-fill",
    style: {
      width: nextProgress * 100 + '%'
    }
  }))));
}

/* ---------------- Bottom nav ---------------- */

function BottomNav({
  tab,
  setTab
}) {
  const tabs = [{
    id: 'dashboard',
    ic: '🏠',
    label: 'Home'
  }, {
    id: 'calendar',
    ic: '📅',
    label: 'Calendar'
  }, {
    id: 'stats',
    ic: '📊',
    label: 'Stats'
  }, {
    id: 'achievements',
    ic: '🏆',
    label: 'Awards'
  }, {
    id: 'settings',
    ic: '⚙️',
    label: 'Settings'
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "bottom-nav"
  }, tabs.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.id,
    className: "nav-btn" + (tab === t.id ? " active" : ""),
    onClick: () => setTab(t.id)
  }, /*#__PURE__*/React.createElement("span", {
    className: "ic"
  }, t.ic), /*#__PURE__*/React.createElement("span", null, t.label))));
}

/* ---------------- App root ---------------- */

function App() {
  const [state, setState] = useState(loadState);
  const [tab, setTab] = useState('dashboard');
  const [overlay, setOverlay] = useState(null); // {type:'add'|'edit'|'detail', habitId}
  const [filter, setFilter] = useState(null);
  useEffect(() => {
    saveState(state);
  }, [state]);
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', state.theme);
  }, [state.theme]);
  useEffect(() => {
    if (!state.onboarded) setOverlay({
      type: 'onboarding'
    });
  }, []);
  function toggleHabit(id) {
    setState(s => ({
      ...s,
      habits: s.habits.map(h => h.id === id ? {
        ...h,
        history: h.history.map((v, i) => i === 29 ? !v : v)
      } : h)
    }));
  }
  function addHabit(data) {
    setState(s => ({
      ...s,
      habits: [...s.habits, {
        id: 'habit_' + Date.now(),
        ...data,
        paused: false,
        history: new Array(30).fill(false),
        createdAt: Date.now()
      }]
    }));
    setOverlay(null);
  }
  function updateHabit(id, data) {
    setState(s => ({
      ...s,
      habits: s.habits.map(h => h.id === id ? {
        ...h,
        ...data
      } : h)
    }));
    setOverlay(null);
  }
  function deleteHabit(id) {
    if (!confirm('Delete this habit? This cannot be undone.')) return;
    setState(s => ({
      ...s,
      habits: s.habits.filter(h => h.id !== id)
    }));
    setOverlay(null);
  }
  function togglePause(id) {
    setState(s => ({
      ...s,
      habits: s.habits.map(h => h.id === id ? {
        ...h,
        paused: !h.paused
      } : h)
    }));
  }
  function finishOnboarding() {
    setState(s => ({
      ...s,
      onboarded: true
    }));
    setOverlay(null);
  }
  function resetSample() {
    if (!confirm('Reset to sample data? Your changes will be lost.')) return;
    setState(s => ({
      ...s,
      habits: buildSeedData()
    }));
  }
  const editingHabit = overlay && overlay.type === 'edit' ? state.habits.find(h => h.id === overlay.habitId) : null;
  const detailHabit = overlay && overlay.type === 'detail' ? state.habits.find(h => h.id === overlay.habitId) : null;
  return /*#__PURE__*/React.createElement("div", {
    className: "app-shell"
  }, tab === 'dashboard' && /*#__PURE__*/React.createElement(Dashboard, {
    habits: state.habits,
    onToggle: toggleHabit,
    onOpenHabit: id => setOverlay({
      type: 'detail',
      habitId: id
    }),
    onAdd: () => setOverlay({
      type: 'add'
    }),
    filter: filter,
    setFilter: setFilter
  }), tab === 'calendar' && /*#__PURE__*/React.createElement(CalendarView, {
    habits: state.habits
  }), tab === 'stats' && /*#__PURE__*/React.createElement(StatsView, {
    habits: state.habits
  }), tab === 'achievements' && /*#__PURE__*/React.createElement(AchievementsView, {
    habits: state.habits
  }), tab === 'settings' && /*#__PURE__*/React.createElement(SettingsView, {
    theme: state.theme,
    setTheme: c => setState(s => ({
      ...s,
      theme: c
    })),
    notifications: state.notifications,
    setNotifications: v => setState(s => ({
      ...s,
      notifications: v
    })),
    onReplayOnboarding: () => setOverlay({
      type: 'onboarding'
    }),
    onReset: resetSample,
    habits: state.habits
  }), /*#__PURE__*/React.createElement(BottomNav, {
    tab: tab,
    setTab: setTab
  }), overlay && overlay.type === 'add' && /*#__PURE__*/React.createElement("div", {
    className: "overlay"
  }, /*#__PURE__*/React.createElement(AddEditHabitForm, {
    onSave: addHabit,
    onCancel: () => setOverlay(null)
  })), overlay && overlay.type === 'edit' && editingHabit && /*#__PURE__*/React.createElement("div", {
    className: "overlay"
  }, /*#__PURE__*/React.createElement(AddEditHabitForm, {
    initial: editingHabit,
    onSave: data => updateHabit(editingHabit.id, data),
    onCancel: () => setOverlay(null),
    onDelete: () => deleteHabit(editingHabit.id)
  })), overlay && overlay.type === 'detail' && detailHabit && /*#__PURE__*/React.createElement("div", {
    className: "overlay"
  }, /*#__PURE__*/React.createElement(HabitDetail, {
    habit: detailHabit,
    onBack: () => setOverlay(null),
    onEdit: id => setOverlay({
      type: 'edit',
      habitId: id
    }),
    onDelete: deleteHabit,
    onTogglePause: togglePause
  })), overlay && overlay.type === 'onboarding' && /*#__PURE__*/React.createElement(OnboardingOverlay, {
    onDone: finishOnboarding
  }));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
