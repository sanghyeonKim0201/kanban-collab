// 시연 백업용 스크린샷 캡처 — 시스템 Chrome 사용(chromium 다운로드 없음)
// 사용: node scripts/capture-demo.mjs
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const OUT = join(ROOT, 'docs', 'screenshots')
mkdirSync(OUT, { recursive: true })

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const EMAIL = 'admin@admin.com'
const PASSWORD = 'admin'
const WS_ID = '2f2a85c8-0a10-41b9-94e0-f2c096cfa4d3'
const BOARD_ID = '3c46b594-9667-4a6c-b4b9-d38e481dee15'
const CARD_ID = 'f261e727-541d-480e-88e5-f1f3af3cba3a' // 로그인 토큰 만료 버그 수정 (AI분류·GitHub)
const MEETING_ID = '50cab769-2659-4e89-a0d9-aa4e85f21d19' // 실시간 회의 데모 (화자 구분)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const shot = async (page, name, opts = {}) => {
  await page.screenshot({ path: join(OUT, name), ...opts })
  console.log('  saved', name)
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
})
const page = await ctx.newPage()

try {
  // 1. 로그인 화면
  console.log('1. 로그인')
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await shot(page, '01-login.png')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/workspaces', { timeout: 15000 }).catch(() => {})
  await sleep(1500)

  // 2. 보드 3컬럼 (필터·라벨·PR자동화·활동로그 🤖 PR머지 포함)
  console.log('2. 보드')
  await page.goto(`${BASE}/board/${BOARD_ID}`, { waitUntil: 'networkidle' })
  await sleep(2500)
  await shot(page, '02-board.png')

  // 3. AI 추천 (카드 상세 인터셉트 라우트 → AI 추천 받기 → LLM 응답)
  console.log('3. AI 추천')
  await page.goto(`${BASE}/board/${BOARD_ID}/card/${CARD_ID}`, { waitUntil: 'networkidle' })
  await page.getByText('AI 분류').first().waitFor({ timeout: 10000 })
  await sleep(800)
  await page.getByRole('button', { name: 'AI 추천 받기' }).click()
  await sleep(7000) // LLM 응답 대기
  await shot(page, '03-ai-recommend.png')

  // (실시간 커서/접속자는 self-userId 필터로 같은 계정 두 창에서 캡처 불가 →
  //  라이브/영상 시연 항목. 정적 스크린샷 생략.)

  // 4. 회의록 목록
  console.log('4. 회의록 목록')
  await page.goto(`${BASE}/meetings`, { waitUntil: 'networkidle' })
  await sleep(1500)
  await shot(page, '04-meetings-list.png')

  // 5. 회의록 상세 — AI 요약·참석자·안건
  console.log('5. 회의록 상세 (AI 요약)')
  await page.goto(`${BASE}/meetings/${MEETING_ID}`, { waitUntil: 'networkidle' })
  await sleep(1800)
  await shot(page, '05-meeting-summary.png', { fullPage: true })

  // 6. 회의록 → 추출된 작업(태스크) 탭
  console.log('6. 추출된 작업')
  const taskTab = page.getByRole('tab', { name: /추출된 작업/ }).first()
  if (await taskTab.count()) {
    await taskTab.click().catch(() => {})
    await sleep(1000)
    await shot(page, '06-meeting-tasks.png', { fullPage: true })
  }

  // 7. 멤버 관리
  console.log('7. 멤버 관리')
  await page.goto(`${BASE}/workspaces/${WS_ID}`, { waitUntil: 'networkidle' })
  await sleep(1500)
  await shot(page, '07-members.png')

  console.log('완료. 저장 위치:', OUT)
} catch (e) {
  console.error('ERROR:', e.message)
  await shot(page, 'error.png').catch(() => {})
} finally {
  await browser.close()
}
