// 제출용 PDF 빌드 — 3개 md를 스크린샷 임베드해 1개 PDF로 병합
// 사용: node scripts/build-submission-pdf.mjs
// 전제: docs/screenshots/*.png 존재(없으면 먼저 `node scripts/capture-demo.mjs`),
//       make-pdf 바이너리(~/.claude/skills/gstack/make-pdf/dist/pdf)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SUB = join(ROOT, 'docs', 'submission')
const SHOTS = join(ROOT, 'docs', 'screenshots')
const RESIZED = join(SHOTS, '.resized')
const FILES = ['1-구현결과보고서.md', '2-팀기여도보고서.md', '3-시연시나리오.md']
const PAGE_BREAK = '\n\n<div style="page-break-after: always;"></div>\n\n'
const IMG_WIDTH = 1200 // 인쇄 페이지 폭에 맞춘 다운스케일

// 1) 스크린샷 다운스케일(sips, macOS)
mkdirSync(RESIZED, { recursive: true })
const used = new Set()
for (const f of FILES) {
  const md = readFileSync(join(SUB, f), 'utf8')
  for (const m of md.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) used.add(m[1].split('/').pop())
}
for (const name of used) {
  const src = join(SHOTS, name)
  const dst = join(RESIZED, name)
  copyFileSync(src, dst)
  execFileSync('sips', ['--resampleWidth', String(IMG_WIDTH), dst], { stdio: 'ignore' })
}

// 2) 3개 md 병합 + 이미지 base64 인라인(make-pdf는 http origin이라 file:// 로컬 이미지 차단)
const parts = FILES.map((f) => {
  let md = readFileSync(join(SUB, f), 'utf8')
  return md.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, p) => {
    const name = p.split('/').pop()
    const b64 = readFileSync(join(RESIZED, name)).toString('base64')
    return `<img alt="${alt}" style="width:100%;height:auto;border:1px solid #ddd" src="data:image/png;base64,${b64}"/>`
  })
})
const combined = join(SUB, '합본.md')
writeFileSync(combined, parts.join(PAGE_BREAK))

// 3) make-pdf 실행
const PDF_BIN = join(homedir(), '.claude/skills/gstack/make-pdf/dist/pdf')
const out = join(SUB, 'TaskFlow_최종제출.pdf')
execFileSync(
  PDF_BIN,
  ['generate', '--cover', '--toc', '--no-confidential',
   '--title', 'TaskFlow 최종 제출', '--author', '김상현 · 김정환',
   combined, out],
  { stdio: 'inherit' },
)
console.log('\n생성 완료:', out)
