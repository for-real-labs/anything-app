# Anything App 1.0.0

Bundle: `com.forreallabs.anythingapp`. Expo project: `b6b3bb9f-8ad1-4e93-beb7-d297bc03e6d7`. App Store Connect: `6829362322`.

Native simulator build `9a77ef8b-ffdd-42c5-a4c1-b09a893a93c3` supplied the matching SDK 57 binary. JavaScript-only fixes were verified in that binary using production Hermes exports. No native dependencies or entitlements changed. Production releases use normal EAS cloud builds.

Verified on iPhone 16 Pro Max and iPad Pro 13-inch, iOS 18.3: app launch, library, bundled tools, generation, saved app reopening, revision retaining its saved status, cross-device source sync, per-app local data persistence after relaunch, sign-out, and native Apple sign-in sheet. A disposable synthetic test identity exercised the authenticated flow. The simulator has no Apple Account signed in, so a real Apple identity-token round trip was not completed; Apple capability, bundle ID, Supabase provider, and nonce flow were inspected.

Automated checks: TypeScript, seven storage/sandbox tests, three generator/auth tests, production iOS export, Expo dependency compatibility, PostgreSQL credit/allowance/RLS regression, and live generation/revision with separate test accounts. Tests verified idempotent charging, refunds, cross-user isolation, save state, and unlimited access. Final wrapper preserves the doctype and standards mode, places storage before app scripts, and enables scrolling.

App Store assets: three continuous panels per device, genuine simulator captures, original SVG icon and wallpaper, licensed DM Sans. See `design/screenshot-provenance.json`. No image-generation spend. Privacy disclosures are published and cover linked email, user ID, app prompts/code, support reports, and usage necessary for credits; no tracking. App is free, rated 18+, with 10 creation/revision credits per new account.

Production build 4 passed Apple processing and is IN_BETA_TESTING for Jake’s internal Team group. Version 1.0.0 is WAITING_FOR_REVIEW, with automatic release after approval. The exact production Hermes bundle was also launched in the matching simulator binary. See `release-status.json`, `validation.json`, and `archive-verification.json`.
