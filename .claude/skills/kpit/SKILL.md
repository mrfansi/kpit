# kpit Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches development patterns for the **kpit** project, a Next.js application built with TypeScript that focuses on project management with AI integration, Gantt chart visualization, and report generation. The codebase emphasizes modular architecture with dedicated workflows for AI-powered features, database management, and specialized reporting components.

## Coding Conventions

### File Naming
- Use **camelCase** for all file names
- Component files: `componentName.tsx`
- API routes: `route.ts` in directory structure
- Test files: `*.test.*` pattern

### Import/Export Style
```typescript
// Use import aliases for cleaner paths
import { ComponentName } from '@/components/ui/component-name'
import { DatabaseSchema } from '@/lib/db/schema'

// Default exports for components and pages
export default function ComponentName() {
  return <div>Content</div>
}
```

### Commit Convention
- Use conventional commit prefixes: `feat:`, `fix:`, `refactor:`, `docs:`
- Keep commit messages around 60 characters
- Example: `feat: add gantt chart milestone rendering`

## Workflows

### AI API Route Creation
**Trigger:** When someone wants to add AI functionality to generate content  
**Command:** `/new-ai-endpoint`

1. Create new API route file in `src/app/api/[endpoint-name]/route.ts`
2. Add authentication check at route entry
3. Implement Gemini AI integration using existing patterns
4. Add comprehensive input sanitization and validation
5. Implement proper error handling with structured responses
6. Test the endpoint with various input scenarios

```typescript
// Example API route structure
import { auth } from '@/lib/auth'
import { geminiService } from '@/lib/ai/gemini'

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  
  // Input validation and AI integration
  const result = await geminiService.generateContent(validatedInput)
  return Response.json({ data: result })
}
```

### Feature Planning Workflow
**Trigger:** When someone wants to plan and document a new feature  
**Command:** `/plan-feature`

1. Create design document at `docs/plans/[feature-name]-design.md`
2. Document feature overview, architecture, and key components
3. Create implementation plan at `docs/plans/[feature-name]-implementation.md`
4. Break down implementation into specific, actionable tasks
5. Include timeline estimates and dependencies
6. Review and refine plan before development begins

### Report Component Creation
**Trigger:** When someone wants to add visual elements to reports  
**Command:** `/new-report-component`

1. Create new component in `src/components/report/report-[component-name].tsx`
2. Implement server-side rendering for optimal print compatibility
3. Use pure SVG or Unicode characters instead of icon libraries for print support
4. Design responsive layout that works in both screen and print media
5. Integrate component into relevant report pages in `src/app/report/*/page.tsx`
6. Test print functionality across different browsers

### Gantt Chart Enhancement
**Trigger:** When someone wants to enhance timeline visualization features  
**Command:** `/enhance-gantt`

1. Modify core functionality in `src/components/gantt/gantt-chart.tsx`
2. Update data structures in `src/components/gantt/gantt-types.ts` if needed
3. Apply consistent changes to `src/components/report/report-gantt.tsx`
4. Test visual improvements across different screen sizes
5. Verify print compatibility for report versions
6. Update related documentation and type definitions

### Database Schema Extension
**Trigger:** When someone wants to add new data entities to the system  
**Command:** `/new-entity`

1. Create SQL migration file in `drizzle/` directory
2. Update `src/lib/db/schema.ts` with new table definitions and relationships
3. Create data access queries in `src/lib/queries/[entity].ts`
4. Implement CRUD server actions in `src/lib/actions/[entity].ts`
5. Add validation schemas in `src/lib/validations/[entity].ts`
6. Create admin management pages in `src/app/admin/[entity]/page.tsx`
7. Run migrations and test full CRUD cycle

### AI Integration Refactoring
**Trigger:** When someone wants to standardize AI service usage across the application  
**Command:** `/refactor-ai-services`

1. Create shared AI service interfaces in `src/lib/ai/types.ts`
2. Implement provider-specific classes (Gemini, OpenAI, etc.)
3. Create factory pattern for AI service instantiation
4. Build utility functions for common AI operations
5. Refactor existing API routes to use new abstractions
6. Add comprehensive error handling and retry logic
7. Update all AI-powered features to use standardized approach

## Testing Patterns

- Test files follow `*.test.*` naming convention
- Place tests near the code they're testing
- Focus on testing business logic and API endpoints
- Use descriptive test names that explain the expected behavior

## Commands

| Command | Purpose |
|---------|---------|
| `/new-ai-endpoint` | Create AI-powered API route with authentication and validation |
| `/plan-feature` | Generate comprehensive feature planning documentation |
| `/new-report-component` | Create print-friendly report component |
| `/enhance-gantt` | Improve Gantt chart functionality and visuals |
| `/new-entity` | Add complete database entity with CRUD operations |
| `/refactor-ai-services` | Standardize AI service usage across application |