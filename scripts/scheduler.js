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
const WORK_START_HOUR = 12   // 12 PM (noon)
const WORK_END_HOUR = 20     // 8 PM (allows slots through 7pm)
const SLOT_DURATION = 60     // minutes per slot
const MAX_HOURS_PER_DAY = 6  // Leave buffer for meetings/breaks
const DEFAULT_LUNCH_HOUR = 15 // Default lunch at 3pm (center of 12-7:30pm workday)
const LUNCH_FLEX_RANGE = 2   // Lunch can move up to 2 hours later (so 3pm-5pm range)

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
  // Only events with specific start/end times are rocks
  // All-day events are ignored (they're usually reminders, not actual time blocks)
  const rocks = []

  for (const event of events) {
    // Skip all-day events - they don't block time slots
    if (!event.start?.dateTime || !event.end?.dateTime) {
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
  const lunchBreaks = []

  // Group chunks by project, maintaining phase order within each project
  const projectMap = new Map()
  for (const chunk of chunks) {
    if (!projectMap.has(chunk.project_id)) {
      projectMap.set(chunk.project_id, {
        id: chunk.project_id,
        name: chunk.project_name,
        priority: chunk.priority || 0,
        lastTouched: chunk.last_touched_at,
        chunks: [],
        currentIndex: 0
      })
    }
    projectMap.get(chunk.project_id).chunks.push(chunk)
  }

  // Sort projects by priority (higher first), then by last_touched (more recent first)
  const projects = Array.from(projectMap.values()).sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
    return new Date(b.lastTouched || 0) - new Date(a.lastTouched || 0)
  })

  console.log(`\nInterweaving ${projects.length} projects:`)
  for (const p of projects) {
    console.log(`  - ${p.name} (priority ${p.priority}, ${p.chunks.length} chunks)`)
  }

  // Calculate time allocation per project based on priority
  const totalPriority = projects.reduce((sum, p) => sum + Math.max(1, p.priority + 2), 0)
  for (const p of projects) {
    p.slotsPerRound = Math.max(1, Math.round((Math.max(1, p.priority + 2) / totalPriority) * 6))
    console.log(`    Allocation: ${p.slotsPerRound} hours per round`)
  }

  // Track daily usage across all scheduling
  const dailyHours = new Map()      // day string -> hours scheduled
  const dailyLunchTaken = new Map() // day string -> boolean
  const dailyHoursBeforeLunch = new Map() // day string -> hours worked before lunch

  // Helper to find consecutive available slots for a chunk
  function findAndAssignSlots(hoursNeeded) {
    let consecutiveSlots = []
    let currentDayStr = null

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]
      const slotDay = slot.start.toDateString()
      const slotHour = slot.start.getHours()

      // Reset consecutive slots when day changes
      if (currentDayStr !== slotDay) {
        consecutiveSlots = []
        currentDayStr = slotDay
      }

      // Skip unavailable slots
      if (!slot.available) {
        consecutiveSlots = []
        continue
      }

      // Check daily limit
      const dayHours = dailyHours.get(slotDay) || 0
      if (dayHours >= MAX_HOURS_PER_DAY) {
        consecutiveSlots = []
        continue
      }

      // Check if we need to take lunch before this slot
      const lunchTaken = dailyLunchTaken.get(slotDay) || false
      const hoursBeforeLunch = dailyHoursBeforeLunch.get(slotDay) || 0

      if (!lunchTaken) {
        const shouldTakeLunch = (hoursBeforeLunch >= 3 && slotHour >= DEFAULT_LUNCH_HOUR) ||
                                (slotHour >= DEFAULT_LUNCH_HOUR + LUNCH_FLEX_RANGE)

        if (shouldTakeLunch) {
          // This slot becomes lunch
          slot.available = false
          slot.isLunch = true
          dailyLunchTaken.set(slotDay, true)
          lunchBreaks.push({ day: slotDay, start: slot.start, end: slot.end })
          consecutiveSlots = []
          continue
        }
      }

      // This slot is available for work
      consecutiveSlots.push({ slot, index: i, day: slotDay })

      // Check if we have enough consecutive slots
      if (consecutiveSlots.length >= hoursNeeded) {
        // Verify all slots are on same day and consecutive
        const firstDay = consecutiveSlots[0].day
        const allSameDay = consecutiveSlots.every(s => s.day === firstDay)

        if (allSameDay) {
          // Assign these slots
          const slotsToUse = consecutiveSlots.slice(0, hoursNeeded)
          for (const { slot: s, day } of slotsToUse) {
            s.available = false
            dailyHours.set(day, (dailyHours.get(day) || 0) + 1)
            if (!dailyLunchTaken.get(day)) {
              dailyHoursBeforeLunch.set(day, (dailyHoursBeforeLunch.get(day) || 0) + 1)
            }
          }
          return slotsToUse.map(s => s.slot)
        } else {
          // Slots span multiple days - this shouldn't happen with daily reset
          consecutiveSlots = [consecutiveSlots[consecutiveSlots.length - 1]]
        }
      }
    }

    return null // Could not find enough slots
  }

  // Round-robin through projects until all chunks are scheduled or no slots remain
  // Key: Don't skip chunks - if a chunk can't be scheduled, the project is blocked
  // until that chunk can fit. This maintains chronological order within projects.
  let activeProjects = projects.filter(p => p.currentIndex < p.chunks.length)
  let lastScheduledCount = -1

  while (activeProjects.length > 0) {
    // Check if we made progress last round (avoid infinite loop)
    if (scheduled.length === lastScheduledCount) {
      break // No progress, no more available slots
    }
    lastScheduledCount = scheduled.length

    for (const project of activeProjects) {
      let hoursThisRound = 0
      let projectBlocked = false

      while (hoursThisRound < project.slotsPerRound &&
             project.currentIndex < project.chunks.length &&
             !projectBlocked) {

        const chunk = project.chunks[project.currentIndex]
        const assignedSlots = findAndAssignSlots(chunk.hours)

        if (!assignedSlots) {
          // No slots available for this chunk - project is blocked
          // DON'T skip to next chunk - maintain order
          projectBlocked = true
          break
        }

        // Mark slots with chunk reference
        for (const slot of assignedSlots) {
          slot.chunk = chunk
        }

        scheduled.push({
          chunk,
          start: assignedSlots[0].start,
          end: assignedSlots[assignedSlots.length - 1].end,
          slots: assignedSlots
        })

        project.currentIndex++
        hoursThisRound += chunk.hours
      }
    }

    // Update active projects - only those with remaining chunks that made progress
    activeProjects = projects.filter(p => p.currentIndex < p.chunks.length)
  }

  // Report unscheduled chunks by project
  for (const project of projects) {
    const remaining = project.chunks.length - project.currentIndex
    if (remaining > 0) {
      console.warn(`${project.name}: ${remaining} chunks could not be scheduled (blocked at: ${project.chunks[project.currentIndex]?.name})`)
    }
  }

  // Add lunch breaks to days that have available time but no lunch scheduled yet
  // Group slots by day
  const slotsByDay = new Map()
  for (const slot of slots) {
    const dayStr = slot.start.toDateString()
    if (!slotsByDay.has(dayStr)) {
      slotsByDay.set(dayStr, [])
    }
    slotsByDay.get(dayStr).push(slot)
  }

  // For each day, if no lunch break exists and there are available slots, add one
  for (const [dayStr, daySlots] of slotsByDay) {
    if (dailyLunchTaken.get(dayStr)) continue // Already has lunch

    // Find available slots around lunch time
    const availableSlots = daySlots.filter(s => s.available && !s.isLunch)
    if (availableSlots.length === 0) continue // Day is fully blocked

    // Find the best slot for lunch (closest to DEFAULT_LUNCH_HOUR)
    let bestSlot = null
    let bestDistance = Infinity

    for (const slot of availableSlots) {
      const slotHour = slot.start.getHours()
      const distance = Math.abs(slotHour - DEFAULT_LUNCH_HOUR)
      if (distance < bestDistance) {
        bestDistance = distance
        bestSlot = slot
      }
    }

    if (bestSlot) {
      bestSlot.available = false
      bestSlot.isLunch = true
      dailyLunchTaken.set(dayStr, true)
      lunchBreaks.push({ day: dayStr, start: bestSlot.start, end: bestSlot.end })
    }
  }

  console.log(`\nScheduled ${lunchBreaks.length} lunch breaks`)

  return { scheduled, lunchBreaks }
}

