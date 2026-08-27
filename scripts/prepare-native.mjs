import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Usage: node scripts/prepare-native.mjs <platform> <arch>
// e.g. node scripts/prepare-native.mjs win32 x64
//      node scripts/prepare-native.mjs darwin x64
const platform = process.argv[2]
const arch = process.argv[3]

if (!platform || !arch) {
  console.error('Usage: prepare-native.mjs <platform> <arch>')
  process.exit(1)
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function sharpPkg(platform, arch) {
  return [
    `@img/sharp-${platform}-${arch}@0.34.5`,
    `@img/sharp-libvips-${platform}-${arch}@1.2.4`,
  ]
}

for (const pkg of sharpPkg(platform, arch)) {
  const name = pkg.split('@')[1].split('@')[0]
  const installed = path.join(root, 'node_modules', `@img/${name}`)
  if (existsSync(installed)) continue
  console.log(`[prepare-native] installing ${pkg}`)
  execFileSync(
    npm,
    ['install', '--no-save', '--force', '--os', platform, '--cpu', arch, pkg],
    { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' },
  )
}

if (platform === 'win32') {
  const bsq = path.join(root, 'node_modules/better-sqlite3')
  if (existsSync(bsq)) {
    const out = path.join(bsq, 'build/Release/better_sqlite3.node')
    if (!existsSync(out)) {
      console.log('[prepare-native] downloading better-sqlite3 win32-x64 electron prebuild')
      execFileSync(
        'node',
        [path.join(root, 'node_modules/prebuild-install/bin.js'), '--platform', 'win32', '--arch', 'x64', '--runtime', 'electron'],
        { cwd: bsq, stdio: 'inherit' },
      )
    }
  }
}

console.log(`[prepare-native] ${platform}-${arch} native modules ready`)
