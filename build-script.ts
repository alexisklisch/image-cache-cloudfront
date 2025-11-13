import { writeFile } from 'node:fs/promises'
// package.json
import packageJson from './package.json' with { type: 'json' }

const sameSection = ['name', 'type', 'version', 'author', 'license', 'dependencies']
const newPackageJson = Object.fromEntries(Object.entries(packageJson).filter(([key]) => sameSection.includes(key)))
await writeFile('dist/package.json', JSON.stringify({ ...newPackageJson, main: 'index.js' }, null, 2))
