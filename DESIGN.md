---
name: ADE
description: An agentic development workstation for projects, tasks, documentation, Git and local runtimes.
colors:
  workspace-bg: "#f7f7f5"
  chrome: "#eef0f3"
  chrome-strong: "#e6e9ed"
  panel: "#fffdfa"
  panel-raised: "#ffffff"
  panel-soft: "#f0f2f5"
  line: "#d9dee5"
  line-strong: "#c3cad4"
  text: "#1f2630"
  text-soft: "#465363"
  muted: "#586878"
  faint: "#69798a"
  primary-blue: "#2858b8"
  accent-cyan: "#16807d"
  success-green: "#2c8a5a"
  warning-amber: "#a46f12"
  error-red: "#c24d59"
  agent-purple: "#7656d6"
  dark-workspace-bg: "#0f1724"
  dark-chrome: "#162335"
  dark-chrome-strong: "#101b2a"
  dark-panel: "#1a2a3b"
  dark-panel-raised: "#203348"
  dark-panel-soft: "#142333"
  dark-line: "#2f4357"
  dark-line-strong: "#486175"
  dark-text: "#edf4f7"
  dark-text-soft: "#c4d2dc"
  dark-muted: "#90a3b5"
  dark-faint: "#64798d"
  dark-blue: "#7fb0ff"
  dark-cyan: "#69d5c8"
  dark-green: "#7cd9a5"
  dark-amber: "#f0c477"
  dark-red: "#f3939b"
  dark-purple: "#c3a7ff"
  light-workspace-bg: "#f3f6fa"
  light-chrome: "#e8eef5"
  light-panel: "#ffffff"
  light-panel-soft: "#edf3f8"
  light-line: "#c6d2de"
  light-text: "#152231"
  light-muted: "#586878"
  light-blue: "#2865b1"
  light-cyan: "#0e827b"
  light-green: "#167646"
  light-amber: "#8a5d11"
  light-red: "#ab3d47"
typography:
  display:
    fontFamily: "Avenir Next, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "25px"
    fontWeight: 650
    lineHeight: 1.1
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Avenir Next, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "SF Mono, JetBrains Mono, ui-monospace, monospace"
    fontSize: "9px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.1em"
rounded:
  none: "0px"
  control: "2px"
  button: "3px"
  dialog: "4px"
spacing:
  xs: "5px"
  sm: "7px"
  md: "12px"
  lg: "17px"
  xl: "22px"
components:
  button-primary:
    backgroundColor: "{colors.accent-cyan}"
    textColor: "#071312"
    rounded: "{rounded.button}"
    padding: "6px 11px"
    height: "30px"
  button-secondary:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.text-soft}"
    rounded: "{rounded.button}"
    padding: "6px 11px"
    height: "30px"
  input:
    backgroundColor: "{colors.panel-soft}"
    textColor: "{colors.text-soft}"
    rounded: "{rounded.control}"
    padding: "7px 9px"
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
    padding: "14px"
---

# Design System: ADE

## Overview

**Creative North Star: "Sala de Evidencia"**

ADE is a focused desktop workbench for software development driven by agents. Its visual language is inspired by the reading clarity of Codex Desktop and GitHub Desktop, while establishing its own editorial-operational identity: conversations, changes and decisions are treated as evidence that must be easy to follow, compare and revisit. The work surface should feel calm and purposeful, with every panel earning its space through a concrete development task.

The system uses a warm light workspace by default and a distinct night-shift dark theme for low-light work. Both themes keep graphite text, quiet structural rules and restrained semantic accents. It is technical without becoming sterile: success, warning, error and agent states have distinct colors, while depth comes from tonal layering instead of decorative effects.

**Key Characteristics:**

- Familiar desktop grammar: labeled navigation, explorer, project context, workbench and status bar.
- Open reading architecture with short labels and monospace operational metadata.
- Truthful chrome: persistent controls represent real, available actions or real state; simulated health, user identity, notifications and placeholder work never occupy the shell.
- Flat-by-default surfaces with softened geometry, quiet rules and state-driven accents.
- No gradients, glassmorphism, marketing hero panels or ornamental imagery.
- Theme switching is explicit, persisted per user and never changes the information architecture.

