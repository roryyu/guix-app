import { buildApp, buildDmg, run, type Target } from './macos'

const args = process.argv.slice(2)
for (const arg of args) {
  if (!['--dmg', '--open', '--target=all', '--target=editor', '--target=gpuix'].includes(arg)) {
    throw new Error(`未知参数 ${arg}；支持 --target=editor|gpuix|all、--dmg、--open。`)
  }
}
const target = args.find((arg) => arg.startsWith('--target='))?.slice(9) ?? 'all'
const targets: Target[] = target === 'all' ? ['editor', 'gpuix'] : [target as Target]
for (const item of targets) {
  const app = await buildApp(item)
  if (args.includes('--dmg')) await buildDmg(item, app)
  if (args.includes('--open')) await run(['open', app])
}
