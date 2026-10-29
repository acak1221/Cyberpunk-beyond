# Private hosting and invitation access

The Vercel deployment uses Supabase PostgreSQL for server-side storage. Player accounts use a username and password; players do not need an email address. A site invitation is separate from an invitation to a particular campaign.

Before opening the deployment to players:

1. Apply the database migrations, enable row-level security, and verify that public browser roles cannot read application tables. Give the server database role only the permissions it needs. Set its transaction-pooler connection string in Vercel as the production-only `DATABASE_URL` secret; require TLS certificate verification. Do not commit credentials.
2. Set `APP_BASE_URL` to the canonical HTTPS site origin and a strong random `OWNER_BOOTSTRAP_CODE` as a production-only secret. The first owner registers with that code and chooses a username and password. The code cannot create another owner after the owner account exists. Never expose the code in a public URL or repository.
3. The owner can create and revoke single-use invitation codes from the account page. Codes expire after seven days and should be shared privately. Each player registers with a code, username, and password. Passwords require at least 12 characters. Without email, email-based password recovery is unavailable; losing a password requires an owner-assisted recovery procedure, which is not yet implemented.
4. Keep the initial deployment protected until real-host tests establish that anonymous requests for `/game` pages and assets are blocked on all deployed hostnames, forged cookies and identity headers fail, a valid login works, logout revokes the session, invite codes cannot be reused, and players cannot access each other's data. Check database security advisors after applying migrations. Proxy protection also has to run before static assets on the hosting platform.
5. Do not rely on Vercel account-based deployment protection for the final player experience without checking its plan limits: players should use the application's own invitation-based login. Keep protected staging separate from production data.

The old Sites deployment and Vercel deployment have different browser origins and account IDs. Existing personal data and campaigns do not automatically migrate. Export, import, and verify user data before relying on the new site; retain the old deployment and its data until migration has been verified.

The GitHub repository is public by the owner's choice. Site access controls do not hide files that are already available in that repository.
