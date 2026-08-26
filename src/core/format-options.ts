import type { ExportFormat } from '@/types'

export interface FormatOption {
  label: string
  value: ExportFormat
  tag?: string
  desc?: string
}

export const FORMAT_OPTIONS: Array<{ label: string; value: ExportFormat }> = [
  { label: '原图格式', value: 'original' },
  { label: 'JPG', value: 'jpg' },
  { label: 'PNG', value: 'png' },
  { label: 'WebP', value: 'webp' },
  { label: 'AVIF', value: 'avif' },
  { label: 'GIF', value: 'gif' },
]

export const FORMAT_OPTIONS_WITH_META: Array<{ label: string; value: ExportFormat; tag: string; desc: string }> = [
  { label: '原图格式', value: 'original', tag: 'SRC', desc: '保持原始编码输出' },
  { label: 'JPG', value: 'jpg', tag: 'JPG', desc: '通用兼容，体积较小' },
  { label: 'PNG', value: 'png', tag: 'PNG', desc: '无损透明，体积较大' },
  { label: 'WebP', value: 'webp', tag: 'WebP', desc: '现代格式，体积与画质均衡' },
  { label: 'AVIF', value: 'avif', tag: 'AVIF', desc: '高压缩率，新浏览器支持' },
  { label: 'GIF', value: 'gif', tag: 'GIF', desc: '动图或索引色场景' },
]
