# Habit Tracker (design-tool test app)

A single-file, no-build React app built as a **reference/test app** for
evaluating a UI design tool — not a production habit tracker. It exists to
give the design tool distinct, icon-and-color-dense screens to redesign.

## Run it

No build step, no install. Just open `index.html` in a browser, or serve it:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

React, ReactDOM, and Babel Standalone load from CDN and the JSX is
transpiled in the browser. Data is seeded on first load and persisted to
`localStorage` after that.

## Screens

- **Dashboard** — today's habits, category filter chips, progress ring, FAB to add
- **Add/Edit Habit** — name, icon picker, category/color picker, frequency, reminder time
- **Habit Detail** — hero header, streak stat badges, 30-day heatmap, quick actions
- **Calendar/History** — month/week toggle, per-day category dots, day detail panel
- **Stats** — summary cards, weekly bar chart, category donut chart
- **Settings** — profile header, toggles, theme color picker, data export
- **Onboarding** — 3-slide intro with dot navigation, replayable from Settings
- **Achievements** — badge grid (locked/unlocked), progress toward the next one
- **Empty state** — shown automatically if all habits are deleted

## Sample data

8 habits seeded across Health, Fitness, Mindfulness, Learning, Productivity,
and Social, each with a name, icon, color, streak, and 30 days of
completion history. Reset anytime from Settings → "Reset sample data".

## Structure

Everything lives in `index.html`: CSS in `<style>`, components and app
logic in one `<script type="text/babel">` block, organized top-to-bottom as
constants/sample data → helpers → shared components → per-screen
components → `App` root. Components are named for isolated redesign
(`HabitCard`, `StreakBadge`, `CategoryIcon`, `ProgressRing`, `HeatmapGrid`,
`DonutChart`, etc).
