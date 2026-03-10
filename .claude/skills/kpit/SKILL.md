# kpit Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill documents development patterns for kpit, a Next.js TypeScript application focused on AI-powered features and reporting functionality. The codebase follows conventional commit patterns and emphasizes modular AI service integration with a clean separation between API routes, components, and pages.

## Coding Conventions

### File Naming
- Use **camelCase** for all file names
- API routes: `route.ts`
- Components: `{feature}.tsx` or `{domain}-{feature}.tsx`
- Pages: `page.tsx`
- Types: `types.ts`

### Import Style
```typescript
// Use alias imports
import { Component } from '@/components/feature'
import { apiHelper } from '@/lib/ai'
import type { FeatureProps } from '@/lib/types'
```

### Export Style
```typescript
// Default exports preferred
export default function FeatureComponent() {
  return <div>Feature content</div>
}

// For utilities and types, use named exports
export const helper = () => {}
export type FeatureType = {}
```

### Commit Format
- Use conventional commits with prefixes: `feat`, `fix`, `refactor`, `docs`
- Keep messages around 59 characters
- Example: `feat: add AI narrative generation to reports`

## Workflows

### Add AI Feature Integration
**Trigger:** When someone wants to add AI functionality to a domain/feature  
**Command:** `/add-ai-feature`

1. **Create API route** in `src/app/api/{domain}/{feature}/route.ts`
   ```typescript
   import { NextRequest } from 'next/server'
   
   export async function POST(request: NextRequest) {
     // AI service integration logic
     return Response.json({ result })
   }
   ```

2. **Create client component** in `src/components/{domain}/{feature}.tsx`
   ```typescript
   'use client'
   
   export default function FeatureComponent({ data }: Props) {
     // Component logic with AI integration
     return <div>{/* AI-powered UI */}</div>
   }
   ```

3. **Integrate into page** in `src/app/{domain}/[id]/page.tsx`
   ```typescript
   import FeatureComponent from '@/components/{domain}/{feature}'
   
   export default function DomainPage({ params }) {
     return <FeatureComponent data={data} />
   }
   ```

4. **Update shared libraries** if needed for reusable AI functionality

### Refactor AI Service Abstraction
**Trigger:** When consolidating AI services or adding new AI providers  
**Command:** `/refactor-ai-service`

1. **Create AI service types** in `src/lib/ai/types.ts`
   ```typescript
   export interface AIProvider {
     generateText(prompt: string): Promise<string>
     analyze(data: any): Promise<Analysis>
   }
   ```

2. **Add provider implementation** in `src/lib/ai/{provider}-provider.ts`
   ```typescript
   import type { AIProvider } from './types'
   
   export class ProviderImplementation implements AIProvider {
     // Implementation details
   }
   ```

3. **Create shared utilities** in `src/lib/ai/{utility}.ts`
   ```typescript
   export const apiHelper = async (endpoint: string, data: any) => {
     // Shared API logic
   }
   ```

4. **Add factory exports** in `src/lib/ai/index.ts`
   ```typescript
   export * from './types'
   export * from './api-helpers'
   export { ProviderImplementation } from './provider'
   ```

5. **Refactor existing API routes** to use the new abstraction layer

### Enhance Report with AI Features
**Trigger:** When enhancing reports with AI insights and auto-generated content  
**Command:** `/enhance-report-ai`

1. **Create AI API route** in `src/app/api/report/{feature}/route.ts`
   ```typescript
   export async function POST(request: NextRequest) {
     const data = await request.json()
     // AI analysis/narrative generation
     return Response.json({ analysis, narrative })
   }
   ```

2. **Create report component** in `src/components/report/report-{feature}.tsx`
   ```typescript
   export default function ReportFeatureComponent({ reportData }: Props) {
     // AI-enhanced reporting UI
     return <section>{/* Report with AI insights */}</section>
   }
   ```

3. **Integrate into report page** in `src/app/report/{type}/page.tsx`
   ```typescript
   import ReportFeature from '@/components/report/report-{feature}'
   
   export default function ReportPage() {
     return (
       <div>
         <ReportFeature reportData={data} />
       </div>
     )
   }
   ```

4. **Update data fetching** and component props as needed

### Create Implementation Documentation
**Trigger:** When planning new features or major enhancements  
**Command:** `/create-feature-docs`

1. **Create design document** in `docs/plans/{date}-{feature}-design.md`
   ```markdown
   # Feature Design: {Feature Name}
   
   ## Overview
   ## Architecture
   ## UI/UX Considerations
   ## Technical Requirements
   ```

2. **Create implementation plan** in `docs/plans/{date}-{feature}.md`
   ```markdown
   # Implementation Plan: {Feature Name}
   
   ## Tasks
   ## Timeline
   ## Dependencies
   ## Testing Strategy
   ```

3. **Create roadmap document** for multiple related features when needed

## Testing Patterns

- Test files follow the pattern: `*.test.*`
- Testing framework: Currently unknown/not specified
- Place test files alongside source files or in dedicated test directories
- Focus on testing AI integrations and API endpoints

## Commands

| Command | Purpose |
|---------|---------|
| `/add-ai-feature` | Add new AI-powered feature with API, component, and page integration |
| `/refactor-ai-service` | Refactor AI implementations to use shared abstraction layer |
| `/enhance-report-ai` | Add AI analysis and narrative generation to reports |
| `/create-feature-docs` | Create design and implementation documentation for new features |