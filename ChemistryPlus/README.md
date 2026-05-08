# Chemistry Plus

Minimal Minecraft Education / Bedrock Edition add-on MVP for 1.21.133-era Bedrock/Education builds.

Pack version: `1.0.18`

This add-on adds custom chemistry compound items using normal crafting table shapeless recipes. It does not modify the official Minecraft Education Compound Creator.

Crafting table recipes use native Education element items where appropriate. These require Minecraft Education, or a Bedrock world with Education features enabled.

## Items

- `chemistry_plus:carbon_dioxide`
- `chemistry_plus:hydrochloric_acid`
- `chemistry_plus:sodium_hypochlorite`
- `chemistry_plus:chlorine_gas`
- `chemistry_plus:glucose`
- `chemistry_plus:salt`
- `chemistry_plus:salt_water`
- `chemistry_plus:salted_beef`
- `chemistry_plus:salted_cooked_beef`
- `chemistry_plus:salted_porkchop`
- `chemistry_plus:salted_cooked_porkchop`
- `chemistry_plus:salted_chicken`
- `chemistry_plus:salted_cooked_chicken`
- `chemistry_plus:chemistry_reactor`

## Recipes

- `minecraft:element_6` Carbon + `minecraft:element_8` Oxygen -> `carbon_dioxide`, then Script API removes one additional Oxygen from the player's inventory
- `minecraft:element_1` Hydrogen + `minecraft:element_17` Chlorine -> `hydrochloric_acid`
- `minecraft:element_11` Sodium + `minecraft:element_17` Chlorine + `minecraft:element_8` Oxygen -> `sodium_hypochlorite`
- `hydrochloric_acid` + `sodium_hypochlorite` -> `chlorine_gas`
- `minecraft:element_11` Sodium + `minecraft:element_17` Chlorine -> `salt`
- `salt` + `minecraft:potion` Water Bottle -> `salt_water`
- `salt_water` in a Furnace -> `salt`
- `salt` + raw/cooked beef, porkchop, or chicken -> salted meat variants

All recipes are set to `AlwaysUnlocked` so they should appear in the crafting table recipe book once the behavior pack is active.

## Chlorine Gas Script Note

Pure JSON crafting recipes cannot run commands or change game mode. This pack now uses a small Script API module to switch a player to survival mode when `chemistry_plus:chlorine_gas` appears in their inventory, then applies poison and direct damage while the player is holding it.

## Chemistry Reactor

Place `chemistry_plus:chemistry_reactor` next to a chest, barrel, or other inventory block. Put native Education elements into that adjacent container:

- Carbon `minecraft:element_6` x6
- Hydrogen `minecraft:element_1` x12
- Oxygen `minecraft:element_8` x6

Tap/click the reactor, tap/click an adjacent container, or place the reactor next to a prepared container. The adjacent container must contain exactly Carbon x6, Hydrogen x12, and Oxygen x6, with no extra items and no extra amounts. If the formula is exact, the script consumes the elements, adds `chemistry_plus:glucose` x1 to the same container, and shows a success message.

The reactor also supports sucrose using Minecraft's built-in sugar item. The exact formula is `C12H22O11`:

- Carbon `minecraft:element_6` x12
- Hydrogen `minecraft:element_1` x22
- Oxygen `minecraft:element_8` x11
- Output: `minecraft:sugar` x1

The reactor also supports salt and water bottle formulas:

- Sodium `minecraft:element_11` x1
- Chlorine `minecraft:element_17` x1
- Output: `chemistry_plus:salt` x1

Water is produced as Minecraft's built-in water bottle item:

- Hydrogen `minecraft:element_1` x2
- Oxygen `minecraft:element_8` x1
- Output: `minecraft:potion` x1

## Salt Water and Salted Meat

Use a crafting table to combine:

- `chemistry_plus:salt` x1
- `minecraft:potion` water bottle x1
- Output: `chemistry_plus:salt_water` x1

