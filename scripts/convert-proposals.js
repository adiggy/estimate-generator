/**
 * Convert proposals to projects with intelligent chunking
 *
 * This script:
 * 1. Reads proposal JSON files
 * 2. Creates projects in the database
 * 3. Breaks phases into 1-3 hour chunks based on work scope
 * 4. Preserves archive path so Claude can reference inputs for context
 */

const fs = require('fs')
const path = require('path')
const db = require('./lib/db.js')

// Chunking rules based on phase characteristics
function chunkPhase(phase, projectContext) {
  const chunks = []
  const avgHours = (phase.lowHrs + phase.highHrs) / 2
  const phaseName = phase.name

  // Different chunking strategies based on phase type
  if (phaseName.toLowerCase().includes('discovery') || phaseName.toLowerCase().includes('planning') || phaseName.toLowerCase().includes('audit')) {
    // Discovery/Planning phases: mix of 2-3 hour chunks
    return chunkByTaskType(phase, [
      { name: 'Requirements gathering', hours: 2 },
      { name: 'Documentation review', hours: 2 },
      { name: 'Architecture planning', hours: 3 },
      { name: 'Roadmap creation', hours: 2 },
    ], avgHours)
  }

  if (phaseName.toLowerCase().includes('design') && phaseName.toLowerCase().includes('system')) {
    // Design system phases: component-based chunks
    return chunkByTaskType(phase, [
      { name: 'Header component design', hours: 3 },
      { name: 'Footer component design', hours: 2 },
      { name: 'Typography system', hours: 2 },
      { name: 'Color & brand integration', hours: 2 },
      { name: 'Component documentation', hours: 2 },
    ], avgHours)
  }

  if (phaseName.toLowerCase().includes('static page') || phaseName.toLowerCase().includes('page development')) {
    // Page development: chunk by page groups
    const pageCount = projectContext.pageCount || Math.ceil(avgHours / 1.5)
    return chunkPages(phase, pageCount, avgHours)
  }

  if (phaseName.toLowerCase().includes('cms') || phaseName.toLowerCase().includes('migration') || phaseName.toLowerCase().includes('database')) {
    // CMS/Migration: chunk by template and content batches
    return chunkByTaskType(phase, [
      { name: 'CMS schema setup', hours: 3 },
      { name: 'Template development', hours: 3 },
      { name: 'Content migration batch', hours: 2 },
      { name: 'Data validation', hours: 2 },
    ], avgHours)
  }

  if (phaseName.toLowerCase().includes('core') || phaseName.toLowerCase().includes('application')) {
    // Core app development: feature-based chunks
    return chunkByTaskType(phase, [
      { name: 'Foundation & setup', hours: 3 },
      { name: 'UI components', hours: 3 },
      { name: 'Core feature development', hours: 3 },
      { name: 'State management', hours: 2 },
      { name: 'API integration', hours: 2 },
    ], avgHours)
  }

  if (phaseName.toLowerCase().includes('extended') || phaseName.toLowerCase().includes('feature')) {
    // Extended features: feature-by-feature
    return chunkByTaskType(phase, [
      { name: 'Feature implementation', hours: 3 },
      { name: 'Format/variant development', hours: 2 },
      { name: 'Integration work', hours: 2 },
    ], avgHours)
  }

  if (phaseName.toLowerCase().includes('development') || phaseName.toLowerCase().includes('integration') || phaseName.toLowerCase().includes('build')) {
    // Development phases: technical task chunks
    return chunkByTaskType(phase, [
      { name: 'Technical implementation', hours: 3 },
      { name: 'Integration work', hours: 2 },
      { name: 'Code optimization', hours: 2 },
    ], avgHours)
  }

  if (phaseName.toLowerCase().includes('qa') || phaseName.toLowerCase().includes('testing') || phaseName.toLowerCase().includes('launch')) {
    // QA/Launch phases
    return chunkByTaskType(phase, [
      { name: 'Cross-browser testing', hours: 2 },
      { name: 'Device testing', hours: 2 },
      { name: 'Bug fixes', hours: 2 },
      { name: 'Final review', hours: 2 },
      { name: 'Deployment', hours: 2 },
    ], avgHours)
  }

  // Default: simple time-based chunking
  return chunkByTime(phase, avgHours)
}

function chunkByTaskType(phase, taskTemplates, totalHours) {
  const chunks = []
  let remainingHours = totalHours
  let taskIndex = 0
  let iteration = 1

  while (remainingHours > 0) {
    const template = taskTemplates[taskIndex % taskTemplates.length]
    const hours = Math.min(template.hours, remainingHours, 3)

    if (hours < 1) break

    const chunkHours = Math.max(1, Math.round(hours))
    chunks.push({
      phase_name: phase.name,
      name: taskTemplates.length > 1 && iteration > taskTemplates.length
        ? `${template.name} (${Math.ceil(iteration / taskTemplates.length)})`
        : template.name,
      description: phase.description,
      hours: chunkHours
    })

    remainingHours -= chunkHours
    taskIndex++
    iteration++
  }

  return chunks
}

function chunkPages(phase, pageCount, totalHours) {
  const chunks = []
  const hoursPerPage = totalHours / pageCount
  const pagesPerChunk = Math.max(1, Math.floor(3 / hoursPerPage))

  let pagesRemaining = pageCount
  let chunkNum = 1

  while (pagesRemaining > 0) {
    const pagesInChunk = Math.min(pagesPerChunk, pagesRemaining)
    const hours = Math.min(3, Math.max(1, Math.round(pagesInChunk * hoursPerPage)))

    chunks.push({
      phase_name: phase.name,
      name: `Page development batch ${chunkNum}`,
      description: `${pagesInChunk} pages - ${phase.description}`,
      hours
    })

    pagesRemaining -= pagesInChunk
    chunkNum++
  }

  return chunks
}

