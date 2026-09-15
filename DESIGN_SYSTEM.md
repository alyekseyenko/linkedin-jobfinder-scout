# 🌌 Neural Scout 2026 — Design System Rules

This document defines the official visual and interaction standards for the Neural Scout ecosystem. All future components and pages MUST adhere to these rules to maintain the "Bio-Neon 2026" aesthetic.

---

## 🎨 1. Core Color Palette
The palette is rooted in high-contrast neon against a deep, procedural void.

| Token | Hex | Usage |
| :--- | :--- | :--- |
| **Bio-Void** | `#030008` | Background layer, deep shadows. |
| **Bio-Neon Green** | `#00ff80` | Success states, high-priority matches, "HUNT" actions. |
| **Bio-Neon Blue** | `#00d4ff` | Primary intelligence, links, secondary actions. |
| **Bio-Neon Purple** | `#bc13fe` | Strategy, tactical advice, applied states. |
| **Bio-Neon Cyan** | `#00f2ff` | Real-time monitoring, interview states. |
| **Glass Base** | `rgba(255,255,255,0.03)` | Card backgrounds (always with backdrop-blur). |

---

## 💎 2. Glassmorphism & Geometry
We use a high-fidelity glass system that feels physical and premium.

- **Primary Radius:** `rounded-3xl` (24px) for cards, job tiles, and standard modals.
- **Large Radius:** `rounded-[2.5rem]` (40px) for main sections and configuration panels.
- **Glass Blur:** 
  - Standard: `backdrop-blur-xl` (12px).
  - High Density: `backdrop-blur-3xl` (40px) for headers and search bars.
- **Borders:** `1px solid rgba(255, 255, 255, 0.05)` (Bio-Border).

---

## 🖋️ 3. Typography Hierarchy
Typography is the voice of the Neural Engine. Use **Geist** or **Inter**.

- **Headers (H1, H2, H3):** Always `font-black`. Use `tracking-tight` for titles and `tracking-[0.2em]` for uppercase subheaders.
- **Body:** `font-medium` or `font-semibold`. Avoid `font-normal` as it lacks the "premium" weight.
- **Micro-labels:** `text-[9px]` or `text-[10px]`, `font-black`, always `uppercase` with `tracking-widest`.

---

## ✨ 4. Visual Effects (Neural Vibe)
The "living" nature of the UI is achieved through specific shaders and filters.

- **Neural Glow:** Use `shadow-bio-neon` or `shadow-bio-cyan` for active states.
- **Film Grain:** SVG turbulence filter applied via `.glass-noise` (user-controllable).
- **Bio-Resonance:** GSAP animations with `power2.out` or `sine.inOut` easing.
- **Hover Transitions:** 
  - Cards: `transition-all duration-500`.
  - Buttons: `whileHover={{ scale: 1.02 }}`, `whileTap={{ scale: 0.98 }}`.

---

## 🧠 5. Logic Consistency
Intelligence must look the same everywhere.

- **Matching Score:** Always use the **Weighted Neural Engine** (Core Tech: 2.5x weight).
- **Icons:** Use `lucide-react` with specific domain assignments:
  - `BrainCircuit`: Intelligence/AI.
  - `Zap`: Hunt/Interested.
  - `Send`: Applied/Contact.
  - `Target`: Mission/Goal.

---

## 🚀 6. Performance Standards
- **Memoization:** Wrap all list-item components (JobCard, SortableCard, Lane) in `memo()`.
- **Throttling:** Use `useSensor` with high activation distance (10px) for drag operations to prevent accidental triggers.
- **Cleanups:** Always destroy GSAP timelines and Lenis instances in `useEffect` cleanups.
