import { Hono } from 'hono'
import requireAuth from '../../middleware/auth'
import { db } from '../../db/client'

const route = new Hono()

route.use('*', requireAuth)

route.get('/', async (c) => {
  const flags = await db`
    SELECT key, enabled, description
    FROM feature_flags
    ORDER BY key
  `
  return c.json(flags)
})

export default route
