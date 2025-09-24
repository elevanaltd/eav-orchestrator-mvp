import { describe, it, expect } from 'vitest'
import type { Project, Video, Script, ScriptComponent } from './data'

describe('Data Type Contracts', () => {
  it('should define Project interface correctly', () => {
    const project: Project = {
      id: '68aa9add9bedb640d0a3bc0c',
      eavCode: 'EAV002',
      title: 'EAV002 - Berkeley Homes',
      dueDate: new Date('2024-12-31'),
      createdAt: new Date(),
      updatedAt: new Date(),
      videoCount: 5,
      status: 'active'
    }

    expect(project.id).toBeDefined()
    expect(project.eavCode).toBeDefined()
    expect(project.title).toBeDefined()
  })

  it('should define Video interface correctly', () => {
    const video: Video = {
      id: '68b24d4d50188d61ca5d564e',
      projectId: '68aa9add9bedb640d0a3bc0c',
      title: '0-Introduction',
      mainStreamStatus: 'draft',
      voStreamStatus: 'not_started',
      productionType: 'new',
      sequence: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    expect(video.projectId).toBeDefined()
    expect(video.title).toBeDefined()
  })

  it('should define Script interface correctly', () => {
    const script: Script = {
      id: 'uuid-here',
      videoId: '68b24d4d50188d61ca5d564e',
      yDocState: null,
      plainText: 'Script content here',
      componentCount: 3,
      lastEditedBy: 'user-uuid',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    expect(script.videoId).toBeDefined()
    expect(script.componentCount).toBeGreaterThanOrEqual(0)
  })

  it('should define ScriptComponent interface correctly', () => {
    const component: ScriptComponent = {
      id: 'uuid-here',
      scriptId: 'script-uuid',
      componentNumber: 1,
      content: 'This is component C1 content',
      wordCount: 5,
      createdAt: new Date()
    }

    expect(component.componentNumber).toBeGreaterThan(0)
    expect(component.content).toBeDefined()
  })

  it('should handle optional fields correctly', () => {
    const project: Project = {
      id: 'test-id',
      eavCode: 'TEST01',
      title: 'Test Project',
      dueDate: null, // Optional
      createdAt: new Date(),
      updatedAt: new Date(),
      videoCount: 0,
      status: 'draft'
    }

    expect(project.dueDate).toBeNull()
  })
})