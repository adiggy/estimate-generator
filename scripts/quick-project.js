#!/usr/bin/env node
/**
 * Quick Project Creator
 *
 * Creates a project with chunks directly from a simple input file,
 * bypassing the full proposal workflow for in-progress projects.
 *
 * Usage:
 *   node scripts/quick-project.js input/my-project.json
 *   node scripts/quick-project.js input/my-project.md
 *   npm run quick-project input/my-project.json
 *
 * Supports both JSON and Markdown formats.
 */

const fs = require('fs')
const path = require('path')
const { neon } = require('@neondatabase/serverless')
require('dotenv').config()

const sql = neon(process.env.DATABASE_URL)

// Generate ID helper
function generateId(prefix = '') {
  return prefix ? `${prefix}-${Date.now().toString(36)}` : Date.now().toString(36)
}

// Slugify helper
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// Parse markdown format
function parseMarkdown(content) {
  const lines = content.split('\n')
  const project = {
    name: '',
    client_id: '',
    description: '',
    priority: 0,
    phases: []
  }

  let currentPhase = null
  let inDescription = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Project name (# heading)
    if (trimmed.startsWith('# ')) {
      project.name = trimmed.substring(2).trim()
      continue
    }

    // Client (Client: xxx)
    if (trimmed.toLowerCase().startsWith('client:')) {
      project.client_id = slugify(trimmed.substring(7).trim())
      continue
    }

    // Priority (Priority: high|normal|low|maybe)
    if (trimmed.toLowerCase().startsWith('priority:')) {
      const val = trimmed.substring(9).trim().toLowerCase()
      project.priority = val === 'high' ? 2 : val === 'priority' ? 1 : val === 'low' ? -1 : val === 'maybe' ? -2 : 0
      continue
    }

    // Description (Description: xxx or multi-line after)
    if (trimmed.toLowerCase().startsWith('description:')) {
      project.description = trimmed.substring(12).trim()
      inDescription = !project.description // If empty, expect multi-line
      continue
    }

    // Multi-line description ends at ## or blank line
    if (inDescription) {
      if (trimmed.startsWith('##') || trimmed === '') {
        inDescription = false
      } else {
        project.description += (project.description ? ' ' : '') + trimmed
      }
    }

    // Phase (## heading)
    if (trimmed.startsWith('## ')) {
      // Parse phase name and optional hours: ## Phase Name (10h) or ## Phase Name - 10h
      const phaseText = trimmed.substring(3).trim()
      let phaseName = phaseText
      let hours = 0

      // Try to extract hours from various formats
      const hoursMatch = phaseText.match(/\((\d+)h?\)$/) || phaseText.match(/-\s*(\d+)h?$/) || phaseText.match(/:\s*(\d+)h?$/)
      if (hoursMatch) {
        hours = parseInt(hoursMatch[1])
        phaseName = phaseText.replace(hoursMatch[0], '').trim()
      }

      currentPhase = { name: phaseName, hours, tasks: [] }
      project.phases.push(currentPhase)
      continue
    }

    // Task (- task description)
    if (trimmed.startsWith('- ') && currentPhase) {
      const taskText = trimmed.substring(2).trim()
      // Optional hours at end: - Task name (2h)
      const taskMatch = taskText.match(/\((\d+)h?\)$/)
      if (taskMatch) {
        currentPhase.tasks.push({
          name: taskText.replace(taskMatch[0], '').trim(),
          hours: parseInt(taskMatch[1])
        })
      } else {
        currentPhase.tasks.push({ name: taskText })
      }
      continue
    }
  }

  return project
}

// Parse JSON format
function parseJson(content) {
  const data = JSON.parse(content)
  return {
    name: data.name || data.projectName,
    client_id: data.client_id || slugify(data.client || ''),
    description: data.description || '',
    priority: data.priority || 0,
    phases: data.phases || []
  }
}

