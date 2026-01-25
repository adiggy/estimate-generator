#!/usr/bin/env node
/**
 * Chunker CLI for Adrial Designs OS
 *
 * Breaks down project scope into 1-3 hour schedulable chunks.
 * This is a "dumb" tool that Claude Code uses to create chunks from:
 * - Proposal phases (reads from proposals JSON)
 * - Manual scope descriptions
 * - Existing project notes
 *
 * Usage:
 *   npm run chunker --project <project-id>              # Chunk from project notes
 *   npm run chunker --proposal <proposal-id>            # Chunk from proposal phases
 *   npm run chunker --project <id> --scope "scope.txt"  # Chunk from scope file
 *   npm run chunker --list <project-id>                 # List existing chunks
 *   npm run chunker --preview                           # Preview without saving
 *
 * Chunking Rules:
 * - Each chunk must be 1, 2, or 3 hours (no more, no less)
 * - Chunks should be self-contained work units
 * - Group related chunks under a phase_name
 * - Aim for ~2 hour chunks as the default
 */

const fs = require('fs')
const path = require('path')
const {
  sql,
  getProject,
  getChunks,
  createChunk,
  generateId,
  slugify
} = require('./lib/db')

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    projectId: null,
    proposalId: null,
    scopeFile: null,
    list: false,
    preview: false,
    clear: false,
    help: false
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--project':
      case '-p':
        options.projectId = args[++i]
        break
      case '--proposal':
        options.proposalId = args[++i]
        break
      case '--scope':
      case '-s':
        options.scopeFile = args[++i]
        break
      case '--list':
      case '-l':
        options.list = true
        options.projectId = options.projectId || args[++i]
        break
      case '--preview':
        options.preview = true
        break
      case '--clear':
        options.clear = true
        break
      case '--help':
      case '-h':
        options.help = true
        break
    }
  }

  return options
}

/**
 * Break hours into valid chunks (1, 2, or 3 hours each)
 * Prefers 2-hour chunks, uses 3 for larger work, 1 for small tasks
 *
 * @param {number} totalHours - Total hours to chunk
 * @returns {number[]} Array of chunk sizes
 */
function breakIntoChunks(totalHours) {
  const chunks = []
  let remaining = Math.round(totalHours)

  while (remaining > 0) {
    if (remaining >= 6) {
      // Large amount: use 3-hour chunks
      chunks.push(3)
      remaining -= 3
    } else if (remaining >= 4) {
      // Medium: use 2-hour chunks
      chunks.push(2)
      remaining -= 2
    } else if (remaining === 3) {
      chunks.push(3)
      remaining = 0
    } else if (remaining === 2) {
      chunks.push(2)
      remaining = 0
    } else if (remaining === 1) {
      chunks.push(1)
      remaining = 0
    } else {
      // Handle fractional: round to nearest valid
      if (remaining < 1.5) {
        chunks.push(1)
      } else if (remaining < 2.5) {
        chunks.push(2)
      } else {
        chunks.push(3)
      }
      remaining = 0
    }
  }

  return chunks
}

/**
 * Generate chunk names for a phase
 * @param {string} phaseName - Name of the phase
 * @param {number} count - Number of chunks
 * @returns {string[]} Array of chunk names
 */
function generateChunkNames(phaseName, count) {
  if (count === 1) {
    return [phaseName]
  }

  const names = []
  for (let i = 1; i <= count; i++) {
    names.push(`${phaseName} (Part ${i}/${count})`)
  }
  return names
}

/**
 * Parse a proposal's phases into chunk specifications
 * @param {Object} proposal - Proposal data
 * @returns {Array<{phase: string, chunks: Array}>}
 */
function parseProposalPhases(proposal) {
  const results = []

  for (const phase of (proposal.phases || [])) {
    // Skip optional phases by default
    if (phase.optional) continue

    // Calculate average hours
    const avgHours = (phase.lowHrs + phase.highHrs) / 2
    const chunkSizes = breakIntoChunks(avgHours)
    const chunkNames = generateChunkNames(phase.name, chunkSizes.length)

    results.push({
      phase_name: phase.name,
      description: phase.description,
      total_hours: avgHours,
      chunks: chunkSizes.map((hours, i) => ({
        name: chunkNames[i],
        description: i === 0 ? phase.description : `Continuation of ${phase.name}`,
        hours
      }))
    })
  }

  return results
}

