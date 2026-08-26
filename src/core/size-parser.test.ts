import { describe, expect, it } from 'vitest'
import {
  parseSingleSize,
  parseSizeList,
  sizeCardPresentation,
  sizeDisplayDesc,
} from '@/core/size-parser'

describe('size-parser comments', () => {
  it('parses size with hash comment', () => {
    const parsed = parseSingleSize('1080x1080 # Instagram 正方形帖子')
    expect(parsed).toMatchObject({
      width: 1080,
      height: 1080,
      label: 'Instagram 正方形帖子',
    })
  })

  it('parses multiline list with labels', () => {
    const parsed = parseSizeList(`800x800 # 主图 1:1
750x1000 // 竖版主图`)
    expect(parsed).toHaveLength(2)
    expect(parsed[0].label).toBe('主图 1:1')
    expect(parsed[1].label).toBe('竖版主图')
  })

  it('uses label in display desc', () => {
    expect(sizeDisplayDesc({ width: 1, height: 1, ratio: 1, ratioLabel: '1-1', label: '测试' })).toBe('测试')
  })

  it('parses comma separated tokens on one line', () => {
    const parsed = parseSizeList('150*150, 50kb内')
    expect(parsed).toEqual([
      expect.objectContaining({ width: 150, height: 150 }),
    ])
  })

  it('ignores text-only lines and keeps valid sizes', () => {
    const parsed = parseSizeList(`150*150, 50kb内
文案：15个字内
690*260
640*300`)
    expect(parsed.map((s) => `${s.width}x${s.height}`)).toEqual([
      '150x150',
      '690x260',
      '640x300',
    ])
  })

  it('builds card presentation with label first', () => {
    const card = sizeCardPresentation({
      width: 690,
      height: 260,
      ratio: 690 / 260,
      ratioLabel: '69-26',
      label: '横幅图',
    })
    expect(card).toEqual({
      tag: '690 × 260',
      title: '横幅图',
      desc: '69:26',
    })
  })
})