// Create project and chunks
async function createProject(project) {
  const projectId = slugify(`${project.client_id}-${project.name}`).substring(0, 60)

  // Check if project exists
  const existing = await sql`SELECT id FROM projects WHERE id = ${projectId}`
  if (existing.length > 0) {
    console.error(`Project already exists: ${projectId}`)
    console.error('Use a different name or delete the existing project first.')
    process.exit(1)
  }

  // Calculate total hours from phases
  let totalHours = 0
  for (const phase of project.phases) {
    if (phase.hours) {
      totalHours += phase.hours
    } else if (phase.tasks) {
      totalHours += phase.tasks.reduce((sum, t) => sum + (t.hours || 0), 0)
    }
  }

  const rate = 12000 // $120/hr in cents

  // Create project
  await sql`
    INSERT INTO projects (id, client_id, name, description, status, priority, billing_type, billing_platform, budget_low, budget_high, rate, tags)
    VALUES (
      ${projectId},
      ${project.client_id},
      ${project.name},
      ${project.description},
      'active',
      ${project.priority},
      'fixed',
      'os',
      ${totalHours * rate},
      ${totalHours * rate},
      ${rate},
      ${JSON.stringify(['quick-project'])}::jsonb
    )
  `

  console.log(`Created project: ${projectId}`)
  console.log(`  Client: ${project.client_id}`)
  console.log(`  Priority: ${project.priority}`)
  console.log(`  Total hours: ${totalHours}`)
  console.log('')

  // Create chunks from phases
  let chunkCount = 0
  let phaseOrder = 0

  for (const phase of project.phases) {
    console.log(`Phase ${phaseOrder}: ${phase.name}`)

    // If phase has explicit hours, break into chunks
    if (phase.hours && !phase.tasks?.length) {
      const chunks = breakIntoChunks(phase.hours)
      let draftOrder = 0

      for (const hours of chunks) {
        const chunkName = chunks.length === 1
          ? phase.name
          : `${phase.name} (Part ${draftOrder + 1}/${chunks.length})`

        await sql`
          INSERT INTO chunks (id, project_id, phase_name, name, hours, status, phase_order, draft_order)
          VALUES (
            ${generateId('chk')},
            ${projectId},
            ${phase.name},
            ${chunkName},
            ${hours},
            'pending',
            ${phaseOrder},
            ${draftOrder}
          )
        `
        draftOrder++
        chunkCount++
      }
      console.log(`  Created ${chunks.length} chunks (${phase.hours}h)`)
    }
    // If phase has tasks, create chunk for each task
    else if (phase.tasks?.length) {
      let draftOrder = 0
      let phaseHours = 0

      for (const task of phase.tasks) {
        const hours = task.hours || 2 // Default 2h if not specified
        await sql`
          INSERT INTO chunks (id, project_id, phase_name, name, hours, status, phase_order, draft_order)
          VALUES (
            ${generateId('chk')},
            ${projectId},
            ${phase.name},
            ${task.name},
            ${hours},
            'pending',
            ${phaseOrder},
            ${draftOrder}
          )
        `
        draftOrder++
        chunkCount++
        phaseHours += hours
      }
      console.log(`  Created ${phase.tasks.length} chunks (${phaseHours}h)`)
    }

    phaseOrder++
  }

  console.log('')
  console.log(`Total: ${chunkCount} chunks created`)
  console.log(`View at: http://localhost:5173/dashboard/os-beta/projects/${projectId}`)

  return { projectId, chunkCount }
}

// Break hours into 1-3 hour chunks
function breakIntoChunks(totalHours) {
  const chunks = []
  let remaining = totalHours

  while (remaining > 0) {
    if (remaining >= 6) {
      chunks.push(3)
      remaining -= 3
    } else if (remaining >= 4) {
      chunks.push(2)
      remaining -= 2
    } else if (remaining === 3) {
      chunks.push(3)
      remaining = 0
    } else if (remaining === 2) {
      chunks.push(2)
      remaining = 0
    } else {
      chunks.push(1)
      remaining = 0
    }
  }

  return chunks
}

// Main
async function main() {
  const inputFile = process.argv[2]

  if (!inputFile) {
    console.log('Quick Project Creator')
    console.log('=====================')
    console.log('')
    console.log('Usage:')
    console.log('  node scripts/quick-project.js <input-file>')
    console.log('  npm run quick-project <input-file>')
    console.log('')
    console.log('Input file can be JSON or Markdown.')
    console.log('')
    console.log('Example Markdown format:')
    console.log('  # Project Name')
    console.log('  Client: Client Name')
    console.log('  Priority: high')
    console.log('  Description: Brief project description')
    console.log('')
    console.log('  ## Phase 1 Name (10h)')
    console.log('  ## Phase 2 Name (8h)')
    console.log('')
    console.log('Or with explicit tasks:')
    console.log('  ## Phase Name')
    console.log('  - Task 1 (2h)')
    console.log('  - Task 2 (3h)')
    console.log('')
    console.log('Example JSON format:')
    console.log('  {')
    console.log('    "name": "Project Name",')
    console.log('    "client": "Client Name",')
    console.log('    "priority": 1,')
    console.log('    "phases": [')
    console.log('      { "name": "Phase 1", "hours": 10 },')
    console.log('      { "name": "Phase 2", "tasks": [')
    console.log('        { "name": "Task 1", "hours": 2 }')
    console.log('      ]}')
    console.log('    ]')
    console.log('  }')
    process.exit(0)
  }

  // Read input file
  const filePath = path.resolve(inputFile)
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }

  const content = fs.readFileSync(filePath, 'utf8')
  const ext = path.extname(filePath).toLowerCase()

  // Parse based on extension
  let project
  if (ext === '.json') {
    project = parseJson(content)
  } else if (ext === '.md' || ext === '.markdown') {
    project = parseMarkdown(content)
  } else {
    // Try to auto-detect
    if (content.trim().startsWith('{')) {
      project = parseJson(content)
    } else {
      project = parseMarkdown(content)
    }
  }

  // Validate
  if (!project.name) {
    console.error('Project name is required')
    process.exit(1)
  }
  if (!project.client_id) {
    console.error('Client is required')
    process.exit(1)
  }
  if (!project.phases.length) {
    console.error('At least one phase is required')
    process.exit(1)
  }

  console.log('Quick Project Creator')
  console.log('=====================')
  console.log('')

  await createProject(project)
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
