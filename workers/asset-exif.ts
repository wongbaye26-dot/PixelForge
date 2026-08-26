import { existsSync } from 'node:fs'
import exifr from 'exifr'
import sharp from 'sharp'

export interface AssetExifInfo {
  make?: string
  model?: string
  lens?: string
  dateTime?: string
  exposureTime?: string
  fNumber?: string
  iso?: number
  focalLength?: string
  gps?: string
  orientation?: number
  software?: string
}

export interface AssetMetadataResponse {
  exif: AssetExifInfo
  hasExif: boolean
  colorSpace?: string
  density?: number
  hasProfile?: boolean
}

function formatExposure(seconds: number | undefined): string | undefined {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return undefined
  if (seconds >= 1) return `${seconds.toFixed(1)}s`
  const denom = Math.round(1 / seconds)
  return denom > 0 ? `1/${denom}s` : undefined
}

function formatFNumber(value: number | undefined): string | undefined {
  if (value == null || !Number.isFinite(value)) return undefined
  return `f/${value.toFixed(1).replace(/\.0$/, '')}`
}

function formatFocalLength(value: number | undefined): string | undefined {
  if (value == null || !Number.isFinite(value)) return undefined
  return `${value.toFixed(1).replace(/\.0$/, '')} mm`
}

function formatGps(lat?: number, lon?: number): string | undefined {
  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return undefined
  const latH = lat >= 0 ? 'N' : 'S'
  const lonH = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(5)}° ${latH}, ${Math.abs(lon).toFixed(5)}° ${lonH}`
}

function formatDate(value: unknown): string | undefined {
  if (!value) return undefined
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('zh-CN')
}

export async function readAssetMetadata(filePath: string): Promise<AssetMetadataResponse> {
  if (!existsSync(filePath)) {
    return { exif: {}, hasExif: false }
  }

  let colorSpace: string | undefined
  let density: number | undefined
  let hasProfile: boolean | undefined
  try {
    const meta = await sharp(filePath, { limitInputPixels: false }).metadata()
    colorSpace = meta.space
    density = meta.density
    hasProfile = meta.hasProfile
  } catch {
    /* ignore sharp errors */
  }

  try {
    const raw = (await exifr.parse(filePath, {
      pick: [
        'Make',
        'Model',
        'LensModel',
        'DateTimeOriginal',
        'CreateDate',
        'ExposureTime',
        'FNumber',
        'ISO',
        'FocalLength',
        'latitude',
        'longitude',
        'Orientation',
        'Software',
      ],
    })) as Record<string, unknown> | null

    if (!raw) {
      return { exif: {}, hasExif: false, colorSpace, density, hasProfile }
    }

    const exif: AssetExifInfo = {
      make: typeof raw.Make === 'string' ? raw.Make : undefined,
      model: typeof raw.Model === 'string' ? raw.Model : undefined,
      lens: typeof raw.LensModel === 'string' ? raw.LensModel : undefined,
      dateTime: formatDate(raw.DateTimeOriginal ?? raw.CreateDate),
      exposureTime: formatExposure(typeof raw.ExposureTime === 'number' ? raw.ExposureTime : undefined),
      fNumber: formatFNumber(typeof raw.FNumber === 'number' ? raw.FNumber : undefined),
      iso: typeof raw.ISO === 'number' ? raw.ISO : undefined,
      focalLength: formatFocalLength(typeof raw.FocalLength === 'number' ? raw.FocalLength : undefined),
      gps: formatGps(
        typeof raw.latitude === 'number' ? raw.latitude : undefined,
        typeof raw.longitude === 'number' ? raw.longitude : undefined,
      ),
      orientation: typeof raw.Orientation === 'number' ? raw.Orientation : undefined,
      software: typeof raw.Software === 'string' ? raw.Software : undefined,
    }

    const hasExif = Object.values(exif).some((v) => v != null && v !== '')
    return { exif, hasExif, colorSpace, density, hasProfile }
  } catch {
    return { exif: {}, hasExif: false, colorSpace, density, hasProfile }
  }
}
