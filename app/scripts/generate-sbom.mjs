import { mkdir, readFile, writeFile } from 'node:fs/promises'

const lock = JSON.parse(await readFile('package-lock.json', 'utf8'))
const components = Object.entries(lock.packages)
  .filter(
    ([packagePath, metadata]) =>
      packagePath && !metadata.dev && !metadata.link && metadata.version,
  )
  .map(([packagePath, metadata]) => {
    const name = metadata.name ?? packagePath.replace(/^.*node_modules\//, '')
    return {
      type: 'library',
      'bom-ref': `pkg:npm/${encodeURIComponent(name)}@${metadata.version}`,
      name,
      version: metadata.version,
      licenses: metadata.license
        ? [{ license: { name: metadata.license } }]
        : undefined,
      purl: `pkg:npm/${encodeURIComponent(name)}@${metadata.version}`,
    }
  })
  .filter(
    (component, index, items) =>
      items.findIndex(
        (candidate) => candidate['bom-ref'] === component['bom-ref'],
      ) === index,
  )
  .sort((left, right) => left['bom-ref'].localeCompare(right['bom-ref']))

const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  version: 1,
  metadata: {
    component: {
      type: 'application',
      name: lock.name,
      version: lock.version,
    },
    tools: {
      components: [
        {
          type: 'application',
          name: 'TextureFlow lockfile SBOM generator',
          version: '1',
        },
      ],
    },
  },
  components,
}

await mkdir('reports', { recursive: true })
await writeFile('reports/sbom.cdx.json', `${JSON.stringify(sbom, null, 2)}\n`)
