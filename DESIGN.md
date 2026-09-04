---
name: ADE
description: An agentic development workstation for projects, tasks, documentation, Git and local runtimes.
colors:
  workspace-bg: "#0b0f14"
  chrome: "#11171f"
  chrome-strong: "#0e1319"
  panel: "#151c25"
  panel-raised: "#1a232e"
  panel-soft: "#121920"
  line: "#293542"
  line-strong: "#3a4a5a"
  text: "#e5edf5"
  text-soft: "#b8c5d2"
  muted: "#8291a0"
  faint: "#5d6a78"
  primary-blue: "#76aef7"
  accent-cyan: "#64d2c6"
  success-green: "#70d6a0"
  warning-amber: "#e4b76b"
  error-red: "#ef8b92"
  agent-purple: "#b9a2ef"
  light-workspace-bg: "#f3f6fa"
  light-chrome: "#e8eef5"
  light-panel: "#ffffff"
  light-panel-soft: "#edf3f8"
  light-line: "#c6d2de"
  light-text: "#152231"
  light-muted: "#647689"
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

**Creative North Star: "The Agentic Workbench"**

ADE is a focused desktop workbench for software development. Its visual language is deliberately inspired by leading IDEs: the interface is organized around persistent context, dense but readable tools, keyboard-oriented controls and clear state transitions. The work surface should feel operational and calm, with every panel earning its space through a concrete development task.

The system uses dark graphite and navy chrome by default, with a deliberate light workspace theme for bright environments. Both themes keep cool text, thin structural rules and a restrained cyan accent. It is technical without becoming sterile: success, warning, error and agent states have distinct colors, while depth comes from tonal layering instead of decorative effects.

**Key Characteristics:**

- Familiar IDE grammar: labeled navigation, explorer, command bar, workbench and status bar.
- Dense information architecture with short labels and monospace operational metadata.
- Flat-by-default surfaces with thin borders and state-driven accents.
- No gradients, glassmorphism, marketing hero panels or ornamental imagery.
- Theme switching is explicit, persisted per user and never changes the information architecture.

## Colors

The palette is a dark graphite workspace with cool neutrals and a small set of semantic status colors, mirrored by a high-contrast light workspace. Cyan is the primary interaction accent and should remain scarce enough to communicate focus.

### Primary

- **Command Blue** (#76aef7): Focus rings, links and secondary interactive emphasis.
- **Workbench Cyan** (#64d2c6): Active navigation, primary actions and running states.

### Secondary

- **Agent Purple** (#b9a2ef): Provider and agent-specific metadata.

### Tertiary

- **Success Green** (#70d6a0): Healthy services, passed gates and completed work.
- **Warning Amber** (#e4b76b): Review, pending gates and caution states.
- **Error Red** (#ef8b92): Failed runtime and recovery-required states.

### Neutral

- **Workspace Black** (#0b0f14): Application canvas.
- **Graphite Chrome** (#11171f): Explorer and persistent shell surfaces.
- **Raised Panel** (#1a232e): Hovered panels and secondary controls.
- **Cool Text** (#e5edf5): Primary headings and decisions.
- **Muted Text** (#8291a0): Supporting copy.
- **Structural Line** (#293542): Panel boundaries and separators.

### Light Theme

- **Light Workspace** (#f3f6fa): Alternate application canvas.
- **Light Chrome** (#e8eef5): Sidebar and toolbar surfaces.
- **Light Panel** (#ffffff): Workbench panes and content surfaces.
- **Light Soft Surface** (#edf3f8): Inputs, code surfaces and raised controls.
- **Light Text** (#152231): Primary headings and decisions.
- **Light Muted** (#647689): Supporting copy.

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

The desktop shell is a two-column IDE frame: one labeled workbench navigation/sidebar and a flexible workbench. The sidebar combines familiar view labels with a persistent project explorer, avoiding duplicate navigation surfaces. A sticky top command bar anchors project context and global actions. The explorer owns a filterable, lazily expanded tree so project navigation stays available while switching views. The main work area uses a 15px panel rhythm and 1px structural gaps so adjacent panes read as one instrument rather than a grid of unrelated cards. A fixed native PTY dock remains available at the bottom, above the full-width status bar, and can be resized by drag or keyboard.

At narrower desktop widths, the workbench collapses the project context panes into one column and the metric strip and knowledge surfaces reduce to two columns. The labeled sidebar remains visible so navigation never disappears.

## Elevation & Depth

ADE is flat-by-default. Depth is conveyed by tonal steps between the canvas, chrome, panel and raised-panel colors, plus thin borders. Shadows are reserved for transient surfaces such as the task dialog and toast; the persistent workspace should not look like a stack of floating cards.

**The Flat Workbench Rule.** A surface earns elevation only when it is transient or interactive; persistent IDE panes use tonal layering and structural lines.

## Shapes

The form language is compact and restrained: mostly square corners, 2–4px radii for controls and dialogs, and no pill-shaped containers except compact status treatments where the state benefit is clear. Borders are 1px and low-contrast at rest, becoming blue or cyan on focus and active states.

## Components

### Buttons

- **Shape:** Compact squared controls (3px radius).
- **Primary:** Cyan background with dark text, 6px 11px padding and a 30px minimum height.
- **Hover / Focus:** Brighten slightly on hover; use a visible blue focus ring for keyboard navigation.
- **Secondary / Ghost:** Raised graphite for secondary actions; ghost text buttons for low-priority links.

### Cards / Containers

- **Corner Style:** Usually square; 0px for pane surfaces and 3–4px for transient containers.
- **Background:** Use the panel hierarchy rather than white cards.
- **Shadow Strategy:** No persistent shadow; dialog and toast may use ambient shadow.
- **Border:** 1px structural line where a pane boundary improves scanning.
- **Internal Padding:** 12–17px for content panes.

### Inputs / Fields

- **Style:** Dark panel-soft field, 1px line-strong border, 2px radius and monospace text for commands/paths.
- **Focus:** Blue outline and line-color shift; never rely on color alone.
- **Error / Disabled:** Error uses red semantic text; disabled controls reduce opacity and retain their labels.

### Navigation

- **Style:** A single labeled navigation controls views inside the project sidebar; the same sidebar owns the Explorer below it. Active items use a 2px cyan edge and a slightly raised surface. Utility actions expose their labels as well as their keyboard affordances.
- **Interaction:** Hover changes surface and text contrast; focus remains visible; labels and ARIA names are always available for icon-only controls.

### Explorer

The explorer is persistent, filterable and lazily expanded. In compact mode it shows the active file's parent branch from the Project root as a constant path hint, hiding sibling noise. Selecting Expand switches the sidebar into tree focus mode: labeled view navigation disappears, the full tree becomes the primary surface, and directory rows can be explored recursively. Collapse restores navigation and the compact active-file branch. Directory rows have a clear disclosure affordance, file rows open through the native shell, and symlinks are visibly non-actionable when they leave the selected project root.

### Terminal Dock

- **Behavior:** The native PTY dock is always available above the status bar. Its top grip resizes the panel by pointer; focused resizing also supports Arrow keys, Shift+Arrow larger steps, Home and End. The chosen height is persisted for the active Project.

The native terminal is a fixed bottom dock with one real command field, an explicit Run action, live output and the current Project path. It is present across views and can be focused from the breadcrumb-area command actions.

### Workbench Pane

The signature component is the IDE workbench: task intent, changed files, verification, agent session context and native terminal appear as coordinated panes. Keep the active task visually anchored with a cyan edge or active tab, and expose evidence without hiding it behind decorative summaries.

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
