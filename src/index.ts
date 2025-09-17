import { Context, Hono } from 'hono'
import { CreateShortcutBody } from './schemas'
import { generateSlug } from './utils'
import z from 'zod'
import { HTTPException } from 'hono/http-exception'

interface HonoEnv {
  Bindings: Env
}

const app = new Hono<HonoEnv>()

function requireAuth(c: Context<HonoEnv>) {
  const { API_KEY } = c.env
  const authHeader = c.req.header('Authorization')
  if (!authHeader || authHeader !== `Bearer ${API_KEY}`) {
    throw new HTTPException(401, {
      res: c.json({ error: 'UNAUTHORIZED' }, 401),
    })
  }
}

app.onError(async (error, c) => {
  if (error instanceof Error && 'getResponse' in error) {
    return error.getResponse()
  }
  if (error instanceof z.ZodError) {
    return c.json({ error: 'ARGUMENTS', details: z.treeifyError(error) }, 400)
  }
  console.error(error)
  return c.json({ error: 'UNKNOWN' }, 500)
})

app.get('/', async c => {
  return c.redirect('https://binjhack.club')
})

app.post('/', async (c) => {
  requireAuth(c)

  const defaultSlug = generateSlug()
  const { url, slug = defaultSlug } = CreateShortcutBody.parse(await c.req.json())
  console.log({ url, slug })

  const result = await c.env.DB.prepare(
    'INSERT INTO shortcuts (url, slug) VALUES (?, ?) ON CONFLICT(slug) DO NOTHING RETURNING slug, url'
  )
    .bind(url, slug)
    .first<{ slug: string; url: string } | null>()
  if (!result) {
    return c.json({ error: 'CONFLICT' }, 409)
  }

  return c.json(result, 200)
})

app.get('/:slug', async (c) => {
  const slug = c.req.param('slug')

  const result = await c.env.DB.prepare(
    'UPDATE shortcuts SET uses = uses + 1 WHERE slug = ? RETURNING url'
  )
    .bind(slug)
    .first<{ url: string } | null>()

  if (!result) {
    return c.notFound()
  }
  return c.redirect(result.url)
})

app.get('/api/:slug', async (c) => {
  requireAuth(c)

  const slug = c.req.param('slug')
  const data = await c.env.DB.prepare('SELECT * FROM shortcuts WHERE slug = ?').bind(slug).first()

  if (!data) {
    return c.json({ error: 'NOT_FOUND' }, 404)
  }
  return c.json(data)
})

app.delete('/:slug', async (c) => {
  requireAuth(c)

  const slug = c.req.param('slug')
  const data = await c.env.DB.prepare('DELETE FROM shortcuts WHERE slug = ? RETURNING *')
    .bind(slug)
    .first()

  if (!data) {
    return c.json({ error: 'NOT_FOUND' }, 404)
  }
  return c.json(data)
})

export default app satisfies ExportedHandler<Env>
