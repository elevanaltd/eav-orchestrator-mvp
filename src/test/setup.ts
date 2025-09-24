// Extend vitest expect with jest-dom matchers - expect is auto-extended
// but we import it to have access to the type in global scope
import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'

// Run cleanup after each test case (e.g. clearing jsdom)
// Make expect available globally
(globalThis as any).expect = expect
afterEach(() => {
  cleanup()
})