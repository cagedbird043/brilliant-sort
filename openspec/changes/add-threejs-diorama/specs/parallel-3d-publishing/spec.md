## ADDED Requirements

### Requirement: One artifact serves independent 2D and 3D entries
The production build SHALL emit the existing 2D application at `/` and the Three.js application at `/3d/` in one static artifact. Both entries SHALL reference hashed assets correctly when served at the Hong Kong origin root and at the GitHub Pages `/brilliant-sort/` project base.

#### Scenario: Root entry remains the 2D game
- **WHEN** a browser requests `/` from the root-base artifact or `/brilliant-sort/` from the Pages artifact
- **THEN** it receives the existing 2D Brilliant Sort application with unchanged gameplay and presentation behavior

#### Scenario: 3D entry resolves on both public bases
- **WHEN** a browser requests `/3d/` from the root-base artifact or `/brilliant-sort/3d/` from the Pages artifact
- **THEN** it receives the Three.js application and all JavaScript, WASM, audio-worklet, image, and source-map assets resolve without a 404

#### Scenario: Direct 3D navigation is static-host compatible
- **WHEN** the public `/3d/` URL is opened directly or refreshed
- **THEN** the static host returns the 3D entry document without requiring a server-side SPA fallback

### Requirement: 2D payload isolation
The 2D entry SHALL NOT import, initialize, or download the Three.js renderer entry during its initial page load. Shared core, audio, and fixture assets MAY remain deduplicated by the build.

#### Scenario: Existing 2D page avoids the 3D chunk
- **WHEN** a fresh browser loads only the 2D root entry
- **THEN** no WebGL renderer is created and no 3D-entry JavaScript chunk is requested

#### Scenario: 3D page can load independently
- **WHEN** a fresh browser loads the 3D entry directly
- **THEN** it initializes without first executing or mounting the 2D React application

### Requirement: Commit-aligned parallel deployment
The 2D and 3D entries in each published artifact SHALL be built from the same commit and deployed atomically. A deployment or rollback SHALL never combine a 2D entry from one commit with a 3D entry from another.

#### Scenario: Hong Kong release switches atomically
- **WHEN** the Hong Kong publish job promotes a verified release
- **THEN** the `current` symlink switches to one immutable directory containing both verified entries from the workflow commit

#### Scenario: GitHub Pages deploys one verified artifact
- **WHEN** the main-branch workflow deploys GitHub Pages
- **THEN** one Pages artifact containing both entries from the workflow commit is published through the existing `github-pages` environment

### Requirement: Parallel-route CI verification
The authoritative workflow SHALL build and exercise both entries before deployment. Desktop Chromium and Pixel 5 projects SHALL cover 3D boot, picking, an accepted gameplay transition, global-wand victory, contextual replay, and deterministic visual baselines while retaining the existing 2D suite.

#### Scenario: 3D regression blocks publication
- **WHEN** a 3D typecheck, build, browser contract, visual baseline, or public-route smoke check fails
- **THEN** the workflow fails before either Hong Kong or GitHub Pages publication

#### Scenario: 2D regression still blocks publication
- **WHEN** any existing 2D, core, audio, fixture, or OpenSpec gate fails
- **THEN** the combined artifact is not published even if every 3D check passes

### Requirement: Public route smoke verification
Deployment verification SHALL check both the existing 2D public URL and the new 3D subpath. The checks SHALL validate a successful response and route-specific built content rather than accepting an unrelated fallback document.

#### Scenario: Hong Kong routes are verified
- **WHEN** the Hong Kong release has been promoted
- **THEN** `https://brilliant-sort.cagedbird.cn/` identifies the 2D entry and `https://brilliant-sort.cagedbird.cn/3d/` identifies the 3D entry

#### Scenario: GitHub Pages routes are verified
- **WHEN** the Pages deployment completes
- **THEN** `https://cagedbird043.github.io/brilliant-sort/` identifies the 2D entry and `https://cagedbird043.github.io/brilliant-sort/3d/` identifies the 3D entry

### Requirement: No new DNS credential dependency
Publishing `/3d/` SHALL reuse the existing origins and SHALL NOT require a new Cloudflare DNS record, Cloudflare API call, or Cloudflare credential in source code, build artifacts, workflow logs, or repository configuration.

#### Scenario: Combined route deploys without Cloudflare mutation
- **WHEN** the verified combined artifact is published
- **THEN** the 3D route becomes available through the existing origin configuration without changing DNS

#### Scenario: Repository contains no Cloudflare credential
- **WHEN** tracked files and generated static artifacts are inspected
- **THEN** they contain no Cloudflare token, account credential, or user email used as an authentication secret
