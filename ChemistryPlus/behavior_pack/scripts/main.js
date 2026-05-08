import { EntityDamageCause, EquipmentSlot, GameMode, ItemStack, system, world } from "@minecraft/server";

const CHLORINE_GAS_ID = "chemistry_plus:chlorine_gas";
const CARBON_DIOXIDE_ID = "chemistry_plus:carbon_dioxide";
const CHEMISTRY_REACTOR_ID = "chemistry_plus:chemistry_reactor";
const GLUCOSE_ID = "chemistry_plus:glucose";
const SALT_ID = "chemistry_plus:salt";
const SALTED_FOOD_BY_ID = new Map([
  [
    "chemistry_plus:salted_beef",
    {
      saturationAmplifier: 0,
      bonusEffect: { name: "regeneration", chance: 0.15, durationTicks: 100, amplifier: 0 }
    }
  ],
  [
    "chemistry_plus:salted_chicken",
    {
      saturationAmplifier: 0,
      bonusEffect: { name: "speed", chance: 0.15, durationTicks: 300, amplifier: 0 }
    }
  ],
  [
    "chemistry_plus:salted_porkchop",
    {
      saturationAmplifier: 0,
      bonusEffect: { name: "resistance", chance: 0.15, durationTicks: 200, amplifier: 0 }
    }
  ],
  [
    "chemistry_plus:salted_cooked_beef",
    {
      saturationAmplifier: 1,
      bonusEffect: { name: "strength", chance: 0.2, durationTicks: 400, amplifier: 0 }
    }
  ],
  [
    "chemistry_plus:salted_cooked_chicken",
    {
      saturationAmplifier: 1,
      bonusEffect: { name: "absorption", chance: 0.2, durationTicks: 600, amplifier: 0 }
    }
  ],
  [
    "chemistry_plus:salted_cooked_porkchop",
    {
      saturationAmplifier: 1,
      bonusEffect: { name: "regeneration", chance: 0.2, durationTicks: 160, amplifier: 0 }
    }
  ]
]);
const SUGAR_ID = "minecraft:sugar";
const WATER_BOTTLE_ID = "minecraft:potion";
const CARBON_ID = "minecraft:element_6";
const HYDROGEN_ID = "minecraft:element_1";
const OXYGEN_ID = "minecraft:element_8";
const SODIUM_ID = "minecraft:element_11";
const CHLORINE_ID = "minecraft:element_17";
const CHECK_INTERVAL_TICKS = 20;
const POISON_DURATION_TICKS = 60;
const POISON_AMPLIFIER = 60;
const DAMAGE_AMOUNT = 10;
const EXTRA_OXYGEN_TIMEOUT_TICKS = 100;
const MESSAGE_COOLDOWN_TICKS = 200;
const REACTOR_TRIGGER_COOLDOWN_TICKS = 10;
const FOOD_USE_COOLDOWN_TICKS = 32;
const ADJACENT_OFFSETS = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 }
];
const REACTOR_RECIPES = [
  {
    outputTypeId: GLUCOSE_ID,
    outputAmount: 1,
    ingredients: [
      { typeId: CARBON_ID, amount: 6 },
      { typeId: HYDROGEN_ID, amount: 12 },
      { typeId: OXYGEN_ID, amount: 6 }
    ]
  },
  {
    outputTypeId: SUGAR_ID,
    outputAmount: 1,
    ingredients: [
      { typeId: CARBON_ID, amount: 12 },
      { typeId: HYDROGEN_ID, amount: 22 },
      { typeId: OXYGEN_ID, amount: 11 }
    ]
  },
  {
    outputTypeId: SALT_ID,
    outputAmount: 1,
    ingredients: [
      { typeId: SODIUM_ID, amount: 1 },
      { typeId: CHLORINE_ID, amount: 1 }
    ]
  },
  {
    outputTypeId: WATER_BOTTLE_ID,
    outputAmount: 1,
    ingredients: [
      { typeId: HYDROGEN_ID, amount: 2 },
      { typeId: OXYGEN_ID, amount: 1 }
    ]
  }
];

const pendingExtraOxygenByPlayerId = new Map();
const lastMessageTickByPlayerId = new Map();
const lastReactorTriggerTickByLocation = new Map();
const lastFoodUseTickByPlayerId = new Map();

const TEXT = {
  chlorineDanger: "\u5371\u96aa\uff1a\u4f60\u8eab\u4e0a\u6709\u6c2f\u6c23\uff0c\u8acb\u52ff\u62ff\u5728\u624b\u4e0a\uff01",
  reactorSuccess: "\u53cd\u61c9\u5b8c\u6210\uff1a\u5df2\u5408\u6210\u7522\u7269\u3002"
};

