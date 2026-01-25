#!/usr/bin/env node
/**
 * Time Logger CLI for Adrial Designs OS
 *
 * Simple CLI for start/stop/log time entries.
 *
 * Usage:
 *   npm run time-log start <project-id> "Description"
 *   npm run time-log stop
 *   npm run time-log log <project-id> "Description" --duration 2h
 *   npm run time-log status
 *   npm run time-log list [project-id]
 */

const {
  getProject,
  getTimeLogs,
  getTimeLog,
  createTimeLog,
  stopTimeLog,
  logTime,
  generateId,
  formatMoney
} = require('./lib/db')

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Parse duration string (e.g., "2h", "30m", "1h30m", "90")
 * @param {string} value
 * @returns {number} Duration in minutes
 */
function parseDuration(value) {
  if (!value) return 0

  // Pure number = minutes
  if (/^\d+$/.test(value)) {
    return parseInt(value)
  }

  let minutes = 0

  // Hours
  const hoursMatch = value.match(/(\d+)h/i)
  if (hoursMatch) {
    minutes += parseInt(hoursMatch[1]) * 60
  }

  // Minutes
  const minsMatch = value.match(/(\d+)m/i)
  if (minsMatch) {
    minutes += parseInt(minsMatch[1])
  }

  return minutes
}

/**
 * Format duration in minutes to human readable
 * @param {number} minutes
 * @returns {string}
 */
