import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import type { SmartSuiteProjectRecord, SmartSuiteVideoRecord, SmartSuiteWebhookPayload } from '../src/types/smartsuite.types';

/**
 * SmartSuite Webhook Handler
 *
 * Receives real-time updates from SmartSuite automations
 * Syncs changes directly to Supabase
 *
 * ARCHITECTURE: Event-driven sync pattern
 * Zero technical debt - production-first implementation
 */

// Initialize Supabase with service role for backend operations
// Using the new Supabase key naming: publishable (client) / secret (server)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY! // Server-side secret key (successor to service_role)
);

// Table IDs from environment - Server-only variables (no VITE_ prefix)
const PROJECTS_TABLE_ID = process.env.SMARTSUITE_PROJECTS_TABLE;
const VIDEOS_TABLE_ID = process.env.SMARTSUITE_VIDEOS_TABLE;

/**
 * Verify webhook signature for security
 * Uses timing-safe comparison to prevent timing attacks
 */
function verifyWebhookSignature(
  payload: string,
  signature: string | undefined
): boolean {
  const webhookSecret = process.env.SMARTSUITE_WEBHOOK_SECRET;

  // In production, always require webhook secret
  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('CRITICAL: No webhook secret configured in production');
      return false;
    }
    console.warn('No webhook secret configured - skipping signature verification (dev only)');
    return true;
  }

  if (!signature) {
    console.error('No signature provided in webhook request');
    return false;
  }

  // Calculate expected signature
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');

  // Timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Transform SmartSuite project record to Supabase schema
 * DYNAMIC MAPPING: Automatically maps any fields with matching names
 */
function transformProject(record: any) {
  // If fields already match Supabase schema (from webhook), pass ALL fields through
  if (record.eav_code !== undefined) {
    // Start with all fields from the webhook (they already match Supabase)
    const transformed = { ...record };

    // Ensure required fields have defaults
    transformed.title = transformed.title || 'Untitled';
    transformed.created_at = transformed.created_at || new Date().toISOString();
    transformed.updated_at = transformed.updated_at || new Date().toISOString();

    return transformed;
  }

  // Legacy format support (if using full record dump from API)
  return {
    id: record.id,
    title: record.title || record.name || 'Untitled',
    eav_code: record.eavcode || '',
    client_filter: record.slabels_c8bebae3c5 || null,
    due_date: record.projdue456?.to_date?.date || null,
    created_at: record.first_created?.on || new Date().toISOString(),
    updated_at: record.last_updated?.on || new Date().toISOString()
  };
}

/**
 * Transform SmartSuite video record to Supabase schema
 * DYNAMIC MAPPING: Automatically maps any fields with matching names
 */
