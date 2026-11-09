import { defineStore } from 'pinia'
import {
  isFermentationMode,
  isSizingMode,
  isSoakerKind,
  isVorteigType,
  matchStarterPreset,
  soakerDefinitions,
  starterPresets,
  type DoughState,
  type FermentationMode,
  type SizingMode,
  type SoakerKind,
  type StarterPresetId,
  type VorteigType,
} from '@/types/dough'
import type { DoughResult } from '@/types/dough-result'
import { calculateDough, soakerDryPercentForGrams } from '@/utils/dough-calculator'
import { formatClockTime, parseClockTime } from '@/utils/schedule'
import { createDefaultState, createSoaker, createVorteig, fitField } from '@/utils/schema'
import {
  STORAGE_KEY,
  clearLegacyVersion,
  readLegacyVersion,
  restoreState,
  serializeState,
} from './persistence'

export const useDoughStore = defineStore('dough', {
  state: (): DoughState => createDefaultState(),

  getters: {
    result: (state): DoughResult => calculateDough(state),
  },

  actions: {
    /** Wechselt die Größenvorgabe, ohne das Rezept zu ändern. */
    setSizingMode(mode: SizingMode) {
      if (!isSizingMode(mode) || mode === this.sizingMode) return
      const result = this.result
      if (mode === 'flour') {
        this.totalFlour = fitField('totalFlour', result.totalFlour)
      } else {
        // Der Verlust steckt im Teiggewicht; je Teigling bleibt der Rest.
        const pieces = this.pieceCount * (1 + this.lossPercent / 100)
        this.pieceWeight = fitField('pieceWeight', result.doughWeight / pieces)
      }
      this.sizingMode = mode
    },

    /** Wechselt zwischen Menge und Zeit; die berechneten Werte werden übernommen. */
    setFermentationMode(mode: FermentationMode) {
      if (!isFermentationMode(mode) || mode === this.fermentation.mode) return
      const result = this.result
      if (mode === 'amount') {
        this.starter.percent = fitField('starterPercent', result.leavening.sourdoughPercent)
        this.yeastPercent = fitField('yeastPercent', result.leavening.yeastPercent)
        this.vorteige.forEach((v, i) => {
          const resolved = result.vorteige[i]
          if (resolved) v.yeastPercent = fitField('vorteigYeastPercent', resolved.yeastPercent)
        })
      } else {
        if (result.leavening.roomHours !== null) {
          this.fermentation.roomHours = fitField('roomHours', result.leavening.roomHours)
        }
        this.fermentation.sourdoughShare = fitField(
          'sourdoughShare',
          result.leavening.sourdoughShare,
        )
        this.vorteige.forEach((v, i) => {
          const hours = result.vorteige[i]?.hours
          if (hours !== undefined && hours !== null) {
            v.fermentationHours = fitField('vorteigHours', hours)
          }
        })
      }
      this.fermentation.mode = mode
    },

    applyStarterPreset(id: StarterPresetId) {
      if (id === 'custom') {
        this.starter.preset = 'custom'
        return
      }
      const preset = starterPresets.find((p) => p.id === id)
      if (!preset) return
      this.starter.flour = preset.flour
      this.starter.water = preset.water
      this.starter.preset = preset.id
    },

    setStarterParts(part: 'flour' | 'water', value: number) {
      this.starter[part] = fitField(part === 'flour' ? 'starterFlour' : 'starterWater', value)
      this.starter.preset = matchStarterPreset(this.starter.flour, this.starter.water)
    },

    addVorteig(type: VorteigType = 'poolish') {
      this.vorteige.push(createVorteig(type))
    },

    removeVorteig(id: string) {
      this.vorteige = this.vorteige.filter((v) => v.id !== id)
    },

    /** Ein Typwechsel setzt alle Werte auf die Defaults des Typs. */
    setVorteigType(id: string, type: VorteigType) {
      if (!isVorteigType(type)) return
      const index = this.vorteige.findIndex((v) => v.id === id)
      if (index >= 0) this.vorteige.splice(index, 1, createVorteig(type, id))
    },

    addSoaker(kind: SoakerKind = 'sunflower') {
      this.soakers.push(createSoaker(kind))
    },

    removeSoaker(id: string) {
      this.soakers = this.soakers.filter((s) => s.id !== id)
    },

    /** Neuer Typ mit seinem Standardverhältnis; die Trockenmenge in Gramm bleibt. */
    setSoakerKind(id: string, kind: SoakerKind) {
      if (!isSoakerKind(kind)) return
      const soaker = this.soakers.find((s) => s.id === id)
      const current = this.result.soakers.find((s) => s.id === id)
      if (!soaker || !current) return
      const waterRatio = soakerDefinitions[kind].defaultWaterRatio
      const dryPercent = soakerDryPercentForGrams(
        this.$state,
        { id, kind, waterRatio },
        current.dry,
      )
      soaker.kind = kind
      soaker.waterRatio = waterRatio
      if (dryPercent !== null) soaker.dryPercent = dryPercent
    },

    /** Neue Trockenmenge; das Wasser wächst im gleichen Verhältnis mit. */
    setSoakerDryGrams(id: string, grams: number) {
      const soaker = this.soakers.find((s) => s.id === id)
      if (!soaker) return
      const dryPercent = soakerDryPercentForGrams(
        this.$state,
        { id, kind: soaker.kind, waterRatio: soaker.waterRatio },
        grams,
      )
      if (dryPercent !== null) soaker.dryPercent = dryPercent
    },

    /** Neue Wassermenge; sie wird zum Verhältnis dieser Einlage, die Trockenmenge bleibt. */
    setSoakerWaterGrams(id: string, grams: number) {
      const soaker = this.soakers.find((s) => s.id === id)
      const current = this.result.soakers.find((s) => s.id === id)
      if (!soaker || !current || !(current.dry > 0) || !(grams >= 0)) return
      const waterRatio = fitField('soakerWaterRatio', grams / current.dry)
      const dryPercent = soakerDryPercentForGrams(
        this.$state,
        { id, kind: soaker.kind, waterRatio },
        current.dry,
      )
      soaker.waterRatio = waterRatio
      if (dryPercent !== null) soaker.dryPercent = dryPercent
    },

    /** Übernimmt nur gültige Uhrzeiten; ein geleertes Feld wird ignoriert. */
    setBakeTime(value: string) {
      const minutes = parseClockTime(value)
      if (minutes !== null) this.bakeTime = formatClockTime(minutes)
    },
  },

  persist: {
    key: STORAGE_KEY,
    serializer: {
      serialize: serializeState,
      deserialize: (raw: string) => restoreState(raw, readLegacyVersion()),
    },
    afterHydrate({ store }) {
      clearLegacyVersion()
      // $subscribe ist zu diesem Zeitpunkt noch nicht aktiv → migrierten Stand sofort speichern
      store.$persist()
    },
  },
})
