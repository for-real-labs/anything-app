# Anything App

Create, revise, use, and save private mini apps on iPhone and iPad. Built with Expo SDK 57, React Native, Sign in with Apple, Supabase, Railway, and a direct Anthropic Messages request returning HTML/CSS/JavaScript.

## Development

Use Node 22.13 or later LTS. `npm ci`, `npm start`, `npm run typecheck`, `npm test`, and `npm --prefix server test`.

The three bundled starter apps work without an account. Creation requires Apple sign-in and an 18+ age declaration. New accounts receive 10 free credits; one creation or revision costs one credit. Failed jobs refund credits atomically. Operator-managed verified email allowances enable unlimited usage. No ads, analytics, subscriptions, or purchases.

App source and prompts sync to each private Supabase account. Mini app data is stored locally per account and app, capped at 200 KB. Generated code runs in an opaque sandboxed iframe with no native permissions or account credentials. A narrow validated storage bridge accepts only that app's key-value snapshot. Remote HTTPS libraries may require internet. Generated apps cannot install native apps, use camera/contacts/notifications, or make native purchases.

## Infrastructure

- [GitHub](https://github.com/for-real-labs/anything-app)
- [Railway](https://railway.com/project/267fdeb8-8b69-4b98-95ab-bf441530a1c7)
- API: https://app-api-production-e73b.up.railway.app
- [Supabase](https://supabase.com/dashboard/project/hhitfzxzxboakaefgzsv)
- [Expo](https://expo.dev/accounts/jjohnson5253/projects/anything-app)
- Bundle ID: `com.forreallabs.anythingapp`

Deploy with `npx @railway/cli up server --path-as-root --service app-api`. Secrets live only in Railway: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `APPLE_ONLY=true`. Public client settings are in `src/studio/config.ts`. Apply schema with `supabase db push`. Never commit credentials or private allowance email addresses.

The authenticated API exposes `/me`, `/apps`, `/generateApp`, `/jobs`, `/account/age`, `/reports`, and `/account`. Generation IDs are idempotent and jobs are claimed across workers; stale interrupted requests are refunded. App reports are private operator records; review unresolved `app_reports` promptly. There is no public sharing, social feed, or interaction between users. Library entries and universal links are private to their owner.

## Release

`npm run build:ios` and `npm run submit:ios`. Release evidence is in `app-store/`. Uploading is not App Review submission; verify Apple's actual review and TestFlight states.

Artwork is original SVG rendered by `npm run assets`. App Store feature images combine a continuous vector wallpaper with genuine native screenshots using `scripts/render-store.py` (Python with Pillow).
