# Game core

Framework-independent game rules and calculations. The first extraction moves the existing damage affinity normalization, labeling, legacy text inference, and damage resolution into `src/damage.ts` without modifying its logic. The original import path in `src/models/combat/Damage.ts` remains available through a compatibility re-export.

Do not introduce React, browser APIs, Cloudflare or database dependencies into this package.
