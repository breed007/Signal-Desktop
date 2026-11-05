# Releasing Backchannel for Mac

`.github/workflows/mac.yml` builds, signs, notarizes and publishes. This
page covers the one-time setup and each release.

## One-time setup

### Signing secrets

In this repository's Settings > Secrets and variables > Actions, add all
five, or none:

| Secret | What |
|---|---|
| `MAC_CERTIFICATE_P12` | A Developer ID Application certificate with its private key, exported from Keychain Access as .p12, then `base64 -i cert.p12 \| pbcopy`. |
| `MAC_CERTIFICATE_PASSWORD` | The password chosen at export. |
| `APPLE_ID` | The Apple ID that notarizes, a member of the certificate's team. |
| `APPLE_APP_SPECIFIC_PASSWORD` | An app-specific password for that Apple ID (account.apple.com > Sign-In and Security). |
| `APPLE_TEAM_ID` | The 10-character team ID shown in the certificate's name. |

Without them the workflow still builds and smoke-tests an ad-hoc signed
app, keeps it as a workflow artifact for 14 days, and publishes nothing.
Gatekeeper blocks that build on any Mac that downloads it, unless the
quarantine flag is removed by hand
(`xattr -dr com.apple.quarantine Backchannel.app`), so it's for testing
only.

### Homebrew tap

1. Create the public repository `mikesimone/homebrew-backchannel` with a
   README, so it has a `main` branch for the cask to land on.
2. Make a fine-grained token with Contents: read and write on that
   repository only, and add it here as the secret `HOMEBREW_TAP_TOKEN`.

Without the token, copy `backchannel.rb` from the workflow's artifact to
`Casks/` by hand after each release.

## Each release

1. Merge the Signal Desktop release you want into `main` and check that the
   helper tests pass. A build expires 90 days after the commit it's built
   from, so rebuilding an old commit doesn't buy time.
2. Tag and push:

   ```sh
   git tag backchannel-mac-v1.11
   git push origin backchannel-mac-v1.11
   ```

3. The workflow builds on `macos-26`, starts the app and checks that the
   helper serves the page, notarizes the app and the DMG, and publishes the
   release with the DMG, the ZIP and `SHA256SUMS`. The tap job then pushes
   the cask.
4. Check the release on a Mac that never ran a dev build:
   `brew install --cask mikesimone/backchannel/backchannel`, open it, link
   it, approve the page.

The release number goes in the file names and the build number
(`CFBundleVersion`). The app's own version stays Signal Desktop's, because
Signal's servers and the expiry check read it.

To try the workflow without releasing, run it from the Actions tab
(workflow_dispatch) with any version; it never publishes.

## For the front-door README

Once the first signed release is out, this goes in `mikesimone/backchannel`'s
README, after Quick start:

````markdown
## On a Mac

Backchannel for Mac is Signal Desktop with the page built in: no server,
no Docker. It needs an Apple Silicon Mac with macOS 14 or later.

```sh
brew install --cask mikesimone/backchannel/backchannel
```

Or download the DMG from the
[releases](https://github.com/mikesimone/Signal-Desktop/releases) and drag
Backchannel to Applications.

Open it and link it to your phone like Signal Desktop (Settings > Linked
devices > Link new device). Signal then asks whether to allow
"Backchannel": allow it, and the page opens in Backchannel's own window.
It keeps its data apart from Signal Desktop, so both can run at once.

Update with `brew upgrade --cask backchannel`, at least every couple of
months: each build stops working 90 days after it's made.
````
