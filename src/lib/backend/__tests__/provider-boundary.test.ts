import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC_ROOT = path.resolve(process.cwd(), 'src')
const PROVIDER_IMPORT_PATTERN =
  /(?:@butterbase\/sdk|@insforge\/sdk|lib\/backend\/(?:butterbase|insforge)|@\/lib\/backend\/(?:butterbase|insforge))/

describe('backend provider boundary', () => {
  it('keeps provider SDKs and adapters out of app/domain code', async () => {
    const files = await listSourceFiles(SRC_ROOT)
    const violations: string[] = []

    for (const file of files) {
      const relative = path.relative(process.cwd(), file)
      if (relative.startsWith('src/lib/backend/')) continue

      const source = await readFile(file, 'utf8')
      if (PROVIDER_IMPORT_PATTERN.test(source)) {
        violations.push(relative)
      }
    }

    expect(violations).toEqual([])
  })
})

async function listSourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(root, entry.name)

      if (entry.isDirectory()) {
        return listSourceFiles(fullPath)
      }

      if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        return [fullPath]
      }

      return []
    })
  )

  return files.flat()
}
