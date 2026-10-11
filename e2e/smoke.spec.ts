import { expect, test } from '@playwright/test'

const watch = (page: import('@playwright/test').Page) => {
  const external: string[] = []
  const errors: string[] = []
  page.on('request', (r) => { if (!r.url().startsWith('http://localhost:5173') && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) external.push(r.url()) })
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  return { external, errors }
}

test('HAR: load, filter, every view, privacy', async ({ page }) => {
  const { external, errors } = watch(page)
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles('fixtures/sample.har')
  await expect(page.getByText('40 / 40 sessions')).toBeVisible()
  await page.screenshot({ path: '/tmp/shots/sessions-dark.png' })

  await page.getByLabel('QuickExec').fill('~c 4xx')
  await page.getByLabel('QuickExec').press('Enter')
  await expect(page.getByText('40 / 40 sessions')).toHaveCount(0)
  await page.getByLabel('QuickExec').fill('~c (')
  await page.getByLabel('QuickExec').press('Enter')
  await expect(page.locator('.hint.err')).toBeVisible()

  await page.locator('[role=row][aria-selected]').first().click()
  for (const v of ['Timeline', 'Findings', 'Stats', 'Find', 'Compare', 'Tools', 'Saved', 'Rules']) {
    await page.getByRole('button', { name: new RegExp(`^${v}( \\d+ serious.*)?$`) }).click()
    await page.waitForTimeout(400)
    await page.screenshot({ path: `/tmp/shots/${v}-dark.png` })
  }
  await page.getByRole('button', { name: /Switch to dark/ }).click()
  await page.getByRole('button', { name: 'Sessions', exact: true }).click()
  await page.screenshot({ path: '/tmp/shots/sessions-light.png' })
  await page.getByRole('button', { name: 'Timeline', exact: true }).click()
  await page.screenshot({ path: '/tmp/shots/timeline-light.png' })

  await page.getByRole('button', { name: 'Export…' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.screenshot({ path: '/tmp/shots/export-light.png' })

  expect(external).toEqual([])
  expect(errors).toEqual([])
})

test('SAZ: gzip + chunked body decodes', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles('fixtures/sample.saz')
  await expect(page.getByText('2 / 2 sessions')).toBeVisible()
  await page.locator('[role=row][aria-selected]').nth(1).click()
  await page.getByRole('tab', { name: 'Text' }).nth(1).click()
  await expect(page.getByText('{"name":"bob","roles":["a","b"]}')).toBeVisible()
})
