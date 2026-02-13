---
name: UI/UX Pro Max
description: An AI SKILL that provides design intelligence for building professional UI/UX on multiple platforms.
version: 2.0
---

# UI/UX Pro Max Skill

## Purpose

To generate professional, industry-specific design systems and UI implementations by reasoning about product type, style, and user experience requirements.

## Core Workflow

When this skill is activated (or when you are asked to design/build UI), follow this process:

### 1. Analyze & Reason

Do not just write code immediately. First, analyze the request using the **Reasoning Engine**:

- **Product Type**: What is it? (e.g., Fintech, SaaS, E-commerce, Wellness)
- **Target Audience**: Who is it for? (e.g., Traders, Gen Z, Enterprise)
- **Vibe/Mood**: What is the desired emotional response? (e.g., Trust, Excitement, Calm, Premium)

### 2. Generate Design System

Before identifying specific components, generate a mini Design System in your thought process (or as an artifact). define:

- **Palette**: Primary, Secondary, Accent, Background (Dark/Light).
- **Typography**: Headings (Font, Weight), Body (Font, Readability).
- **Effects**: Shadows (Soft/Hard), Border Radius, Glassmorphism, Transitions.
- **Anti-Patterns**: What to AVOID for this specific industry (e.g., "Don't use neon colors for a serious banking app").

### 3. Implementation Rules

- **Structure**: Semantic HTML, clear hierarchy.
- **Styling**: Tailwind CSS (preferred) or CSS-in-JS.
- **Interactions**: `hover:`, `active:`, `focus:` states are MANDATORY.
- **Accessibility**: Contrast ratios, touch targets, keyboard navigation.
- **Micro-interactions**: Add subtle animations (fade-in, slide-up) for "Premium" feel.

## Industry-Specific Reasoning Rules (Examples)

### Fintech / Trading (Current Project Context)

- **Pattern**: Data-heavy Dashboard, High Density.
- **Style**: Dark Mode, Glassmorphism, High Contrast Numbers.
- **Colors**:
  - Background: Deep Zinc/Slate (#09090b, #18181b).
  - Profit: Emerald/Green (#10b981).
  - Loss: Rose/Red (#f43f5e).
  - Text: White, Zinc-400 (secondary).
- **Typography**: Monospace/Numeric fonts for data (e.g., Barlow, JetBrains Mono).
- **Effects**: Subtle glows for active states, strict borders.
- **Anti-Patterns**:
  - Cluttered gradients (distracts from data).
  - Low contrast text.
  - Slow animations (must be performant).

### Wellness / Spa

- **Style**: Soft UI, Organic.
- **Colors**: Pastels, Warm Whites, Sage Green.
- **Effects**: Soft large shadows, slow transitions.
- **Anti-Patterns**: Sharp corners, high contrast black/white.

### System Feedback & States

- **Loading**: Use Skeleton loaders (shimmer effect) for content, Spinners for actions.
- **Error**:
  - Contextual: Inline red text/border for form fields.
  - Global: Toast notifications or Alert banners.
- **Disabled / Unsupported**:
  - **Visuals**: Opacity 40-50%, Grayscale filter, `cursor-not-allowed`.
  - **Communication**: Explicitly label as "Unsupported" or "Coming Soon" (Don't just hide it if it's discoverable).
  - **Behavior**: Disable all interactivity (click, hover).

  - **Behavior**: Disable all interactivity (click, hover).

### Animation & Motion Guidelines

To achieve the "Pro Max" feel, motion must be intentional, not just decorative.

- **Duration**:
  - Micro-interactions (Hover, Click): `duration-200` to `duration-300`.
  - Content Entry (Fade/Slide): `duration-500` to `duration-700` with `ease-out`.
- **Easing**:
  - Use `ease-out` for entering elements (feels natural).
  - Use `ease-in` for exiting elements.
- **Staggering**:
  - When loading lists, stagger items by 50-100ms (e.g., `delay-[100ms]`).
- **Feedback**:
  - Active states (`active:scale-95`) give tactile feedback on buttons.

## Pre-Delivery Checklist

Before confirming a task is done:

- [ ] No emojis as icons (Use Lucide/Heroicons).
- [ ] `cursor-pointer` on all interactive elements.
- [ ] Hover states exist and are smooth (`duration-200`).
- [ ] Responsive design checks (Mobile/Desktop).
- [ ] Dark mode compatibility (if applicable).

## Usage

Apply this skill to "Strengthen" existing UI by:

1. Reviewing current UI against the Industry Rules.
2. Identifying "Anti-Patterns".
3. Proposing "Polish" upgrades (like Glassmorphism, Typography).
