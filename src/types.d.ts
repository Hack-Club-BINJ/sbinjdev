import { Context, Hono } from 'hono'

declare global {
  interface HonoEnv {
    Bindings: Env
  }
  type HonoContext = Context<HonoEnv>

  interface Shortcut {
    url: string
    slug: string
    uses: number
  }
}