function sendCooldownMessage(player, key, message, cooldownTicks = MESSAGE_COOLDOWN_TICKS) {
  const mapKey = `${player.id}:${key}`;
  const lastTick = lastMessageTickByPlayerId.get(mapKey) ?? -cooldownTicks;
  if (system.currentTick - lastTick < cooldownTicks) {
    return;
  }

  player.sendMessage(message);
  lastMessageTickByPlayerId.set(mapKey, system.currentTick);
}

function setSurvivalMode(player) {
  try {
    if (player.getGameMode() === GameMode.survival) {
      return;
    }
  } catch {
    // Continue to the command fallback when the current mode cannot be read.
  }

  let changedMode = false;

  try {
    player.setGameMode(GameMode.survival);
    changedMode = player.getGameMode() === GameMode.survival;
  } catch {
    changedMode = false;
  }

  if (!changedMode) {
    try {
      player.runCommand("gamemode survival @s");
      changedMode = true;
    } catch {
      changedMode = false;
    }
  }

  if (changedMode) {
    return;
  }
}

function warnChlorineDanger(player) {
  sendCooldownMessage(player, "chlorine_danger", TEXT.chlorineDanger);
}

function getInventoryContainer(player) {
  const inventory = player.getComponent("minecraft:inventory");
  return inventory?.container;
}

