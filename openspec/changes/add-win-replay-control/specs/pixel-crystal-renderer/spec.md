## MODIFIED Requirements

### Requirement: The presentation SHALL remain original and functional

The approved dark pixel cavern SHALL remain visible around the irregular Tux and adaptive Shelf banks. The playable surface SHALL contain no persistent branding, status copy, dashboard frame, reset control, level selector, reward, currency, inventory, lock, payment, or commercial progression affordance. During `Playing` it MAY contain exactly one implemented in-world global-wand assist, the sibling audio mute crystal, and one transient first-visit instruction sentence. After `Won`, authoritative motion, and the bounded finale settle, the wand slot SHALL become exactly one functional contextual replay control; it SHALL NOT create a dashboard or remain visible after restart. Implemented Board/Shelf interactions, bounded zoom/pan, assist, onboarding, audio mute, and replay behavior SHALL retain accessible semantics.

#### Scenario: Reviewing the completed game canvas

- **WHEN** a reviewer opens the Tux stage at desktop, square, or portrait aspect
- **THEN** the complete stage is centered and every visible interactive object performs a real implemented action
- **AND THEN** the only non-Board/Shelf controls during `Playing` are the functional audio crystal and global wand
- **AND THEN** the only non-Board/Shelf controls after settled `Won` are the functional audio crystal and contextual replay
- **AND THEN** no legacy panel, slot number, decorative economy control, or persistent instruction appears.

#### Scenario: Completing the available level

- **WHEN** `GameCorePort` reaches `Won`
- **THEN** the renderer runs the bounded shared arc-light and pixel-firework finale and leaves the solved mosaic visible
- **AND THEN** no replay action appears while authoritative motion or the finale remains active
- **AND THEN** exactly one contextual replay action appears after settlement
- **AND THEN** no completion plaque, next-level action, reward, or automatic reset appears.
