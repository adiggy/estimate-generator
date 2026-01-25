#!/usr/bin/env node
/**
 * Scheduler CLI for Adrial Designs OS
 *
 * Calendar System:
 * - Reference (READ): "Adrial project" calendar (availability, blocked times)
 * - Write: "Adrial project chunks" calendar (scheduled work)
 *
 * Usage:
 *   npm run schedule --week        # Schedule for coming week
 *   npm run schedule --sync        # Full calendar sync
 *   npm run schedule <chunk-id>    # Schedule specific chunk
 *   npm run schedule --list        # List pending chunks
 *
 * Note: This script is a "dumb" tool that Claude Code uses.
 * The AI logic for finding optimal slots happens at Claude's layer.
 */

const {
  sql,
  getChunk,
  getPendingChunks,
  updateChunk,
  getOAuthToken,
  generateId
} = require('./lib/db')

// ============================================================================
// CONFIG
// ============================================================================

const REFERENCE_CALENDAR_ID = process.env.GOOGLE_REFERENCE_CALENDAR_ID
const WORK_CALENDAR_ID = process.env.GOOGLE_WORK_CALENDAR_ID

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2)
  return {
    week: args.includes('--week'),
    sync: args.includes('--sync'),
    list: args.includes('--list'),
    chunkId: args.find(a => !a.startsWith('--')),
    dryRun: args.includes('--dry-run')
  }
}

/**
 * Get Google access token (refreshing if needed)
 * @returns {Promise<string|null>}
 */
async function getGoogleToken() {
  const token = await getOAuthToken('google')
  if (!token) {
    console.error('❌ No Google OAuth token found.')
    console.error('   Run the OAuth flow first via /api/os-beta/auth/google')
    return null
  }

  // Check if token is expired
  if (token.expires_at && new Date(token.expires_at) < new Date()) {
    console.log('Token expired, would need to refresh...')
    // In production, implement token refresh here
    return null
  }

  return token.access_token
}

/**
 * Format chunk for display
 * @param {Object} chunk
 * @param {Object} options
 */
function displayChunk(chunk, options = {}) {
  const status = chunk.status.padEnd(10)
  const hours = `${chunk.hours}h`.padEnd(3)
  const phase = (chunk.phase_name || 'General').substring(0, 15).padEnd(15)
  const name = chunk.name.substring(0, 40)
  const scheduled = chunk.scheduled_start
    ? new Date(chunk.scheduled_start).toLocaleDateString()
    : 'Not scheduled'

  if (options.verbose) {
    console.log(`  [${chunk.id}]`)
    console.log(`    Name: ${chunk.name}`)
    console.log(`    Phase: ${chunk.phase_name || 'General'}`)
    console.log(`    Hours: ${chunk.hours}`)
    console.log(`    Status: ${chunk.status}`)
    console.log(`    Scheduled: ${scheduled}`)
    console.log('')
  } else {
    console.log(`  ${status}  ${hours}  ${phase}  ${name}`)
  }
}

// ============================================================================
// COMMANDS
// ============================================================================

/**
 * List pending chunks that need scheduling
 */
async function listPendingChunks() {
  const chunks = await getPendingChunks()

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
    const priorityMarker = data.priority > 0 ? ' 🔴' : data.priority < 0 ? ' ⚪' : ''
    console.log(`\n  📁 ${data.name}${priorityMarker}`)

    for (const chunk of data.chunks) {
      displayChunk(chunk)
    }
  }

  // Summary
  const totalHours = chunks.reduce((sum, c) => sum + c.hours, 0)
  console.log(`\n  Total: ${totalHours} hours across ${chunks.length} chunks`)
}

/**
 * Schedule a specific chunk
 * @param {string} chunkId
 * @param {Object} options
 */
async function scheduleChunk(chunkId, options = {}) {
  const chunk = await getChunk(chunkId)

  if (!chunk) {
    console.error(`❌ Chunk not found: ${chunkId}`)
    process.exit(1)
  }

  if (chunk.status === 'done') {
    console.log(`✅ Chunk already completed: ${chunk.name}`)
    return
  }

  if (chunk.status === 'scheduled' && chunk.scheduled_start) {
    console.log(`⏰ Chunk already scheduled for ${new Date(chunk.scheduled_start).toLocaleString()}`)
    console.log(`   Use --force to reschedule`)
    if (!options.force) return
  }

  console.log(`\n📅 Scheduling chunk: ${chunk.name}`)
  console.log(`   Hours: ${chunk.hours}`)
  console.log(`   Phase: ${chunk.phase_name || 'General'}`)

  if (options.dryRun) {
    console.log('\n   [DRY RUN - No changes made]')
    console.log('   Next steps:')
    console.log('   1. Claude reads reference calendar for available slots')
    console.log('   2. Claude picks optimal time based on priority and duration')
    console.log('   3. Claude calls this script with --start and --end times')
    return
  }

  // If start/end times provided, create the event
  if (options.start && options.end) {
    const startTime = new Date(options.start)
    const endTime = new Date(options.end)

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      console.error('❌ Invalid start/end time format')
      process.exit(1)
    }

    // Update chunk with scheduled times
    await updateChunk(chunkId, {
      status: 'scheduled',
      scheduled_start: startTime.toISOString(),
      scheduled_end: endTime.toISOString()
    })

    console.log(`\n✅ Chunk scheduled:`)
    console.log(`   Start: ${startTime.toLocaleString()}`)
    console.log(`   End: ${endTime.toLocaleString()}`)

    // Would create Google Calendar event here if token available
    const token = await getGoogleToken()
    if (token && WORK_CALENDAR_ID) {
      console.log('   (Google Calendar integration available)')
      // Implementation would use Google Calendar API here
    } else {
      console.log('   (Google Calendar not configured - manual entry needed)')
    }
  } else {
    console.log('\n   No start/end times provided.')
    console.log('   Provide --start and --end to schedule.')
    console.log('   Example: npm run schedule chunk-id --start "2026-01-27 09:00" --end "2026-01-27 11:00"')
  }
}