function transformVideo(record: any) {
  // If fields already match Supabase schema (from webhook field selection)
  if (record.project_id !== undefined || record.projects_link !== undefined) {
    // Start with all fields from the webhook (they already match Supabase)
    const transformed = { ...record };

    // Handle project link field name variations
    if (record.projects_link && !record.project_id) {
      transformed.project_id = record.projects_link;
      delete transformed.projects_link;
    }

    // Ensure required fields have defaults
    transformed.title = transformed.title || 'Untitled';
    transformed.created_at = transformed.created_at || new Date().toISOString();
    transformed.updated_at = transformed.updated_at || new Date().toISOString();

    return transformed;
  }

  // Legacy format support (if using full record dump from API)
  return {
    id: record.id,
    project_id: record.project_id || record.s75e825d24 || null,
    title: record.title || record.name || 'Untitled',
    production_type: record.production_type || null,
    main_stream_status: record.main_stream_status || null,
    vo_stream_status: record.vo_stream_status || null,
    created_at: record.first_created?.on || new Date().toISOString(),
    updated_at: record.last_updated?.on || new Date().toISOString()
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Log the incoming method for debugging
  console.log(`Webhook called with method: ${req.method}`);

  // Only accept POST requests
  if (req.method !== 'POST') {
    console.error(`Method ${req.method} not allowed - expected POST`);
    return res.status(405).json({ error: `Method ${req.method} not allowed - webhook expects POST` });
  }

  // Verify webhook signature (optional for testing)
  const signature = req.headers['x-smartsuite-signature'] as string;
  const payload = JSON.stringify(req.body);

  // Only verify signature if both secret and signature are provided
  if (process.env.SMARTSUITE_WEBHOOK_SECRET && signature) {
    if (!verifyWebhookSignature(payload, signature)) {
      console.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
  } else if (process.env.SMARTSUITE_WEBHOOK_SECRET && !signature) {
    console.warn('⚠️ Webhook secret configured but no signature provided - allowing for testing');
  } else if (!process.env.SMARTSUITE_WEBHOOK_SECRET) {
    console.warn('⚠️ No webhook secret configured - skipping signature verification');
  }

  // Parse webhook payload - handle multiple formats
  let event_type: string;
  let table_id: string;
  let record: any;
  let webhook_id: string | undefined;

  // Check payload format
  if (req.body.table && req.body.record) {
    // NEW FORMAT: Explicit table routing - most reliable!
    record = req.body.record;
    table_id = req.body.table; // SmartSuite tells us which table
    event_type = req.body.event_type || 'record.updated';
    webhook_id = req.body.webhook_id || 'smartsuite-automation';

    console.log(`Webhook using explicit table routing: ${req.body.table}`);
  } else if (req.body.record && req.body.event_type) {
    // Full format with event_type and record wrapper
    ({ event_type, table_id, record, webhook_id } = req.body as SmartSuiteWebhookPayload);
  } else if (req.body.record && !req.body.event_type) {
    // Simple format - just {record: {...}}
    record = req.body.record;
    event_type = 'record.updated';
    webhook_id = 'smartsuite-automation';

    // Determine table by checking for unique fields
    if (record.projects_link !== undefined || record.project_id !== undefined) {
      // Has project link = it's a VIDEO
      table_id = process.env.SMARTSUITE_VIDEOS_TABLE!;
    } else if (record.eavcode !== undefined || record.eav_code !== undefined || record.client_filter !== undefined) {
      // Has EAV code or client filter = it's a PROJECT
      table_id = process.env.SMARTSUITE_PROJECTS_TABLE!;
    } else {
      console.error('Cannot determine table type from record fields');
      return res.status(400).json({ error: 'Cannot determine table type' });
    }
  } else if (req.body.id && (req.body.eavcode !== undefined || req.body.eav_code !== undefined || req.body.projects_link !== undefined || req.body.project_id !== undefined)) {
    // Direct format - SmartSuite sends fields at root level
    record = req.body;  // The entire body IS the record
    event_type = 'record.updated';
    webhook_id = 'smartsuite-automation';

    // Determine table by checking for unique fields (check videos first since they have project links)
    if (record.projects_link !== undefined || record.project_id !== undefined) {
      // Has project link = it's a VIDEO
      table_id = process.env.SMARTSUITE_VIDEOS_TABLE!;
    } else if (record.eavcode !== undefined || record.eav_code !== undefined || record.client_filter !== undefined) {
      // Has EAV code or client filter = it's a PROJECT
      table_id = process.env.SMARTSUITE_PROJECTS_TABLE!;
    } else {
      console.error('Cannot determine table type from record fields');
      return res.status(400).json({ error: 'Cannot determine table type' });
    }
  } else {
    console.error('Unrecognized webhook payload format:', JSON.stringify(req.body));
    return res.status(400).json({ error: 'Invalid webhook payload format' });
  }

  console.log(`Webhook received: ${event_type} for table ${table_id}`);

  try {
    // Update sync metadata to show sync in progress
    await supabase
      .from('sync_metadata')
      .upsert({
        id: 'singleton',
        status: 'running',
        last_sync_started_at: new Date().toISOString()
      });

    let result;

    // Map table names to Supabase tables
    const getSupabaseTable = (tableId: string): string => {
      // Handle both SmartSuite table IDs and friendly names
      if (tableId === PROJECTS_TABLE_ID || tableId === 'projects' || tableId === 'Projects') {
        return 'projects';
      } else if (tableId === VIDEOS_TABLE_ID || tableId === 'videos' || tableId === 'Videos') {
        return 'videos';
      }
      // Future tables can be added here
      console.warn(`Unknown table: ${tableId}, attempting to use as-is`);
      return tableId.toLowerCase(); // Try using the name directly
    };

    const supabaseTable = getSupabaseTable(table_id);

    // Route based on table
    if (supabaseTable === 'projects') {
      // Handle project changes
      const project = transformProject(record);

      if (event_type === 'record.deleted') {
        // Delete project
        result = await supabase
          .from('projects')
          .delete()
          .eq('id', project.id);
      } else {
        // Create or update project
        result = await supabase
          .from('projects')
          .upsert(project, {
            onConflict: 'id',
            ignoreDuplicates: false
          });
      }

      console.log(`Project ${project.id} processed: ${event_type}`);

    } else if (supabaseTable === 'videos') {
      // Handle video changes
      const video = transformVideo(record);

      if (event_type === 'record.deleted') {
        // Delete video
        result = await supabase
          .from('videos')
          .delete()
          .eq('id', video.id);
      } else {
        // Create or update video
        result = await supabase
          .from('videos')
          .upsert(video, {
            onConflict: 'id',
            ignoreDuplicates: false
          });
      }

      console.log(`Video ${video.id} processed: ${event_type}`);

    } else {
      // Try dynamic table handling for future tables
      console.log(`Attempting dynamic handling for table: ${supabaseTable}`);

      // Just pass the record through with minimal transformation
      const transformedRecord = {
        ...record,
        created_at: record.created_at || new Date().toISOString(),
        updated_at: record.updated_at || new Date().toISOString()
      };

      if (event_type === 'record.deleted') {
        result = await supabase
          .from(supabaseTable)
          .delete()
          .eq('id', transformedRecord.id);
      } else {
        result = await supabase
          .from(supabaseTable)
          .upsert(transformedRecord, {
            onConflict: 'id',
            ignoreDuplicates: false
          });
      }

      console.log(`Record ${transformedRecord.id} processed in table ${supabaseTable}: ${event_type}`);
    }

    // Check for errors
    if (result.error) {
      throw result.error;
    }

    // Update sync metadata to show success
    // First get current sync_count to increment it
    const { data: currentMeta } = await supabase
      .from('sync_metadata')
      .select('sync_count')
      .eq('id', 'singleton')
      .single();

    await supabase
      .from('sync_metadata')
      .upsert({
        id: 'singleton',
        status: 'idle',
        last_sync_completed_at: new Date().toISOString(),
        sync_count: (currentMeta?.sync_count || 0) + 1
      });

    // Return success response
    return res.status(200).json({
      success: true,
      event_type,
      table_id,
      record_id: record.id,
      webhook_id
    });

  } catch (error) {
    console.error('Webhook processing error:', error);

    // Update sync metadata to show error
    await supabase
      .from('sync_metadata')
      .upsert({
        id: 'singleton',
        status: 'error',
        last_error: error instanceof Error ? error.message : 'Unknown error'
      });

    // Return error response
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Processing failed'
    });
  }
}