Smelt `chemistry_plus:salt_water` in a furnace to evaporate the water and recover `chemistry_plus:salt` x1.

Salted meat variants are crafted in the crafting table with `chemistry_plus:salt` plus the original meat:

- `minecraft:beef` -> `chemistry_plus:salted_beef`
- `minecraft:cooked_beef` -> `chemistry_plus:salted_cooked_beef`
- `minecraft:porkchop` -> `chemistry_plus:salted_porkchop`
- `minecraft:cooked_porkchop` -> `chemistry_plus:salted_cooked_porkchop`
- `minecraft:chicken` -> `chemistry_plus:salted_chicken`
- `minecraft:cooked_chicken` -> `chemistry_plus:salted_cooked_chicken`

Salted meat restores more hunger than the original food and has a small chance to grant a positive effect when eaten.

To adjust or add reactor recipes, edit `behavior_pack/scripts/main.js`:

- `REACTOR_RECIPES`: add or change exact container formulas and outputs.
- `CHLORINE_GAS_ID`: the dangerous item detected in the player's inventory.
- `POISON_AMPLIFIER` and `DAMAGE_AMOUNT`: chlorine gas hand-held exposure strength.
- `TEXT.chlorineDanger`: the only warning message shown to players.

## Compound Creator Note

The public Bedrock recipe system does not expose Minecraft Education's Compound Creator recipes as add-on JSON. Official recipe definitions cover normal recipe systems such as shaped, shapeless, furnace, brewing, and smithing recipes.

## Texture Placeholders

The resource pack registers these texture paths:

- `resource_pack/textures/items/carbon_dioxide.png`
- `resource_pack/textures/items/hydrochloric_acid.png`
- `resource_pack/textures/items/sodium_hypochlorite.png`
- `resource_pack/textures/items/chlorine_gas.png`
- `resource_pack/textures/items/glucose.png`
- `resource_pack/textures/items/salt.png`
- `resource_pack/textures/items/salt_water.png`
- `resource_pack/textures/items/salted_beef.png`
- `resource_pack/textures/items/salted_cooked_beef.png`
- `resource_pack/textures/items/salted_porkchop.png`
- `resource_pack/textures/items/salted_cooked_porkchop.png`
- `resource_pack/textures/items/salted_chicken.png`
- `resource_pack/textures/items/salted_cooked_chicken.png`
- `resource_pack/textures/blocks/chemistry_reactor.png`

The active item PNG files are 16x16. The previous 64x64 source images are backed up under `source_textures/items_64_backup/`.

## Localization

The resource pack includes:

- `resource_pack/texts/languages.json`
- `resource_pack/texts/en_US.lang`
- `resource_pack/texts/zh_TW.lang`

## Package as .mcaddon

Minecraft Education is most reliable when the add-on imports as two `.mcpack` files. The current release packages:

- `ChemistryPlus_BP.mcpack`
- `ChemistryPlus_RP.mcpack`
- `ChemistryPlus.mcaddon`, which contains the two `.mcpack` files

PowerShell example from the repository root:

```powershell
Compress-Archive -Path .\ChemistryPlus\behavior_pack\* -DestinationPath .\ChemistryPlus_BP.zip -Force
Compress-Archive -Path .\ChemistryPlus\resource_pack\* -DestinationPath .\ChemistryPlus_RP.zip -Force
Move-Item .\ChemistryPlus_BP.zip .\ChemistryPlus_BP.mcpack -Force
Move-Item .\ChemistryPlus_RP.zip .\ChemistryPlus_RP.mcpack -Force
Compress-Archive -Path .\ChemistryPlus_BP.mcpack, .\ChemistryPlus_RP.mcpack -DestinationPath .\ChemistryPlus.zip -Force
Move-Item .\ChemistryPlus.zip .\ChemistryPlus.mcaddon -Force
```

If Minecraft Education reports a compressed archive warning when opening `ChemistryPlus.mcaddon` but still imports BP/RP, import the two `.mcpack` files separately instead.
