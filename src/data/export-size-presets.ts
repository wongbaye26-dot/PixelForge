export interface ExportSizeEntry {
  width: number
  height: number
  label: string
}

export interface ExportSizeTemplate {
  name: string
  category: 'common' | 'social' | 'ecommerce'
  sizes: ExportSizeEntry[]
  formats: string[]
}

/** 内置导出尺寸模板（社交媒体 / 电商 / 常用） */
export const EXPORT_SIZE_TEMPLATES: ExportSizeTemplate[] = [
  {
    name: '通用高清',
    category: 'common',
    sizes: [
      { width: 1920, height: 1080, label: '全高清横版 16:9' },
      { width: 1280, height: 720, label: '高清横版 720P' },
      { width: 1080, height: 1920, label: '全高清竖版 9:16' },
      { width: 800, height: 600, label: '标准 4:3' },
    ],
    formats: ['webp', 'jpg'],
  },
  {
    name: '通用方形',
    category: 'common',
    sizes: [
      { width: 1024, height: 1024, label: '正方形高清' },
      { width: 512, height: 512, label: '正方形缩略图' },
    ],
    formats: ['webp', 'png'],
  },
  {
    name: '微信生态',
    category: 'social',
    sizes: [
      { width: 900, height: 383, label: '公众号头图' },
      { width: 900, height: 500, label: '公众号封面图 2.35:1' },
      { width: 1280, height: 1184, label: '朋友圈封面' },
      { width: 500, height: 400, label: '小程序分享图 5:4' },
      { width: 1080, height: 1260, label: '视频号封面 6:7' },
      { width: 1080, height: 1920, label: '视频号竖版 9:16' },
    ],
    formats: ['webp', 'jpg'],
  },
  {
    name: '抖音 & 快手',
    category: 'social',
    sizes: [
      { width: 1080, height: 1920, label: '竖版短视频封面 9:16' },
      { width: 1242, height: 2208, label: '竖版高清封面' },
      { width: 1920, height: 1080, label: '横版短视频封面 16:9' },
      { width: 1080, height: 1080, label: '正方形封面' },
    ],
    formats: ['webp', 'jpg'],
  },
  {
    name: '小红书',
    category: 'social',
    sizes: [
      { width: 1242, height: 1660, label: '笔记封面 3:4' },
      { width: 1080, height: 1440, label: '笔记配图 3:4' },
      { width: 1080, height: 1080, label: '正方形配图 1:1' },
      { width: 1080, height: 1920, label: '竖版视频封面 9:16' },
    ],
    formats: ['webp', 'jpg'],
  },
  {
    name: '微博 & B站',
    category: 'social',
    sizes: [
      { width: 980, height: 300, label: '微博头条封面' },
      { width: 1080, height: 1080, label: '微博方图' },
      { width: 1080, height: 1920, label: '微博竖图 9:16' },
      { width: 1146, height: 717, label: 'B站视频封面 16:10' },
      { width: 1920, height: 1080, label: 'B站高清封面 16:9' },
    ],
    formats: ['webp', 'jpg'],
  },
  {
    name: 'Instagram & Facebook',
    category: 'social',
    sizes: [
      { width: 1080, height: 1080, label: 'Instagram 正方形帖子' },
      { width: 1080, height: 1350, label: 'Instagram 竖版帖子 4:5' },
      { width: 1080, height: 1920, label: 'Instagram 故事 / Reels' },
      { width: 1200, height: 630, label: 'Facebook 链接分享图' },
      { width: 820, height: 312, label: 'Facebook 主页封面' },
    ],
    formats: ['webp', 'jpg'],
  },
  {
    name: 'YouTube & X',
    category: 'social',
    sizes: [
      { width: 1280, height: 720, label: 'YouTube 缩略图 16:9' },
      { width: 2560, height: 1440, label: 'YouTube 频道横幅（安全区居中）' },
      { width: 1500, height: 500, label: 'X (Twitter) 头图' },
      { width: 1200, height: 675, label: 'X (Twitter) 帖子图 16:9' },
      { width: 1200, height: 627, label: 'LinkedIn 帖子分享图' },
      { width: 1584, height: 396, label: 'LinkedIn 主页封面' },
    ],
    formats: ['webp', 'jpg'],
  },
  {
    name: '通用社交封面',
    category: 'social',
    sizes: [
      { width: 1200, height: 630, label: 'Open Graph 通用分享图' },
      { width: 1500, height: 500, label: '横幅头图 3:1' },
      { width: 1080, height: 1920, label: '竖版故事通用 9:16' },
      { width: 1000, height: 1500, label: 'Pinterest 竖图 2:3' },
    ],
    formats: ['webp', 'jpg'],
  },
  {
    name: '淘宝 / 天猫',
    category: 'ecommerce',
    sizes: [
      { width: 800, height: 800, label: '主图 1:1（标准）' },
      { width: 1000, height: 1000, label: '主图 1:1（高清）' },
      { width: 750, height: 1000, label: '主图 3:4（竖版）' },
      { width: 800, height: 1200, label: '长图主图 2:3' },
      { width: 790, height: 1200, label: '详情页切片宽图' },
    ],
    formats: ['webp', 'jpg'],
  },
  {
    name: '京东 / 拼多多',
    category: 'ecommerce',
    sizes: [
      { width: 800, height: 800, label: '京东主图 1:1' },
      { width: 750, height: 1000, label: '京东竖版主图 3:4' },
      { width: 750, height: 750, label: '拼多多主图 1:1' },
      { width: 750, height: 352, label: '拼多多店铺横幅' },
      { width: 480, height: 480, label: 'SKU 小图（最低）' },
    ],
    formats: ['webp', 'jpg'],
  },
  {
    name: '抖音 / 快手小店',
    category: 'ecommerce',
    sizes: [
      { width: 800, height: 800, label: '商品主图 1:1' },
      { width: 750, height: 1000, label: '商品主图 3:4' },
      { width: 1080, height: 1080, label: '直播间商品图' },
      { width: 1242, height: 1660, label: '种草笔记商品图 3:4' },
    ],
    formats: ['webp', 'jpg'],
  },
  {
    name: '跨境电商',
    category: 'ecommerce',
    sizes: [
      { width: 2000, height: 2000, label: 'Amazon 主图 1:1（推荐）' },
      { width: 1000, height: 1000, label: 'Amazon 主图 1:1（最低）' },
      { width: 970, height: 600, label: 'Amazon A+ 横图' },
      { width: 1464, height: 600, label: 'Amazon 品牌横幅' },
      { width: 1200, height: 1200, label: 'Shopify 商品主图' },
    ],
    formats: ['webp', 'jpg', 'png'],
  },
  {
    name: '电商详情长图',
    category: 'ecommerce',
    sizes: [
      { width: 750, height: 1000, label: '详情首屏 3:4' },
      { width: 790, height: 1185, label: '详情切片 2:3' },
      { width: 790, height: 1500, label: '详情长切片' },
      { width: 1125, height: 1500, label: '高清详情竖图 3:4' },
    ],
    formats: ['webp', 'jpg'],
  },
]

export function formatSizeInputLine(entry: ExportSizeEntry | { width: number; height: number; label?: string }) {
  const label = 'label' in entry && entry.label ? entry.label : undefined
  return label ? `${entry.width}x${entry.height} # ${label}` : `${entry.width}x${entry.height}`
}

export function formatSizeInputLines(
  sizes: Array<{ width: number; height: number; label?: string }>,
) {
  return sizes.map((s) => formatSizeInputLine(s as ExportSizeEntry)).join('\n')
}

export const SOCIAL_SIZE_PRESETS = EXPORT_SIZE_TEMPLATES.filter((t) => t.category === 'social')
export const ECOMMERCE_SIZE_PRESETS = EXPORT_SIZE_TEMPLATES.filter((t) => t.category === 'ecommerce')