/**
 * Parse scope text into chunk specifications
 * Looks for patterns like:
 * - "## Phase Name" for phases
 * - "- Task (Xh)" or "- Task: X hours" for tasks
 *
 * @param {string} scopeText - Scope document text
 * @returns {Array<{phase: string, chunks: Array}>}
 */
function parseScopeText(scopeText) {
  const results = []
  const lines = scopeText.split('\n')

  let currentPhase = 'General'
  let currentTasks = []

  const flushPhase = () => {
    if (currentTasks.length > 0) {
      results.push({
        phase_name: currentPhase,
        chunks: currentTasks
      })
      currentTasks = []
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()

    // Phase header: ## Phase Name
    const phaseMatch = trimmed.match(/^#{1,3}\s+(.+)$/)
    if (phaseMatch) {
      flushPhase()
      currentPhase = phaseMatch[1]
      continue
    }

    // Task with hours: - Task name (2h) or - Task name: 2 hours
    const taskMatch = trimmed.match(/^[-*]\s+(.+?)\s*(?:\((\d+)h?\)|:\s*(\d+)\s*hours?)$/i)
    if (taskMatch) {
      const name = taskMatch[1].trim()
      const hours = parseInt(taskMatch[2] || taskMatch[3])

      if (hours >= 1 && hours <= 3) {
        currentTasks.push({ name, hours, description: '' })
      } else if (hours > 3) {
        // Break large tasks into chunks
        const chunkSizes = breakIntoChunks(hours)
        const chunkNames = generateChunkNames(name, chunkSizes.length)
        for (let i = 0; i < chunkSizes.length; i++) {
          currentTasks.push({
            name: chunkNames[i],
            hours: chunkSizes[i],
            description: i === 0 ? '' : `Continuation of ${name}`
          })
        }
      }
      continue
    }

    // Task without hours (default to 2h): - Task name
    const simpleTaskMatch = trimmed.match(/^[-*]\s+(.+)$/)
    if (simpleTaskMatch && !trimmed.includes('http')) {
      const name = simpleTaskMatch[1].trim()
      if (name.length > 3 && name.length < 100) {
        currentTasks.push({ name, hours: 2, description: '' })
      }
    }
  }

  flushPhase()
  return results
}

// ============================================================================
// COMMANDS
// ============================================================================

/**
 * List existing chunks for a project
 */
async function listChunks(projectId) {
  const project = await getProject(projectId)
  if (!project) {
    console.error(`❌ Project not found: ${projectId}`)
    process.exit(1)
  }

  const chunks = await getChunks(projectId)

  console.log(`\n📁 ${project.name}`)
  console.log(`   Client: ${project.client_id}`)
  console.log(`   Status: ${project.status}\n`)

  if (chunks.length === 0) {
    console.log('   No chunks found. Run chunker to create some.')
    return
  }

  // Group by phase
  const byPhase = chunks.reduce((acc, chunk) => {
    const phase = chunk.phase_name || 'General'
    if (!acc[phase]) acc[phase] = []
    acc[phase].push(chunk)
    return acc
  }, {})

  let totalHours = 0
  let completedHours = 0

  for (const [phase, phaseChunks] of Object.entries(byPhase)) {
    console.log(`   📂 ${phase}`)

    for (const chunk of phaseChunks) {
      const status = chunk.status === 'done' ? '✓' :
                     chunk.status === 'in_progress' ? '▶' :
                     chunk.status === 'scheduled' ? '📅' : '○'
      console.log(`      ${status} [${chunk.hours}h] ${chunk.name}`)
      totalHours += chunk.hours
      if (chunk.status === 'done') completedHours += chunk.hours
    }
  }

  console.log(`\n   Total: ${completedHours}/${totalHours} hours complete`)
}

/**
 * Create chunks from a proposal
 */
async function chunkFromProposal(proposalId, projectId, options) {
  // Load proposal
  const proposalPath = path.join(__dirname, '..', 'data', 'proposals', `${proposalId}.json`)

  if (!fs.existsSync(proposalPath)) {
    // Try loading from database
    const rows = await sql`SELECT data FROM proposals WHERE id = ${proposalId}`
    if (rows.length === 0) {
      console.error(`❌ Proposal not found: ${proposalId}`)
      process.exit(1)
    }
    var proposal = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data
  } else {
    var proposal = JSON.parse(fs.readFileSync(proposalPath, 'utf8'))
  }

  console.log(`\n📋 Chunking proposal: ${proposal.projectName}`)
  console.log(`   Client: ${proposal.clientName || proposal.clientCompany}`)
  console.log(`   Phases: ${proposal.phases?.length || 0}\n`)

  // Parse phases into chunks
  const phaseChunks = parseProposalPhases(proposal)

  if (phaseChunks.length === 0) {
    console.log('   No phases found in proposal.')
    return
  }

  // Display preview
  let totalChunks = 0
  let totalHours = 0

  for (const { phase_name, total_hours, chunks } of phaseChunks) {
    console.log(`   📂 ${phase_name} (${total_hours}h → ${chunks.length} chunks)`)
    for (const chunk of chunks) {
      console.log(`      ○ [${chunk.hours}h] ${chunk.name}`)
      totalChunks++
      totalHours += chunk.hours
    }
  }

  console.log(`\n   Summary: ${totalChunks} chunks, ${totalHours} hours total`)

  if (options.preview) {
    console.log('\n   [PREVIEW MODE - No chunks created]')
    return
  }

  if (!projectId) {
    console.log('\n   Provide --project <id> to create chunks in database.')
    return
  }

  // Verify project exists
  const project = await getProject(projectId)
  if (!project) {
    console.error(`\n❌ Project not found: ${projectId}`)
    process.exit(1)
  }

  // Clear existing chunks if requested
  if (options.clear) {
    await sql`DELETE FROM chunks WHERE project_id = ${projectId}`
    console.log('\n   Cleared existing chunks.')
  }

  // Create chunks
  console.log('\n   Creating chunks...')
  for (const { phase_name, chunks } of phaseChunks) {
    for (const chunk of chunks) {
      await createChunk({
        id: generateId('chk'),
        project_id: projectId,
        phase_name,
        name: chunk.name,
        description: chunk.description,
        hours: chunk.hours
      })
    }
  }

  console.log(`   ✅ Created ${totalChunks} chunks`)
}

/**
 * Create chunks from a scope file
 */
async function chunkFromScope(projectId, scopeFile, options) {
  const project = await getProject(projectId)
  if (!project) {
    console.error(`❌ Project not found: ${projectId}`)
    process.exit(1)
  }

  // Read scope file
  const scopePath = path.resolve(scopeFile)
  if (!fs.existsSync(scopePath)) {
    console.error(`❌ Scope file not found: ${scopePath}`)
    process.exit(1)
  }

  const scopeText = fs.readFileSync(scopePath, 'utf8')
  console.log(`\n📋 Chunking from scope file: ${scopeFile}`)
  console.log(`   Project: ${project.name}\n`)

  // Parse scope text
  const phaseChunks = parseScopeText(scopeText)

  if (phaseChunks.length === 0) {
    console.log('   No tasks found in scope file.')
    console.log('   Expected format:')
    console.log('   ## Phase Name')
    console.log('   - Task name (2h)')
    console.log('   - Another task: 3 hours')
    return
  }

  // Display preview
  let totalChunks = 0
  let totalHours = 0

  for (const { phase_name, chunks } of phaseChunks) {
    console.log(`   📂 ${phase_name}`)
    for (const chunk of chunks) {
      console.log(`      ○ [${chunk.hours}h] ${chunk.name}`)
      totalChunks++
      totalHours += chunk.hours
    }
  }

  console.log(`\n   Summary: ${totalChunks} chunks, ${totalHours} hours total`)

  if (options.preview) {
    console.log('\n   [PREVIEW MODE - No chunks created]')
    return
  }

  // Clear existing chunks if requested
  if (options.clear) {
    await sql`DELETE FROM chunks WHERE project_id = ${projectId}`
    console.log('\n   Cleared existing chunks.')
  }

  // Create chunks
  console.log('\n   Creating chunks...')
  for (const { phase_name, chunks } of phaseChunks) {
    for (const chunk of chunks) {
      await createChunk({
        id: generateId('chk'),
        project_id: projectId,
        phase_name,
        name: chunk.name,
        description: chunk.description,
        hours: chunk.hours
      })
    }
  }

  console.log(`   ✅ Created ${totalChunks} chunks`)
}

/**
 * Create chunks from project notes
 */
async function chunkFromProject(projectId, options) {
  const project = await getProject(projectId)
  if (!project) {
    console.error(`❌ Project not found: ${projectId}`)
    process.exit(1)
  }

  console.log(`\n📋 Chunking project: ${project.name}`)
  console.log(`   Client: ${project.client_id}`)

  // If project has a linked proposal, use that
  if (project.proposal_id) {
    console.log(`   Found linked proposal: ${project.proposal_id}`)
    await chunkFromProposal(project.proposal_id, projectId, options)
    return
  }

  // Otherwise, try to parse from notes
  if (project.notes) {
    console.log('   Parsing from project notes...\n')
    const phaseChunks = parseScopeText(project.notes)

    if (phaseChunks.length > 0) {
      let totalChunks = 0
      let totalHours = 0

      for (const { phase_name, chunks } of phaseChunks) {
        console.log(`   📂 ${phase_name}`)
        for (const chunk of chunks) {
          console.log(`      ○ [${chunk.hours}h] ${chunk.name}`)
          totalChunks++
          totalHours += chunk.hours
        }
      }

      console.log(`\n   Summary: ${totalChunks} chunks, ${totalHours} hours total`)

      if (!options.preview) {
        if (options.clear) {
          await sql`DELETE FROM chunks WHERE project_id = ${projectId}`
          console.log('\n   Cleared existing chunks.')
        }

        console.log('\n   Creating chunks...')
        for (const { phase_name, chunks } of phaseChunks) {
          for (const chunk of chunks) {
            await createChunk({
              id: generateId('chk'),
              project_id: projectId,
              phase_name,
              name: chunk.name,
              description: chunk.description,
              hours: chunk.hours
            })
          }
        }
        console.log(`   ✅ Created ${totalChunks} chunks`)
      } else {
        console.log('\n   [PREVIEW MODE - No chunks created]')
      }
      return
    }
  }

  console.log('\n   No structured scope found in project.')
  console.log('   Options:')
  console.log('   - Link a proposal with --proposal <id>')
  console.log('   - Provide a scope file with --scope <file>')
  console.log('   - Add structured notes to the project')
}

/**
 * Show help
 */
function showHelp() {
  console.log(`
Chunker CLI - Break down project scope into schedulable chunks

Usage:
  npm run chunker --project <id>                    Chunk from project notes
  npm run chunker --proposal <id> --project <id>   Chunk from proposal phases
  npm run chunker --project <id> --scope <file>    Chunk from scope file
  npm run chunker --list <project-id>              List existing chunks

Options:
  --preview    Preview chunks without saving
  --clear      Clear existing chunks before creating new ones
  --help       Show this help

Scope File Format:
  ## Phase Name
  - Task description (2h)
  - Another task: 3 hours
  - Simple task              (defaults to 2h)

  ## Design
  - Mockups (3h)
  - Style guide (2h)

Chunking Rules:
  - Each chunk is 1, 2, or 3 hours
  - Tasks > 3h are automatically split
  - Prefer 2h chunks for most work
  - Group related work under phases

Examples:
  npm run chunker --proposal 2026-01-20-my-project --project proj-123 --preview
  npm run chunker --project proj-123 --scope requirements.md
  npm run chunker --list proj-123
`)
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const options = parseArgs()

  if (options.help) {
    showHelp()
    return
  }

  console.log('='.repeat(60))
  console.log('Adrial Designs OS - Chunker')
  console.log('='.repeat(60))

  try {
    if (options.list && options.projectId) {
      await listChunks(options.projectId)
    } else if (options.proposalId) {
      await chunkFromProposal(options.proposalId, options.projectId, options)
    } else if (options.scopeFile && options.projectId) {
      await chunkFromScope(options.projectId, options.scopeFile, options)
    } else if (options.projectId) {
      await chunkFromProject(options.projectId, options)
    } else {
      showHelp()
    }
  } catch (err) {
    console.error('\n❌ Error:', err.message)
    process.exit(1)
  }
}

main()
