const { test, expect } = require('@playwright/test');

const password = process.env.E2E_PASSWORD || 'DemoPass123!';
const emails = { seeker: 'seeker@hirelane.demo', employer: 'employer@hirelane.demo' };
const description = 'Build accessible, reliable web applications with React, TypeScript, and Node.js. Collaborate with our product team, review code thoughtfully, and own the quality of the features you ship.';

async function signIn(page, role) {
  await page.goto(`/auth/${role}/login`);
  await page.getByLabel('Email address').fill(emails[role]);
  await page.getByLabel('Password', { exact: true }).fill(password);
  const response = page.waitForResponse((res) => res.url().endsWith('/api/auth/login') && res.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  expect((await response).status(), 'Demo login must succeed against the real server').toBe(200);
  await expect(page).toHaveURL(role === 'employer' ? /\/employer$/ : /\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

async function expectNoPageOverflow(page) {
  await expect.poll(() => page.evaluate(() => ({
    width: window.innerWidth,
    overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
  }))).toEqual(expect.objectContaining({ overflow: expect.any(Number) }));
  const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
  expect(overflow, 'Horizontal scrolling must be contained within components, not the page').toBeLessThanOrEqual(1);
}

function jobCard(page, title) {
  return page.locator('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
}

async function screenshot(page, testInfo, name) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

test('guests search real jobs, read details, and reach the correct sign-in flow', async ({ page, isMobile }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Find your next great opportunity.' })).toBeVisible();
  await expect(page.locator('article.job-card').first()).toBeVisible();
  await expectNoPageOverflow(page);
  await screenshot(page, testInfo, 'job-search');

  if (isMobile) {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: /Find jobs/ }).click();
    await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
  }

  await page.getByRole('textbox', { name: 'Job title, company, or skill' }).fill('Senior Frontend');
  await expect(page).toHaveURL(/q=Senior\+Frontend|q=Senior%20Frontend/);
  await expect(page.getByRole('link', { name: 'Senior Frontend Engineer', exact: true })).toBeVisible();
  await expect(page.locator('article.job-card')).toHaveCount(1);
  await page.getByRole('link', { name: 'Senior Frontend Engineer', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Senior Frontend Engineer', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'About this opportunity' })).toBeVisible();
  await expectNoPageOverflow(page);
  await page.getByRole('link', { name: 'Sign in to apply' }).click();
  await expect(page).toHaveURL(/\/auth\/seeker\/login$/);
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expectNoPageOverflow(page);
  const protectedResponse = await page.request.get('/api/employer/jobs');
  expect(protectedResponse.status()).toBe(401);
});

test('seekers save profile changes, keep private sessions, and track submitted applications', async ({ page, context }, testInfo) => {
  await signIn(page, 'seeker');
  const session = (await context.cookies()).find((cookie) => cookie.httpOnly);
  expect(session, 'Authentication should use an HTTP-only session cookie').toBeTruthy();
  expect(await page.evaluate(() => document.cookie)).not.toContain(`${session.name}=`);
  expect((await page.request.get('/api/employer/jobs')).status()).toBe(403);
  await page.goto('/employer');
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/seeker/profile');
  const headline = page.getByLabel('Professional headline');
  await expect(headline).toBeVisible();
  const original = await headline.inputValue();
  const updated = `Accessible product engineer · ${testInfo.project.name}`;
  try {
    await headline.fill(updated);
    const saved = page.waitForResponse((res) => res.url().endsWith('/api/profile') && res.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Save profile', exact: true }).first().click();
    expect((await saved).status()).toBe(200);
    await expect(page.getByText('Your profile is up to date.', { exact: true })).toBeVisible();
    await page.reload();
    await expect(headline).toHaveValue(updated);
    await expectNoPageOverflow(page);
    await screenshot(page, testInfo, 'seeker-profile');
  } finally {
    if (!page.isClosed()) {
      await headline.fill(original);
      const restored = page.waitForResponse((res) => res.url().endsWith('/api/profile') && res.request().method() === 'PUT');
      await page.getByRole('button', { name: 'Save profile', exact: true }).first().click();
      expect((await restored).status()).toBe(200);
    }
  }

  await page.goto('/seeker/applications');
  await expect(page.getByRole('heading', { name: 'Your next chapter, in progress.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Senior Frontend Engineer', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Product Designer', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Full Stack Developer', exact: true })).toBeVisible();
  await page.getByRole('group', { name: 'Filter applications' }).getByRole('button', { name: 'Shortlisted', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Product Designer', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Full Stack Developer', exact: true })).toHaveCount(0);
  await expectNoPageOverflow(page);
});

test('employers create, pause, edit, reopen, and archive a real job', async ({ page }, testInfo) => {
  await signIn(page, 'employer');
  expect((await page.request.get('/api/profile')).status()).toBe(403);
  await page.goto('/employer/jobs');
  await expect(page.getByRole('heading', { level: 1, name: 'Job openings' })).toBeVisible();
  await page.getByRole('button', { name: 'Post a job', exact: true }).click();
  const title = `E2E Quality Engineer ${testInfo.project.name} ${Date.now()}`;
  const editedTitle = `${title} II`;
  let createdId;
  try {
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Create a job opening' })).toBeVisible();
    await dialog.getByLabel('Job title', { exact: true }).fill(title);
    await dialog.getByLabel('Location', { exact: true }).fill('Bengaluru, India');
    await dialog.getByLabel('Required skills').fill('React, TypeScript, Node.js');
    await dialog.getByLabel('Job description').fill(description);
    await dialog.getByLabel('Currency').selectOption('USD');
    await dialog.getByLabel('Annual salary from').fill('80000');
    await dialog.getByLabel('Annual salary to').fill('110000');
    const created = page.waitForResponse((res) => res.url().endsWith('/api/jobs') && res.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Publish job', exact: true }).click();
    const createdResponse = await created;
    expect(createdResponse.status()).toBe(201);
    const body = await createdResponse.json();
    createdId = (body.data || body)._id;
    await expect(dialog).not.toBeVisible();
    await expect(jobCard(page, title).getByText('active', { exact: true })).toBeVisible();

    await jobCard(page, title).getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(jobCard(page, title).getByText('paused', { exact: true })).toBeVisible();
    await jobCard(page, title).getByRole('button', { name: 'Edit', exact: true }).click();
    await dialog.getByLabel('Job title', { exact: true }).fill(editedTitle);
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(jobCard(page, editedTitle)).toBeVisible();
    await jobCard(page, editedTitle).getByRole('button', { name: 'Reopen', exact: true }).click();
    await expect(jobCard(page, editedTitle).getByText('active', { exact: true })).toBeVisible();
    await jobCard(page, editedTitle).getByRole('button', { name: `Archive ${editedTitle}`, exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Archive this opening?' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Archive job', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(jobCard(page, editedTitle).getByText('archived', { exact: true })).toBeVisible();
    await page.reload();
    await expect(jobCard(page, editedTitle).getByText('archived', { exact: true })).toBeVisible();
    await expectNoPageOverflow(page);
    await screenshot(page, testInfo, 'employer-jobs');
  } finally {
    if (createdId && !page.isClosed()) {
      // Only archive the listing created by this test. Existing jobs are untouched.
      await page.request.delete(`/api/jobs/${createdId}`, { headers: { Origin: new URL(page.url()).origin } });
    }
  }
});

test('ATS status changes persist and appear in the seeker application tracker', async ({ page, browser, baseURL }, testInfo) => {
  await signIn(page, 'employer');
  await page.goto('/employer/applicants');
  await expect(page.getByRole('heading', { name: 'Applicant pipeline', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Filter by job' }).locator('option', { hasText: 'Senior Frontend Engineer' })).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Filter by job' }).selectOption({ label: 'Senior Frontend Engineer' });
  const applicantStatus = page.getByRole('combobox', { name: 'Application status for Alex Morgan', exact: true });
  await expect(applicantStatus).toHaveCount(1);
  const originalStatus = await applicantStatus.inputValue();
  const nextStatus = originalStatus === 'Interviewing' ? 'Shortlisted' : 'Interviewing';
  let seekerContext;
  try {
    const statusResponse = page.waitForResponse((res) => /\/api\/applications\/[^/]+\/status$/.test(res.url()) && res.request().method() === 'PATCH');
    await applicantStatus.selectOption(nextStatus);
    expect((await statusResponse).status()).toBe(200);
    await expect(applicantStatus).toHaveValue(nextStatus);
    await page.getByRole('button', { name: 'View profile', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Alex Morgan', exact: true })).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('link', { name: emails.seeker })).toBeVisible();
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await expectNoPageOverflow(page);
    await screenshot(page, testInfo, 'employer-pipeline');

    seekerContext = await browser.newContext({ baseURL, viewport: page.viewportSize() });
    const seekerPage = await seekerContext.newPage();
    await signIn(seekerPage, 'seeker');
    await seekerPage.goto('/seeker/applications');
    const tracked = seekerPage.locator('article').filter({ has: seekerPage.getByRole('link', { name: 'Senior Frontend Engineer', exact: true }) });
    await expect(tracked.locator('.badge')).toHaveText(nextStatus);
    await expectNoPageOverflow(seekerPage);
  } finally {
    await seekerContext?.close();
    await page.bringToFront();
    if (!page.isClosed()) {
      await page.reload();
      await expect(applicantStatus).toBeVisible();
      if (await applicantStatus.inputValue() !== originalStatus) {
        const restored = page.waitForResponse((res) => /\/api\/applications\/[^/]+\/status$/.test(res.url()) && res.request().method() === 'PATCH');
        await applicantStatus.selectOption(originalStatus);
        expect((await restored).status()).toBe(200);
      }
    }
  }
});
