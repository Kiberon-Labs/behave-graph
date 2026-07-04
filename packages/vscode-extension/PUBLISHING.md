# Publishing the VS Code extension

The extension is dual-published to the [VS Code Marketplace](https://marketplace.visualstudio.com)
and [Open VSX](https://open-vsx.org) (used by VSCodium, Cursor, Gitpod, Theia,
and other non-Microsoft VS Code builds) by
`.github/workflows/publish-extension.yml`.

## How releases flow

1. Land a change with a changeset that includes the `behave-graph` extension
   package (`pnpm changeset`).
2. Merge the changesets "Version Packages" PR on `master`.
3. `release.yml` runs `changeset publish`. The extension is a private package,
   so it is not sent to npm, but `privatePackages.tag` in
   `.changeset/config.json` makes changesets create a git tag for it.
4. The `publish-extension` job sees the extension in the published packages
   list and calls `publish-extension.yml`, which builds, packages, and
   publishes the same VSIX to both registries. The VSIX is also uploaded as a
   workflow artifact.

Both registry publishes use `--skip-duplicate`, so re-running the workflow
after a partial failure is safe: registries that already have the version are
skipped.

You can also run the workflow manually from Actions > "Publish VS Code
Extension" (needed for the very first publish, or to backfill one registry).

## One-time setup

### VS Code Marketplace (secret: `VSCE_PAT`)

1. Create the `kiberon-labs` publisher at
   https://marketplace.visualstudio.com/manage (must match `publisher` in
   `package.json`).
2. Create an Azure DevOps personal access token at https://dev.azure.com
   (User settings > Personal access tokens):
   - Organization: **All accessible organizations**
   - Scopes: **Marketplace > Manage**
3. Add it as the `VSCE_PAT` repository secret.

### Open VSX (secret: `OVSX_PAT`)

1. Log in to https://open-vsx.org with GitHub and sign the Eclipse Foundation
   publisher agreement (Profile > Settings).
2. Create an access token (Profile > Settings > Access Tokens).
3. Claim the namespace once:
   `npx ovsx create-namespace kiberon-labs -p <token>`
4. Add the token as the `OVSX_PAT` repository secret.

## Local packaging

```sh
pnpm turbo build --filter=behave-graph
pnpm --filter behave-graph run package
```

This produces `packages/vscode-extension/behave-graph.vsix`, installable via
`code --install-extension behave-graph.vsix`. Packaging uses
`--no-dependencies` because the extension host bundle (`dist/`) and webview
app (`build/`) are fully bundled by esbuild and vite; `node_modules` is never
shipped.
