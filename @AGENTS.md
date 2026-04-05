# Important Breaking Changes in Next.js 16

## Next.js 16.2.2 Compatibility Notes

This project uses Next.js 16.2.2 which has several breaking changes from Next.js 15:

### Key Changes
1. **React 19 Adoption** - Uses React 19.2.4 with new features like use() hook
2. **Server Components by Default** - All components are server components unless marked 'use client'
3. **Turbopack** - Next.js 16 defaults to Turbopack for faster builds
4. **Dynamic Imports** - require() no longer works in Next.js; use import()
5. **Image Optimization** - next/image requires explicit width/height/alt attributes

### Component Rules
- Use `'use client'` directive for client-side features (useState, useEffect, event handlers)
- Server components can directly access databases and environment variables
- Can't use browser APIs in server components

### CSS
- Tailwind CSS 4 with @tailwindcss/postcss
- Custom dark theme uses CSS variables via Tailwind config

### Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` - public Supabase instance URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - public Supabase anonymous key
- Environment variables must be declared in next.config.ts or .env.local

### Migration Notes
If updating from Next.js 15:
1. Update React imports (some hooks changed)
2. Add 'use client' to components using hooks/events
3. Test dynamic imports thoroughly
4. Verify image optimization with explicit dimensions
5. Update deployment environment variables

## Testing
Run `npm run build` to check for compatibility issues.