function formatDuration(minutes) {
  if (!minutes) return '0m'

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m`
  } else if (hours > 0) {
    return `${hours}h`
  } else {
    return `${mins}m`
  }
}

/**
 * Get the currently running timer
 * @returns {Promise<Object|null>}
 */
async function getRunningTimer() {
  const logs = await getTimeLogs({ invoiced: false })
  return logs.find(l => l.started_at && !l.ended_at) || null
}

// ============================================================================
// COMMANDS
// ============================================================================

/**
 * Start a new timer
 */
async function startTimer(projectId, description) {
  // Check for existing running timer
  const running = await getRunningTimer()
  if (running) {
    console.error('❌ Timer already running!')
    console.error(`   Project: ${running.project_id}`)
    console.error(`   Description: ${running.description}`)
    console.error(`   Started: ${new Date(running.started_at).toLocaleString()}`)
    console.error('\n   Run "npm run time-log stop" first.')
    process.exit(1)
  }

  // Validate project exists
  const project = await getProject(projectId)
  if (!project) {
    console.error(`❌ Project not found: ${projectId}`)
    process.exit(1)
  }

  const id = generateId('tl')
  const log = await createTimeLog({
    id,
    project_id: projectId,
    description: description || 'Work session',
    rate: project.rate
  })

  console.log('✅ Timer started!')
  console.log(`   Project: ${project.name}`)
  console.log(`   Description: ${log.description}`)
  console.log(`   Started: ${new Date(log.started_at).toLocaleString()}`)
  console.log('\n   Run "npm run time-log stop" when done.')
}

/**
 * Stop the running timer
 */
async function stopTimer() {
  const running = await getRunningTimer()
  if (!running) {
    console.error('❌ No timer running!')
    console.error('   Start one with "npm run time-log start <project-id> <description>"')
    process.exit(1)
  }

  const stopped = await stopTimeLog(running.id)
  const project = await getProject(running.project_id)

  console.log('✅ Timer stopped!')
  console.log(`   Project: ${project?.name || running.project_id}`)
  console.log(`   Description: ${stopped.description}`)
  console.log(`   Duration: ${formatDuration(stopped.duration_minutes)}`)

  if (project?.rate && stopped.duration_minutes) {
    const amount = Math.round((stopped.duration_minutes / 60) * project.rate)
    console.log(`   Value: ${formatMoney(amount)}`)
  }
}

/**
 * Log time directly without start/stop
 */
async function logTimeEntry(projectId, description, durationStr) {
  // Validate project exists
  const project = await getProject(projectId)
  if (!project) {
    console.error(`❌ Project not found: ${projectId}`)
    process.exit(1)
  }

  const durationMinutes = parseDuration(durationStr)
  if (!durationMinutes) {
    console.error('❌ Invalid duration. Examples: "2h", "30m", "1h30m", "90"')
    process.exit(1)
  }

  const id = generateId('tl')
  const log = await logTime({
    id,
    project_id: projectId,
    description: description || 'Work session',
    duration_minutes: durationMinutes,
    rate: project.rate
  })

  console.log('✅ Time logged!')
  console.log(`   Project: ${project.name}`)
  console.log(`   Description: ${log.description}`)
  console.log(`   Duration: ${formatDuration(log.duration_minutes)}`)

  if (project.rate) {
    const amount = Math.round((log.duration_minutes / 60) * project.rate)
    console.log(`   Value: ${formatMoney(amount)}`)
  }
}

/**
 * Show current timer status
 */
async function showStatus() {
  const running = await getRunningTimer()

  if (running) {
    const project = await getProject(running.project_id)
    const startedAt = new Date(running.started_at)
    const elapsed = Math.round((Date.now() - startedAt.getTime()) / 60000)

    console.log('⏱️  Timer running:')
    console.log(`   Project: ${project?.name || running.project_id}`)
    console.log(`   Description: ${running.description}`)
    console.log(`   Started: ${startedAt.toLocaleString()}`)
    console.log(`   Elapsed: ${formatDuration(elapsed)}`)
  } else {
    console.log('⏹️  No timer running.')
  }
}

/**
 * List recent time entries
 */
async function listEntries(projectId) {
  const logs = await getTimeLogs(projectId ? { projectId } : {})
  const recent = logs.slice(0, 20)

  if (recent.length === 0) {
    console.log('No time entries found.')
    return
  }

  console.log('Recent time entries:\n')

  for (const log of recent) {
    const project = await getProject(log.project_id)
    const startedAt = new Date(log.started_at).toLocaleDateString()
    const duration = log.duration_minutes ? formatDuration(log.duration_minutes) : '(running)'
    const invoiced = log.invoiced ? ' [invoiced]' : ''

    console.log(`  ${startedAt}  ${duration.padEnd(8)}  ${(project?.name || log.project_id).substring(0, 25).padEnd(25)}  ${log.description?.substring(0, 30) || ''}${invoiced}`)
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  try {
    switch (command) {
      case 'start': {
        const projectId = args[1]
        const description = args.slice(2).join(' ').replace(/--duration.*/, '').trim()
        if (!projectId) {
          console.error('Usage: npm run time-log start <project-id> "Description"')
          process.exit(1)
        }
        await startTimer(projectId, description)
        break
      }

      case 'stop': {
        await stopTimer()
        break
      }

      case 'log': {
        const projectId = args[1]
        const durationIdx = args.indexOf('--duration')
        const duration = durationIdx > -1 ? args[durationIdx + 1] : null
        const description = args
          .slice(2)
          .filter((_, i) => i + 2 !== durationIdx && i + 2 !== durationIdx + 1)
          .join(' ')
          .trim()

        if (!projectId || !duration) {
          console.error('Usage: npm run time-log log <project-id> "Description" --duration 2h')
          process.exit(1)
        }
        await logTimeEntry(projectId, description, duration)
        break
      }

      case 'status': {
        await showStatus()
        break
      }

      case 'list': {
        const projectId = args[1]
        await listEntries(projectId)
        break
      }

      default: {
        console.log('Time Logger CLI')
        console.log('')
        console.log('Usage:')
        console.log('  npm run time-log start <project-id> "Description"   Start timer')
        console.log('  npm run time-log stop                               Stop running timer')
        console.log('  npm run time-log log <project-id> "Desc" --duration 2h')
        console.log('  npm run time-log status                             Show running timer')
        console.log('  npm run time-log list [project-id]                  List recent entries')
        console.log('')
        console.log('Duration formats: 2h, 30m, 1h30m, 90 (minutes)')
      }
    }
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

main()
