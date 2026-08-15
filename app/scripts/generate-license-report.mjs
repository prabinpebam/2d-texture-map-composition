import { mkdir, readFile, writeFile } from 'node:fs/promises'

const lock = JSON.parse(await readFile('package-lock.json', 'utf8'))
const packages = Object.entries(lock.packages)
  .filter(([packagePath, metadata]) => packagePath && !metadata.link)
  .map(([packagePath, metadata]) => ({
    name: metadata.name ?? packagePath.replace(/^.*node_modules\//, ''),
    version: metadata.version,
    license: metadata.license ?? 'UNKNOWN',
  }))
  .filter(
    (item, index, items) =>
      items.findIndex(
        (candidate) =>
          candidate.name === item.name && candidate.version === item.version,
      ) === index,
  )
  .sort((left, right) =>
    `${left.name}@${left.version}`.localeCompare(
      `${right.name}@${right.version}`,
    ),
  )

const rows = packages.map(
  ({ name, version, license }) => `| ${name} | ${version} | ${license} |`,
)
const report = [
  '# Third-Party Dependency Licenses',
  '',
  'Generated from `package-lock.json`. UNKNOWN entries block dependency review.',
  '',
  '| Package | Version | License |',
  '| --- | --- | --- |',
  ...rows,
  '',
].join('\n')

await mkdir('reports', { recursive: true })
await writeFile('reports/third-party-licenses.md', report)

if (packages.some(({ license }) => license === 'UNKNOWN')) {
  process.exitCode = 1
}
