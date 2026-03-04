---
title: Rich Text Editor
tags: []
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: '2026-03-04T18:40:06.130Z'
updatedAt: '2026-03-04T18:40:06.130Z'
---
## Raw Concept
**Task:**
Document Rich Text Editor component implementation and SSR fix

**Changes:**
- Added immediatelyRender: false to useEditor options to fix SSR hydration mismatch

**Files:**
- src/components/rich-text-editor.tsx

**Timestamp:** 2026-03-04

**Author:** System

## Narrative
### Structure
The RichTextEditor component uses Tiptap with StarterKit, Image, Link, and Placeholder extensions. It includes a toolbar for basic formatting and image uploads via /api/upload.

### Dependencies
Tiptap React, Lucide React, Sonner for notifications.

### Highlights
Supports bold, italic, strikethrough, headings, lists, links, and image uploads. Uses a custom toolbar with conditional button variants based on editor state.

### Rules
SSR Compatibility: Must set immediatelyRender: false in useEditor options to prevent hydration mismatch errors in Next.js.

### Examples
Usage: <RichTextEditor content={note} onChange={setNote} />

## Facts
- **editor_library**: RichTextEditor uses Tiptap React [project]
- **ssr_fix**: Must set immediatelyRender: false for SSR [convention]