function chunkByTime(phase, totalHours) {
  const chunks = []
  let remaining = totalHours
  let chunkNum = 1

  while (remaining > 0) {
    const hours = Math.min(3, Math.max(1, Math.round(remaining)))
    if (hours < 1) break

    chunks.push({
      phase_name: phase.name,
      name: `${phase.name} - Part ${chunkNum}`,
      description: phase.description,
      hours
    })

    remaining -= hours
    chunkNum++
  }

  return chunks
}

async function convertProposal(proposalPath) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Converting: ${path.basename(proposalPath)}`)
  console.log('='.repeat(60))

  // Read proposal
  const proposal = JSON.parse(fs.readFileSync(proposalPath, 'utf8'))

  // Calculate budget from phases
  const budgetLow = proposal.phases.reduce((sum, p) => sum + (p.lowHrs * p.rate), 0)
  const budgetHigh = proposal.phases.reduce((sum, p) => sum + (p.highHrs * p.rate), 0)
  const totalLowHrs = proposal.phases.reduce((sum, p) => sum + p.lowHrs, 0)
  const totalHighHrs = proposal.phases.reduce((sum, p) => sum + p.highHrs, 0)

  console.log(`\nProject: ${proposal.projectName}`)
  console.log(`Client: ${proposal.clientId}`)
  console.log(`Estimated: ${totalLowHrs}-${totalHighHrs} hours ($${budgetLow/100}-$${budgetHigh/100})`)
  console.log(`Phases: ${proposal.phases.length}`)

  // Extract context for smarter chunking
  const projectContext = {
    pageCount: proposal.projectSpecifics?.match(/\((\d+) pages\)/)?.[1] ||
               proposal.projectSpecifics?.match(/(\d+) static pages/i)?.[1] ||
               null
  }

  if (projectContext.pageCount) {
    console.log(`Detected ${projectContext.pageCount} pages in project specifics`)
  }

  // Create project
  const projectId = proposal.id
  const project = {
    id: projectId,
    client_id: proposal.clientId,
    proposal_id: proposal.id,
    name: proposal.projectName,
    description: proposal.projectDescription,
    status: 'active',
    priority: 1, // Both are priority projects for this test
    billing_type: 'fixed',
    billing_platform: 'os',
    budget_low: budgetLow,
    budget_high: budgetHigh,
    rate: (proposal.phases[0]?.rate || 120) * 100, // Convert to cents
    due_date: proposal.estimatedTimeline?.includes('February 28') ? '2026-02-28' : null,
    notes: `Archive: ${proposal.archivePath}\n\nInternal Notes: ${proposal.internalNotes || ''}\n\nTimeline: ${proposal.estimatedTimeline || ''}`,
    external_links: [
      { type: 'archive', path: proposal.archivePath, label: 'Project inputs & documents' },
      { type: 'proposal', id: proposal.id, label: 'Original proposal' }
    ],
    tags: [proposal.projectType]
  }

  // Check if project already exists
  const existing = await db.getProject(projectId)
  if (existing) {
    console.log(`\n⚠️  Project already exists, deleting old chunks...`)
    await db.sql`DELETE FROM chunks WHERE project_id = ${projectId}`
    await db.sql`DELETE FROM projects WHERE id = ${projectId}`
  }

  // Create project
  await db.createProject(project)
  console.log(`\n✅ Created project: ${projectId}`)

  // Generate chunks for each phase
  console.log(`\nChunking phases:`)
  let totalChunks = 0
  let totalChunkHours = 0

  for (const phase of proposal.phases) {
    const chunks = chunkPhase(phase, projectContext)
    console.log(`\n  📁 ${phase.name} (${phase.lowHrs}-${phase.highHrs}h) → ${chunks.length} chunks`)

    for (const chunk of chunks) {
      const chunkId = db.generateId('chk')
      await db.createChunk({
        id: chunkId,
        project_id: projectId,
        phase_name: chunk.phase_name,
        name: chunk.name,
        description: chunk.description,
        hours: chunk.hours,
        status: 'pending'
      })
      console.log(`     • ${chunk.name} (${chunk.hours}h)`)
      totalChunks++
      totalChunkHours += chunk.hours
    }
  }

  console.log(`\n📊 Summary: ${totalChunks} chunks totaling ${totalChunkHours} hours`)

  return { projectId, totalChunks, totalChunkHours }
}

async function main() {
  const proposals = [
    'data/proposals/2026-01-23-water-institute-rebrand.json',
    'data/proposals/2026-01-19-csu-brand-asset-generator.json'
  ]

  console.log('🚀 Converting proposals to projects with intelligent chunking\n')

  let grandTotalChunks = 0
  let grandTotalHours = 0
  const projects = []

  for (const proposalPath of proposals) {
    const result = await convertProposal(proposalPath)
    projects.push(result)
    grandTotalChunks += result.totalChunks
    grandTotalHours += result.totalChunkHours
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log('CONVERSION COMPLETE')
  console.log('='.repeat(60))
  console.log(`Projects created: ${projects.length}`)
  console.log(`Total chunks: ${grandTotalChunks}`)
  console.log(`Total hours: ${grandTotalHours}`)
  console.log(`\nRun 'node scripts/scheduler.js --generate' to create a draft schedule`)

  process.exit(0)
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
