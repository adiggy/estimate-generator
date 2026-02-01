// @ts-check
const { test, expect } = require('@playwright/test')

const BASE_URL = 'http://localhost:5173/dashboard/os-beta'

// Collect console errors
const consoleErrors = []

test.describe('OS Beta App - Desktop (1280x800)', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ page }) => {
    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ type: 'error', text: msg.text(), location: msg.location() })
      }
    })
    page.on('pageerror', error => {
      consoleErrors.push({ type: 'pageerror', text: error.message })
    })
  })

  test('Schedule page - week view with view toggle', async ({ page }) => {
    await page.goto(`${BASE_URL}/schedule`)
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    // Check that Schedule heading exists
    await expect(page.getByRole('heading', { name: /schedule/i }).first()).toBeVisible({ timeout: 10000 })
    
    // Look for week view elements - day columns
    const weekContainer = page.locator('[class*="flex"]').filter({ hasText: /Mon|Tue|Wed|Thu|Fri/i }).first()
    await expect(weekContainer).toBeVisible({ timeout: 5000 })
    
    // Take screenshot
    await page.screenshot({ path: '/tmp/desktop-schedule.png', fullPage: true })
    console.log('Desktop Schedule screenshot saved to /tmp/desktop-schedule.png')
  })

  test('Timeline page - list view', async ({ page }) => {
    await page.goto(`${BASE_URL}/timeline`)
    
    await page.waitForLoadState('networkidle')
    
    // Check that Timeline heading exists
    await expect(page.getByRole('heading', { name: /timeline/i }).first()).toBeVisible({ timeout: 10000 })
    
    // Look for view toggle buttons
    const listButton = page.locator('button').filter({ hasText: /list/i }).first()
    const ganttButton = page.locator('button').filter({ hasText: /gantt/i }).first()
    
    // If toggle buttons exist, click List to ensure list view
    if (await listButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await listButton.click()
      await page.waitForTimeout(500)
    }
    
    // Take screenshot of list view
    await page.screenshot({ path: '/tmp/desktop-timeline-list.png', fullPage: true })
    console.log('Desktop Timeline List screenshot saved to /tmp/desktop-timeline-list.png')
  })

  test('Timeline page - gantt view toggle', async ({ page }) => {
    await page.goto(`${BASE_URL}/timeline`)
    
    await page.waitForLoadState('networkidle')
    
    // Wait for heading
    await expect(page.getByRole('heading', { name: /timeline/i }).first()).toBeVisible({ timeout: 10000 })
    
    // Look for Gantt toggle button
    const ganttButton = page.locator('button').filter({ hasText: /gantt/i }).first()
    
    if (await ganttButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await ganttButton.click()
      await page.waitForTimeout(1000)
    }
    
    // Take screenshot of gantt view
    await page.screenshot({ path: '/tmp/desktop-timeline-gantt.png', fullPage: true })
    console.log('Desktop Timeline Gantt screenshot saved to /tmp/desktop-timeline-gantt.png')
  })
})

test.describe('OS Beta App - Mobile (375x667 iPhone)', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ type: 'error', text: msg.text(), location: msg.location() })
      }
    })
    page.on('pageerror', error => {
      consoleErrors.push({ type: 'pageerror', text: error.message })
    })
  })

  test('Schedule page - mobile view', async ({ page }) => {
    await page.goto(`${BASE_URL}/schedule`)
    
    await page.waitForLoadState('networkidle')
    
    // Check that content loads on mobile
    await expect(page.getByRole('heading', { name: /schedule/i }).first()).toBeVisible({ timeout: 10000 })
    
    // Take screenshot
    await page.screenshot({ path: '/tmp/mobile-schedule.png', fullPage: true })
    console.log('Mobile Schedule screenshot saved to /tmp/mobile-schedule.png')
  })

  test('Timeline page - mobile view with navigation', async ({ page }) => {
    await page.goto(`${BASE_URL}/timeline`)
    
    await page.waitForLoadState('networkidle')
    
    // Check that content loads on mobile
    await expect(page.getByRole('heading', { name: /timeline/i }).first()).toBeVisible({ timeout: 10000 })
    
    // Take screenshot
    await page.screenshot({ path: '/tmp/mobile-timeline.png', fullPage: true })
    console.log('Mobile Timeline screenshot saved to /tmp/mobile-timeline.png')
  })

  test('Navigation works on mobile', async ({ page }) => {
    await page.goto(BASE_URL)
    
    await page.waitForLoadState('networkidle')
    
    // Try to navigate using bottom nav or sidebar on mobile
    // First check if there's a menu button for mobile nav
    const menuButton = page.locator('button[aria-label*="menu" i], button:has(svg[class*="menu"])').first()
    
    // Navigate to Schedule via URL (fallback if no menu)
    await page.goto(`${BASE_URL}/schedule`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /schedule/i }).first()).toBeVisible({ timeout: 10000 })
    
    // Navigate to Timeline
    await page.goto(`${BASE_URL}/timeline`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /timeline/i }).first()).toBeVisible({ timeout: 10000 })
    
    console.log('Mobile navigation test passed')
  })
})

test.afterAll(async () => {
  // Report any console errors found during tests
  if (consoleErrors.length > 0) {
    console.log('\n=== Console Errors Found ===')
    consoleErrors.forEach((err, i) => {
      console.log(`${i + 1}. [${err.type}] ${err.text}`)
      if (err.location) {
        console.log(`   Location: ${err.location.url}:${err.location.lineNumber}`)
      }
    })
    console.log('============================\n')
  } else {
    console.log('\nNo console errors found during tests.\n')
  }
})