function inventoryHasChlorineGas(player) {
  try {
    const container = getInventoryContainer(player);
    if (!container) {
      return false;
    }

    for (let slot = 0; slot < container.size; slot += 1) {
      if (container.getItem(slot)?.typeId === CHLORINE_GAS_ID) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

function removeItemsFromInventory(player, typeId, amount) {
  try {
    const container = getInventoryContainer(player);
    if (!container) {
      return 0;
    }

    let remaining = amount;
    for (let slot = 0; slot < container.size && remaining > 0; slot += 1) {
      const item = container.getItem(slot);
      if (item?.typeId !== typeId) {
        continue;
      }

      const removed = Math.min(item.amount, remaining);
      remaining -= removed;

      if (item.amount === removed) {
        container.setItem(slot, undefined);
      } else {
        const updatedItem = item.clone();
        updatedItem.amount -= removed;
        container.setItem(slot, updatedItem);
      }
    }

    return amount - remaining;
  } catch {
    return 0;
  }
}

function isSurvivalLike(player) {
  try {
    const gameMode = player.getGameMode();
    return gameMode === GameMode.survival || gameMode === GameMode.adventure;
  } catch {
    return true;
  }
}

function consumeHeldItem(player, typeId) {
  try {
    const equippable = player.getComponent("minecraft:equippable");
    const heldItem = equippable?.getEquipment(EquipmentSlot.Mainhand);
    if (heldItem?.typeId !== typeId) {
      return false;
    }

    if (!isSurvivalLike(player)) {
      return true;
    }

    if (heldItem.amount <= 1) {
      equippable.setEquipment(EquipmentSlot.Mainhand, undefined);
      return true;
    }

    const updatedItem = heldItem.clone();
    updatedItem.amount -= 1;
    equippable.setEquipment(EquipmentSlot.Mainhand, updatedItem);
    return true;
  } catch {
    return removeItemsFromInventory(player, typeId, 1) > 0;
  }
}

function applyFoodEffect(player, food) {
  try {
    player.addEffect("saturation", 20, {
      amplifier: food.saturationAmplifier,
      showParticles: false
    });
  } catch {
    try {
      player.runCommand(`effect @s saturation 1 ${food.saturationAmplifier} true`);
    } catch {
      // Ignore if this edition cannot apply saturation through scripts or commands.
    }
  }

  const bonusEffect = food.bonusEffect;
  if (bonusEffect && Math.random() < bonusEffect.chance) {
    try {
      player.addEffect(bonusEffect.name, bonusEffect.durationTicks, {
        amplifier: bonusEffect.amplifier,
        showParticles: true
      });
    } catch {
      // Bonus effects are nice-to-have; eating should still succeed without them.
    }
  }
}

function playEatFeedback(player) {
  try {
    player.runCommand("playsound random.eat @s ~ ~ ~ 0.7 1.0");
  } catch {
    // The item use still works if the sound command is unavailable.
  }
}

function handleSaltedFoodUse(event) {
  const player = event.source;
  const itemStack = event.itemStack;
  const food = SALTED_FOOD_BY_ID.get(itemStack?.typeId);
  if (!player || !food) {
    return;
  }

  const lastTick = lastFoodUseTickByPlayerId.get(player.id) ?? -FOOD_USE_COOLDOWN_TICKS;
  if (system.currentTick - lastTick < FOOD_USE_COOLDOWN_TICKS) {
    return;
  }

  if (!consumeHeldItem(player, itemStack.typeId)) {
    return;
  }

  lastFoodUseTickByPlayerId.set(player.id, system.currentTick);
  applyFoodEffect(player, food);
  playEatFeedback(player);
}

function countItems(container, typeId) {
  let count = 0;
  for (let slot = 0; slot < container.size; slot += 1) {
    const item = container.getItem(slot);
    if (item?.typeId === typeId) {
      count += item.amount;
    }
  }
  return count;
}

function removeItemsFromContainer(container, typeId, amount) {
  let remaining = amount;
  for (let slot = 0; slot < container.size && remaining > 0; slot += 1) {
    const item = container.getItem(slot);
    if (item?.typeId !== typeId) {
      continue;
    }

    const removed = Math.min(item.amount, remaining);
    remaining -= removed;

    if (item.amount === removed) {
      container.setItem(slot, undefined);
    } else {
      const updatedItem = item.clone();
      updatedItem.amount -= removed;
      container.setItem(slot, updatedItem);
    }
  }

  return amount - remaining;
}

function hasRoomForItem(container, typeId) {
  let maxAmount = 64;
  try {
    maxAmount = new ItemStack(typeId, 1).maxAmount ?? 64;
  } catch {
    maxAmount = 64;
  }

  for (let slot = 0; slot < container.size; slot += 1) {
    const item = container.getItem(slot);
    if (!item) {
      return true;
    }

    if (item.typeId === typeId && item.amount < maxAmount) {
      return true;
    }
  }

  return false;
}

function containerExactlyMatchesRecipe(container, recipe) {
  const expectedByTypeId = new Map(recipe.map((ingredient) => [ingredient.typeId, ingredient.amount]));
  const actualByTypeId = new Map();

  for (let slot = 0; slot < container.size; slot += 1) {
    const item = container.getItem(slot);
    if (!item) {
      continue;
    }

    if (!expectedByTypeId.has(item.typeId)) {
      return false;
    }

    actualByTypeId.set(item.typeId, (actualByTypeId.get(item.typeId) ?? 0) + item.amount);
  }

  for (const [typeId, expectedAmount] of expectedByTypeId) {
    if ((actualByTypeId.get(typeId) ?? 0) !== expectedAmount) {
      return false;
    }
  }

  return true;
}

function getBlockContainer(block) {
  try {
    const inventory = block.getComponent("minecraft:inventory") ?? block.getComponent("inventory");
    return inventory?.container;
  } catch {
    return undefined;
  }
}

function findAdjacentContainer(block) {
  const { x, y, z } = block.location;
  for (const offset of ADJACENT_OFFSETS) {
    const adjacentBlock = block.dimension.getBlock({
      x: x + offset.x,
      y: y + offset.y,
      z: z + offset.z
    });
    const container = adjacentBlock ? getBlockContainer(adjacentBlock) : undefined;
    if (container) {
      return container;
    }
  }

  return undefined;
}

function findAdjacentReactor(block) {
  const { x, y, z } = block.location;
  for (const offset of ADJACENT_OFFSETS) {
    const adjacentBlock = block.dimension.getBlock({
      x: x + offset.x,
      y: y + offset.y,
      z: z + offset.z
    });
    if (adjacentBlock?.typeId === CHEMISTRY_REACTOR_ID) {
      return adjacentBlock;
    }
  }

  return undefined;
}

function getLocationKey(block) {
  const { x, y, z } = block.location;
  return `${block.dimension.id}:${x},${y},${z}`;
}

function shouldRunReactor(block) {
  const key = getLocationKey(block);
  const lastTick = lastReactorTriggerTickByLocation.get(key) ?? -REACTOR_TRIGGER_COOLDOWN_TICKS;
  if (system.currentTick - lastTick < REACTOR_TRIGGER_COOLDOWN_TICKS) {
    return false;
  }

  lastReactorTriggerTickByLocation.set(key, system.currentTick);
  return true;
}

function findMatchingReactorRecipe(container) {
  return REACTOR_RECIPES.find((recipe) => containerExactlyMatchesRecipe(container, recipe.ingredients));
}

function craftFromReactorContainer(container, player) {
  const recipe = findMatchingReactorRecipe(container);
  if (!recipe) {
    return;
  }

  if (!hasRoomForItem(container, recipe.outputTypeId)) {
    return;
  }

  for (const ingredient of recipe.ingredients) {
    removeItemsFromContainer(container, ingredient.typeId, ingredient.amount);
  }

  const leftover = container.addItem(new ItemStack(recipe.outputTypeId, recipe.outputAmount));
  if (leftover) {
    player.dimension.spawnItem(leftover, player.location);
  }

  player.sendMessage(TEXT.reactorSuccess);
}

function runReactor(block, player) {
  if (!shouldRunReactor(block)) {
    return;
  }

  const container = findAdjacentContainer(block);
  if (!container) {
    return;
  }

  system.run(() => craftFromReactorContainer(container, player));
}

function handleChemistryReactorInteract(event) {
  if (event.block.typeId === CHEMISTRY_REACTOR_ID) {
    runReactor(event.block, event.player);
    return;
  }

  const adjacentReactor = findAdjacentReactor(event.block);
  if (adjacentReactor) {
    runReactor(adjacentReactor, event.player);
  }
}

function handleBlockPlaced(event) {
  const block = event.block;
  if (block?.typeId !== CHEMISTRY_REACTOR_ID) {
    return;
  }

  system.runTimeout(() => runReactor(block, event.player), 1);
}

function addPendingExtraOxygen(player, amount) {
  const current = pendingExtraOxygenByPlayerId.get(player.id);
  pendingExtraOxygenByPlayerId.set(player.id, {
    remaining: (current?.remaining ?? 0) + amount,
    expiresAtTick: system.currentTick + EXTRA_OXYGEN_TIMEOUT_TICKS
  });
}

function settleExtraOxygenCost(player) {
  const pending = pendingExtraOxygenByPlayerId.get(player.id);
  if (!pending) {
    return;
  }

  const removedOxygen = removeItemsFromInventory(player, OXYGEN_ID, pending.remaining);
  pending.remaining -= removedOxygen;

  if (pending.remaining <= 0) {
    pendingExtraOxygenByPlayerId.delete(player.id);
    return;
  }

  if (system.currentTick >= pending.expiresAtTick) {
    const removedProduct = removeItemsFromInventory(player, CARBON_DIOXIDE_ID, pending.remaining);
    pending.remaining -= removedProduct;

    if (pending.remaining <= 0) {
      pendingExtraOxygenByPlayerId.delete(player.id);
    }
  }
}

function handleCarbonDioxideReceived(event) {
  const newStack = event.itemStack;
  if (newStack?.typeId !== CARBON_DIOXIDE_ID) {
    return;
  }

  const oldStack = event.beforeItemStack;
  const previousAmount = oldStack?.typeId === CARBON_DIOXIDE_ID ? oldStack.amount : 0;
  const gainedAmount = newStack.amount - previousAmount;
  if (gainedAmount <= 0) {
    return;
  }

  system.run(() => {
    const removedOxygen = removeItemsFromInventory(event.player, OXYGEN_ID, gainedAmount);
    const missingOxygen = gainedAmount - removedOxygen;
    if (missingOxygen > 0) {
      addPendingExtraOxygen(event.player, missingOxygen);
    }
  });
}

function getHeldItem(player, slot) {
  try {
    const equippable = player.getComponent("minecraft:equippable");
    return equippable?.getEquipment(slot);
  } catch {
    return undefined;
  }
}

function isHoldingChlorineGas(player) {
  const mainHand = getHeldItem(player, EquipmentSlot.Mainhand);
  if (mainHand?.typeId === CHLORINE_GAS_ID) {
    return true;
  }

  const offHand = getHeldItem(player, EquipmentSlot.Offhand);
  return offHand?.typeId === CHLORINE_GAS_ID;
}

function applyChlorineExposure(player) {
  try {
    player.addEffect("poison", POISON_DURATION_TICKS, {
      amplifier: POISON_AMPLIFIER,
      showParticles: true
    });

    player.applyDamage(DAMAGE_AMOUNT, {
      cause: EntityDamageCause.magic
    });
  } catch {
    // Ignore players that left the world or cannot be damaged in the current game mode.
  }
}

world.afterEvents.playerInventoryItemChange?.subscribe((event) => {
  if (event.itemStack?.typeId === CHLORINE_GAS_ID) {
    system.run(() => setSurvivalMode(event.player));
  }

  handleCarbonDioxideReceived(event);
});

world.afterEvents.playerInteractWithBlock?.subscribe(handleChemistryReactorInteract);
world.afterEvents.playerPlaceBlock?.subscribe(handleBlockPlaced);
world.afterEvents.itemUse?.subscribe(handleSaltedFoodUse);

system.runInterval(() => {
  for (const player of world.getPlayers()) {
    settleExtraOxygenCost(player);

    if (inventoryHasChlorineGas(player)) {
      setSurvivalMode(player);
      warnChlorineDanger(player);
    }

    if (isHoldingChlorineGas(player)) {
      applyChlorineExposure(player);
    }
  }
}, CHECK_INTERVAL_TICKS);
