- Evolution inputs are `assetA_mint`, `assetA_metadata`, `catalystB_mint`, `catalystB_metadata`, and `walletPublicKey`.
- Verify ownership of Asset A and Catalyst B before mutation; re-check Catalyst B right before burn/mint.
- Catalyst B is burned/consumed; Asset A is never burned and remains with the user.
- Mutated NFT attributes are derived by iterating over Asset A attributes and appending tier to each value.
- If an attribute value ends with ` T1`, ` T2`, or ` T3`, strip it first before appending the new tier.
- Category is derived only from Asset A traits via `deriveCategory(attributesA)` and stored in metadata.
- Mutated metadata contains a `mutation` object with parent/catalyst lineage and versioning.
- Fail with clear errors on missing assets, invalid tier, transaction failure, or malformed metadata.

State machine (UX):
1) Idle: wallet not connected
2) Ready: wallet connected, user has eligible Asset A + Catalyst B
3) Armed: user selected 1 Asset A + 1 Catalyst B
4) Processing: evolve transaction running (button disabled)
5) Success: show tx signature + new Mutated mint
6) Fail: show error + return to Armed
