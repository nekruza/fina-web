# Apple sign-in for the web

Login and signup both use Supabase's `signInWithOAuth({ provider: "apple" })` flow. The existing `/auth/callback` route exchanges the PKCE code and returns the learner to their validated `next` destination. Apple does not return a full name through this flow; the existing onboarding/profile UI collects it.

## Provider setup

Enabling Apple for native iOS login alone does not configure web OAuth. The Apple provider must also have a web Services ID and a current OAuth secret.

1. In Apple Developer, register a **Services ID** linked to the app's Sign in with Apple-enabled App ID.
2. Configure that Services ID's website domain as `<project-ref>.supabase.co` and its return URL as `https://<project-ref>.supabase.co/auth/v1/callback` (use the project's custom Auth domain instead if configured).
3. Create a Sign in with Apple signing key and generate the OAuth client secret using the Team ID, Key ID, Services ID, and private `.p8` signing key.
4. In Supabase → Authentication → Sign In / Providers → Apple, place the **web Services ID first** in Client IDs. Keep existing native app IDs after it so iOS sign-in continues working. Save the generated secret in the provider's OAuth secret field.
5. In Supabase's redirect URL allow list, include the deployed app's `/auth/callback` URL and `http://localhost:3000/auth/callback` for development. The Apple return URL from step 2 is a separate URL and points to Supabase.
6. Complete an Apple sign-in from both `/login` and `/signup`, including a first-time account and an existing account. Confirm that `next` and onboarding are preserved.

Keep the private signing key and OAuth secret out of source control and all `NEXT_PUBLIC_` variables. Apple OAuth secrets expire after at most six months; generate and save a replacement before expiry.

If authorization returns `Unsupported provider: missing OAuth secret`, finish step 4; the enabled-provider flag alone is insufficient.

Reference: [Supabase's Apple sign-in guide](https://supabase.com/docs/guides/auth/social-login/auth-apple).
