#!/usr/bin/env node
/**
 * Adrial OS - Intelligent Scheduler
 *
 * Generates draft schedules for pending chunks, respecting calendar "rocks"
 *
 * Usage:
 *   npm run schedule              # Generate draft for next week
 *   npm run schedule --week 2     # Generate draft for 2 weeks out
 *   npm run schedule --publish    # Publish accepted draft to Google Calendar
 *   npm run schedule --clear      # Clear current draft
 *   npm run schedule --list       # List pending chunks
 *
 * Environment Variables Required:
 *   DATABASE_URL - Neon database connection string
 *   GOOGLE_REFERENCE_CALENDAR_ID - Calendar to read "rocks" from
 *   GOOGLE_WORK_CALENDAR_ID - Calendar to write scheduled chunks to
 */

const { neon } = require('@neondatabase/serverless')
require('dotenv').config()

const sql = neon(process.env.DATABASE_URL)

// Configuration
const WORK_START_HOUR = 9    // 9 AM
const WORK_END_HOUR = 17     // 5 PM
const SLOT_DURATION = 60     // minutes per slot
const MAX_HOURS_PER_DAY = 6  // Leave buffer for meetings/breaks

// ============ GOOGLE CALENDAR HELPERS ============

async function getGoogleAccessToken() {
  const rows = await sql`
    SELECT access_token, refresh_token, expires_at
    FROM oauth_tokens
    WHERE provider = 'google'
  `

  if (rows.length === 0) {
    throw new Error('Google Calendar not connected. Visit /dashboard/os-beta to connect.')
  }

  const token = rows[0]
  const now = new Date()
  const expiresAt = new Date(token.expires_at)

  // If token is expired, refresh it
  if (expiresAt < now && token.refresh_token) {
    console.log('Refreshing expired Google token...')
    const refreshed = await refreshGoogleToken(token.refresh_token)
    return refreshed.access_token
  }

  return token.access_token
}

async function refreshGoogleToken(refreshToken) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  })

  const tokens = await response.json()

  if (tokens.error) {
    throw new Error(`Token refresh failed: ${tokens.error}`)
  }

  // Update stored token
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)
  await sql`
    UPDATE oauth_tokens
    SET access_token = ${tokens.access_token},
        expires_at = ${expiresAt.toISOString()},
        updated_at = NOW()
    WHERE provider = 'google'
  `

  return tokens
}

async function fetchCalendarEvents(calendarId, timeMin, timeMax, accessToken) {
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`)
  url.searchParams.set('timeMin', timeMin.toISOString())
  url.searchParams.set('timeMax', timeMax.toISOString())
  url.searchParams.set('singleEvents', 'true')
  url.searchParams.set('orderBy', 'startTime')
  url.searchParams.set('maxResults', '250')

  const response = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Calendar API error: ${error.error?.message || response.statusText}`)
  }

  const data = await response.json()
  return data.items || []
}