// ============ DATABASE OPERATIONS ============

async function fetchPendingChunks() {
  // Order by project, then by phase_order within each project
  // This ensures chunks maintain their phase sequence (phase_order set from proposal)
  const rows = await sql`
    SELECT c.*, p.name as project_name, p.client_id, p.priority, p.last_touched_at
    FROM chunks c
    JOIN projects p ON c.project_id = p.id
    WHERE c.status = 'pending'
      AND p.status = 'active'
    ORDER BY c.project_id, c.phase_order ASC NULLS LAST, c.created_at ASC
  `
  return rows
}

async function saveDraftSchedule(scheduled, weekStart, weekEnd, rocksAvoided, lunchBreaks = []) {
  // Generate draft ID
  const draftId = `draft-${Date.now().toString(36)}`

  // Clear any existing draft schedule
  await sql`UPDATE chunks SET draft_scheduled_start = NULL, draft_scheduled_end = NULL, draft_order = NULL`

  // Expire any existing draft
  await sql`UPDATE schedule_drafts SET status = 'expired', updated_at = NOW() WHERE status = 'draft'`

  // Format lunch breaks for storage
  const lunchBreaksJson = JSON.stringify(lunchBreaks.map(lb => ({
    day: lb.day,
    start: lb.start.toISOString(),
    end: lb.end.toISOString()
  })))

  // Save draft metadata
  await sql`
    INSERT INTO schedule_drafts (id, week_start, week_end, total_hours, chunk_count, rocks_avoided, lunch_breaks)
    VALUES (
      ${draftId},
      ${weekStart.toISOString().split('T')[0]},
      ${weekEnd.toISOString().split('T')[0]},
      ${scheduled.reduce((sum, s) => sum + s.chunk.hours, 0)},
      ${scheduled.length},
      ${rocksAvoided},
      ${lunchBreaksJson}::jsonb
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

  // Get week offset and count
  const weekIndex = args.indexOf('--week')
  const weeksIndex = args.indexOf('--weeks')
  const startWeek = weekIndex >= 0 ? parseInt(args[weekIndex + 1]) || 1 : 1
  const weekCount = weeksIndex >= 0 ? parseInt(args[weeksIndex + 1]) || 1 : 1

  console.log('')

  // Get pending chunks
  const chunks = await fetchPendingChunks()
  console.log(`Found ${chunks.length} pending chunks across active projects.`)

  if (chunks.length === 0) {
    console.log('Nothing to schedule!')
    return
  }

  // Calculate total hours needed
  const totalHoursNeeded = chunks.reduce((sum, c) => sum + c.hours, 0)
  console.log(`Total hours to schedule: ${totalHoursNeeded}`)

  // Get bounds for all weeks
  const { monday: firstMonday } = getWeekBounds(startWeek)
  const { friday: lastFriday } = getWeekBounds(startWeek + weekCount - 1)
  console.log(`\nScheduling for: ${firstMonday.toLocaleDateString()} - ${lastFriday.toLocaleDateString()} (${weekCount} week${weekCount > 1 ? 's' : ''})`)

  // Fetch calendar "rocks" for entire period
  let rocks = []
  let rocksAvoided = 0

  try {
    const accessToken = await getGoogleAccessToken()
    const calendarId = process.env.GOOGLE_REFERENCE_CALENDAR_ID || 'primary'

    console.log('\nFetching calendar events (rocks)...')
    const events = await fetchCalendarEvents(calendarId, firstMonday, lastFriday, accessToken)
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

  // Generate time slots for all weeks
  let allSlots = []
  for (let w = 0; w < weekCount; w++) {
    const { monday, friday } = getWeekBounds(startWeek + w)
    const weekSlots = generateTimeSlots(monday, friday)
    allSlots = allSlots.concat(weekSlots)
  }
  console.log(`\nGenerated ${allSlots.length} hourly slots for ${weekCount} week${weekCount > 1 ? 's' : ''}.`)

  // Mark rocks
  rocksAvoided = markRocksInSlots(allSlots, rocks)
  const availableSlots = allSlots.filter(s => s.available).length
  console.log(`Available slots after avoiding rocks: ${availableSlots}`)
  console.log(`Estimated capacity: ~${Math.floor(availableSlots * 0.75)} hours (with 6h/day max)`)

  // Schedule chunks (with lunch breaks)
  const { scheduled, lunchBreaks } = scheduleChunks(chunks, allSlots)
  console.log(`\nScheduled ${scheduled.length} chunks (${scheduled.reduce((s, c) => s + c.chunk.hours, 0)} hours).`)

  // Save draft (including lunch breaks)
  const draftId = await saveDraftSchedule(scheduled, firstMonday, lastFriday, rocksAvoided, lunchBreaks)

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
