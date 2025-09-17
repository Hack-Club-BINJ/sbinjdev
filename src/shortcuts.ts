import { CreateShortcutBody } from './schemas'
import { generateSlug } from './utils'

export async function createShortcut(c: HonoContext, data: CreateShortcutBody) {
  const defaultSlug = generateSlug()
  const { url, slug = defaultSlug } = CreateShortcutBody.parse(data)
  console.log({ url, slug })

  const result = await c.env.DB.prepare(
    'INSERT INTO shortcuts (url, slug) VALUES (?, ?) ON CONFLICT(slug) DO NOTHING RETURNING *'
  )
    .bind(url, slug)
    .first<Shortcut | null>()

  return result
}
