# Session protocol

Cross-runtime TypeScript contracts shared by the website and Cloudflare session server.

This package must remain independent of React, browser APIs, Cloudflare APIs, Prisma, and game UI modules.

First migration: `InitiativeHpApplicationResult`. Future operations and messages should be migrated incrementally, preserving wire compatibility and behavior.
