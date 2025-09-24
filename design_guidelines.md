# Centro de Lutas Management Platform - Design Guidelines

## Design Approach
**Selected Approach:** Reference-Based (Productivity Focus)  
Drawing inspiration from modern SaaS platforms like Linear, Notion, and Stripe Dashboard for clean, professional interfaces that prioritize functionality while maintaining visual appeal for the martial arts industry.

**Key Design Principles:**
- Professional martial arts academy branding with strength and discipline themes
- Clear hierarchy emphasizing data management and operational efficiency  
- Multi-tenant security through visual separation and role-based UI differentiation
- Responsive design optimized for both desktop management and mobile student portal access

## Core Design Elements

### Color Palette
**Light Mode:**
- Primary: 220 85% 20% (deep navy blue - strength/discipline)
- Secondary: 220 15% 95% (light gray backgrounds)
- Accent: 40 90% 50% (energetic orange - sparingly used for CTAs)
- Success: 120 60% 45% (attendance/payment success states)
- Warning: 35 85% 55% (overdue payments)
- Error: 0 75% 55% (validation errors)

**Dark Mode:**
- Primary: 220 85% 75% (lighter navy for contrast)
- Secondary: 220 15% 15% (dark gray backgrounds)
- Accent: 40 85% 65% (muted orange)
- Text primary: 220 5% 95%
- Text secondary: 220 5% 70%

### Typography
**Font System:** Inter (Google Fonts)
- Headers: Inter 600-700 (semibold to bold)
- Body text: Inter 400-500 (regular to medium)
- UI elements: Inter 500 (medium)
- Code/data: JetBrains Mono 400

### Layout System
**Spacing Units:** Tailwind scale focused on 4, 8, 16, 24 units
- Micro spacing: p-1, m-1 (4px)
- Component spacing: p-4, m-4 (16px) 
- Section spacing: p-8, gap-8 (32px)
- Page-level spacing: p-16, my-16 (64px)

### Component Library

**Navigation:**
- Clean sidebar navigation for admin dashboard with academy branding
- Collapsible mobile navigation
- Role-based menu items with clear visual separation
- Breadcrumb navigation for deep management pages

**Data Display:**
- Clean table designs with alternating row colors
- Card-based layouts for student profiles and class schedules
- Dashboard widgets with subtle shadows and rounded corners
- Status indicators using color-coded badges

**Forms:**
- Consistent input styling with focus states
- Form sections with clear grouping and spacing
- Inline validation with helpful error messages
- Multi-step forms for student enrollment

**Admin Dashboard Components:**
- Statistics cards with icons and trend indicators
- Quick action buttons prominently placed
- Calendar view for class scheduling
- Student attendance tracking interface

**Student Portal Components:**
- Personal dashboard with upcoming classes
- Schedule view optimized for mobile
- Attendance history with visual progress indicators
- Profile management forms

### Images
**Hero Section:** Large hero image on landing page featuring diverse martial arts students in training, conveying community and discipline. Image should have a subtle dark overlay for text contrast.

**Academy Branding:** Each tenant academy can upload their logo, displayed consistently in navigation and headers.

**Stock Photography:** Professional martial arts training photos for marketing sections, emphasizing community, discipline, and achievement.

### Professional Martial Arts Aesthetic
- Subtle use of martial arts imagery and iconography
- Strong, confident visual hierarchy reflecting discipline
- Clean, organized layouts that convey professionalism to parents and students
- Color choices that work across different martial arts disciplines (not style-specific)