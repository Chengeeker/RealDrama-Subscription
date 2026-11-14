# RealDrama Subscription

Independently updatable subscription packages for [RealDrama](https://github.com/Chengeeker/RealDrama).

## Usage

1. Copy the [catalog URL](https://raw.githubusercontent.com/Chengeeker/RealDrama-Subscription/main/subscription.json).
2. In RealDrama, open Settings > Source management > Subscriptions and updates, and import the URL.
3. Select the packages you want to install, then open Enable and maintain under Source management to enable them.
4. Use the subscription update controls to check for and install package updates. Updating a package does not require reinstalling the app.

You can also import a single package using this URL pattern:

```text
https://raw.githubusercontent.com/Chengeeker/RealDrama-Subscription/main/sources/<source-id>.json
```

Replace `<source-id>` with an ID from the catalog. Available entries and capabilities are defined by the catalog and the installed packages. Packages imported from local files do not participate in online update checks.

### Hongguo playback

The Hongguo `0.1.7` development package retains a consistent device identity during retries and tries the second video-model API host when the first returns an empty HTTP 200 response. It is intended to reduce intermittent episode-resolution failures, not to bypass unavailable upstream content. Playback through the Android player still requires device verification.

### TikTok beta

[TikTok beta](https://raw.githubusercontent.com/Chengeeker/RealDrama-Subscription/main/sources/tiktok.json) provides public popular videos, keyword search, and video playback through TikWM without account login. Search also accepts numeric video IDs and full TikTok video URLs. Photo posts and ads are excluded.

This is a beta package. Some videos can still fail during media DNS resolution, and availability depends on TikWM and the media service. It does not provide personalized recommendations, an account following feed, or comments.

Import the online catalog or the package link to receive updates. If the existing TikTok package was imported from a local file or a different origin, remove that package before importing the online version. Keep the package ID `tiktok` for future updates; when a stable version is released, its display name will change to `TikTok`.

### Optional account cookies

Some subscriptions require account cookies. Only provide them in the corresponding subscription settings.

1. Sign in to the relevant website in Chrome.
2. Open [Cookie-Editor](https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm) on that website. If cookies are missing, allow access to that site and reload the page.
3. Export as **Header string**, usually `key1=value1; key2=value2`. Use JSON or Netscape format only if the subscription explicitly requires it.
4. Paste the text into the subscription's Cookie field in RealDrama and save.

Cookies are login credentials. Keep them on your device and out of repositories, issues, screenshots, and messages. Grant the extension only the site access it needs. Expired cookies or additional service checks can still prevent sign-in or playback.

## Package maintenance

- `subscription.json`: catalog metadata, compatibility, capabilities, status, package paths, and SHA-256 hashes.
- `sources/*.json`: individual packages; bundles can contain separately enabled child sources.
- `programs/*.js`: subscription programs and the shared SDK.
- `build_catalog.py`: generates packages and catalog hashes.

With Python 3 installed, run from the repository root:

```sh
python3 build_catalog.py
```

On Windows, use `py -3 build_catalog.py`.

After changing a program, increment the affected package version and regenerate the packages and catalog together. Keep published package IDs stable so existing settings and update records continue to match.

## Compatibility

Updating subscriptions does not add missing native capabilities to an older client.

- The extended playback model and encrypted URLs require client `1.1.15+2235` or later.
- From client `2.2.0 (4262)`, `feedSeek` can enable feed seeking for on-demand episodes. Ordinary videos retain their default seeking behavior; live playback keeps its existing controls.
- Sources providing `danmaku` may declare an integer `danmakuWindowMs` matching their program's segment duration. Client `2.2.0` accepts 1,000–600,000 milliseconds and retains the default for older packages.
- `browserCredentialDomains` requires client `1.1.4+2224` or later. It must be a subset of `credentialDomains` and applies only to requests with `browser: true`. Cookie sessions remain isolated by source.

## Runtime

Packages declare their format and interface through `schema`, `api`, and `engine`; bundles list their sources in `children`. The program entry point is `sourceExecute(action, input, state)`.

Programs describe requests for the client's restricted native network layer. `capabilities` declares supported operations; `domains` and `credentialDomains` limit ordinary and authenticated requests. Programs cannot directly access local files, network sockets, or credential storage.

Search supports JSON pagination. Successful search and detail responses are cached for up to 60 seconds, with at most eight entries. Playback URL requests only share matching in-flight work and are not cached long-term.

## Integrity and status

The client verifies package SHA-256 hashes and limits request counts, execution time, and concurrency. A matching hash confirms agreement with the catalog, not the publisher's identity. Import only trusted subscriptions.

Keep cookies, tokens, signing material, and personal configuration out of this repository. Credentials are stored by the client and used only within package declarations and client policy.

A `draft` status indicates a development snapshot. Generation and static checks do not establish real-account access, service availability, device compatibility, or successful playback.
