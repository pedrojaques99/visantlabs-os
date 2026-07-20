// Verificação da lógica pura de entitlements (server/lib/entitlements.ts)
// Roda o TS via tsx contra o arquivo real — sem DB, sem Stripe.
import assert from 'node:assert/strict'
import {
  toEntitlements,
  hasEntitlement,
  hasEntitlementForSession,
  withEntitlement,
} from '../server/lib/entitlements.ts'

let pass = 0
const t = (name, fn) => {
  fn()
  pass++
  console.log('  ok -', name)
}

console.log('\nentitlements:')

t('lista vazia/inválida vira []', () => {
  assert.deepEqual(toEntitlements(null), [])
  assert.deepEqual(toEntitlements(undefined), [])
  assert.deepEqual(toEntitlements('nope'), [])
  assert.deepEqual(toEntitlements([{ nope: 1 }]), [])
})

const list = [
  { sku: 'ebook-metodologia', kind: 'product', source: 'stripe', sessionId: 'cs_1', grantedAt: 'x' },
]

t('hasEntitlement acerta o sku (case-insensitive)', () => {
  assert.equal(hasEntitlement(list, 'ebook-metodologia'), true)
  assert.equal(hasEntitlement(list, 'EBOOK-METODOLOGIA'), true)
  assert.equal(hasEntitlement(list, 'outro-produto'), false)
  assert.equal(hasEntitlement(list, ''), false)
  assert.equal(hasEntitlement(null, 'ebook-metodologia'), false)
})

t('idempotência por sessionId', () => {
  assert.equal(hasEntitlementForSession(list, 'cs_1'), true)
  assert.equal(hasEntitlementForSession(list, 'cs_2'), false)
  assert.equal(hasEntitlementForSession(list, ''), false)
})

t('withEntitlement adiciona produto novo', () => {
  const next = withEntitlement(list, {
    sku: 'curso-x',
    kind: 'product',
    source: 'stripe',
    sessionId: 'cs_2',
  })
  assert.ok(next)
  assert.equal(next.length, 2)
  assert.equal(next[1].sku, 'curso-x')
  assert.ok(next[1].grantedAt, 'grantedAt preenchido')
  // não muta o original
  assert.equal(list.length, 1)
})

t('withEntitlement é idempotente (mesmo sku → null)', () => {
  const next = withEntitlement(list, {
    sku: 'ebook-metodologia',
    kind: 'product',
    source: 'stripe',
    sessionId: 'cs_OUTRO',
  })
  assert.equal(next, null, 'reprocessar webhook não duplica')
})

t('primeiro grant a partir de conta sem entitlements', () => {
  const next = withEntitlement(undefined, {
    sku: 'ebook-metodologia',
    kind: 'product',
    source: 'stripe',
    sessionId: 'cs_new',
  })
  assert.ok(next)
  assert.equal(next.length, 1)
})

console.log(`\n${pass} testes passaram\n`)
