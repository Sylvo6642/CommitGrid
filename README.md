# CommitGrid

[![npm version](https://badge.fury.io/js/commitgrid.svg)](https://www.npmjs.com/package/commitgrid)
[![npm downloads](https://img.shields.io/npm/dm/commitgrid.svg)](https://www.npmjs.com/package/commitgrid)
[![license](https://img.shields.io/npm/l/commitgrid.svg)](https://github.com/Sylvo6642/CommitGrid/blob/main/LICENSE)

> Animated GitHub-style contributions heatmap for React. You fetch the data — it handles the rendering.

---

## Features

- Spring-scale entry animation on scroll into view
- Count-up animation on the total contributions number
- Animated ping ring on today's cell
- Pulsing glow on high-activity cells
- Dark / light / auto theme support
- Fully customizable colors — per theme or from a single seed color
- Square, rounded, or circle cell shapes
- Zero config — works out of the box

---

## Install

```bash
npm install commitgrid framer-motion
```

---

## Usage

```tsx
import { GitHubContributionsGraph } from 'commitgrid';

<GitHubContributionsGraph data={contributionData} />
```

---

## Data shape

The component expects this format — which matches the GitHub GraphQL API response directly:

```ts
{
  totalContributions: number;
  weeks: {
    contributionDays: {
      date: string;           // "2024-01-15"
      contributionCount: number;
    }[];
  }[];
}
```

---

## Fetching from GitHub

Query the GitHub GraphQL API with a personal access token:

```ts
const query = `{
  user(login: "your-username") {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            date
            contributionCount
          }
        }
      }
    }
  }
}`;

const res = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: { Authorization: `bearer ${token}` },
  body: JSON.stringify({ query }),
});

const { data } = await res.json();
const contributionData = data.user.contributionsCollection.contributionCalendar;
```

> **Note:** Never expose your GitHub token on the frontend. Run this fetch on a server or edge function and pass the result as a prop.

---

## Props

### Data & layout

| Prop | Type | Default | Description |
|---|---|---|---|
| `data` | `ContributionData` | required | Contribution data to render |
| `theme` | `"dark" \| "light" \| "auto"` | `"auto"` | `"auto"` watches the `dark` class on `<html>` |
| `darkColors` | `[string, string, string, string, string]` | purple scale | 5 colors from empty → most active (dark mode) |
| `lightColors` | `[string, string, string, string, string]` | purple scale | 5 colors from empty → most active (light mode) |
| `seedColor` | `string` | — | Single color to auto-generate both scales. Overridden by explicit scales. |
| `cellSize` | `number` | `13` | Cell size in px |
| `cellGap` | `number` | `3` | Gap between cells in px |
| `cellShape` | `"square" \| "rounded" \| "circle"` | `"square"` | Shape of each cell |
| `showTotal` | `boolean` | `true` | Show total contribution count |
| `showLegend` | `boolean` | `true` | Show Less/More legend |
| `className` | `string` | — | Class name on the wrapper div |

### Animations

| Prop | Type | Default | Description |
|---|---|---|---|
| `animate` | `boolean` | `true` | Spring-scale entry animation on scroll into view |
| `countUp` | `boolean` | `true` | Animate total contributions from 0 → real value |
| `todayIndicator` | `boolean` | `true` | Animated ping ring on the latest day's cell |
| `pulseHighActivity` | `boolean` | `true` | Breathing glow on the most-active cells |
| `pulseIntensity` | `number` | `2` | Glow strength — `0` invisible, `2` noticeable, `6` dramatic |
| `pulseDuration` | `number` | `2.4` | Pulse cycle length in seconds |
| `todayIndicatorColor` | `string` | `COLORS[4]` | Override the today-indicator ring color |
| `pulseColor` | `string` | `COLORS[4]` | Override the pulse glow color |

All color props accept any valid CSS color: `#rgb`, `#rrggbb`, `rgb()`, `hsl()`, or named colors like `"cyan"`.

---

## Custom colors

Pass a full 5-step scale for one or both themes:

```tsx
<GitHubContributionsGraph
  data={data}
  darkColors={['#0d1117', '#0e4429', '#006d32', '#26a641', '#39d353']}
  lightColors={['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39']}
/>
```

Or use a single `seedColor` and let the component derive both scales automatically:

```tsx
<GitHubContributionsGraph data={data} seedColor="#22d3ee" />
```

You can also call the helper directly to tweak the generated scales:

```tsx
import { generateColorScales } from 'commitgrid';

const { dark, light } = generateColorScales('tomato');
```

---

## Tuning animations

```tsx
<GitHubContributionsGraph
  data={data}
  pulseIntensity={3}
  pulseDuration={3}
  todayIndicatorColor="#22d3ee"
  pulseColor="#22d3ee"
/>
```

To disable all motion entirely:

```tsx
<GitHubContributionsGraph
  data={data}
  animate={false}
  countUp={false}
  todayIndicator={false}
  pulseHighActivity={false}
/>
```

---

## No framer-motion?

Set `animate={false}` to skip the entry animation. framer-motion is still a peer dependency. For a fully static graph, also disable `todayIndicator` and `pulseHighActivity` — they use framer-motion internally. `countUp` uses plain `requestAnimationFrame` and is independent.

---

## License

MIT
