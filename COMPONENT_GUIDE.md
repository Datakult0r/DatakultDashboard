# Component Architecture Guide

## Component Structure

### 1. StatCard (`src/components/StatCard.tsx`)
Large number display with label, optional icon, and subtext.
```typescript
<StatCard
  number={42}
  label="Urgent Items"
  icon={<AlertCircle size={20} />}
  bgColor="bg-danger/10"
  numberColor="text-danger"
  subtext="Tasks requiring immediate action"
/>
```

### 2. SourceTag (`src/components/SourceTag.tsx`)
Colored pill badge for source types.
- `email` → Blue (#60a5fa)
- `linkedin` → Green (#34d399)
- `beeper` → Violet (#a78bfa)
- `calendar` → Amber (#fbbf24)
- `other` → Gray (#9299b0)

### 3. ScoreChip (`src/components/ScoreChip.tsx`)
Score badge with label and semantic coloring.
- `strong` → Red background (#f87171)
- `apply` → Amber background (#fbbf24)
- `light` → Gray background with low opacity
- `priority` → Red with pulsing animation
- `skip` → Muted gray

### 4. TriageCard (`src/components/TriageCard.tsx`)
Main card for urgent and review items.
Features:
- Source tag at top
- Score chip on right
- Title, subtitle, contact info
- Tags array (first 3 displayed)
- Expandable draft reply with copy button
- External link button

### 5. JobCard (`src/components/JobCard.tsx`)
Pipeline card for job opportunities.
Features:
- Company and role display
- Location and salary row
- Job type badges
- Easy Apply flag
- Recruiter name badge
- Status indicator (pending, in_progress, completed, skipped)
- View job link

### 6. NewsCard (`src/components/NewsCard.tsx`)
Horizontal news card with image.
Features:
- Thumbnail on left (80x60px)
- Source badge in mono font
- Title and subtitle (truncated)
- External link
- Image uses Next.js Image component

### 7. ScheduleRow (`src/components/ScheduleRow.tsx`)
Calendar event row with time-aware highlighting.
Features:
- Time display (start and end times)
- Divider separator
- Event title and description
- Location badge with icon
- Status badges: Today, Now (pulsing), Soon
- Time-aware highlighting:
  - Current event: warning/amber background
  - Upcoming (< 1 hour): info/purple background
  - Regular: default style

### 8. DashboardShell (`src/components/DashboardShell.tsx`)
Main client component with full dashboard logic.
Features:
- Sticky header with branding and date
- 4-column stat row (urgent, in-progress, jobs, done)
- Tab navigation with badge counts
- Realtime Supabase subscription
- Tab-specific content rendering
- Footer with last refresh time
- Responsive grid layouts

## Data Types

Located in `src/types/triage.ts`:

```typescript
type TriageCategory = 'urgent' | 'review' | 'job' | 'news' | 'schedule' | 'done';
type TriageStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';
type ScoreLabel = 'strong' | 'apply' | 'light' | 'skip' | 'priority';
type SourceType = 'email' | 'linkedin' | 'beeper' | 'calendar' | 'other';
```

## Tailwind Color Tokens

### Base Colors
- `bg-base`: #0b0d14 (dark background)
- `bg-surface`: #12151f (card backgrounds)
- `bg-elevated`: #1a1e2e (nested content)
- `border`: #272d42 (borders)

### Text Colors
- `text-primary`: #eef0f6 (main text)
- `text-secondary`: #9299b0 (secondary text)

### Semantic Colors
- `text-danger`: #f87171 (red)
- `text-warning`: #fbbf24 (amber)
- `text-success`: #34d399 (green)
- `text-accent`: #60a5fa (blue)
- `text-info`: #a78bfa (purple)

## Layout Patterns

### Grid for Jobs/News
```tsx
<div className="grid gap-3 md:grid-cols-2">
  {items.map(item => <JobCard key={item.id} item={item} />)}
</div>
```

### Stack for Urgent/Review
```tsx
<div className="grid gap-3">
  {items.map(item => <TriageCard key={item.id} item={item} />)}
</div>
```

## Responsive Breakpoints

- Mobile: Base styles (< 640px)
- Small: `sm:` prefix (640px+)
- Medium: `md:` prefix (768px+)
- Large: `lg:` prefix (1024px+)

## Accessibility Features

- Focus-visible outlines on all interactive elements
- Color not used as only indicator (semantic text + icons)
- WCAG AA contrast ratios maintained
- Semantic HTML (buttons, links, headings)
- Proper alt text on images
- Aria-friendly structure

## Performance Considerations

- Server components for data fetching (page.tsx)
- Client components only where needed (DashboardShell)
- Realtime subscription with React state management
- Image optimization with Next.js Image component
- Lazy loading through Tailwind classes

## Styling Approach

- Utility-first with Tailwind CSS
- Dark theme by default
- No CSS modules needed (utilities sufficient)
- Custom scrollbar in globals.css
- Font variables from layout.tsx
- Animation classes for pulse effects

## Integration Points

1. **Supabase**: Real-time subscription to `triage_items` table
2. **Date formatting**: date-fns for all date/time operations
3. **Icons**: lucide-react for consistent icon set
4. **Images**: Next.js Image for optimized delivery
5. **Forms**: Native HTML for copy-to-clipboard action

## Common Patterns

### Copy to Clipboard
```tsx
const handleCopy = async (text: string) => {
  await navigator.clipboard.writeText(text);
  // Show feedback
};
```

### Realtime Subscription
```tsx
const subscription = supabase
  .channel('triage_changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'triage_items' }, (payload) => {
    // Handle INSERT, UPDATE, DELETE
  })
  .subscribe();
```

### Conditional Styling
```tsx
className={`base-class ${isActive ? 'bg-accent text-white' : 'bg-secondary/20'}`}
```

### Tab Navigation
```tsx
const tabs = [
  { id: 'tab1', label: 'Tab 1', count: 5 },
  { id: 'tab2', label: 'Tab 2', count: 3 },
];

{tabs.map(tab => (
  <button
    key={tab.id}
    onClick={() => setActiveTab(tab.id)}
    className={activeTab === tab.id ? 'border-accent' : 'border-transparent'}
  >
    {tab.label} <span>{tab.count}</span>
  </button>
))}
```
