import type { ImageAsset } from '@/types'

export type ModuleAssetItem = Pick<
  ImageAsset,
  'id' | 'filename' | 'width' | 'height' | 'format' | 'thumbnailUrl' | 'previewUrl'
>

export type ModuleBrowserView = 'list' | 'grid'