async function createCalendarEvent(calendarId, event, accessToken) {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(event)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to create event: ${error.error?.message || response.statusText}`)
  }

  return response.json()
}

// ============ SCHEDULING LOGIC ============

function getWeekBounds(weeksFromNow = 1) {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7

  const monday = new Date(now)
  monday.setDate(now.getDate() + daysUntilMonday + (weeksFromNow - 1) * 7)
  monday.setHours(0, 0, 0, 0)

  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  friday.setHours(23, 59, 59, 999)

  return { monday, friday }
}

function parseRocks(events) {
  // Convert calendar events to blocked time ranges
  const rocks = []

  for (const event of events) {
    if (!event.start?.dateTime || !event.end?.dateTime) {
      // All-day event - block the whole day
      if (event.start?.date) {
        const date = new Date(event.start.date)
        rocks.push({
          start: new Date(date.setHours(WORK_START_HOUR, 0, 0, 0)),
          end: new Date(date.setHours(WORK_END_HOUR, 0, 0, 0)),
          title: event.summary || 'All-day event'
        })
      }
      continue
    }

    rocks.push({
      start: new Date(event.start.dateTime),
      end: new Date(event.end.dateTime),
      title: event.summary || 'Busy'
    })
  }

  return rocks
}

function generateTimeSlots(monday, friday) {
  const slots = []
  const current = new Date(monday)

  while (current <= friday) {
    const dayOfWeek = current.getDay()

    // Skip weekends
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      for (let hour = WORK_START_HOUR; hour < WORK_END_HOUR; hour++) {
        const slotStart = new Date(current)
        slotStart.setHours(hour, 0, 0, 0)

        const slotEnd = new Date(slotStart)
        slotEnd.setHours(hour + 1, 0, 0, 0)

        slots.push({ start: slotStart, end: slotEnd, available: true })
      }
    }

    current.setDate(current.getDate() + 1)
  }

  return slots
}

function markRocksInSlots(slots, rocks) {
  let rocksAvoided = 0

  for (const slot of slots) {
    for (const rock of rocks) {
      // Check if slot overlaps with rock
      if (slot.start < rock.end && slot.end > rock.start) {
        slot.available = false
        slot.blockedBy = rock.title
        rocksAvoided++
        break
      }
    }
  }

  return rocksAvoided
}

function scheduleChunks(chunks, slots) {
  const scheduled = []
  let slotIndex = 0
  let hoursScheduledToday = 0
  let currentDay = null

  // Sort chunks by priority (higher first), then by project last_touched
  const sortedChunks = [...chunks].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
    return new Date(b.last_touched_at || 0) - new Date(a.last_touched_at || 0)
  })

  for (const chunk of sortedChunks) {
    const hoursNeeded = chunk.hours
    let hoursAssigned = 0
    const scheduledSlots = []

    while (hoursAssigned < hoursNeeded && slotIndex < slots.length) {
      const slot = slots[slotIndex]

      // Track daily hours
      const slotDay = slot.start.toDateString()
      if (currentDay !== slotDay) {
        currentDay = slotDay
        hoursScheduledToday = 0
      }

      // Skip if slot is blocked or we've hit daily max
      if (!slot.available || hoursScheduledToday >= MAX_HOURS_PER_DAY) {
        slotIndex++
        continue
      }

      // Assign this slot
      slot.available = false
      slot.chunk = chunk
      scheduledSlots.push(slot)
      hoursAssigned++
      hoursScheduledToday++
      slotIndex++
    }

    if (scheduledSlots.length > 0) {
      scheduled.push({
        chunk,
        start: scheduledSlots[0].start,
        end: scheduledSlots[scheduledSlots.length - 1].end,
        slots: scheduledSlots
      })
    } else {
      console.warn(`Could not schedule chunk: ${chunk.name} (${chunk.hours}h)`)
    }
  }

  return scheduled
}

// ============ DATABASE OPERATIONS ============

async function fetchPendingChunks() {
  const rows = await sql`
    SELECT c.*, p.name as project_name, p.client_id, p.priority, p.last_touched_at
    FROM chunks c
    JOIN projects p ON c.project_id = p.id
    WHERE c.status = 'pending'
      AND p.status = 'active'
    ORDER BY p.priority DESC, p.last_touched_at DESC NULLS LAST
  `
  return rows
}

async function saveDraftSchedule(scheduled, weekStart, weekEnd, rocksAvoided) {
  // Generate draft ID
  const draftId = `draft-${Date.now().toString(36)}`

  // Clear any existing draft schedule
  await sql`UPDATE chunks SET draft_scheduled_start = NULL, draft_scheduled_end = NULL, draft_order = NULL`

  // Expire any existing draft
  await sql`UPDATE schedule_drafts SET status = 'expired', updated_at = NOW() WHERE status = 'draft'`

  // Save draft metadata
  await sql`
    INSERT INTO schedule_drafts (id, week_start, week_end, total_hours, chunk_count, rocks_avoided)
    VALUES (
      ${draftId},
      ${weekStart.toISOString().split('T')[0]},
      ${weekEnd.toISOString().split('T')[0]},
      ${scheduled.reduce((sum, s) => sum + s.chunk.hours, 0)},
      ${scheduled.length},
      ${rocksAvoided}
    )
  `

  // Update chunks with draft schedule
  for (let i = 0; i < scheduled.length; i++) {
    const { chunk, start, end } = scheduled[i]
    await sql`
      UPDATE chunks
      SET draft_scheduled_start = ${start.toISOString()},
          draft_scheduled_end = ${end.toISOString()},
          draft_order = ${i},
          updated_at = NOW()
      WHERE id = ${chunk.id}
    `
  }

  return draftId
}

async function clearDraft() {
  await sql`UPDATE chunks SET draft_scheduled_start = NULL, draft_scheduled_end = NULL, draft_order = NULL`
  await sql`UPDATE schedule_drafts SET status = 'rejected', updated_at = NOW() WHERE status = 'draft'`
  console.log('Draft schedule cleared.')
}

async function publishDraft() {
  // Get chunks with draft schedules
  const chunks = await sql`
    SELECT c.*, p.name as project_name, p.client_id
    FROM chunks c
    JOIN projects p ON c.project_id = p.id
    WHERE c.draft_scheduled_start IS NOT NULL
    ORDER BY c.draft_order ASC
  `

  if (chunks.length === 0) {
    console.log('No draft schedule to publish.')
    return
  }

  const accessToken = await getGoogleAccessToken()
  const workCalendarId = process.env.GOOGLE_WORK_CALENDAR_ID || 'primary'

  console.log(`Publishing ${chunks.length} chunks to calendar...`)

  for (const chunk of chunks) {
    const event = {
      summary: `${chunk.project_name}: ${chunk.name}`,
      description: `Project: ${chunk.project_name}\nClient: ${chunk.client_id}\nChunk ID: ${chunk.id}\n\n${chunk.description || ''}`,
      start: {
        dateTime: chunk.draft_scheduled_start,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: chunk.draft_scheduled_end,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      colorId: '9' // Blue
    }

    try {
      const created = await createCalendarEvent(workCalendarId, event, accessToken)

      // Update chunk with actual schedule and event ID
      await sql`
        UPDATE chunks
        SET scheduled_start = ${chunk.draft_scheduled_start},
            scheduled_end = ${chunk.draft_scheduled_end},
            calendar_event_id = ${created.id},
            status = 'scheduled',
            draft_scheduled_start = NULL,
            draft_scheduled_end = NULL,
            draft_order = NULL,
            updated_at = NOW()
        WHERE id = ${chunk.id}
      `

      console.log(`  Scheduled: ${chunk.name}`)
    } catch (err) {
      console.error(`  Failed to schedule ${chunk.name}:`, err.message)
    }
  }

  // Mark draft as accepted
  await sql`UPDATE schedule_drafts SET status = 'accepted', accepted_at = NOW() WHERE status = 'draft'`

  console.log('\nSchedule published successfully!')
}

async function listPendingChunks() {
  const chunks = await fetchPendingChunks()

  if (chunks.length === 0) {
    console.log('No pending chunks to schedule.')
    return
  }

  console.log(`\nPending Chunks (${chunks.length}):\n`)
  console.log('  Status      Hrs  Phase            Name')
  console.log('  ' + '-'.repeat(65))

  // Group by project
  const byProject = new Map()
  for (const chunk of chunks) {
    const key = chunk.project_id
    if (!byProject.has(key)) {
      byProject.set(key, { name: chunk.project_name, priority: chunk.priority, chunks: [] })
    }
    byProject.get(key).chunks.push(chunk)
  }

  // Sort projects by priority
  const sorted = Array.from(byProject.entries()).sort((a, b) => b[1].priority - a[1].priority)

  for (const [projectId, data] of sorted) {
    const priorityMarker = data.priority > 0 ? ' [PRIORITY]' : data.priority < 0 ? ' [LATER]' : ''
    console.log(`\n  ${data.name}${priorityMarker}`)

    for (const chunk of data.chunks) {
      const status = chunk.status.padEnd(10)
      const hours = `${chunk.hours}h`.padEnd(3)
      const phase = (chunk.phase_name || 'General').substring(0, 15).padEnd(15)
      const name = chunk.name.substring(0, 40)
      console.log(`    ${status}  ${hours}  ${phase}  ${name}`)
    }
  }

  // Summary
  const totalHours = chunks.reduce((sum, c) => sum + c.hours, 0)
  console.log(`\n  Total: ${totalHours} hours across ${chunks.length} chunks`)
}

// ============ MAIN ============

async function main() {
  const args = process.argv.slice(2)

  console.log('='.repeat(60))
  console.log('Adrial Designs OS - Scheduler')
  console.log('='.repeat(60))

  // Handle flags
  if (args.includes('--publish')) {
    await publishDraft()
    return
  }

  if (args.includes('--clear')) {
    await clearDraft()
    return
  }

  if (args.includes('--list')) {
    await listPendingChunks()
    return
  }

  // Get week offset
  const weekIndex = args.indexOf('--week')
  const weeksFromNow = weekIndex >= 0 ? parseInt(args[weekIndex + 1]) || 1 : 1

  console.log('')

  // Get pending chunks
  const chunks = await fetchPendingChunks()
  console.log(`Found ${chunks.length} pending chunks across active projects.`)

  if (chunks.length === 0) {
    console.log('Nothing to schedule!')
    return
  }

  // Get week bounds
  const { monday, friday } = getWeekBounds(weeksFromNow)
  console.log(`\nScheduling for: ${monday.toLocaleDateString()} - ${friday.toLocaleDateString()}`)

  // Fetch calendar "rocks"
  let rocks = []
  let rocksAvoided = 0

  try {
    const accessToken = await getGoogleAccessToken()
    const calendarId = process.env.GOOGLE_REFERENCE_CALENDAR_ID || 'primary'

    console.log('\nFetching calendar events (rocks)...')
    const events = await fetchCalendarEvents(calendarId, monday, friday, accessToken)
    rocks = parseRocks(events)
    console.log(`Found ${rocks.length} calendar events to avoid.`)

    if (rocks.length > 0) {
      console.log('Rocks:')
      for (const rock of rocks.slice(0, 5)) {
        console.log(`  - ${rock.title} (${rock.start.toLocaleString()} - ${rock.end.toLocaleTimeString()})`)
      }
      if (rocks.length > 5) {
        console.log(`  ... and ${rocks.length - 5} more`)
      }
    }
  } catch (err) {
    console.warn(`\nWarning: Could not fetch calendar: ${err.message}`)
    console.log('Proceeding without rock detection...\n')
  }

  // Generate time slots
  const slots = generateTimeSlots(monday, friday)
  console.log(`\nGenerated ${slots.length} hourly slots for the week.`)

  // Mark rocks
  rocksAvoided = markRocksInSlots(slots, rocks)
  const availableSlots = slots.filter(s => s.available).length
  console.log(`Available slots after avoiding rocks: ${availableSlots}`)

  // Schedule chunks
  const scheduled = scheduleChunks(chunks, slots)
  console.log(`\nScheduled ${scheduled.length} chunks.`)

  // Save draft
  const draftId = await saveDraftSchedule(scheduled, monday, friday, rocksAvoided)

  // Print summary
  console.log('\n--- DRAFT SCHEDULE ---\n')

  let currentDay = ''
  for (const item of scheduled) {
    const day = item.start.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    if (day !== currentDay) {
      currentDay = day
      console.log(`\n${day}:`)
    }
    const startTime = item.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    const endTime = item.end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    console.log(`  ${startTime} - ${endTime}: ${item.chunk.project_name} - ${item.chunk.name} (${item.chunk.hours}h)`)
  }

  const unscheduled = chunks.length - scheduled.length
  if (unscheduled > 0) {
    console.log(`\n\nWarning: ${unscheduled} chunks could not be scheduled (not enough time slots).`)
  }

  console.log(`\n\nDraft saved (ID: ${draftId})`)
  console.log('View in UI: /dashboard/os-beta/schedule')
  console.log('To publish: npm run schedule --publish')
  console.log('To clear:   npm run schedule --clear')
}

main().catch(err => {
  console.error('Scheduler error:', err)
  process.exit(1)
})
