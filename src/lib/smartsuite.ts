/**
 * SmartSuite Integration for EAV Orchestrator Prototype
 *
 * ⚠️ DEPRECATED: This file is INSECURE and should not be used.
 *
 * SECURITY ISSUE: Exposes API keys to browser and bypasses RLS policies.
 *
 * USE INSTEAD: src/lib/smartsuite-secure.ts
 *
 * Migration completed: 2025-09-25
 * All client code should use secureSmartSuite instead of smartSuite.
 */

export interface SmartSuiteConfig {
  workspaceId: string;
  prototypeTableId: string;
  apiKey?: string; // Will be loaded from environment
}

export interface ComponentData {
  componentId: string;
  componentNumber: number;
  content: string;
  status: 'draft' | 'review' | 'approved';
  lastUpdated: string;
}

export interface SyncStatus {
  isConnected: boolean;
  lastSync: string | null;
  pendingChanges: number;
  error: string | null;
}

export class SmartSuiteIntegration {
  private config: SmartSuiteConfig;

  constructor() {
    console.error(`
      🚨 SECURITY WARNING: smartsuite.ts is DEPRECATED and INSECURE

      This integration exposes API keys to the browser and bypasses RLS.

      MIGRATE TO: src/lib/smartsuite-secure.ts

      Benefits:
      • Server-side authentication only
      • No API keys in browser
      • RLS policies enforced
      • Distributed locking
    `);

    this.config = {
      workspaceId: 's3qnmox1',
      prototypeTableId: '68b2437a8f1755b055e0a124',
      apiKey: undefined // REMOVED: No longer exposing API keys to client
    };
  }

  /**
   * Test connection to SmartSuite workspace
   */
  async testConnection(): Promise<boolean> {
    try {
      // Placeholder for actual SmartSuite API call
      console.log('Testing SmartSuite connection...');
      console.log('Workspace:', this.config.workspaceId);
      console.log('Table:', this.config.prototypeTableId);

      // In prototype, simulate connection
      return new Promise((resolve) => {
        setTimeout(() => resolve(true), 1000);
      });
    } catch (error) {
      console.error('SmartSuite connection failed:', error);
      return false;
    }
  }

  /**
   * Sync components to SmartSuite prototype table
   */
  async syncComponents(components: ComponentData[]): Promise<SyncStatus> {
    try {
      console.log('Syncing components to SmartSuite...');
      console.log('Components to sync:', components.length);

      // In prototype, simulate sync operation
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            isConnected: true,
            lastSync: new Date().toISOString(),
            pendingChanges: 0,
            error: null
          });
        }, 2000);
      });
    } catch (error) {
      return {
        isConnected: false,
        lastSync: null,
        pendingChanges: components.length,
        error: error instanceof Error ? error.message : 'Unknown sync error'
      };
    }
  }

  /**
   * Get sync status without performing sync
   */
  async getSyncStatus(): Promise<SyncStatus> {
    // In prototype, return mock status
    return {
      isConnected: true,
      lastSync: null,
      pendingChanges: 3, // Mock pending changes
      error: null
    };
  }

  /**
   * Extract components from TipTap editor content
   * This is a prototype implementation - production will use server-side extraction
   */
  extractComponentsFromContent(content: string): ComponentData[] {
    const components: ComponentData[] = [];

    // Simple extraction based on H2 headers (Component C1, C2, etc.)
    const componentRegex = /<h2>Component C(\d+)<\/h2>\s*<p>(.*?)<\/p>/g;
    let match;

    while ((match = componentRegex.exec(content)) !== null) {
      const componentNumber = parseInt(match[1], 10);
      const componentContent = match[2];

      components.push({
        componentId: `C${componentNumber}`,
        componentNumber,
        content: componentContent,
        status: 'draft',
        lastUpdated: new Date().toISOString()
      });
    }

    return components;
  }
}

// Export singleton instance for prototype
export const smartSuite = new SmartSuiteIntegration();