/**
 * Integration Tests for SmartSuite Sync Edge Function
 *
 * CRITICAL: These tests run against actual Deno runtime via `supabase functions serve`
 * NO MOCKING - We test the real function with real HTTP requests
 *
 * Prerequisites:
 * 1. Run `supabase functions serve` in separate terminal
 * 2. Ensure .env.local has required environment variables
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts"

const FUNCTION_URL = "http://localhost:54321/functions/v1/smartsuite-sync"
const TEST_AUTH_TOKEN = Deno.env.get("SUPABASE_ANON_KEY") || "test-token"

/**
 * TEST 1: Walking Skeleton - Function responds to basic health check
 * This test MUST PASS before any business logic is implemented
 */
Deno.test("Edge Function - Walking Skeleton Health Check", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${TEST_AUTH_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ action: "health-check" })
  })

  // Function should respond without crashing
  assertEquals(response.status, 200)

  const data = await response.json()
  assertEquals(data.status, "ok")

  // Environment validation
  assertEquals(typeof data.env_available, "boolean")
  assertEquals(typeof data.auth_provided, "boolean")
})

/**
 * TEST 2: CORS Headers - Function handles preflight OPTIONS requests
 */
Deno.test("Edge Function - CORS Preflight Request", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "OPTIONS",
    headers: {
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,content-type"
    }
  })

  assertEquals(response.status, 200)

  const corsOrigin = response.headers.get("Access-Control-Allow-Origin")
  const corsHeaders = response.headers.get("Access-Control-Allow-Headers")

  assertExists(corsOrigin)
  assertExists(corsHeaders)
})

/**
 * TEST 3: Authentication - Function rejects requests without auth
 */
Deno.test("Edge Function - Rejects Unauthenticated Requests", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ action: "sync-projects" })
  })

  assertEquals(response.status, 401)
})

/**
 * TEST 4: SmartSuite API Integration - Fetch projects from production workspace
 * This test validates the actual SmartSuite API integration
 */
Deno.test("Edge Function - SmartSuite Projects Fetch", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${TEST_AUTH_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "fetch-projects",
      workspace_id: "s3qnmox1"
    })
  })

  assertEquals(response.status, 200)

  const data = await response.json()
  assertEquals(data.success, true)
  assertExists(data.projects)
  assertEquals(Array.isArray(data.projects), true)
})

/**
 * TEST 5: Error Handling - Function handles SmartSuite API errors gracefully
 */
Deno.test("Edge Function - Handles Invalid Workspace ID", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${TEST_AUTH_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "fetch-projects",
      workspace_id: "invalid-workspace-id"
    })
  })

  // Should not crash, should return structured error
  assertEquals(response.status, 400)

  const data = await response.json()
  assertEquals(data.success, false)
  assertExists(data.error)
})

/**
 * TEST 6: Input Validation - Function validates request schema
 */
Deno.test("Edge Function - Validates Request Schema", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${TEST_AUTH_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      invalid: "payload"
    })
  })

  assertEquals(response.status, 400)

  const data = await response.json()
  assertEquals(data.success, false)
  assertExists(data.error)
  assertEquals(data.error_type, "validation_error")
})