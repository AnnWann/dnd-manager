# Shared game UI

Presentation-only React components shared by the website and future VTT adapters.

`ExperienceProgress` accepts a computed experience snapshot and formatting callback; it does not import character context, session provider, router or authentication services. The current website uses the component via a compatibility integration in `characterExperience.tsx`.

Future extracts should follow the same controlled-props pattern rather than importing website providers.