/**
 * Schedule chunks for the coming week
 */
async function scheduleWeek(options = {}) {
  console.log('\n📅 Scheduling for the coming week...')

  const chunks = await getPendingChunks()
  const priorityChunks = chunks.filter(c => c.priority > 0)
  const regularChunks = chunks.filter(c => c.priority === 0)

  console.log(`\n   Priority chunks: ${priorityChunks.length}`)
  console.log(`   Regular chunks: ${regularChunks.length}`)

  if (chunks.length === 0) {
    console.log('\n   No pending chunks to schedule.')
    return
  }

  // Calculate available hours (assuming 30 hours/week of billable work)
  const availableHours = 30
  const priorityHours = priorityChunks.reduce((sum, c) => sum + c.hours, 0)
  const regularHours = Math.min(
    availableHours - priorityHours,
    regularChunks.reduce((sum, c) => sum + c.hours, 0)
  )

  console.log(`\n   Target: ${availableHours}h available`)
  console.log(`   Priority work: ${priorityHours}h`)
  console.log(`   Regular work: ${regularHours}h`)

  if (options.dryRun) {
    console.log('\n   [DRY RUN]')
    console.log('   Next steps:')
    console.log('   1. Claude reads "Adrial project" calendar for blocked times')
    console.log('   2. Claude identifies available slots')
    console.log('   3. Claude schedules priority chunks first')
    console.log('   4. Claude fills remaining slots with regular chunks')
    console.log('   5. Claude calls this script with specific times for each chunk')
    return
  }

  console.log('\n   This command requires Claude to analyze calendar availability.')
  console.log('   Run "npm run schedule --list" to see pending chunks.')
}

/**
 * Sync calendar state
 */
async function syncCalendar(options = {}) {
  console.log('\n🔄 Syncing calendar...')

  const token = await getGoogleToken()
  if (!token) {
    console.log('   Cannot sync without Google OAuth token.')
    return
  }

  // Get all scheduled chunks
  const scheduledChunks = await sql`
    SELECT * FROM chunks
    WHERE status = 'scheduled'
      AND scheduled_start IS NOT NULL
  `

  console.log(`   Found ${scheduledChunks.length} scheduled chunks`)

  if (options.dryRun) {
    console.log('\n   [DRY RUN]')
    console.log('   Would sync the following:')
    for (const chunk of scheduledChunks) {
      console.log(`   - ${chunk.name} @ ${new Date(chunk.scheduled_start).toLocaleString()}`)
    }
    return
  }

  console.log('   Calendar sync would happen here with Google Calendar API')
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = parseArgs()

  console.log('='.repeat(60))
  console.log('Adrial Designs OS - Scheduler')
  console.log('='.repeat(60))

  // Extract additional options
  const startIdx = process.argv.indexOf('--start')
  const endIdx = process.argv.indexOf('--end')
  const options = {
    dryRun: args.dryRun,
    force: process.argv.includes('--force'),
    start: startIdx > -1 ? process.argv[startIdx + 1] : null,
    end: endIdx > -1 ? process.argv[endIdx + 1] : null
  }

  if (args.dryRun) {
    console.log('\n🔍 DRY RUN MODE')
  }

  try {
    if (args.list) {
      await listPendingChunks()
    } else if (args.week) {
      await scheduleWeek(options)
    } else if (args.sync) {
      await syncCalendar(options)
    } else if (args.chunkId) {
      await scheduleChunk(args.chunkId, options)
    } else {
      console.log('\nUsage:')
      console.log('  npm run schedule --list              List pending chunks')
      console.log('  npm run schedule --week              Schedule for coming week')
      console.log('  npm run schedule --sync              Sync with Google Calendar')
      console.log('  npm run schedule <chunk-id>          Schedule specific chunk')
      console.log('')
      console.log('Options:')
      console.log('  --dry-run                            Preview without changes')
      console.log('  --force                              Reschedule already-scheduled chunks')
      console.log('  --start "YYYY-MM-DD HH:MM"           Start time for chunk')
      console.log('  --end "YYYY-MM-DD HH:MM"             End time for chunk')
      console.log('')
      console.log('Examples:')
      console.log('  npm run schedule --list')
      console.log('  npm run schedule chunk-123 --start "2026-01-27 09:00" --end "2026-01-27 11:00"')
    }
  } catch (err) {
    console.error('\n❌ Error:', err.message)
    process.exit(1)
  }
}

main()
