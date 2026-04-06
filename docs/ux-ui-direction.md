# MAXIWA KPI UX/UI Direction

## Design intent
The new experience should feel:
- premium
- intelligent
- calm
- decisive
- executive

This should not look like a generic admin panel.

It should also feel complete and self-contained, so users never feel they need a technical person to fix data manually in the database.

## Visual direction
- Tone
  - modern executive operations center
  - high contrast but not harsh
  - premium materials and restrained motion
- Layout
  - bold dashboard headers
  - modular card system
  - clean segmentation between summary and details
- Hierarchy
  - top layer: decision metrics
  - middle layer: workload and risk
  - lower layer: detailed task operations

## Recommended design language
- Typography
  - English/UI: `Manrope` or `Satoshi`
  - Thai support pairing: `IBM Plex Sans Thai` or `Noto Sans Thai`
- Color system
  - Base: graphite, slate, soft ivory
  - Accent: deep teal or cobalt
  - Success: emerald
  - Warning: amber
  - Danger: vermilion
- Surfaces
  - layered cards with subtle translucency or soft gradients
  - premium shadows, not heavy neon

## UX principles by screen

### Dashboard
- Show only the numbers that drive action
- Prioritize risk and trend before raw lists
- Every chart must answer a management question

### Task center
- Fast filters first
- Inline actions for high-frequency updates
- Make status, owner, SLA, and due risk visible without opening detail

### Job tracker
- Make the distinction between `Job` and `Task` explicit
- Show grouped timeline elegantly
- Warn users when records appear highly similar

### Admin
- Convert dense forms into guided setup flows
- Use side panels and sections instead of crowded modals where possible
- Make every admin action feel safe, explainable, and fully application-driven
- Design screens so admins can operate confidently without technical database knowledge

## Interaction patterns
- Command-bar style quick actions for:
  - assign task
  - update status
  - search job
  - jump to staff
- Sticky filter bars on data-heavy pages
- Right-side detail drawer for task inspection
- Expand/collapse only when it reduces clutter
- Guided confirmation flows for sensitive admin actions instead of raw destructive controls

## Executive dashboard concept
- Top hero strip
  - SLA health
  - completion performance
  - at-risk jobs
  - pending approvals
- Middle zone
  - team scorecards
  - trend graph
  - bottleneck heatmap
- Bottom zone
  - exceptions queue
  - recent critical updates
  - job risk tracker

## Avoid
- flat, generic white admin layout
- purple-heavy default SaaS look
- overusing dense tables as the first layer
- putting every KPI on the same visual weight
- noisy gradients or decorative motion without information value
- exposing technical database concepts to operational users when the system can abstract them

## MAXIWA KPI homepage feel
- Strong wordmark
- Sophisticated dark-light layered background
- Editorial spacing
- Premium metric cards
- Crisp iconography
- Modern, boardroom-ready atmosphere
