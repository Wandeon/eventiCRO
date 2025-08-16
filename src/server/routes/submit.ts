import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import db from '../db/client'
import { submitRateLimit } from '../middleware/rate-limit'

interface SubmitRequest {
  title: string
  description?: string
  start_time: string
  end_time?: string
  venue_name?: string
  address?: string
  city?: string
  lat?: number
  lng?: number
  organizer_name?: string
  url?: string
  image_url?: string
  price?: string
  captcha_token: string
  honeypot?: string
}

interface SubmitErrors {
  title?: string
  description?: string
  start_time?: string
  end_time?: string
  venue_name?: string
  address?: string
  city?: string
  lat?: string
  lng?: string
  organizer_name?: string
  url?: string
  image_url?: string
  price?: string
  captcha_token?: string
  honeypot?: string
}

interface FriendlyCaptchaResponse {
  success: boolean
}

// Helper to validate URLs
function validateUrl(value: unknown): boolean {
  if (typeof value !== 'string' || value.length === 0) return false
  try {
    const u = new URL(value)
    if (u.protocol !== 'https:') return false
    if (u.hostname.length > 255) return false
    return true
  } catch {
    return false
  }
}

const route = new Hono()

route.post('/submit', ...submitRateLimit, async (c) => {
  c.header('Cache-Control', 'no-store')

  let parsed: unknown
  try {
    parsed = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const body: SubmitRequest = parsed as SubmitRequest

  const errors: SubmitErrors = {}

  const {
    title,
    description,
    start_time,
    end_time,
    venue_name,
    address,
    city,
    lat,
    lng,
    organizer_name,
    url,
    image_url,
    price,
    captcha_token,
    honeypot,
  } = body

  // Title validation
  if (typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 140) {
    errors.title = '3..140 chars'
  }

  // Description validation
  if (description !== undefined) {
    if (typeof description !== 'string' || description.length > 2000) {
      errors.description = '≤2000 chars'
    }
  }

  // Start time validation
  let start: Date | null = null
  if (typeof start_time !== 'string') {
    errors.start_time = 'Invalid'
  } else {
    start = new Date(start_time)
    if (isNaN(start.getTime())) {
      errors.start_time = 'Invalid'
    } else if (start.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
      errors.start_time = 'Too far in past'
    }
  }

  // End time validation
  if (end_time !== undefined) {
    if (typeof end_time !== 'string') {
      errors.end_time = 'Invalid'
    } else {
      const end = new Date(end_time)
      if (isNaN(end.getTime()) || !start) {
        errors.end_time = 'Invalid'
      } else if (end <= start) {
        errors.end_time = 'Must be after start'
      } else if (end.getTime() - start.getTime() > 14 * 24 * 60 * 60 * 1000) {
        errors.end_time = 'Too long'
      }
    }
  }

  // City validation
  if (city !== undefined) {
    if (typeof city !== 'string' || city.trim().length < 2 || city.trim().length > 80) {
      errors.city = '2..80 chars'
    }
  }

  // URL validations
  if (url !== undefined && !validateUrl(url)) {
    errors.url = 'Invalid URL'
  }
  if (image_url !== undefined && !validateUrl(image_url)) {
    errors.image_url = 'Invalid URL'
  }

  // Lat/lng
  if (lat !== undefined) {
    if (typeof lat !== 'number' || lat < -90 || lat > 90) {
      errors.lat = 'Invalid latitude'
    }
  }
  if (lng !== undefined) {
    if (typeof lng !== 'number' || lng < -180 || lng > 180) {
      errors.lng = 'Invalid longitude'
    }
  }

  // Captcha token required
  if (typeof captcha_token !== 'string' || captcha_token.length === 0) {
    errors.captcha_token = 'Required'
  }

  // Honeypot must be empty
  if (honeypot && honeypot !== '') {
    errors.honeypot = 'Invalid'
  }

  if (Object.keys(errors).length > 0) {
    return c.json({ fieldErrors: errors }, 400)
  }

  const secret = process.env.FRIENDLY_CAPTCHA_SECRET
  if (!secret) {
    throw new HTTPException(500, { message: 'Captcha secret not configured' })
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const resp = await fetch('https://api.friendlycaptcha.com/api/v1/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ secret, solution: captcha_token }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!resp.ok) {
      return c.json({ error: 'captcha verification failed' }, 503)
    }
    const result: FriendlyCaptchaResponse = await resp.json()
    if (!result.success) {
      return c.json({ error: 'captcha failed' }, 403)
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return c.json({ error: 'captcha timeout' }, 503)
    }
    return c.json({ error: 'captcha verification failed' }, 503)
  }

  const payload = {
    title,
    description,
    start_time,
    end_time,
    venue_name,
    address,
    city,
    lat,
    lng,
    organizer_name,
    url,
    image_url,
    price,
  }

  const [row] = await db`INSERT INTO submissions (payload) VALUES (${db.json(payload)}) RETURNING id`

  return c.json({ submission_id: row.id }, 202)
})

export default route

