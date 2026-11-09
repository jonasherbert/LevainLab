# LevainLab

Hydration, starters and baker's math.

A dough calculator for sourdough bakers. Enter the flour (or the number and weight of your loaves), hydration, starter and any pre-ferments or soakers — LevainLab computes the exact amounts, the water temperature and a baking schedule.

## Features

- **Sizing** — by total flour or by number × weight of the dough pieces, with an allowance for processing losses (default 3 %)
- **Starter** — feeding presets (stiff, liquid, Lievito Madre, rye) with TA, ripening time and reserve; the seed's flour and water are part of the dough balance
- **Fermentation** — enter the amounts and get the estimated proofing time, or enter the time and get the amounts; optional yeast alongside the sourdough, fridge proof including cool-down, active or inactive malt
- **Oil/fat** — optional, as % of flour; counts towards the dough weight, not the hydration
- **Pre-ferments** — poolish and biga, yeast relative to the pre-ferment's own flour
- **Soakers** — entered in grams, scaled with the flour; grain products count as flour (their water counts towards hydration), oil seeds keep their soaking water bound
- **Dough temperature** — water temperature for the target dough temperature
- **Recipe view** — a separate tab with the key figures and the recipe as a timeline: every step with its time (planned backwards from the bake time) and the amounts it needs
- **Advanced settings** — rarely needed temperatures, malt type and kneading friction are collapsed by default
- **Warnings** — overflow and plausibility checks, counted on the recipe tab
- **Persistent state** — inputs are saved to localStorage and migrated between schema versions

## How the calculation works

All maths lives in pure TypeScript under `src/utils` (no Vue imports); components only format the result of `calculateDough`.

- **Baker's math** — everything is relative to the total flour, which includes the flour in the starter (incl. seed), the pre-ferments and grain soakers.
- **Fermentation model** (`src/utils/fermentation.ts`) — each leavening agent follows a power law: the amount needed for an effective fermentation time `t` is `p_ref · (t_ref / t)^a`; temperature enters via Q10. The constants are starting values from common baking practice and can be calibrated with your own bakes.

## Tech Stack

- Vue 3 + TypeScript
- Vuetify 4 (Material Design)
- Pinia (with persisted state)
- Vite, Vitest

## Setup

```sh
npm install
npm run dev
```

## Scripts

| Command                      | Description                         |
| ---------------------------- | ----------------------------------- |
| `npm run dev`                | Start dev server                    |
| `npm run build`              | Type-check and build for production |
| `npm run test:unit -- --run` | Run unit and component tests once   |
| `npm run lint`               | Lint with ESLint + oxlint           |
| `npm run format`             | Format with Prettier                |

## Notes

- Component templates live in separate `.html` files. `vue-tsc` and ESLint do not check them, so the component tests in `src/components/DoughCalculator.test.ts` fail on any Vue warning instead.
- When the stored state changes shape, bump `SCHEMA_VERSION` in `src/stores/persistence.ts` and add a migration.
