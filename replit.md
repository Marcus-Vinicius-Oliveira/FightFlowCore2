# Centro de Lutas Management Platform

## Overview

Centro de Lutas Management is a comprehensive SaaS platform for martial arts academies to manage students, classes, attendance, and basic financials. The platform features both an admin dashboard for academy operations and a student portal for member access, with a focus on multi-tenant security and role-based access control.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite for development and build tooling
- **UI Components**: Radix UI primitives with shadcn/ui component library for consistent design
- **Styling**: TailwindCSS with custom CSS variables for theming and dark/light mode support
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query for server state management and data fetching
- **Forms**: React Hook Form with Zod validation schemas

### Backend Architecture
- **Framework**: Express.js with TypeScript for REST API endpoints
- **Architecture Pattern**: Modular monolith with clear separation between domains (auth, students, classes, attendance)
- **Authentication**: JWT-based authentication with bcrypt password hashing
- **Authorization**: Role-based access control with three roles: ADMIN_ACADEMIA, PROFESSOR, ALUNO
- **Multi-tenancy**: Academy-based tenant isolation enforced at API and database level

### Database Design
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema**: PostgreSQL with comprehensive relational design
- **Key Entities**: 
  - Academies (tenant isolation)
  - Users with role-based permissions
  - Membership plans and class types
  - Classes with scheduling and enrollment
  - Attendance tracking and payment records
- **Security**: Multi-tenant data isolation using academyId foreign keys on all relevant tables

### Design System
- **Approach**: Reference-based design inspired by modern SaaS platforms (Linear, Notion, Stripe)
- **Theme**: Professional martial arts academy branding with strength/discipline aesthetics
- **Color Palette**: Deep navy primary, light gray backgrounds, energetic orange accents
- **Typography**: Inter font family with consistent sizing scale
- **Components**: Comprehensive UI component library with hover states and elevation effects

### Security Architecture
- **Authentication**: JWT token-based with secure password hashing
- **Authorization**: Middleware-based role checking for protected routes
- **Data Isolation**: Strict tenant separation using academyId filtering
- **Input Validation**: Zod schemas for request validation and type safety

## External Dependencies

### Core Dependencies
- **Database**: Neon PostgreSQL serverless database with connection pooling
- **UI Framework**: Radix UI primitives for accessible component foundations
- **Authentication**: bcryptjs for password hashing, jsonwebtoken for session management
- **Development**: ESBuild for server bundling, TSX for development runtime

### Frontend Libraries
- **State Management**: TanStack React Query for server state caching and synchronization
- **Styling**: TailwindCSS with PostCSS for utility-first styling
- **Forms**: React Hook Form with Hookform/resolvers for form validation
- **Icons**: Lucide React for consistent iconography
- **Utilities**: clsx and tailwind-merge for conditional class handling

### Development Tools
- **Build System**: Vite for fast development server and optimized production builds
- **Type Checking**: TypeScript with strict configuration for type safety
- **Database Management**: Drizzle Kit for schema migrations and database operations
- **Fonts**: Google Fonts (Inter, JetBrains Mono) for typography system