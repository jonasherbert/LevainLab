# LevainLab

Hydration, starters and baker's math.

A dough calculator for sourdough bakers. Enter your total flour, target hydration, starter percentage and any soakers — LevainLab computes the exact amounts for your main dough.

## Features

- **Baker's percentages** — salt, yeast, malt as % of total flour
- **Starter** — set percentage and hydration, see computed weight
- **Soakers** — add cooked, scalded or soaked ingredients with flour/water split
- **Recipe overview** — all ingredients with effective hydration
- **Persistent state** — inputs saved to localStorage

## Tech Stack

- Vue 3 + TypeScript
- Vuetify 3 (Material Design)
- Tailwind CSS 4
- Pinia (with persisted state)
- Vite

## Setup

```sh
npm install
npm run dev
```

## Scripts

| Command             | Description                         |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Start dev server                    |
| `npm run build`     | Type-check and build for production |
| `npm run test:unit` | Run unit tests (Vitest)             |
| `npm run lint`      | Lint with ESLint + oxlint           |
| `npm run format`    | Format with Prettier                |
