import { Context, Hono } from 'hono'
import { CreateShortcutBody } from './schemas'
import { generateSlug } from './utils'
import z from 'zod'
import { HTTPException } from 'hono/http-exception'
import { createShortcut } from './shortcuts'
import { html } from 'hono/html'

function requireAuth(c: Context<HonoEnv>) {
  const { API_KEY } = c.env
  const authHeader = c.req.header('Authorization')
  if (!authHeader || authHeader !== `Bearer ${API_KEY}`) {
    throw new HTTPException(401, {
      res: c.json({ error: 'UNAUTHORIZED' }, 401),
    })
  }
}

const app = new Hono<HonoEnv>()

app.use('*', async (c, next) => {
  c.res.headers.set('Access-Control-Allow-Origin', '*')
  c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (c.req.method === 'OPTIONS') {
    return c.status(204)
  }
  c.setRenderer(async (content) => {
    return c.html(
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>URL Shortener</title>
          <link
            href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css"
            rel="stylesheet"
            integrity="sha384-sRIl4kxILFvY47J16cr9ZwB07vP4J8+LH7qKQnuqkuIAvNWLzeN8tE5YBujZqJLB"
            crossorigin="anonymous"
          />
        </head>
        <body>
          {content}
          <script
            src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"
            integrity="sha384-FKyoEForCGlyvwx9Hj09JcYn3nv7wiPVlz7YYwJrWVcXK/BmnVDxM+D2scQbITxI"
            crossorigin="anonymous"
          ></script>
        </body>
      </html>
    )
  })
  await next()
})

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

app.get('/', async (c) => {
  return c.render(
    <div class="container mt-4">
      <style>
        {`
          .form-label {
            font-weight: bold;
          }
        `}
      </style>
      <h1>s.binj.dev</h1>
      <form action="/api/new" method="post">
        <div class="mb-3">
          <label for="key" class="form-label">
            API Key
          </label>
          <input type="password" class="form-control" id="key" name="key" required />
        </div>
        <div class="mb-3">
          <label for="url" class="form-label">
            URL
          </label>
          <input type="url" class="form-control" id="url" name="url" required />
        </div>
        <div class="mb-3">
          <label for="slug" class="form-label">
            Slug (optional)
          </label>
          <input type="text" class="form-control" id="slug" name="slug" />
        </div>
        <button type="submit" class="btn btn-primary">
          Create
        </button>
      </form>
      {html`
        <script>
          const apiKey = localStorage.getItem('apiKey')
          if (apiKey) {
            document.getElementById('key').value = apiKey
          }
          document.getElementById('key').addEventListener('input', (e) => {
            localStorage.setItem('apiKey', e.target.value)
          })
        </script>
      `}
    </div>
  )
})

app.post('/api/new', async (c) => {
  const formData = await c.req.formData()
  const key = formData.get('key')
  const url = formData.get('url')
  const slug = formData.get('slug') || undefined

  if (key !== c.env.API_KEY) {
    c.status(401)
    return c.render(<div class="container mt-4">Unauthorized</div>)
  }

  const result = await createShortcut(c, { url, slug } as any)

  if (!result) {
    c.status(409)
    return c.render(<div class="container mt-4">Conflict: Slug already exists.</div>)
  }
  return c.render(
    <div class="container mt-4">
      <div class="alert alert-success" role="alert">
        Shortcut created successfully! View at{' '}
        <a href={`/${result.slug}`}>s.binj.dev/{result.slug}</a>
      </div>
    </div>
  )
})

app.post('/', async (c) => {
  requireAuth(c)

  const result = await createShortcut(c, await c.req.json())

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