## Colors

The palette is a warm, light-first workspace with graphite ink, cool neutrals and a small set of semantic status colors. The dark theme is a distinct night-shift translation rather than a mechanical inversion: deep ink-blue canvas, slate-blue surfaces and cool ivory text make long technical reading comfortable while teal and orchid retain ADE's identity. Cobalt blue is the primary interaction accent and remains scarce enough to communicate focus.

### Primary

- **Cobalt Action** (#2858b8): Focus rings, links and primary interactive emphasis.
- **Workbench Teal** (#16807d): Active navigation and running states.

### Secondary

- **Agent Purple** (#7656d6): Provider and agent-specific metadata.

### Tertiary

- **Success Green** (#2c8a5a): Healthy services, passed gates and completed work.
- **Warning Amber** (#a46f12): Review, pending gates and caution states.
- **Error Red** (#c24d59): Failed runtime and recovery-required states.

### Neutral

- **Paper Workspace** (#f7f7f5): Default application canvas.
- **Soft Chrome** (#eef0f3): Explorer and persistent shell surfaces.
- **Raised Panel** (#ffffff): Workbench panes and interactive controls.
- **Graphite Ink** (#1f2630): Primary headings and decisions.
- **Muted Text** (#586878): Supporting copy with readable contrast.
- **Structural Line** (#d9dee5): Panel boundaries and separators.

### Light Theme (Default)

- **Light Workspace** (#f7f7f5): Default application canvas.
- **Light Chrome** (#eef0f3): Sidebar and toolbar surfaces.
- **Light Panel** (#fffdfa): Workbench panes and content surfaces.
- **Light Soft Surface** (#f0f2f5): Inputs, code surfaces and raised controls.
- **Light Text** (#1f2630): Primary headings and decisions.
- **Light Muted** (#586878): Supporting copy with readable contrast.

### Dark Theme

- **Night Evidence** (#0f1724): Deep blue-black application canvas for sustained work.
- **Ink Chrome** (#162335): Sidebar, toolbar and persistent shell surfaces.
- **Slate Panel** (#1a2a3b): Workbench panes and conversation surfaces.
- **Raised Slate** (#203348): Focused controls and elevated interactive surfaces.
- **Soft Night Surface** (#142333): Inputs, editor and terminal surfaces.
- **Cool Ivory Text** (#edf4f7): Primary reading text with comfortable contrast.
- **Slate Secondary Text** (#c4d2dc): Conversation and supporting content.
- **Teal Signal** (#69d5c8): Active navigation, focus and running states.
- **Orchid Agent** (#c3a7ff): Provider and agent-specific metadata.

Dark mode is intentionally familiar to developers — a dark editor, terminal and pane grammar — but uses blue-green depth and restrained semantic accents instead of a generic near-black palette. The dark theme owns its surface hierarchy, selection, terminal background, Monaco editor and browser `color-scheme` independently from light mode.

**The Signal Scarcity Rule.** Use cyan, green, amber and red only when they communicate interaction or state; never use them as decoration.

## Typography

**Display Font:** Avenir Next (with the system sans-serif fallback)

**Body Font:** Avenir Next (with the system sans-serif fallback)

**Label/Mono Font:** SF Mono (with JetBrains Mono and ui-monospace fallbacks)

**Character:** The sans face keeps task intent and explanatory copy approachable; the monospace face makes paths, IDs, commands and state labels feel traceable and tool-like.

### Hierarchy

- **Display** (650, 25px, 1.1): View titles and the project name.
- **Title** (600, 13–16px, 1.3): Panel and task headings.
- **Body** (400, 10–12px, 1.5): Descriptions, supporting context and event copy.
- **Label** (500, 8–10px, 1.3, tracked): IDs, statuses, metadata and section markers.

**The Traceable Type Rule.** Use the mono face for anything a developer may copy, compare or use to locate evidence; use the sans face for intent and explanation.

## Layout

The desktop shell is a two-column evidence workspace: one labeled navigation/sidebar and a flexible workbench. The sidebar combines view labels with a persistent project explorer, avoiding duplicate navigation surfaces. A visible vertical grip lets the user resize it by drag or keyboard, within bounds persisted per Project. A restrained top bar anchors project and branch context. `Agents` uses a Project-scoped conversation rail grouped by Task and General plus a wide conversation-first central thread; its compact identity row only retains provider, conversation, Task and state, never repeating the Project path already anchored globally. Tool activity and changed files stay attached to the relevant turn instead of becoming a permanent inspector. `Version control` uses the same reading rhythm: a focused change list, readable diff and deliberate commit action. Changes gives the diff the dominant width; History can collapse its commit and changed-file columns, with restore controls anchored to their headers, and long diff lines wrap to the live available width. Persistent surfaces use generous whitespace, quiet rules and tonal layering rather than a grid of unrelated cards. The native PTY dock remains available at the bottom and can be resized by drag or keyboard.

At narrower desktop widths, the workbench collapses the project context panes into one column and the metric strip and knowledge surfaces reduce to two columns. The labeled sidebar remains visible so navigation never disappears.

The operational `Git workspace` panel belongs exclusively to `Version control`; Projects, Editor, Agents, Work and Project context do not repeat Git status or actions. The top bar retains only the global Project and branch selectors.

## Elevation & Depth

ADE is flat-by-default. Depth is conveyed by tonal steps between the canvas, chrome, panel and raised-panel colors, plus thin borders. Shadows are reserved for transient surfaces such as the task dialog and toast; the persistent workspace should not look like a stack of floating cards.

**The Flat Workbench Rule.** A surface earns elevation only when it is transient or interactive; persistent workbench panes use tonal layering, softened geometry and structural lines.

## Shapes

The form language is calm and approachable: 7–10px radii for controls and workbench containers, no decorative pills, and compact status treatments only where the state benefit is clear. Borders are 1px and quiet at rest, becoming blue or teal on focus and active states.

## Components

### Buttons

- **Shape:** Softened controls (7px radius) with clear hit targets.
- **Primary:** Cobalt or teal semantic accent with readable dark text, 7px 13px padding and a 34px minimum height.
- **Hover / Focus:** Raise contrast without inverting the surface; use a visible blue focus ring for keyboard navigation.
- **Secondary / Ghost:** Raised light panel for secondary actions; ghost text buttons for low-priority links. Dark theme maps the same roles to its night-shift palette.

### Cards / Containers

- **Corner Style:** Usually square; 0px for pane surfaces and 3–4px for transient containers.
- **Background:** Use the panel hierarchy rather than white cards.
- **Shadow Strategy:** No persistent shadow; dialog and toast may use ambient shadow.
- **Border:** 1px structural line where a pane boundary improves scanning.
- **Internal Padding:** 12–17px for content panes.

### Inputs / Fields

- **Style:** Light panel-soft field by default, 1px line-strong border, 2px radius and monospace text for commands/paths; dark theme maps it to its night-shift panel.
- **Focus:** Blue outline and line-color shift; never rely on color alone.
- **Error / Disabled:** Error uses red semantic text; disabled controls reduce opacity and retain their labels.

### Navigation

- **Style:** A single labeled navigation controls views inside the project sidebar; the same sidebar owns the Explorer below it. Active items use a 2px cyan edge and a slightly raised surface. Utility actions expose their labels as well as their keyboard affordances.
- **Interaction:** Hover changes surface and text contrast; focus remains visible; labels and ARIA names are always available for icon-only controls.
- **Sizing:** The sidebar has a discoverable vertical resize grip. Pointer drag and `←`/`→` resize it; Shift changes the step, Home and End reach the bounds of 190–720 px (responsive to the window), and the width persists for the active Project.
- **Theme control:** The persistent light/dark switch lives in the top-right global toolbar. It uses a compact circular thumb with a visible track, keeps light as the default, and exposes the next action through its label and ARIA state.

### Explorer

The explorer is persistent, filterable and lazily expanded. Search results are file-first: matching files are shown directly, without presenting their containing folders as the result. Each result pairs the filename with a readable, adjacent relative parent path so same-named files remain distinguishable; long paths wrap inside the result instead of being clipped, and the full relative path is available as the row tooltip. Search input remains responsive while the first recursive index is loading: keystrokes are debounced, stale requests are ignored, and a small spinner stays visible until the current results are ready. Selecting a result clears the query and restores the active file's parent branch from the Project root as a constant path hint. In compact mode it shows that branch, hiding sibling noise. Selecting Expand switches the sidebar into tree focus mode: labeled view navigation disappears, the full tree becomes the primary surface, and directory rows can be explored recursively. Collapse restores navigation and the compact active-file branch. Directory rows have a clear disclosure affordance, file rows open in ADE's internal text editor by default, and Save, Discard and an explicit external-open action remain available. The editor fills its viewport, keeps unsaved state visible and supports the platform save shortcut. Symlinks are visibly non-actionable when they leave the selected project root.
- **Motion:** Expanding and collapsing the Explorer uses a short ease-out layout transition: navigation recedes, the tree takes its place, and the compact branch fades into the restored context. Reduced-motion preferences remove spatial movement while preserving the state change.

### Terminal Dock

- **Behavior:** The native PTY dock is always available above the status bar. Its top grip resizes the panel by pointer; focused resizing also supports Arrow keys, Shift+Arrow larger steps, Home and End. The chosen height is persisted for the active Project.

The native terminal is a fixed bottom dock with tabbed familiar console surfaces: each tab owns one PTY transcript, prompt, cwd and command history. The shell owns command echo and prompt rendering so output is never duplicated by the UI. The transcript interprets the PTY's ANSI cursor, erase, color and alternate-screen control sequences, so interactive TUIs such as Claude render as interfaces rather than escaped text. Enter executes the current command; Arrow Up/Down navigates the active tab's history; Tab completes `cd` directory paths from the active Project and shows a short suggestion list when ambiguous. Tabs are compact, labeled and keyboard-focusable; creating, switching and closing a tab is explicit, and closing one does not disturb the others. The current Project path stays visible in the terminal header, and the dock is present across views and can be focused from the breadcrumb-area command actions.

### Workbench Pane

The signature component is the IDE workbench: task intent, changed files, verification, agent session context and native terminal appear as coordinated panes. Keep the active task visually anchored with a cyan edge or active tab, and expose evidence without hiding it behind decorative summaries.

### Integrity, accessibility and adaptation

- The Tauri window opens at 1180 × 780 px and has a 900 × 640 px minimum. The sidebar cap reserves at least 580 px for the work surface, even after a persisted resize is restored.
- `Tasks` never show fixture cards. While loading they expose a status; when empty they offer a clear next action. Task selection is a native button with a visible keyboard focus state.
- `History` and `Changes` use the tab pattern completely: `aria-controls`, `aria-labelledby`, roving tab stop and `←`/`→`, Home and End navigation.
- The documentation graph belongs only to `Project context`; `Git workspace` belongs only to `Version control`. A surface must not appear globally merely because its data is globally available.
- Respect reduced-motion preferences by removing spatial transitions from non-essential surfaces while preserving an immediate, readable state change. Explorer expansion keeps its short transition for users without that preference.
- CodeMirror stays available for the common path. Monaco and Prettier are loaded on demand when a matching language or explicit `Format` action needs them, so the first workbench render remains responsive.

## Do's and Don'ts

### Do:

- **Do** make the current task and its evidence the visual center of the workbench.
- **Do** preserve familiar IDE affordances: tree navigation, command bar, tabs, terminal and status bar.
- **Do** use semantic color for state and keep focus states visible for keyboard users.
- **Do** keep operational labels short and traceable, with paths and IDs in monospace.

### Don't:

- **Don't** turn the workbench into a marketing dashboard of equal-weight metric cards.
- **Don't** use gradients, glassmorphism or decorative illustrations in the desktop shell.
- **Don't** use Unicode glyphs as substitute icons; use inline SVG with an accessible label.
- **Don't** add a rounded container when a structural pane or simple divider communicates the relationship more clearly.
