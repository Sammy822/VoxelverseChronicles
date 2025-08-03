
            import React, { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
            import ReactDOM from 'react-dom/client';
            import { ethers } from 'ethers';
            import * as PIXI from 'pixi.js';
            import { EffectsManager } from './pixiEffects';
            import './index.css';

            // --- New Seeded Random Class to fix PIXI.Random issue ---
            class SeededRandom {
                private seed: number;

                constructor(seed: number) {
                    this.seed = seed;
                }

                private next(): number {
                    // A simple mulberry32 PRNG
                    let t = this.seed += 0x6D2B79F5;
                    t = Math.imul(t ^ t >>> 15, t | 1);
                    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
                    this.seed = t;
                    return ((t ^ t >>> 14) >>> 0) / 4294967296;
                }
                
                public realInRange(min: number, max: number): number {
                    return this.next() * (max - min) + min;
                }

                public bool(probability: number = 0.5): boolean {
                    return this.next() < probability;
                }
            }


            // Type definitions
            declare global {
                interface Window {
                    ethereum?: any;
                    soundSystem?: any;
                }
            }

            // Helper function to correctly encode UTF-8 strings to Base64
            function utf8_to_b64(str: string) {
                try {
                    return window.btoa(unescape(encodeURIComponent(str)));
                } catch (e) {
                    console.error("b64 encoding failed for:", str);
                    return window.btoa("invalid_string");
                }
            }


            // Enhanced Types & Interfaces
            interface Position {
                x: number;
                y: number;
            }

            interface Velocity {
                x: number;
                y: number;
            }

            interface StatusEffect {
                id: 'poison' | 'stun' | 'attack_buff' | 'defense_buff' | 'luck_buff';
                duration: number; // in seconds
                damage?: number; // per second for DoT like poison
                interval?: number; // how often it ticks
                lastTick?: number; // timestamp of the last tick
                potency?: number; // for buffs like +20% attack
            }

            interface Entity {
                id: string;
                type: 'player' | 'enemy' | 'item' | 'npc' | 'projectile' | 'effect' | 'boss';
                position: Position;
                velocity?: Velocity;
                sprite: string;
                stats?: CharacterStats;
                item?: ItemData;
                aiState?: 'idle' | 'patrol' | 'chase' | 'attack' | 'flee' | 'special_attack' | 'casting' | 'stunned';
                lastMove?: number;
                attackCooldown?: number;
                specialAttackCooldown?: number;
                skillCooldowns: Record<string, number>;
                facing?: 'up' | 'down' | 'left' | 'right';
                health?: number;
                maxHealth?: number;
                statusEffects: StatusEffect[];
            }

            interface DungeonTile {
                type: 'floor' | 'wall' | 'door' | 'chest' | 'exit' | 'trap' | 'portal';
                explored: boolean;
                entity?: Entity;
                decoration?: string;
                effect?: 'fire' | 'poison' | 'ice' | 'heal' | 'boss_warning';
                isDestructible?: boolean;
                health?: number; // For destructible walls
            }

            interface CharacterStats {
                level: number;
                health: number;
                maxHealth: number;
                mana: number;
                maxMana: number;
                attack: number;
                defense: number;
                speed: number;
                critChance: number;
                experience: number;
                experienceToNext: number;
                // New Deeper Stats
                cooldownReduction: number;
                lifesteal: number;
                manasteal: number;
                magicFind: number;
                goldFind: number;
                aoeSize: number;
            }

            interface GemData {
                id: string;
                name: string;
                type: 'ruby' | 'sapphire' | 'emerald' | 'diamond' | 'onyx';
                level: number;
                stats: { [key: string]: number };
                icon: string;
            }

            interface ItemData {
                id: string;
                name: string;
                nameEn?: string;
                description: string;
                rarity: 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythic';
                type: 'weapon' | 'armor' | 'accessory' | 'consumable' | 'material' | 'gem';
                slot?: 'weapon' | 'helmet' | 'chest' | 'pants' | 'boots' | 'accessory';
                stats?: { [key: string]: number };
                value: number;
                icon: string;
                quantity?: number;
                isNFT?: boolean;
                tokenId?: string;
                uniqueId?: string; // Every item has unique ID for NFT-ready
                enhancement: number;
                maxSockets: number;
                sockets: (GemData | null)[];
                gemData?: GemData;
                isLegacy?: boolean;
            }

            interface BuildingData {
                id: string;
                name: string;
                icon: string;
                description: string;
                purchaseCost: number;
                unlocked: boolean;
            }

            interface SaveData {
                version: string;
                playerStats: CharacterStats;
                inventory: ItemData[];
                maxInventorySlots: number;
                equipment: { [key: string]: ItemData | null };
                buildings: BuildingData[];
                resources: Resources;
                settings: GameSettings;
                lastSaved: number;
                dungeonProgress: number;
                totalPlayTime: number;
                achievements: string[];
                // New Save Data
                ascensionLevel: number;
                ascensionPoints: number;
                ascensionUpgrades: { [key: string]: number };
                skillPoints: number;
                learnedSkills: Record<string, number>;
                museumItems: { [setId: string]: ItemData[] }; // setID -> ItemData[]
                unlockedSkills: string[];
                activeSkills: (string | null)[];
            }

            interface Resources {
                gold: number;
                gems: number;
                materials: {
                    iron: number;
                    leather: number;
                    crystal: number;
                    corruptedCrystals: number;
                };
                guardianShards?: number;
            }

            interface GameSettings {
                soundEnabled: boolean;
                musicVolume: number;
                sfxVolume: number;
                language: 'th' | 'en';
                autoSave: boolean;
            }

            interface SkillData {
                id: string;
                name: string;
                icon: string;
                description: string;
                manaCost: number;
                cooldown: number;
                damage?: number;
                effect?: string;
                range?: number;
                area?: number;
                isUtility?: boolean;
                duration?: number;
            }

            interface VisualEffect {
                id: string;
                type: 'damage' | 'heal' | 'skill' | 'levelup' | 'item';
                position: Position;
                value?: string | number;
                color?: string;
                duration: number;
                startTime: number;
            }

            interface Biome {
                id: string;
                name: string;
                tilesets: {
                    floor: number[];
                    wall: number[];
                    decorations: string[];
                };
                enemyTypes: string[];
                ambientColor?: string;
            }

            interface CraftingRecipe {
                id: string;
                name: string;
                description: string;
                icon: string;
                result: { name: string; quantity: number }; // Name of the item to produce
                cost: { [materialId: string]: number }; // e.g., { iron: 2, crystal: 1 }
                goldCost: number;
                rarity: ItemData['rarity'];
            }

            // --- New System Interfaces ---
            interface SkillTreeNode {
                id: string;
                name: string;
                description: string;
                icon: string;
                type: 'active_unlock' | 'passive';
                cost: number;
                dependencies: string[];
                maxLevel?: number;
                getBonus?: (level: number, stats: CharacterStats) => Partial<CharacterStats>;
                unlocksSkill?: string; // ID of the skill to unlock
                position: { x: number; y: number };
            }

            interface AscensionUpgrade {
                id: string;
                name: string;
                description: (level: number) => string;
                icon: string;
                maxLevel: number;
                costPerLevel: (level: number) => number;
            }

            interface MuseumSet {
                id: string;
                name: string;
                itemNames: string[]; // English names for matching
                bonus: { [key: string]: number };
                bonusDescription: string;
            }

            type GameScreen = 'camp' | 'dungeon' | 'inventory' | 'shop' | 'forge' | 'settings' | 'alchemist' | 'skillTree' | 'museum' | 'ascension' | 'soulforge';
            type ModalType = 'settings' | 'leaveDungeon' | 'ascend' | 'purchaseBuilding' | 'itemActions' | 'sellItemConfirm' | 'sellMultipleConfirm' | 'playerDefeated';
            type MobileInventoryTab = 'inventory' | 'equipment' | 'stats';
            type ForgeTab = 'enhance' | 'socket' | 'combine';
            type SkillScreenTab = 'passive' | 'active';
            type InventoryFilter = 'all' | 'weapon' | 'armor' | 'accessory' | 'item' | 'nft' | 'gem' | 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythic';


            // Constants
            const SAVE_VERSION = '1.8.0'; // Bump version for progression/ascension/skill fixes
            const DUNGEON_SIZE = { width: 40, height: 30 };
            const TILE_SIZE = 32;
            const VISION_RANGE = 10; 
            const PLAYER_SIZE = 0.3; // Bounding box half-width for collision
            const ENEMY_MOVE_SPEED = 2;
            const ATTACK_RANGE = 1.5;
            const SHOP_REFRESH_INTERVAL = 15 * 60; // 15 minutes in seconds
            const INITIAL_INVENTORY_SLOTS = 36;
            const MAX_ENHANCEMENT = 15;
            const MAX_LEVEL = 50;

            const inventoryCategoryFilters = [
                { filter: 'all', icon: '📜', label: 'ทั้งหมด' },
                { filter: 'weapon', icon: '⚔️', label: 'อาวุธ' },
                { filter: 'armor', icon: '🛡️', label: 'เกราะ' },
                { filter: 'accessory', icon: '💍', label: 'เครื่องประดับ' },
                { filter: 'gem', icon: '💎', label: 'อัญมณี' },
                { filter: 'item', icon: '🧪', label: 'ไอเทม' },
                { filter: 'nft', icon: '✨', label: 'NFT' }
            ] as const;

            // Biome definitions
            const BIOMES: { [key: string]: Biome } = {
                forest: {
                    id: 'forest',
                    name: 'The Whispering Woods',
                    tilesets: {
                        floor: [0x6B8E23, 0x556B2F, 0x7C9D42],
                        wall: [0x5A5A5A, 0x4d382c, 0x6B4226],
                        decorations: ['🌺', '🌸', '🍄', '🪨']
                    },
                    enemyTypes: ['wolf', 'goblin', 'treant'],
                    ambientColor: '#1e2d24'
                },
                crypts: {
                    id: 'crypts',
                    name: 'The Sunken Crypts',
                    tilesets: {
                        floor: [0x696969, 0x708090, 0x778899],
                        wall: [0x4A4A4A, 0x363636, 0x2A2A2A],
                        decorations: ['💀', '🕸️', '⚰️', '🕯️']
                    },
                    enemyTypes: ['skeleton', 'zombie', 'wraith'],
                    ambientColor: '#3d3d5c'
                },
                volcano: {
                    id: 'volcano',
                    name: 'The Volcanic Forge',
                    tilesets: {
                        floor: [0x8B4513, 0xA0522D, 0x800000],
                        wall: [0x6B2A00, 0x4D2000, 0x331500],
                        decorations: ['🔥', '💎', '⚒️', '🛡️']
                    },
                    enemyTypes: ['imp', 'golem', 'drake'],
                    ambientColor: '#8b2500'
                }
            };

            // Enemy definitions
            const ENEMY_TYPES: { [key: string]: { sprite: string; health: number; attack: number; defense: number; speed: number; exp: number; drops: { [key: string]: number }; skills?: { id: string; cooldown: number; chance: number }[] } } = {
                // Forest enemies
                wolf: { sprite: '🐺', health: 30, attack: 8, defense: 2, speed: 3, exp: 15, drops: { leather: 0.5, corruptedCrystals: 0.05 } },
                goblin: { sprite: '👺', health: 25, attack: 6, defense: 1, speed: 2, exp: 10, drops: { leather: 0.2, iron: 0.1, corruptedCrystals: 0.02 } },
                treant: { sprite: '🌳', health: 50, attack: 10, defense: 5, speed: 1, exp: 25, drops: { leather: 0.3, crystal: 0.1, corruptedCrystals: 0.1 } },
                
                // Crypt enemies
                skeleton: { sprite: '💀', health: 20, attack: 5, defense: 1, speed: 2, exp: 12, drops: { iron: 0.3, corruptedCrystals: 0.15 } },
                zombie: { sprite: '🧟', health: 35, attack: 7, defense: 3, speed: 1, exp: 18, drops: { leather: 0.4, corruptedCrystals: 0.1 } },
                wraith: { sprite: '👻', health: 25, attack: 12, defense: 0, speed: 4, exp: 30, drops: { crystal: 0.3, corruptedCrystals: 0.2 } },
                
                // Volcano enemies
                imp: { sprite: '👹', health: 15, attack: 6, defense: 1, speed: 4, exp: 20, drops: { crystal: 0.2, iron: 0.2, corruptedCrystals: 0.18 } },
                golem: { sprite: '🗿', health: 50, attack: 12, defense: 8, speed: 1, exp: 40, drops: { iron: 0.8, crystal: 0.2, corruptedCrystals: 0.3 } },
                drake: { 
                    sprite: '🐉', health: 70, attack: 18, defense: 5, speed: 2, exp: 60, drops: { leather: 0.5, crystal: 0.4, corruptedCrystals: 0.4 },
                    skills: [{ id: 'fire_breath', cooldown: 8, chance: 0.3 }]
                },

                // Boss
                boss: { 
                    sprite: '👿', health: 500, attack: 40, defense: 20, speed: 2, exp: 1000, drops: { corruptedCrystals: 1.0 },
                    skills: [{ id: 'aoe_stomp', cooldown: 8, chance: 1.0 }] // Boss special attack is now a skill
                }
            };

            const GEM_TYPES: { [key in GemData['type']]: Omit<GemData, 'id' | 'level'> } = {
                ruby: { name: 'Ruby', type: 'ruby', icon: '❤️‍🔥', stats: { attack: 5 } },
                sapphire: { name: 'Sapphire', type: 'sapphire', icon: '💙', stats: { maxMana: 20 } },
                emerald: { name: 'Emerald', type: 'emerald', icon: '💚', stats: { critChance: 2 } },
                diamond: { name: 'Diamond', type: 'diamond', icon: '💎', stats: { defense: 8 } },
                onyx: { name: 'Onyx', type: 'onyx', icon: '🖤', stats: { lifesteal: 1 } }
            };


            const CONSUMABLE_ITEMS_BASE: Omit<ItemData, 'id' | 'uniqueId' | 'quantity' | 'enhancement' | 'maxSockets' | 'sockets'>[] = [
                { name: 'ยาฟื้นฟู', description: 'ฟื้นฟู HP 100', rarity: 'common', type: 'consumable', stats: { heal: 100 }, value: 20, icon: '🧪' },
                { name: 'ยามานา', description: 'ฟื้นฟู Mana 50', rarity: 'common', type: 'consumable', stats: { mana: 50 }, value: 25, icon: '💙' },
                { name: 'ยาฟื้นฟูชั้นสูง', description: 'ฟื้นฟู HP 300', rarity: 'uncommon', type: 'consumable', stats: { heal: 300 }, value: 50, icon: '🧪' },
                { name: 'ยาเพิ่มพลังโจมตี', description: 'เพิ่มพลังโจมตี 20% เป็นเวลา 30 วินาที', rarity: 'rare', type: 'consumable', stats: { attack_buff: 20 }, value: 100, icon: '🔥' },
                { name: 'ยาเพิ่มเกราะ', description: 'เพิ่มพลังป้องกัน 30% เป็นเวลา 30 วินาที', rarity: 'rare', type: 'consumable', stats: { defense_buff: 30 }, value: 100, icon: '🛡️' },
                { name: 'ยาอายุวัฒนะ', description: 'ฟื้นฟู HP และ Mana เต็ม', rarity: 'legendary', type: 'consumable', stats: { full_restore: 1 }, value: 500, icon: '💖' },
                { name: 'โพชั่นแห่งโชค', nameEn: 'Potion of Luck', description: 'เพิ่ม Magic Find และ Gold Find 25% ชั่วคราว', rarity: 'rare', type: 'consumable', stats: { luck_buff: 25 }, value: 200, icon: '🍀' }
            ];

            // Master list of all possible base items for lookup
            const ALL_BASE_ITEMS: Omit<ItemData, 'id' | 'uniqueId' | 'description' | 'quantity' | 'isNFT' | 'tokenId' | 'enhancement' | 'maxSockets' | 'sockets'>[] = [
                ...CONSUMABLE_ITEMS_BASE,
                // From shop
                { name: 'ดาบเหล็ก', nameEn: 'Steel Sword', icon: '⚔️', value: 200, type: 'weapon', slot: 'weapon', stats: { attack: 15 }, rarity: 'common' },
                { name: 'โล่เหล็ก', nameEn: 'Steel Shield', icon: '🛡️', value: 150, type: 'armor', slot: 'chest', stats: { defense: 10 }, rarity: 'common' },
                { name: 'รองเท้าวิ่ง', nameEn: 'Running Boots', icon: '👢', value: 100, type: 'armor', slot: 'boots', stats: { speed: 2 }, rarity: 'common' },
                { name: 'แหวนพลัง', nameEn: 'Ring of Power', icon: '💍', value: 300, type: 'accessory', slot: 'accessory', stats: { attack: 5, defense: 5 }, rarity: 'uncommon' },
                { name: 'ดาบราชันย์', nameEn: "King's Blade", icon: '🗡️', value: 2500, type: 'weapon', slot: 'weapon', stats: { attack: 50, critChance: 10 }, rarity: 'legendary' },
                { name: 'เกราะเทวะ', nameEn: 'Divine Armor', icon: '🛡️', value: 5000, type: 'armor', slot: 'chest', stats: { defense: 40, health: 100 }, rarity: 'mythic' },
                // From generateRandomItem (base names)
                { name: 'ดาบ', nameEn: 'Sword', icon: '⚔️', type: 'weapon', slot: 'weapon', rarity: 'common', value: 10 },
                { name: 'ขวาน', nameEn: 'Axe', icon: '🪓', type: 'weapon', slot: 'weapon', rarity: 'common', value: 10 },
                { name: 'คทา', nameEn: 'Scepter', icon: '🔱', type: 'weapon', slot: 'weapon', rarity: 'common', value: 10 },
                { name: 'หอก', nameEn: 'Spear', icon: '🗡️', type: 'weapon', slot: 'weapon', rarity: 'common', value: 10 },
                { name: 'ธนู', nameEn: 'Bow', icon: '🏹', type: 'weapon', slot: 'weapon', rarity: 'common', value: 10 },
                { name: 'มีด', nameEn: 'Dagger', icon: '🔪', type: 'weapon', slot: 'weapon', rarity: 'common', value: 10 },
                { name: 'เกราะ', nameEn: 'Armor', icon: '🛡️', type: 'armor', slot: 'chest', rarity: 'common', value: 10 },
                { name: 'หมวก', nameEn: 'Helmet', icon: '🎩', type: 'armor', slot: 'helmet', rarity: 'common', value: 10 },
                { name: 'รองเท้า', nameEn: 'Boots', icon: '👢', type: 'armor', slot: 'boots', rarity: 'common', value: 10 },
                { name: 'กางเกง', nameEn: 'Pants', icon: '👖', type: 'armor', slot: 'pants', rarity: 'common', value: 10 },
                { name: 'ถุงมือ', nameEn: 'Gloves', icon: '🧤', type: 'armor', slot: 'helmet', rarity: 'common', value: 10 }, // Note: Slot is helmet in original code
                { name: 'แหวน', nameEn: 'Ring', icon: '💍', type: 'accessory', slot: 'accessory', rarity: 'common', value: 10 },
                { name: 'สร้อยคอ', nameEn: 'Necklace', icon: '📿', type: 'accessory', slot: 'accessory', rarity: 'common', value: 10 },
                { name: 'ตุ้มหู', nameEn: 'Earring', icon: '💎', type: 'accessory', slot: 'accessory', rarity: 'common', value: 10 },
                { name: 'กำไล', nameEn: 'Bracelet', icon: '⌚', type: 'accessory', slot: 'accessory', rarity: 'common', value: 10 },
            ];

            const CRAFTING_RECIPES: CraftingRecipe[] = [
                {
                    id: 'recipe_hp_potion_plus',
                    name: 'ยาฟื้นฟูชั้นสูง',
                    description: 'ฟื้นฟู HP 300 หน่วยทันที',
                    icon: '🧪',
                    result: { name: 'ยาฟื้นฟูชั้นสูง', quantity: 1 },
                    cost: { leather: 5, crystal: 1 },
                    goldCost: 50,
                    rarity: 'uncommon'
                },
                {
                    id: 'recipe_attack_potion',
                    name: 'ยาเพิ่มพลังโจมตี',
                    description: 'เพิ่มพลังโจมตี 20% เป็นเวลา 30 วินาที',
                    icon: '🔥',
                    result: { name: 'ยาเพิ่มพลังโจมตี', quantity: 1 },
                    cost: { iron: 3, crystal: 3 },
                    goldCost: 150,
                    rarity: 'rare'
                },
                {
                    id: 'recipe_defense_potion',
                    name: 'ยาเพิ่มเกราะ',
                    description: 'เพิ่มพลังป้องกัน 30% เป็นเวลา 30 วินาที',
                    icon: '🛡️',
                    result: { name: 'ยาเพิ่มเกราะ', quantity: 1 },
                    cost: { iron: 5, leather: 2 },
                    goldCost: 150,
                    rarity: 'rare'
                },
                {
                    id: 'recipe_luck_potion',
                    name: 'โพชั่นแห่งโชค',
                    description: 'เพิ่ม Magic Find และ Gold Find 25% เป็นเวลา 2 นาที',
                    icon: '🍀',
                    result: { name: 'โพชั่นแห่งโชค', quantity: 1 },
                    cost: { crystal: 5 },
                    goldCost: 300,
                    rarity: 'rare'
                },
                {
                    id: 'recipe_elixir',
                    name: 'ยาอายุวัฒนะ',
                    description: 'ฟื้นฟู HP และ Mana จนเต็ม',
                    icon: '💖',
                    result: { name: 'ยาอายุวัฒนะ', quantity: 1 },
                    cost: { crystal: 10, corruptedCrystals: 2 },
                    goldCost: 500,
                    rarity: 'legendary'
                },
            ];

            // Initial buildings
            const INITIAL_BUILDINGS: BuildingData[] = [
                {
                    id: 'blacksmith',
                    name: 'โรงตีเหล็ก',
                    icon: '⚒️',
                    description: 'ตีบวก, ใส่อัญมณี, และรวมอัญมณี',
                    purchaseCost: 1000,
                    unlocked: true, // Start with blacksmith unlocked
                },
                {
                    id: 'merchant',
                    name: 'ร้านค้า',
                    icon: '🏪',
                    description: 'ซื้อขายไอเทมและขยายช่องเก็บของ',
                    purchaseCost: 500,
                    unlocked: false,
                },
                {
                    id: 'alchemist',
                    name: 'ห้องปรุงยา',
                    icon: '⚗️',
                    description: 'สร้างยาและไอเทมบัฟ',
                    purchaseCost: 800,
                    unlocked: false,
                },
                {
                    id: 'soulforge',
                    name: 'เตาหลอมวิญญาณ',
                    icon: '🔥',
                    description: 'สร้างอุปกรณ์ให้เป็น NFT',
                    purchaseCost: 1000, 
                    unlocked: false,
                },
                {
                    id: 'skillShrine',
                    name: 'แท่นบูชาทักษะ',
                    icon: '✨',
                    description: 'เรียนรู้และอัปเกรดทักษะ',
                    purchaseCost: 1500,
                    unlocked: false,
                },
                {
                    id: 'museum',
                    name: 'พิพิธภัณฑ์วิญญาณ',
                    icon: '🏛️',
                    description: 'จัดแสดงไอเทม NFT เพื่อรับโบนัสถาวร',
                    purchaseCost: 2000,
                    unlocked: false,
                },
                {
                    id: 'ascensionAltar',
                    name: 'แท่นบูชาจุติ',
                    icon: '🌌',
                    description: 'สละเลเวลและพลังปัจจุบันเพื่อความแข็งแกร่งอันเป็นนิรันดร์',
                    purchaseCost: 0,
                    unlocked: false,
                },
            ];

            // --- New Game System Data ---

            const SKILL_TREE_DATA: SkillTreeNode[] = [
                // Warrior Branch (Center)
                { id: 'warrior_1', name: 'พลังโจมตีพื้นฐาน', description: 'เพิ่มพลังโจมตี +5 ต่อเลเวล', icon: '⚔️', type: 'passive', cost: 1, dependencies: [], maxLevel: 5, getBonus: (level) => ({ attack: 5 * level }), position: { x: 630, y: 50 } },
                { id: 'warrior_2', name: 'ฟันรุนแรง', description: 'เพิ่มโอกาสคริติคอล +1% ต่อเลเวล', icon: '🎯', type: 'passive', cost: 1, dependencies: ['warrior_1'], maxLevel: 5, getBonus: (level) => ({ critChance: 1 * level }), position: { x: 630, y: 200 } },
                { id: 'whirlwind_unlock', name: 'ปลดล็อค: Whirlwind', description: 'เรียนรู้สกิล Whirlwind', icon: '🌪️', type: 'active_unlock', cost: 2, dependencies: ['warrior_2'], maxLevel: 1, unlocksSkill: 'whirlwind', position: { x: 630, y: 350 } },
                { id: 'warrior_4', name: 'ดูดเลือด', description: 'เพิ่ม Lifesteal +0.5% ต่อเลเวล', icon: '🩸', type: 'passive', cost: 2, dependencies: ['whirlwind_unlock'], maxLevel: 5, getBonus: (level) => ({ lifesteal: 0.5 * level }), position: { x: 630, y: 500 } },
                { id: 'warrior_5', name: 'Berserker Rage', description: 'เพิ่มพลังโจมตีเมื่อ HP ต่ำ', icon: '😡', type: 'passive', cost: 3, dependencies: ['warrior_4'], maxLevel: 1, getBonus: (level, stats) => ({ attack: (stats.health < stats.maxHealth * 0.3) ? 50 : 0 }), position: { x: 630, y: 650 } },
                
                // Guardian Branch (Left)
                { id: 'guardian_1', name: 'พลังป้องกันพื้นฐาน', description: 'เพิ่มพลังป้องกัน +5 ต่อเลเวล', icon: '🛡️', type: 'passive', cost: 1, dependencies: [], maxLevel: 5, getBonus: (level) => ({ defense: 5 * level }), position: { x: 380, y: 50 } },
                { id: 'guardian_2', name: 'พลังชีวิตมหาศาล', description: 'เพิ่ม HP สูงสุด +20 ต่อเลเวล', icon: '❤️', type: 'passive', cost: 1, dependencies: ['guardian_1'], maxLevel: 5, getBonus: (level) => ({ maxHealth: 20 * level }), position: { x: 380, y: 200 } },
                { id: 'shield_bash_unlock', name: 'ปลดล็อค: Shield Bash', description: 'เรียนรู้สกิล Shield Bash', icon: '🛡️', type: 'active_unlock', cost: 2, dependencies: ['guardian_2'], maxLevel: 1, unlocksSkill: 'shield_bash', position: { x: 380, y: 350 } },
                { id: 'guardian_4', name: 'ฟื้นฟูมานา', description: 'เพิ่มการฟื้นฟูมานา +10% ต่อเลเวล', icon: '💧', type: 'passive', cost: 2, dependencies: ['shield_bash_unlock'], maxLevel: 3, getBonus: (level) => ({}), position: { x: 380, y: 500 } }, // Logic in game loop
                { id: 'guardian_5', name: 'Last Stand', description: 'เป็นอมตะ 3 วินาทีเมื่อ HP เหลือ 0 (ครั้งเดียวต่อดันเจี้ยน)', icon: '👼', type: 'passive', cost: 3, dependencies: ['guardian_4'], maxLevel: 1, getBonus: (level) => ({}), position: { x: 380, y: 650 } },

                // Ranger Branch (Right)
                { id: 'ranger_1', name: 'ค้นหาทอง', description: 'เพิ่ม Gold Find +5% ต่อเลเวล', icon: '💰', type: 'passive', cost: 1, dependencies: [], maxLevel: 5, getBonus: (level) => ({ goldFind: 5 * level }), position: { x: 880, y: 50 } },
                { id: 'ranger_2', name: 'ค้นหาสมบัติ', description: 'เพิ่ม Magic Find +5% ต่อเลเวล', icon: '💎', type: 'passive', cost: 1, dependencies: ['ranger_1'], maxLevel: 5, getBonus: (level) => ({ magicFind: 5 * level }), position: { x: 880, y: 200 } },
                { id: 'dash_unlock', name: 'ปลดล็อค: Dash', description: 'เรียนรู้สกิล Dash', icon: '💨', type: 'active_unlock', cost: 2, dependencies: ['ranger_2'], maxLevel: 1, unlocksSkill: 'dash', position: { x: 880, y: 350 } },
                { id: 'ranger_4', name: 'ความเร็ว', description: 'เพิ่มความเร็วในการเคลื่อนที่ +1 ต่อเลเวล', icon: '👟', type: 'passive', cost: 2, dependencies: ['dash_unlock'], maxLevel: 3, getBonus: (level) => ({ speed: 1 * level }), position: { x: 880, y: 500 } },
                { id: 'ranger_5', name: 'Treasure Hunter', description: 'มีโอกาส 2 เท่าที่จะได้ไอเทมจากหีบ', icon: '🗝️', type: 'passive', cost: 3, dependencies: ['ranger_4'], maxLevel: 1, getBonus: (level) => ({}), position: { x: 880, y: 650 } },
                
                // Mage Branch (Top-Left)
                { id: 'mage_1', name: 'พลังเวท', description: 'เพิ่มความเสียหายสกิล 5% ต่อเลเวล', icon: '🧙', type: 'passive', cost: 1, dependencies: ['warrior_1', 'guardian_1'], maxLevel: 5, getBonus: (level) => ({}), position: { x: 505, y: 125 } },
                { id: 'fireball_unlock', name: 'ปลดล็อค: Fireball', description: 'เรียนรู้สกิล Fireball', icon: '🔥', type: 'active_unlock', cost: 2, dependencies: ['mage_1'], maxLevel: 1, unlocksSkill: 'fireball', position: { x: 505, y: 275 } },
                { id: 'mage_3', name: 'Chain Lightning', description: 'Fireball มีโอกาสชิ่งไปหาศัตรูใกล้เคียง', icon: '⚡', type: 'passive', cost: 3, dependencies: ['fireball_unlock'], maxLevel: 1, getBonus: (level) => ({}), position: { x: 505, y: 425 } },

                // Assassin Branch (Top-Right)
                { id: 'assassin_1', name: 'ดูดมานา', description: 'เพิ่ม Manasteal +0.5% ต่อเลเวล', icon: '🧿', type: 'passive', cost: 1, dependencies: ['warrior_1', 'ranger_1'], maxLevel: 5, getBonus: (level) => ({ manasteal: 0.5 * level }), position: { x: 755, y: 125 } },
                { id: 'poison_nova_unlock', name: 'ปลดล็อค: Poison Nova', description: 'เรียนรู้สกิล Poison Nova', icon: '☠️', type: 'active_unlock', cost: 2, dependencies: ['assassin_1'], maxLevel: 1, unlocksSkill: 'poison_nova', position: { x: 755, y: 275 } },
                { id: 'assassin_3', name: 'Execute', description: 'โจมตีแรงขึ้น 50% ใส่ศัตรู HP ต่ำกว่า 20%', icon: '🔪', type: 'passive', cost: 3, dependencies: ['poison_nova_unlock'], maxLevel: 1, getBonus: (level) => ({}), position: { x: 755, y: 425 } },
            ];


            const ASCENSION_UPGRADES: AscensionUpgrade[] = [
                { id: 'asc_attack', name: 'พลังโจมตีอมตะ', description: (lvl) => `เพิ่มพลังโจมตีถาวร +${lvl * 2}`, icon: '⚔️', maxLevel: 50, costPerLevel: (lvl) => 1 + Math.floor(lvl / 5) },
                { id: 'asc_defense', name: 'เกราะพิทักษ์นิรันดร์', description: (lvl) => `เพิ่มพลังป้องกันถาวร +${lvl * 2}`, icon: '🛡️', maxLevel: 50, costPerLevel: (lvl) => 1 + Math.floor(lvl / 5) },
                { id: 'asc_crit', name: 'เนตรสังหาร', description: (lvl) => `เพิ่มโอกาสคริติคอลถาวร +${(lvl * 0.5).toFixed(1)}%`, icon: '🎯', maxLevel: 20, costPerLevel: (lvl) => 2 + lvl },
                { id: 'asc_gold', name: 'พรแห่งไมดาส', description: (lvl) => `เพิ่ม Gold Find ถาวร +${lvl * 2}%`, icon: '💰', maxLevel: 25, costPerLevel: (lvl) => 1 + Math.floor(lvl / 3) },
                { id: 'asc_magic', name: 'ดวงตาเหยี่ยว', description: (lvl) => `เพิ่ม Magic Find ถาวร +${lvl * 2}%`, icon: '💎', maxLevel: 25, costPerLevel: (lvl) => 1 + Math.floor(lvl / 3) },
            ];


            const MUSEUM_SETS: MuseumSet[] = [
                {
                    id: 'steel_set',
                    name: 'ชุดเกราะเหล็กกล้า',
                    itemNames: ['Steel Sword', 'Steel Shield'],
                    bonus: { defense: 20, health: 50 },
                    bonusDescription: '+20 Defense, +50 Max Health'
                },
                {
                    id: 'royal_set',
                    name: 'เซ็ตราชันย์',
                    itemNames: ["King's Blade", 'Divine Armor'],
                    bonus: { attack: 50, critChance: 5 },
                    bonusDescription: '+50 Attack, +5% Crit Chance'
                },
                {
                    id: 'adventurer_set',
                    name: 'ชุดนักผจญภัย',
                    itemNames: ['Sword', 'Armor', 'Boots'],
                    bonus: { speed: 2, goldFind: 10 },
                    bonusDescription: '+2 Speed, +10% Gold Find'
                },
                {
                    id: 'hunter_set',
                    name: 'ชุดนักล่า',
                    itemNames: ['Bow', 'Armor', 'Gloves'],
                    bonus: { critChance: 3, lifesteal: 2 },
                    bonusDescription: '+3% Crit Chance, +2% Lifesteal'
                },
                {
                    id: 'mage_set',
                    name: 'ชุดนักเวทย์',
                    itemNames: ['Scepter', 'Ring', 'Necklace'],
                    bonus: { maxMana: 50, cooldownReduction: 5 },
                    bonusDescription: '+50 Max Mana, +5% Cooldown Reduction'
                },
                {
                    id: 'guardian_set',
                    name: 'ชุดผู้พิทักษ์',
                    itemNames: ['Axe', 'Helmet', 'Pants'],
                    bonus: { defense: 30, maxHealth: 100 },
                    bonusDescription: '+30 Defense, +100 Max Health'
                },
                {
                    id: 'assassin_set',
                    name: 'ชุดนักฆ่า',
                    itemNames: ['Dagger', 'Boots', 'Earring'],
                    bonus: { speed: 3, critChance: 5 },
                    bonusDescription: '+3 Speed, +5% Crit Chance'
                }
            ];

            // Skills
            const ALL_SKILLS: SkillData[] = [
                {
                    id: 'fireball',
                    name: 'Fireball',
                    icon: '🔥',
                    description: 'ยิงลูกไฟใส่ศัตรู',
                    manaCost: 10,
                    cooldown: 2,
                    damage: 25,
                    range: 5
                },
                {
                    id: 'heal',
                    name: 'Heal',
                    icon: '💚',
                    description: 'ฟื้นฟู HP',
                    manaCost: 15,
                    cooldown: 5,
                    effect: 'heal',
                    damage: -30
                },
                {
                    id: 'whirlwind',
                    name: 'Whirlwind',
                    icon: '🌪️',
                    description: 'โจมตีรอบตัว',
                    manaCost: 20,
                    cooldown: 8,
                    damage: 15,
                    area: 2
                },
                {
                    id: 'dash',
                    name: 'Dash',
                    icon: '💨',
                    description: 'พุ่งไปข้างหน้าอย่างรวดเร็ว',
                    manaCost: 8,
                    cooldown: 3,
                    isUtility: true,
                },
                {
                    id: 'shield_bash',
                    name: 'Shield Bash',
                    icon: '🛡️',
                    description: 'โจมตีและทำให้ศัตรูมึนงงชั่วครู่',
                    manaCost: 12,
                    cooldown: 6,
                    damage: 10,
                    range: ATTACK_RANGE,
                    effect: 'stun',
                    duration: 2, // 2 second stun
                },
                {
                    id: 'poison_nova',
                    name: 'Poison Nova',
                    icon: '☠️',
                    description: 'ปล่อยพิษกระจายรอบตัว',
                    manaCost: 25,
                    cooldown: 10,
                    damage: 5, // Per second
                    area: 3,
                    effect: 'poison',
                    duration: 5, // 5 seconds
                }
            ];

            // NFT Contract
            const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
            const CONTRACT_ABI = [
                "function mintWeapon(address to, string memory itemName, string memory description, string memory image)",
                "function getMyWeapons() view returns (tuple(string itemName, string description, string image, bool isUsed, address owner)[])"
            ];

            // Tooltip and Modal components are moved here, before they are used.
            const ItemTooltip = ({ item }: { item: ItemData }) => (
                <div className="item-tooltip">
                    <h4 className={`font-pixel text-lg rarity-${item.rarity}`}>
                        {item.name} {item.enhancement > 0 && `+${item.enhancement}`}
                    </h4>
                    <p className="text-sm text-gray-300 my-2">{item.description}</p>
                    
                    {item.stats && Object.keys(item.stats).length > 0 && (
                        <div className="border-t border-gray-600 pt-2 mt-2">
                            {Object.entries(item.stats).map(([key, value]) => (
                                <p key={key} className="text-green-400 text-sm capitalize">+{value} {key}</p>
                            ))}
                        </div>
                    )}

                    {item.sockets && item.sockets.length > 0 && (
                        <div className="border-t border-gray-600 pt-2 mt-2">
                            {item.sockets.map((gem, index) => gem && (
                                <p key={`${item.uniqueId}-socket-${index}`} className="text-blue-400 text-sm">
                                    {gem.icon} +{Object.values(gem.stats)[0]} {Object.keys(gem.stats)[0]}
                                </p>
                            ))}
                        </div>
                    )}

                    <p className="mt-2 text-yellow-400 text-sm">Value: {item.value} Gold</p>
                    {item.isNFT && <p className="mt-1 text-purple-400 font-bold text-sm animate-pulse">NFT Item</p>}
                    {item.isNFT && item.uniqueId && (
                        <div className="nft-id-display">
                            NFT ID: {item.uniqueId}
                        </div>
                    )}
                </div>
            );

            const ComparisonTooltip = ({ currentItem, equippedItem }: { currentItem: ItemData, equippedItem: ItemData | null }) => {
                return (
                    <div className="comparison-tooltip">
                        <div className="comparison-column">
                            <ItemTooltip item={currentItem} />
                        </div>
                        <div className="comparison-column">
                            {equippedItem ? <ItemTooltip item={equippedItem} /> : <div className="p-4 text-center text-gray-500">ไม่มีของสวมใส่</div>}
                        </div>
                    </div>
                );
            };

            const Modal = ({ type, payload, onClose, gameActions, gameState }: { type: ModalType, payload: any, onClose: () => void, gameActions: any, gameState: any }): React.ReactElement => {
                // A centralized modal component to handle different modal types
                const isDismissible = type !== 'playerDefeated';
                
                const renderContent = () => {
                    switch (type) {
                        case 'settings':
                            const CustomToggle = ({ checked, onChange }: { checked: boolean, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
                                <label className="custom-toggle">
                                    <input type="checkbox" checked={checked} onChange={onChange} aria-label="Toggle Sound" />
                                    <span className="slider"></span>
                                </label>
                            );
                            return (
                                <div className="settings-modal-content">
                                    <h3 className="font-pixel text-2xl text-gold mb-6">SETTINGS</h3>
                                    <div className="settings-group">
                                        <h4 className="settings-group-title">เสียง</h4>
                                        <div className="settings-row">
                                            <label>เปิดใช้งานเสียง</label>
                                            <CustomToggle
                                                checked={gameState.settings.soundEnabled}
                                                onChange={(e) => {
                                                    gameActions.playClickSound();
                                                    const enabled = e.target.checked;
                                                    gameActions.setSettings((prev: GameSettings) => ({ ...prev, soundEnabled: enabled }));
                                                    if (window.soundSystem) {
                                                        enabled ? window.soundSystem.unmute() : window.soundSystem.mute();
                                                    }
                                                }}
                                            />
                                        </div>
                                        <div className="settings-row">
                                            <label htmlFor="music-volume-slider">เสียงเพลง</label>
                                            <div className="settings-slider-wrapper">
                                                <input 
                                                    type="range" aria-label="Music Volume" title="Music Volume" min="0" max="1" step="0.01"
                                                    id="music-volume-slider"
                                                    value={gameState.settings.musicVolume} className="custom-slider"
                                                    onInput={(e) => {
                                                        const newVolume = parseFloat(e.currentTarget.value);
                                                        gameActions.setSettings((prev: GameSettings) => ({ ...prev, musicVolume: newVolume }));
                                                        if (window.soundSystem) window.soundSystem.setVolume('music', newVolume);
                                                    }}
                                                />
                                                <span>{Math.round(gameState.settings.musicVolume * 100)}%</span>
                                            </div>
                                        </div>
                                        <div className="settings-row">
                                            <label htmlFor="sfx-volume-slider">เสียงเอฟเฟกต์</label>
                                            <div className="settings-slider-wrapper">
                                                <input 
                                                    type="range" aria-label="Sound Effects Volume" title="Sound Effects Volume" min="0" max="1" step="0.01"
                                                    id="sfx-volume-slider"
                                                    value={gameState.settings.sfxVolume} className="custom-slider"
                                                    onInput={(e) => {
                                                        const newVolume = parseFloat(e.currentTarget.value);
                                                        gameActions.setSettings((prev: GameSettings) => ({ ...prev, sfxVolume: newVolume }));
                                                    }}
                                                    onChange={() => { // On release, play sound
                                                        if(window.soundSystem) window.soundSystem.play('click', {volume: gameState.settings.sfxVolume})
                                                    }}
                                                />
                                                <span>{Math.round(gameState.settings.sfxVolume * 100)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button className="pixel-button mt-4" onClick={onClose}>ปิด</button>
                                </div>
                            );

                        case 'ascend':
                            return (
                                <div className="ascension-view text-center">
                                    <h2 className="font-pixel text-2xl md:text-3xl text-gold">แท่นบูชาจุติ</h2>
                                    <div className="ascension-info my-4">
                                        <h3 className="font-pixel text-xl mb-2">ระดับจุติ: {gameState.ascensionLevel}</h3>
                                        <p className="ascension-points-display">แต้มคงเหลือ: <span>{gameState.ascensionPoints}</span></p>
                                    </div>
                                    <div className="ascension-upgrade-list my-4">
                                        {ASCENSION_UPGRADES.map(upgrade => {
                                            const currentLevel = gameState.ascensionUpgrades[upgrade.id] || 0;
                                            const cost = upgrade.costPerLevel(currentLevel + 1);
                                            const canUpgrade = gameState.ascensionPoints >= cost && currentLevel < upgrade.maxLevel;
                                            return (
                                                <div key={upgrade.id} className="ascension-upgrade-entry">
                                                    <div className="item-icon">{upgrade.icon}</div>
                                                    <h4 className="font-pixel text-lg">{upgrade.name}</h4>
                                                    <p className="text-sm text-gray-400 h-10">{upgrade.description(currentLevel)}</p>
                                                    <p className="ascension-level-display">Lv. {currentLevel} / {upgrade.maxLevel}</p>
                                                    <button
                                                        className="pixel-button purple"
                                                        disabled={!canUpgrade}
                                                        onClick={() => gameActions.handleUpgradeAscension(upgrade.id)}
                                                    >
                                                        อัปเกรด ({cost} แต้ม)
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {gameState.totalStats.level >= MAX_LEVEL && (
                                        <div className="text-center mt-6 p-4 border-t border-gray-600">
                                            <h3 className="font-pixel text-xl text-red-400 mb-2">ยืนยันการจุติ</h3>
                                            <p className="mb-4 text-sm">การจุติจะรีเซ็ตเลเวล, แต้มทักษะ และความคืบหน้าของดันเจี้ยน เพื่อแลกกับแต้มจุติ</p>
                                            <button className="pixel-button danger animate-pulse" onClick={gameActions.performAscension}>✨ ยืนยันการจุติ ✨</button>
                                        </div>
                                    )}
                                    <button className="pixel-button mt-4" onClick={onClose}>ปิด</button>
                                </div>
                            );

                        case 'playerDefeated':
                            if (payload?.victory) {
                                return (
                                    <div className="text-center animate-pixel-fade">
                                        <div className="text-8xl mb-4 animate-bounce-slow">🏆</div>
                                        <h3 className="font-pixel text-2xl text-gold mb-4">ด่านสำเร็จ!</h3>
                                        <div className="space-y-2 mb-6">
                                            <p>ได้รับโบนัส {payload.bonusGold} ทอง</p>
                                            <p>ได้รับ {payload.bonusExp} EXP</p>
                                        </div>
                                        <p className="text-lg font-bold mb-4">ด่านต่อไป: ระดับ {payload.nextLevel}</p>
                                        <button 
                                            className="pixel-button gold"
                                            onClick={() => {
                                                gameActions.playClickSound();
                                                gameActions.setDungeonLevel((prev: number) => prev + 1);
                                                gameActions.setGameScreen('camp');
                                                onClose();
                                            }}
                                        >
                                            กลับแคมป์
                                        </button>
                                    </div>
                                );
                            }
                            return (
                                <div className="text-center">
                                    <div className="text-8xl mb-4">💀</div>
                                    <h3 className="font-pixel text-2xl text-red-500 mb-4">พ่ายแพ้!</h3>
                                    <p className="mb-2">คุณถูกเอาชนะในดันเจี้ยนชั้น {gameState.dungeonLevel}</p>
                                    <p className="text-sm text-gray-400 mb-4">Gold และ EXP ในรอบนี้จะหายไป</p>
                                    <button 
                                        className="pixel-button danger"
                                        onClick={() => {
                                            gameActions.playClickSound();
                                            gameActions.setGameScreen('camp');
                                            gameActions.setPlayerStats((prev: any) => ({
                                                ...prev,
                                                health: prev.maxHealth,
                                                mana: prev.maxMana
                                            }));
                                            onClose();
                                        }}
                                    >
                                        กลับแคมป์
                                    </button>
                                </div>
                            );

                        case 'leaveDungeon':
                            return (
                                <div className="text-center">
                                    <h3 className="font-pixel text-xl text-gold mb-4">ออกจากดันเจี้ยน?</h3>
                                    <p className="mb-4">คุณจะสูญเสียความคืบหน้าและไอเทมที่ยังไม่ได้เก็บ</p>
                                    <div className="flex justify-center gap-4">
                                        <button className="pixel-button" onClick={onClose}>ยกเลิก</button>
                                        <button className="pixel-button danger" onClick={() => {
                                            gameActions.setGameScreen('camp');
                                            onClose();
                                        }}>ยืนยัน</button>
                                    </div>
                                </div>
                            );

                        case 'purchaseBuilding':
                            const building: BuildingData = payload;
                            return (
                                <div className="text-center">
                                    <h3 className="font-pixel text-xl text-gold mb-2">สร้าง {building.name}?</h3>
                                    <div className="text-5xl my-4">{building.icon}</div>
                                    <p className="mb-4">{building.description}</p>
                                    <p>ราคา: <span className="text-yellow-400">{building.purchaseCost} ทอง</span></p>
                                    <div className="flex justify-center gap-4 mt-4">
                                        <button className="pixel-button" onClick={onClose}>ยกเลิก</button>
                                        <button className="pixel-button success" onClick={() => gameActions.purchaseBuilding(building.id)}>สร้าง</button>
                                    </div>
                                </div>
                            );
                        
                        case 'itemActions':
                            const item: ItemData = payload;
                            const isEquipped = item.slot ? gameState.equipment[item.slot]?.uniqueId === item.uniqueId : false;
                            
                            return (
                                <div className="item-actions-modal">
                                    <ItemTooltip item={item} />
                                    <div className="modal-actions">
                                        {item.type === 'consumable' && <button className="pixel-button success" onClick={() => { gameActions.useItem(item); onClose(); }}>ใช้</button>}
                                        {item.slot && !isEquipped && <button className="pixel-button primary" onClick={() => { gameActions.equipItem(item); onClose(); }}>สวมใส่</button>}
                                        {item.slot && isEquipped && <button className="pixel-button" onClick={() => { gameActions.unequipItem(item.slot); onClose(); }}>ถอด</button>}
                                        {!item.isNFT && <button className="pixel-button danger" onClick={() => {
                                            const sellValue = Math.floor(item.value * 0.5);
                                            gameActions.setResources((prev: Resources) => ({ ...prev, gold: prev.gold + sellValue }));
                                            gameActions.setInventory((prev: ItemData[]) => prev.filter(i => i.uniqueId !== item.uniqueId));
                                            gameActions.showNotification(`ขาย ${item.name} ได้ ${sellValue} ทอง`, 'success');
                                            onClose();
                                        }}>ขาย</button>}
                                    </div>
                                </div>
                            );

                        case 'sellMultipleConfirm': {
                            const { itemsToSell, totalValue } = payload;
                            return (
                                <div className="text-center">
                                    <h3 className="font-pixel text-xl text-gold mb-4">ยืนยันการขาย</h3>
                                    <p>คุณกำลังจะขาย {itemsToSell.length} ชิ้น</p>
                                    <p>เป็นเงิน <span className="text-yellow-400">{totalValue} ทอง</span></p>
                                    <div className="flex justify-center gap-4 mt-4">
                                        <button className="pixel-button" onClick={onClose}>ยกเลิก</button>
                                        <button className="pixel-button danger" onClick={() => {
                                            const idsToSell = new Set(itemsToSell.map((i: ItemData) => i.uniqueId));
                                            gameActions.setInventory((prev: ItemData[]) => prev.filter(i => !i.uniqueId || !idsToSell.has(i.uniqueId)));
                                            gameActions.setResources((prev: Resources) => ({ ...prev, gold: prev.gold + totalValue }));
                                            gameActions.showNotification(`ขาย ${itemsToSell.length} ชิ้น ได้ ${totalValue} ทอง`, 'success');
                                            gameActions.setSelectedForSale([]);
                                            onClose();
                                        }}>ขาย</button>
                                    </div>
                                </div>
                            );
                        }

                        default:
                            return <div>
                                <h3 className="font-pixel text-xl mb-4">Unhandled Modal</h3>
                                <p>Type: {type}</p>
                                <button className="pixel-button" onClick={onClose}>Close</button>
                            </div>;
                    }
                };

                return (
                    <div className="modal-overlay" onClick={isDismissible ? onClose : undefined}>
                        <div className="modal-content animate-pixel-fade" onClick={e => e.stopPropagation()}>
                            {isDismissible && <button className="modal-close-button" onClick={onClose}>✕</button>}
                            {renderContent()}
                        </div>
                    </div>
                );
            }

            // Main Game Component
            function VoxelverseChronicles() {
                // Core States
                const [isPaused, setIsPaused] = useState(false);
                const [gameScreen, setGameScreen] = useState<GameScreen>('camp');
                const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
                const [signer, setSigner] = useState<ethers.Signer | null>(null);
                const [contract, setContract] = useState<ethers.Contract | null>(null);
                const [userAddress, setUserAddress] = useState<string>('');
                const [loading, setLoading] = useState(true);
                const [error, setError] = useState<string>('');

                // Game States
                const [playerStats, setPlayerStats] = useState<CharacterStats>({
                    level: 1,
                    health: 100,
                    maxHealth: 100,
                    mana: 50,
                    maxMana: 50,
                    attack: 10,
                    defense: 5,
                    speed: 5,
                    critChance: 10,
                    experience: 0,
                    experienceToNext: 100,
                    cooldownReduction: 0,
                    lifesteal: 0,
                    manasteal: 0,
                    magicFind: 0,
                    goldFind: 0,
                    aoeSize: 0,
                });

                const [inventory, setInventory] = useState<ItemData[]>([]);
                const [maxInventorySlots, setMaxInventorySlots] = useState(INITIAL_INVENTORY_SLOTS);
                const [equipment, setEquipment] = useState<{ [key: string]: ItemData | null }>({
                    weapon: null,
                    helmet: null,
                    chest: null,
                    pants: null,
                    boots: null,
                    accessory: null
                });

                const [buildings, setBuildings] = useState<BuildingData[]>(INITIAL_BUILDINGS);
                const [resources, setResources] = useState<Resources>({
                    gold: 1000,
                    gems: 10,
                    materials: { iron: 5, leather: 3, crystal: 1, corruptedCrystals: 0 },
                    guardianShards: 0,
                });

                const [settings, setSettings] = useState<GameSettings>({
                    soundEnabled: true,
                    musicVolume: 0.3,
                    sfxVolume: 0.5,
                    language: 'th',
                    autoSave: true
                });

                // UI States
                const [showInventory, setShowInventory] = useState(false);
                const [selectedItem, setSelectedItem] = useState<ItemData | null>(null);
                const [activeModal, setActiveModal] = useState<ModalType | null>(null);
                const [modalPayload, setModalPayload] = useState<any>(null); // For passing data to modals
                const [inventoryFilter, setInventoryFilter] = useState<InventoryFilter>('all');
                const [mobileInventoryTab, setMobileInventoryTab] = useState<MobileInventoryTab>('inventory');
                const [tooltip, setTooltip] = useState<{ content: React.ReactNode; x: number; y: number } | null>(null);
                const [isSellMode, setIsSellMode] = useState(false);
                const [selectedForSale, setSelectedForSale] = useState<string[]>([]);


                // --- Performance Refactor: High-frequency state moved to Refs ---
                const dungeonMap = useRef<DungeonTile[][]>([]);
                const playerPosition = useRef<Position>({ x: 1, y: 1 });
                const entities = useRef<Entity[]>([]);
                const [dungeonLevel, setDungeonLevel] = useState(1);
                const [currentBiome, setCurrentBiome] = useState<Biome>(BIOMES.forest);
                const [skillCooldowns, setSkillCooldowns] = useState<Record<string, number>>({});
                const [totalPlayTime, setTotalPlayTime] = useState(0);
                const [achievements, setAchievements] = useState<string[]>([]);
                const playerStatusEffects = useRef<StatusEffect[]>([]);
                const dungeonGeneratedForLevel = useRef<number | null>(null);

                // Boss State
                const [isBossFightActive, setIsBossFightActive] = useState(false);
                const bossEntity = useRef<Entity | null>(null);

                // Shop States
                const [shopItems, setShopItems] = useState<ItemData[]>([]);
                const [shopRefreshTimer, setShopRefreshTimer] = useState(SHOP_REFRESH_INTERVAL);

                // Forge State
                const [selectedForgeItem, setSelectedForgeItem] = useState<ItemData | null>(null);
                const [forgeTab, setForgeTab] = useState<ForgeTab>('enhance');
                const [selectedGem, setSelectedGem] = useState<ItemData | null>(null);
                const [forgeFilter, setForgeFilter] = useState<InventoryFilter>('all');

                // Alchemist State
                const [selectedRecipe, setSelectedRecipe] = useState<CraftingRecipe | null>(null);

                // Soulforge State
                const [selectedSoulforgeItem, setSelectedSoulforgeItem] = useState<ItemData | null>(null);

                // New System States
                const [ascensionLevel, setAscensionLevel] = useState(0);
                const [ascensionPoints, setAscensionPoints] = useState(0);
                const [ascensionUpgrades, setAscensionUpgrades] = useState<{ [key: string]: number }>({});
                const [skillPoints, setSkillPoints] = useState(0);
                const [learnedSkills, setLearnedSkills] = useState<Record<string, number>>({});
                const [unlockedSkills, setUnlockedSkills] = useState<string[]>(['heal']);
                const [activeSkills, setActiveSkills] = useState<(string | null)[]>(['heal', null, null]);
                const [skillScreenTab, setSkillScreenTab] = useState<SkillScreenTab>('passive');
                const [selectedSkillToEquip, setSelectedSkillToEquip] = useState<string | null>(null);

                const [museumItems, setMuseumItems] = useState<Record<string, ItemData[]>>({});
                const [selectedMuseumItem, setSelectedMuseumItem] = useState<ItemData | null>(null);
                const [selectedMuseumSet, setSelectedMuseumSet] = useState<MuseumSet | null>(null);
                const [selectedSkillNode, setSelectedSkillNode] = useState<SkillTreeNode | null>(null);

                // Admin Mode States
                const [isAdminMode, setIsAdminMode] = useState(false);
                const [adminSequence, setAdminSequence] = useState('');

                // Movement & Input States
                const playerFacing = useRef<'up' | 'down' | 'left' | 'right'>('down');
                const playerVelocity = useRef({ x: 0, y: 0 });
                const keysDown = useRef<Record<string, boolean>>({});

                // Refs
                const uniqueIdCounter = useRef(0);
                const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
                const gameLoopRef = useRef<number>(0);
                const canvasContainerRef = useRef<HTMLDivElement>(null);
                const effectsManager = useRef<EffectsManager | null>(null);
                const defeatedEnemiesRef = useRef(new Set());
                const skillTreeContainerRef = useRef<HTMLDivElement>(null);
                const isDungeonReady = useRef(false);
                const lastPortalWarning = useRef(0);
                
                // PIXI Object Refs for Dungeon Rendering Stability
                const pixiAppRef = useRef<PIXI.Application | null>(null);
                const tileContainerRef = useRef<PIXI.Container | null>(null);
                const entityContainerRef = useRef<PIXI.Container | null>(null);
                const tileTexturesRef = useRef(new Map<string, PIXI.Texture>());
                const emojiTexturesRef = useRef(new Map<string, PIXI.Texture>());
                const tileSpritesRef = useRef(new Map<string, PIXI.Sprite>());
                const entitySpritesRef = useRef(new Map<string, PIXI.Container>());

                const showNotification = useCallback((message: string, type: 'info' | 'error' | 'success' = 'info') => {
                    const container = document.getElementById('notification-container');
                    if (!container) return;

                    const notification = document.createElement('div');
                    notification.className = `notification ${type}`;
                    
                    const icon = type === 'success' ? '🏆' : type === 'error' ? '❌' : 'ℹ️';
                    notification.innerHTML = `${icon} ${message}`; // Use innerHTML to render the icon
                    
                    container.appendChild(notification);
                    
                    setTimeout(() => {
                        notification.classList.add('fade-out');
                        setTimeout(() => notification.remove(), 300);
                    }, 3000);
                }, []);

                const addAchievement = useCallback((id: string, name: string) => {
                    setAchievements(prev => {
                        if (prev.includes(id)) {
                            return prev;
                        }
                        showNotification(`สำเร็จ: ${name}`, 'success');
                        window.soundSystem?.play('achievement', { volume: settings.sfxVolume });
                        return [...prev, id];
                    });
                }, [showNotification, settings.sfxVolume]);

                const applyLevelUp = useCallback((expGained: number) => {
                    setPlayerStats(prev => {
                        let currentExp = prev.experience + expGained;
                        let currentLevel = prev.level;
                        let expToNext = prev.experienceToNext;
                        let leveledUp = false;
                        let levelGained = 0;
                
                        while (currentExp >= expToNext && currentLevel < MAX_LEVEL) {
                            leveledUp = true;
                            levelGained++;
                            currentLevel++;
                            currentExp -= expToNext;
                            expToNext = Math.floor(100 * Math.pow(currentLevel, 1.5));
                        }
                
                        if (leveledUp) {
                            setSkillPoints(prevPoints => prevPoints + levelGained);

                            if (effectsManager.current) {
                                effectsManager.current.createLevelUpEffect(playerPosition.current);
                            }
                            
                            window.soundSystem?.play('levelup', { volume: settings.sfxVolume });
                            showNotification(`เลเวลอัพ! ตอนนี้เลเวล ${currentLevel}`);
                
                            if (currentLevel >= 10 && prev.level < 10) addAchievement('level_10', 'ผู้แข็งแกร่ง');
                            if (currentLevel >= 20 && prev.level < 20) addAchievement('level_20', 'ผู้ยิ่งใหญ่');

                            return {
                                ...prev,
                                level: currentLevel,
                                experience: currentExp,
                                experienceToNext: expToNext,
                                maxHealth: prev.maxHealth + 10 * levelGained,
                                health: prev.maxHealth + 10 * levelGained, // Full heal on level up
                                maxMana: prev.maxMana + 5 * levelGained,
                                mana: prev.maxMana + 5 * levelGained, // Full mana on level up
                                attack: prev.attack + 2 * levelGained,
                                defense: prev.defense + 1 * levelGained,
                            };
                        } else {
                            if (currentLevel === MAX_LEVEL) {
                                return { ...prev, experience: 0, experienceToNext: 99999999 };
                            }
                            return { ...prev, experience: currentExp };
                        }
                    });
                }, [settings.sfxVolume, showNotification, addAchievement]);

                // Generate unique ID for items
                const generateUniqueId = useCallback(() => {
                    uniqueIdCounter.current += 1;
                    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${uniqueIdCounter.current}`;
                }, []);

                // Admin Mode Activation
                const activateAdminMode = useCallback(() => {
                    setIsAdminMode(true);
                    setResources({
                        gold: 99999999,
                        gems: 999999,
                        materials: { iron: 99999, leather: 99999, crystal: 99999, corruptedCrystals: 99999 },
                        guardianShards: 9999,
                    });
                    setPlayerStats(prev => ({
                        ...prev,
                        maxHealth: 99999,
                        health: 99999,
                        maxMana: 99999,
                        mana: 99999,
                        attack: 9999,
                        defense: 9999,
                    }));
                    setBuildings(prev => prev.map(b => ({ ...b, unlocked: true })));
                    setSkillPoints(100);

                    // Add all museum set items
                    const allMuseumItemNames = new Set(MUSEUM_SETS.flatMap(set => set.itemNames));
                    const itemsToAdd: ItemData[] = [];
                    
                    allMuseumItemNames.forEach(itemNameEn => {
                        const baseItem = ALL_BASE_ITEMS.find(item => item.nameEn === itemNameEn);
                        if (baseItem) {
                            const newItemUniqueId = generateUniqueId();
                            itemsToAdd.push({
                                id: newItemUniqueId,
                                uniqueId: newItemUniqueId,
                                name: baseItem.name,
                                nameEn: baseItem.nameEn,
                                description: `Admin generated item.`,
                                rarity: baseItem.rarity as ItemData['rarity'],
                                type: baseItem.type as ItemData['type'],
                                slot: baseItem.slot as ItemData['slot'],
                                stats: baseItem.stats,
                                value: baseItem.value,
                                icon: baseItem.icon,
                                enhancement: 0,
                                maxSockets: 0,
                                sockets: [],
                            });
                        }
                    });

                    setInventory(prev => [...prev, ...itemsToAdd]);
                    showNotification('Added all museum set items to inventory!', 'success');
                    showNotification('โหมดผู้ดูแลระบบเปิดใช้งาน!', 'success');
                }, [showNotification, generateUniqueId]);

                useEffect(() => {
                    const targetSequences: { [key: string]: () => void } = {
                        admin: activateAdminMode,
                        exp: () => {
                            let totalExpNeeded = 0;
                            let tempLevel = playerStats.level;
                            let tempExpToNext = playerStats.experienceToNext;
                        
                            // Calculate exp for next 10 levels from current level
                            for (let i = 0; i < 10; i++) {
                                const levelCheck = tempLevel + i;
                                if (levelCheck >= MAX_LEVEL) break;
                                
                                if (i === 0) {
                                    // Exp for the current level
                                    totalExpNeeded += tempExpToNext - playerStats.experience;
                                } else {
                                    // Exp for subsequent levels
                                    totalExpNeeded += Math.floor(100 * Math.pow(levelCheck, 1.5));
                                }
                            }
                            
                            // Add a little extra to ensure level up
                            totalExpNeeded += 1;
                            
                            applyLevelUp(totalExpNeeded);
                            showNotification('ได้รับ EXP สำหรับ 10 เลเวล!', 'success');
                        }
                    };

                    const handleCheatKey = (e: KeyboardEvent) => {
                        if (isAdminMode) return;
                        const newSequence = (adminSequence + e.key.toLowerCase()).slice(-5); // Keep last 5 chars
                        setAdminSequence(newSequence);

                        for (const [sequence, action] of Object.entries(targetSequences)) {
                            if (newSequence.endsWith(sequence)) {
                                action();
                                setAdminSequence(''); // Reset after successful cheat
                                break;
                            }
                        }
                    };

                    window.addEventListener('keydown', handleCheatKey);
                    return () => window.removeEventListener('keydown', handleCheatKey);
                }, [adminSequence, isAdminMode, activateAdminMode, playerStats.experience, playerStats.experienceToNext, playerStats.level, applyLevelUp]);


                // Audio Helpers
                const playClickSound = useCallback(() => {
                    window.soundSystem?.play('click', { volume: settings.sfxVolume });
                }, [settings.sfxVolume]);

                const playHoverSound = useCallback(() => {
                    window.soundSystem?.play('hover', { volume: settings.sfxVolume * 0.4 });
                }, [settings.sfxVolume]);

                const throttledSfxPlayer = useMemo(() => {
                    let timeout: NodeJS.Timeout | null = null;
                    let canPlay = true;
                    return (sound: string, volume: number) => {
                        if (canPlay) {
                            window.soundSystem?.play(sound, { volume });
                            canPlay = false;
                            timeout = setTimeout(() => {
                                canPlay = true;
                                timeout = null;
                            }, 100); // Throttle to 100ms
                        }
                    };
                }, []);


                // Tooltip Handlers
                const handleShowTooltip = useCallback((item: ItemData, e: React.MouseEvent) => {
                    playHoverSound();
                    const equippedItem = (item.slot && equipment[item.slot as keyof typeof equipment]) || null;
                    
                    let content: React.ReactNode;
                    if (equippedItem && equippedItem.uniqueId !== item.uniqueId) {
                        content = <ComparisonTooltip currentItem={item} equippedItem={equippedItem} />;
                    } else {
                        content = <ItemTooltip item={item} />;
                    }
                    
                    setTooltip({
                        content,
                        x: e.clientX,
                        y: e.clientY
                    });
                }, [playHoverSound, equipment]);

                const handleShowGenericTooltip = useCallback((content: React.ReactNode, e: React.MouseEvent) => {
                    playHoverSound();
                    setTooltip({
                        content,
                        x: e.clientX,
                        y: e.clientY
                    });
                }, [playHoverSound]);

                const handleHideTooltip = useCallback(() => {
                    setTooltip(null);
                }, []);

                // Mobile touch feedback handlers
                const handleTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
                    e.currentTarget.classList.add('pressed');
                };
                const handleTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
                    e.currentTarget.classList.remove('pressed');
                };

                // Enhanced Save/Load System
                const saveGameData = useCallback(() => {
                    if (!userAddress || isAdminMode) { // Don't save in admin mode
                        console.warn('Cannot save game, no user address or in admin mode.');
                        return;
                    }

                    const saveData: SaveData = {
                        version: SAVE_VERSION,
                        playerStats,
                        inventory,
                        maxInventorySlots,
                        equipment,
                        buildings,
                        resources,
                        settings,
                        lastSaved: Date.now(),
                        dungeonProgress: dungeonLevel,
                        totalPlayTime,
                        achievements,
                        ascensionLevel,
                        ascensionPoints,
                        ascensionUpgrades,
                        skillPoints,
                        learnedSkills,
                        museumItems,
                        unlockedSkills,
                        activeSkills
                    };

                    try {
                        localStorage.setItem(`voxelverse_save_${userAddress}`, JSON.stringify(saveData));
                        console.log('Game Saved!');
                        
                    } catch (err) {
                        console.error('Failed to save game:', err);
                        setError('ไม่สามารถบันทึกเกมได้');
                    }
                }, [userAddress, playerStats, inventory, maxInventorySlots, equipment, buildings, resources, settings, dungeonLevel, totalPlayTime, achievements, ascensionLevel, ascensionPoints, ascensionUpgrades, skillPoints, learnedSkills, museumItems, unlockedSkills, activeSkills, isAdminMode]);

                const initializeNewGame = useCallback(() => {
                    const starterSwordId = generateUniqueId();
                    const starterPotionId = generateUniqueId();
                    const starterItems: ItemData[] = [
                        {
                            id: starterSwordId,
                            uniqueId: starterSwordId,
                            name: 'ดาบมือใหม่',
                            description: 'ดาบพื้นฐานสำหรับนักผจญภัย',
                            rarity: 'common',
                            type: 'weapon',
                            slot: 'weapon',
                            stats: { attack: 5 },
                            value: 10,
                            icon: '⚔️',
                            enhancement: 0,
                            maxSockets: 0,
                            sockets: []
                        },
                        {
                            id: starterPotionId,
                            uniqueId: starterPotionId,
                            name: 'ยาฟื้นฟู',
                            description: 'ฟื้นฟู HP 50',
                            rarity: 'common',
                            type: 'consumable',
                            stats: { heal: 50 },
                            value: 20,
                            icon: '🧪',
                            quantity: 5,
                            enhancement: 0,
                            maxSockets: 0,
                            sockets: []
                        }
                    ];
                    
                    setInventory(starterItems);
                    setBuildings(INITIAL_BUILDINGS);
                    setUnlockedSkills(['heal']);
                    setActiveSkills(['heal', null, null]);
                    addAchievement('first_steps', 'การเดินทางเริ่มต้น');
                }, [addAchievement, generateUniqueId]);

                const loadGameData = useCallback(() => {
                    if (!userAddress) return;
                    
                    const savedData = localStorage.getItem(`voxelverse_save_${userAddress}`);
                    
                    if (savedData) {
                        try {
                            const data: SaveData = JSON.parse(savedData);
                            
                            // Basic version check, could be expanded into a migration system
                            if (!data.version || data.version < SAVE_VERSION) {
                                console.warn(`Save version mismatch (found ${data.version}, requires ${SAVE_VERSION}), starting new game for compatibility.`);
                                localStorage.removeItem(`voxelverse_save_${userAddress}`);
                                initializeNewGame();
                                return;
                            }
                            
                            setPlayerStats(data.playerStats);
                            setInventory(data.inventory.map(i => ({...i, enhancement: i.enhancement || 0, maxSockets: i.maxSockets || 0, sockets: i.sockets || []})));
                            setMaxInventorySlots(Number(data.maxInventorySlots) || INITIAL_INVENTORY_SLOTS);
                            setEquipment(data.equipment);
                            setBuildings(data.buildings || INITIAL_BUILDINGS);
                            setResources(data.resources);
                            setSettings(data.settings);
                            setDungeonLevel(Number(data.dungeonProgress) || 1);
                            setTotalPlayTime(Number(data.totalPlayTime) || 0);
                            setAchievements(data.achievements || []);
                            setAscensionLevel(data.ascensionLevel || 0);
                            setAscensionPoints(data.ascensionPoints || 0);
                            setAscensionUpgrades(data.ascensionUpgrades || {});
                            setSkillPoints(data.skillPoints || 0);
                            setLearnedSkills(data.learnedSkills || {});
                            setMuseumItems(data.museumItems || {});
                            setUnlockedSkills(data.unlockedSkills || ['heal']);
                            setActiveSkills(data.activeSkills || ['heal', null, null]);
                            
                        } catch (err) {
                            console.error('Failed to load save data:', err);
                            initializeNewGame();
                        }
                    } else {
                        initializeNewGame();
                    }
                }, [userAddress, initializeNewGame]);

                // Web3 Functions
                const initializeWeb3 = useCallback(async () => {
                    try {
                        if (!window.ethereum) {
                            setError('กรุณาติดตั้ง MetaMask!');
                            setLoading(false);
                            return;
                        }

                        const provider = new ethers.BrowserProvider(window.ethereum);
                        // The overlay script has already handled eth_requestAccounts.
                        // We can now safely get the signer without re-prompting the user.
                        const signer = await provider.getSigner();
                        const address = await signer.getAddress();
                        const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

                        setProvider(provider);
                        setSigner(signer);
                        setContract(contractInstance);
                        setUserAddress(address);

                    } catch (err) {
                        console.error('Web3 initialization failed inside React component:', err);
                        setError('Wallet connection lost. Please reconnect by refreshing the page.');
                        setLoading(false);
                    }
                }, []);

                const loadNFTItems = useCallback(async () => {
                    if (!contract || !userAddress) return;

                    try {
                        const myWeapons = await contract.getMyWeapons();
                        
                        const nftItems: ItemData[] = myWeapons.map((weapon: any, index: number) => {
                            const uniqueId = weapon.image;
                            const nftItemName = weapon.itemName;
                
                            const findBaseItem = (name: string): Partial<ItemData> => {
                                // Try for an exact match first (e.g., "ดาบราชันย์")
                                let base = ALL_BASE_ITEMS.find(i => i.name === name);
                                if (base) return base;
                
                                // Try matching base name for dungeon items (e.g., "ดาบ" from "ดาบ (หายาก)")
                                const baseNameMatch = name.match(/^([^(]+)/);
                                if (baseNameMatch) {
                                    const baseName = baseNameMatch[0].trim();
                                    base = ALL_BASE_ITEMS.find(i => i.name === baseName);
                                    if (base) return base;
                                }
                                
                                // Fallback if no base item is found
                                return { 
                                    name: name,
                                    rarity: 'common', 
                                    type: 'weapon', 
                                    value: 100, 
                                    stats: { attack: 1 }, 
                                    icon: '❓', // Use a question mark for unknown items
                                    slot: 'weapon' 
                                };
                            };
                            
                            const baseItem = findBaseItem(nftItemName);
                            
                            return {
                                id: `nft-${uniqueId}`,
                                uniqueId: uniqueId,
                                name: `[NFT] ${nftItemName}`,
                                nameEn: baseItem.nameEn,
                                description: weapon.description,
                                rarity: (baseItem.rarity || 'common') as ItemData['rarity'],
                                type: (baseItem.type || 'weapon') as ItemData['type'],
                                slot: baseItem.slot as ItemData['slot'],
                                stats: baseItem.stats,
                                value: (baseItem.value || 100) * 2,
                                icon: baseItem.icon || '❓', // Use the icon from the base item
                                isNFT: true,
                                tokenId: `unknown-${index}`,
                                enhancement: 0,
                                maxSockets: 0,
                                sockets: [],
                            };
                        });
                
                        // When loading NFTs, filter out any that are already placed in the museum from being added to inventory
                        const placedMuseumIds = new Set(Object.values(museumItems).flat().map(item => item.uniqueId));

                        setInventory(prev => [
                            ...prev.filter(item => !item.isNFT), // remove old non-museum NFTs
                            ...nftItems.filter(item => item.uniqueId && !placedMuseumIds.has(item.uniqueId)) // add only NFTs not in museum
                        ]);
                
                    } catch (err: any) {
                        if (err.code === 'BAD_DATA' && err.value === '0x') {
                            console.log('No NFT items found for this address. Clearing local NFTs.');
                            setInventory(prev => prev.filter(item => !item.isNFT));
                        } else {
                            console.error('Failed to load NFT items:', err);
                            showNotification('ไม่สามารถโหลด NFT ไอเทมได้', 'error');
                        }
                    }
                }, [contract, userAddress, showNotification, museumItems]);
                
                // Shop System
                const generateShopItems = useCallback(() => {
                    const items: ItemData[] = [
                        // Always have potions
                        { id: 'potion-shop', name: 'ยาฟื้นฟู', icon: '🧪', value: 50, type: 'consumable' as const, description: 'ฟื้นฟู HP 100', rarity: 'common', stats: { heal: 100 }, uniqueId: generateUniqueId(), enhancement: 0, maxSockets: 0, sockets: [] },
                        { id: 'mana-shop', name: 'ยามานา', icon: '💙', value: 75, type: 'consumable' as const, description: 'ฟื้นฟู Mana 50', rarity: 'common', stats: { mana: 50 }, uniqueId: generateUniqueId(), enhancement: 0, maxSockets: 0, sockets: [] },
                    ];

                    const itemPool = [
                        { id: 'sword-shop', name: 'ดาบเหล็ก', icon: '⚔️', value: 200, type: 'weapon' as const, slot: 'weapon' as const, stats: { attack: 15 }, rarity: 'common' },
                        { id: 'shield-shop', name: 'โล่เหล็ก', icon: '🛡️', value: 150, type: 'armor' as const, slot: 'chest' as const, stats: { defense: 10 }, rarity: 'common' },
                        { id: 'boots-shop', name: 'รองเท้าวิ่ง', icon: '👢', value: 100, type: 'armor' as const, slot: 'boots' as const, stats: { speed: 2 }, rarity: 'common' },
                        { id: 'ring-shop', name: 'แหวนพลัง', icon: '💍', value: 300, type: 'accessory' as const, slot: 'accessory' as const, stats: { attack: 5, defense: 5 }, rarity: 'uncommon' },
                        { id: 'legendary-sword', name: 'ดาบราชันย์', icon: '🗡️', value: 2500, type: 'weapon' as const, slot: 'weapon' as const, stats: { attack: 50, critChance: 10 }, rarity: 'legendary' },
                        { id: 'mythic-armor', name: 'เกราะเทวะ', icon: '🛡️', value: 5000, type: 'armor' as const, slot: 'chest' as const, stats: { defense: 40, health: 100 }, rarity: 'mythic' }
                    ] as const;

                    const rarityChance = {
                        common: 0.6,
                        uncommon: 0.3,
                        rare: 0.15,
                        legendary: 0.05,
                        mythic: 0.01,
                    }

                    // Add 4 random items
                    for (let i=0; i<4; i++) {
                        const rand = Math.random();
                        let chosenRarity: ItemData['rarity'] = 'common';
                        if (rand < rarityChance.mythic) chosenRarity = 'mythic';
                        else if (rand < rarityChance.legendary) chosenRarity = 'legendary';
                        else if (rand < rarityChance.rare) chosenRarity = 'rare';
                        else if (rand < rarityChance.uncommon) chosenRarity = 'uncommon';

                        const availableItems = itemPool.filter(item => item.rarity === chosenRarity);
                        if(availableItems.length > 0) {
                            const shopItem = availableItems[Math.floor(Math.random() * availableItems.length)];
                            items.push({
                                ...shopItem,
                                uniqueId: generateUniqueId(),
                                description: `${shopItem.name} จากร้านค้า`,
                                enhancement: 0,
                                maxSockets: 0,
                                sockets: [],
                            });
                        }
                    }
                    
                    setShopItems(items);
                }, [generateUniqueId]);


                const getDistance = useCallback((a: Position, b: Position): number => {
                    const dx = a.x - b.x;
                    const dy = a.y - b.y;
                    return Math.sqrt(dx * dx + dy * dy);
                }, []);

                const hasLineOfSight = useCallback((start: Position, end: Position): boolean => {
                    if (!dungeonMap.current || dungeonMap.current.length === 0) return false;

                    let x1 = Math.floor(start.x);
                    let y1 = Math.floor(start.y);
                    const x2 = Math.floor(end.x);
                    const y2 = Math.floor(end.y);

                    const dx = Math.abs(x2 - x1);
                    const dy = Math.abs(y2 - y1);
                    const sx = (x1 < x2) ? 1 : -1;
                    const sy = (y1 < y2) ? 1 : -1;
                    let err = dx - dy;

                    while(true) {
                        if (dungeonMap.current[y1]?.[x1]?.type === 'wall') {
                            return false;
                        }
                        if ((x1 === x2) && (y1 === y2)) break;
                        const e2 = 2 * err;
                        if (e2 > -dy) { err -= dy; x1 += sx; }
                        if (e2 < dx) { err += dx; y1 += sy; }
                    }
                    return true;
                }, []);


                // Update vision/exploration
                const updateVision = useCallback((centerX: number, centerY: number) => {
                    const currentMap = dungeonMap.current;
                    if (!currentMap || currentMap.length === 0) return;

                    let mapChanged = false;
                    const newMap = [...currentMap]; // Shallow copy
            
                    const visionRangeSq = VISION_RANGE * VISION_RANGE;
                    const startX = Math.max(0, Math.floor(centerX - VISION_RANGE));
                    const endX = Math.min(DUNGEON_SIZE.width, Math.ceil(centerX + VISION_RANGE));
                    const startY = Math.max(0, Math.floor(centerY - VISION_RANGE));
                    const endY = Math.min(DUNGEON_SIZE.height, Math.ceil(centerY + VISION_RANGE));
            
                    for (let y = startY; y < endY; y++) {
                        let rowChanged = false;
                        let newRow: DungeonTile[] | null = null;
            
                        for (let x = startX; x < endX; x++) {
                            const tile = newMap[y]?.[x];
                            if (tile && !tile.explored) {
                                const dx = x - centerX;
                                const dy = y - centerY;
                                if (dx * dx + dy * dy <= visionRangeSq) {
                                    if (!rowChanged) {
                                        newRow = [...newMap[y]];
                                    }
                                    if (newRow) {
                                        newRow[x] = { ...tile, explored: true };
                                    }
                                    rowChanged = true;
                                }
                            }
                        }
                        if (rowChanged && newRow) {
                            newMap[y] = newRow;
                            mapChanged = true;
                        }
                    }
                    if (mapChanged) {
                        dungeonMap.current = newMap;
                    }
                }, []);

                const generateDungeon = useCallback(() => {
                    // Clear previous PIXI sprites to prevent artifacts on re-entry
                    if (tileContainerRef.current) tileContainerRef.current.removeChildren();
                    if (entityContainerRef.current) entityContainerRef.current.removeChildren();
                    tileSpritesRef.current.clear();
                    entitySpritesRef.current.clear();
                    if (effectsManager.current) {
                        effectsManager.current.clearAll();
                    }
                
                    const rng = new SeededRandom(dungeonLevel);
                    const map: DungeonTile[][] = Array.from({ length: DUNGEON_SIZE.height }, () => []);
                    const biomeKeys = Object.keys(BIOMES);
                    const biome = BIOMES[biomeKeys[Math.max(0, dungeonLevel - 1) % biomeKeys.length]];
                    const isBossLevel = dungeonLevel > 0 && dungeonLevel % 5 === 0;
                
                    setCurrentBiome(biome);
                    defeatedEnemiesRef.current.clear();
                    bossEntity.current = null;
                    setIsBossFightActive(false);
                
                    // Robust Generation with Validation Loop
                    let floorTiles: Position[] = [];
                    const minFloorTiles = DUNGEON_SIZE.width * DUNGEON_SIZE.height * 0.35;
                    let generationAttempts = 0;
                    const maxGenerationAttempts = 20;
                
                    while (floorTiles.length < minFloorTiles && generationAttempts < maxGenerationAttempts) {
                        generationAttempts++;
                        floorTiles = [];
                
                        // 1. Initialize with walls
                        for (let y = 0; y < DUNGEON_SIZE.height; y++) {
                            for (let x = 0; x < DUNGEON_SIZE.width; x++) {
                                map[y][x] = { type: 'wall', explored: false };
                            }
                        }
                
                        // 2. Drunkard's Walk algorithm to carve floors
                        let currentX = Math.floor(DUNGEON_SIZE.width / 2);
                        let currentY = Math.floor(DUNGEON_SIZE.height / 2);
                        const totalTiles = DUNGEON_SIZE.width * DUNGEON_SIZE.height;
                        const floorToCarve = totalTiles * 0.45; // Carve a bit extra to ensure minimum is met
                
                        for (let i = 0; i < floorToCarve; i++) {
                            if (map[currentY]?.[currentX]?.type === 'wall') {
                                map[currentY][currentX] = {
                                    type: 'floor',
                                    explored: false,
                                    decoration: rng.bool(0.1) ? biome.tilesets.decorations[Math.floor(rng.realInRange(0, biome.tilesets.decorations.length))] : undefined
                                };
                                floorTiles.push({ x: currentX, y: currentY });
                            }
                
                            const direction = Math.floor(rng.realInRange(0, 4));
                            if (direction === 0 && currentX > 1) currentX--;
                            else if (direction === 1 && currentX < DUNGEON_SIZE.width - 2) currentX++;
                            else if (direction === 2 && currentY > 1) currentY--;
                            else if (direction === 3 && currentY < DUNGEON_SIZE.height - 2) currentY++;
                        }
                    }
                
                    if (floorTiles.length === 0) {
                        console.error("Failed to generate a valid dungeon after multiple attempts.");
                        showNotification('เกิดข้อผิดพลาดในการสร้างดันเจี้ยน!', 'error');
                        setGameScreen('camp');
                        isDungeonReady.current = false;
                        return;
                    }
                
                    const newEntities: Entity[] = [];
                    let availableFloorTiles = [...floorTiles];
                
                    // 3. Place player
                    const playerStartIndex = Math.floor(rng.realInRange(0, availableFloorTiles.length));
                    const startPos = availableFloorTiles[playerStartIndex];
                    playerPosition.current = { x: startPos.x + 0.5, y: startPos.y + 0.5 };
                    availableFloorTiles.splice(playerStartIndex, 1);

                    // 3.5 Create Safe Zone around player
                    const SAFE_ZONE_RADIUS = 7;
                    availableFloorTiles = availableFloorTiles.filter(tile => getDistance(startPos, tile) > SAFE_ZONE_RADIUS);
                
                    if (isBossLevel) {
                        let bossPos: Position | null = null;
                        for (const tile of [...availableFloorTiles].reverse()) {
                            if (getDistance(startPos, tile) > 20) {
                                bossPos = tile;
                                break;
                            }
                        }
                        if (!bossPos && availableFloorTiles.length > 0) bossPos = availableFloorTiles[availableFloorTiles.length - 1];
                
                        if (bossPos) {
                            const bossData = ENEMY_TYPES.boss;
                            const bossHealth = bossData.health * (1 + dungeonLevel * 0.2);
                            const boss: Entity = {
                                id: `boss-${dungeonLevel}`, type: 'boss', position: { x: bossPos.x + 0.5, y: bossPos.y + 0.5 }, sprite: bossData.sprite,
                                health: bossHealth, maxHealth: bossHealth, skillCooldowns: {}, statusEffects: [],
                                stats: {
                                    level: dungeonLevel * 2, health: bossHealth, maxHealth: bossHealth, mana: 0, maxMana: 0,
                                    attack: bossData.attack * (1 + dungeonLevel * 0.15), defense: bossData.defense * (1 + dungeonLevel * 0.15), speed: bossData.speed, critChance: 15,
                                    experience: bossData.exp * dungeonLevel, experienceToNext: 0,
                                    cooldownReduction: 0, lifesteal: 0, manasteal: 0, magicFind: 0, goldFind: 0, aoeSize: 0,
                                },
                                aiState: 'idle', lastMove: Date.now(), attackCooldown: 0, specialAttackCooldown: 5, facing: 'down'
                            };
                            newEntities.push(boss);
                            map[bossPos.y][bossPos.x].type = 'portal';
                            availableFloorTiles = availableFloorTiles.filter(t => t.x !== bossPos!.x || t.y !== bossPos!.y);
                        }
                    } else {
                        // 4. Place exit portal far from the player
                        let exitPos: Position | null = null;
                        let maxDist = 0;
                        let exitIndex = -1;
                        availableFloorTiles.forEach((tile, index) => {
                            const dist = getDistance(startPos, tile);
                            if (dist > maxDist) {
                                maxDist = dist;
                                exitPos = tile;
                                exitIndex = index;
                            }
                        });
                
                        if (exitPos && exitIndex > -1) {
                            map[(exitPos as Position).y][(exitPos as Position).x].type = 'portal';
                            availableFloorTiles.splice(exitIndex, 1);
                        }
                
                        // 5. Place enemies
                        const enemyCount = 5 + dungeonLevel * 2;
                        for (let i = 0; i < enemyCount; i++) {
                            if (availableFloorTiles.length === 0) break;
                            const tileIndex = Math.floor(rng.realInRange(0, availableFloorTiles.length));
                            const { x, y } = availableFloorTiles[tileIndex];
                            
                            const enemyType = biome.enemyTypes[Math.floor(rng.realInRange(0, biome.enemyTypes.length))];
                            const enemyData = ENEMY_TYPES[enemyType as keyof typeof ENEMY_TYPES];
                            const isElite = rng.bool(0.1);
                            const enemyHealth = enemyData.health * (1 + dungeonLevel * 0.1) * (isElite ? 2 : 1);
                            
                            const enemy: Entity = {
                                id: `enemy-${i}`, type: 'enemy', position: { x: x + 0.5, y: y + 0.5 }, sprite: isElite ? `🌟${enemyData.sprite}` : enemyData.sprite,
                                health: enemyHealth, maxHealth: enemyHealth, skillCooldowns: {}, statusEffects: [],
                                stats: {
                                    level: dungeonLevel, health: enemyHealth, maxHealth: enemyHealth, mana: 0, maxMana: 0,
                                    attack: enemyData.attack * (1 + dungeonLevel * 0.07) * (isElite ? 1.5 : 1),
                                    defense: enemyData.defense * (1 + dungeonLevel * 0.07) * (isElite ? 1.5 : 1),
                                    speed: enemyData.speed, critChance: 5,
                                    experience: enemyData.exp * dungeonLevel * (isElite ? 3 : 1), experienceToNext: 0,
                                    cooldownReduction: 0, lifesteal: 0, manasteal: 0, magicFind: 0, goldFind: 0, aoeSize: 0,
                                },
                                aiState: 'idle', lastMove: Date.now(), attackCooldown: 0, facing: 'down'
                            };
                            newEntities.push(enemy);
                            availableFloorTiles.splice(tileIndex, 1);
                        }
                
                        // 6. Place chests
                        const itemCount = 3 + Math.floor(rng.realInRange(0, 3));
                        for (let i = 0; i < itemCount; i++) {
                            if (availableFloorTiles.length === 0) break;
                            const tileIndex = Math.floor(rng.realInRange(0, availableFloorTiles.length));
                            const { x, y } = availableFloorTiles[tileIndex];
                            map[y][x].type = 'chest';
                            availableFloorTiles.splice(tileIndex, 1);
                        }
                    }
                
                    dungeonMap.current = map;
                    entities.current = newEntities;
                    updateVision(playerPosition.current.x, playerPosition.current.y);
                    isDungeonReady.current = true;
                
                }, [dungeonLevel, getDistance, updateVision, showNotification]);

                const generateGem = useCallback((level: number = 1): ItemData => {
                    const gemTypeKeys = Object.keys(GEM_TYPES) as GemData['type'][];
                    const type = gemTypeKeys[Math.floor(Math.random() * gemTypeKeys.length)];
                    const baseGem = GEM_TYPES[type];

                    const gemId = generateUniqueId();
                    const statKey = Object.keys(baseGem.stats)[0];
                    const statValue = Math.floor(Object.values(baseGem.stats)[0] * Math.pow(2.5, level - 1));

                    return {
                        id: gemId,
                        uniqueId: gemId,
                        name: `${baseGem.name} T${level}`,
                        description: `An empowerd gem. +${statValue} ${statKey}`,
                        rarity: level === 1 ? 'uncommon' : level === 2 ? 'rare' : 'legendary',
                        type: 'gem',
                        icon: baseGem.icon,
                        value: 50 * Math.pow(3, level - 1),
                        gemData: {
                            id: gemId,
                            name: baseGem.name,
                            type: baseGem.type,
                            level: level,
                            icon: baseGem.icon,
                            stats: { [statKey]: statValue }
                        },
                        enhancement: 0,
                        maxSockets: 0,
                        sockets: [],
                    };
                }, [generateUniqueId]);

                // Calculate total stats with equipment, skill tree, ascension, and museum bonuses
                const totalStats = useMemo(() => {
                    let finalStats: CharacterStats = { ...playerStats };

                    if (isAdminMode) {
                        return {
                            ...finalStats,
                            health: 99999, maxHealth: 99999,
                            mana: 99999, maxMana: 99999,
                            attack: 9999, defense: 9999,
                            critChance: 100,
                        };
                    }

                    // 1. Ascension Bonuses (Base)
                    Object.entries(ascensionUpgrades).forEach(([id, level]) => {
                        const upgrade = ASCENSION_UPGRADES.find(u => u.id === id);
                        if (upgrade) {
                            if (id === 'asc_attack') finalStats.attack += level * 2;
                            if (id === 'asc_defense') finalStats.defense += level * 2;
                            if (id === 'asc_crit') finalStats.critChance += level * 0.5;
                            if (id === 'asc_gold') finalStats.goldFind += level * 2;
                            if (id === 'asc_magic') finalStats.magicFind += level * 2;
                        }
                    });

                    // 2. Skill Tree Bonuses
                    Object.entries(learnedSkills).forEach(([id, level]) => {
                        const skillNode = SKILL_TREE_DATA.find(s => s.id === id);
                        if (skillNode && skillNode.getBonus) {
                            const bonus = skillNode.getBonus(level, finalStats);
                            Object.entries(bonus).forEach(([statKey, statValue]) => {
                                if (typeof statValue === 'number') {
                                    (finalStats[statKey as keyof CharacterStats] as number) += statValue;
                                }
                            });
                        }
                    });

                    // 3. Equipment Bonuses
                    const equipmentBonus: { [key: string]: number } = {};
                    Object.values(equipment).forEach(item => {
                        if (!item) return;

                        // Base stats and enhancement bonus
                        if (item.stats) {
                            Object.entries(item.stats).forEach(([key, value]) => {
                                const enhancementMultiplier = 1 + (item.enhancement || 0) * 0.1; // +10% base stats per level
                                equipmentBonus[key] = (equipmentBonus[key] || 0) + (value * enhancementMultiplier);
                            });
                        }

                        // Gem bonus
                        if (item.sockets) {
                            item.sockets.forEach(gem => {
                                if (gem?.stats) {
                                    Object.entries(gem.stats).forEach(([key, value]) => {
                                        equipmentBonus[key] = (equipmentBonus[key] || 0) + value;
                                    });
                                }
                            })
                        }
                    });

                    // 4. Museum Set Bonuses
                    const museumBonus: { [key: string]: number } = {};
                    MUSEUM_SETS.forEach(set => {
                        const displayedItems = museumItems[set.id] || [];
                        const displayedItemNames = new Set(displayedItems.map(i => i.nameEn));
                        
                        if (set.itemNames.every(name => displayedItemNames.has(name))) {
                            Object.entries(set.bonus).forEach(([key, value]) => {
                                museumBonus[key] = (museumBonus[key] || 0) + value;
                            });
                        }
                    });

                    // 5. Combine all bonuses
                    const allBonuses = { ...equipmentBonus, ...museumBonus };
                    Object.entries(allBonuses).forEach(([key, value]) => {
                        if (key in finalStats) {
                            (finalStats[key as keyof CharacterStats] as number) += value;
                        }
                    });
                    
                    // Ensure health/mana are not over max
                    finalStats.health = Math.min(finalStats.health, finalStats.maxHealth);
                    finalStats.mana = Math.min(finalStats.mana, finalStats.maxMana);

                    // Floor stats for display
                    Object.keys(finalStats).forEach(key => {
                        if (typeof finalStats[key as keyof CharacterStats] === 'number') {
                            finalStats[key as keyof CharacterStats] = Math.floor(finalStats[key as keyof CharacterStats] as number);
                        }
                    })

                    return finalStats;
                }, [playerStats, equipment, learnedSkills, ascensionUpgrades, museumItems, isAdminMode]);
                
                // Effect to keep current health/mana in sync with max values from totalStats
                useEffect(() => {
                    setPlayerStats(prev => ({
                        ...prev,
                        health: Math.min(prev.health, totalStats.maxHealth),
                        mana: Math.min(prev.mana, totalStats.maxMana)
                    }));
                }, [totalStats.maxHealth, totalStats.maxMana]);

                // Generate random item with unique ID
                const generateRandomItem = useCallback((rarityOverride?: ItemData['rarity']): ItemData => {
                    const totalMagicFind = totalStats.magicFind;
                    let rarity: ItemData['rarity'];

                    if (rarityOverride) {
                        rarity = rarityOverride;
                    } else {
                        const rarities: ItemData['rarity'][] = ['common', 'common', 'common', 'uncommon', 'uncommon', 'rare'];
                        if (Math.random() < (0.05 * dungeonLevel) * (1 + totalMagicFind / 100)) rarities.push('legendary');
                        if (Math.random() < (0.01 * dungeonLevel) * (1 + totalMagicFind / 100) && dungeonLevel > 5) rarities.push('mythic');
                        rarity = rarities[Math.floor(Math.random() * rarities.length)];
                    }
                    
                    const itemTypes = [
                        {
                            type: 'weapon' as const,
                            names: ['ดาบ', 'ขวาน', 'คทา', 'หอก', 'ธนู', 'มีด'],
                            icons: ['⚔️', '🪓', '🔱', '🗡️', '🏹', '🔪'],
                            slot: 'weapon' as const,
                            baseStats: { attack: 10 + Math.floor(Math.random() * 20 * dungeonLevel) }
                        },
                        {
                            type: 'armor' as const,
                            names: ['เกราะ', 'หมวก', 'รองเท้า', 'กางเกง', 'ถุงมือ'],
                            icons: ['🛡️', '🎩', '👢', '👖', '🧤'],
                            slots: ['chest', 'helmet', 'boots', 'pants', 'helmet'] as const,
                            baseStats: { defense: 5 + Math.floor(Math.random() * 15 * dungeonLevel) }
                        },
                        {
                            type: 'accessory' as const,
                            names: ['แหวน', 'สร้อยคอ', 'ตุ้มหู', 'กำไล'],
                            icons: ['💍', '📿', '💎', '⌚'],
                            slot: 'accessory' as const,
                            baseStats: { 
                                health: Math.floor(Math.random() * 20 * dungeonLevel),
                                mana: Math.floor(Math.random() * 10 * dungeonLevel)
                            }
                        },
                        {
                            type: 'consumable' as const,
                            names: ['ยาฟื้นฟู', 'ยาเพิ่มพลัง', 'ยามานา', 'ยาต้านพิษ'],
                            icons: ['🧪', '💊', '🏺', '💚'],
                            baseStats: { heal: 50 + Math.floor(Math.random() * 50 * dungeonLevel) }
                        }
                    ];
                    
                    const itemType = itemTypes[Math.floor(Math.random() * itemTypes.length)];
                    const nameIdx = Math.floor(Math.random() * itemType.names.length);
                    
                    const stats: { [key: string]: number } = {};
                    Object.entries(itemType.baseStats).forEach(([key, value]) => {
                        stats[key] = Math.floor(value * (1 + (['common', 'uncommon', 'rare', 'legendary', 'mythic'].indexOf(rarity) * 0.2)));
                    });
                    
                    // Add random bonus stats for higher rarities
                    if (rarity === 'rare' || rarity === 'legendary' || rarity === 'mythic') {
                        const bonusStats = ['critChance', 'speed', 'lifesteal', 'cooldownReduction', 'magicFind', 'goldFind'];
                        const bonusStat = bonusStats[Math.floor(Math.random() * bonusStats.length)];
                        stats[bonusStat] = 5 + Math.floor(Math.random() * 10) * (['common', 'uncommon', 'rare', 'legendary', 'mythic'].indexOf(rarity) - 1);
                    }
                    
                    const rarityText = {
                        common: '',
                        uncommon: ' (พิเศษ)',
                        rare: ' (หายาก)',
                        legendary: ' (ตำนาน)',
                        mythic: ' (เทพ)'
                    };

                    const maxSockets = rarity === 'common' ? (Math.random() < 0.2 ? 1 : 0) :
                                rarity === 'uncommon' ? (Math.random() < 0.5 ? 1 : 0) :
                                rarity === 'rare' ? (Math.random() < 0.7 ? 2 : 1) :
                                rarity === 'legendary' ? (Math.random() < 0.8 ? 3 : 2) : 3;
                    
                    const newItemUniqueId = generateUniqueId();
                    return {
                        id: newItemUniqueId,
                        uniqueId: newItemUniqueId,
                        name: `${itemType.names[nameIdx]}${rarityText[rarity]}`,
                        description: `${itemType.names[nameIdx]}ที่พบในดันเจี้ยนชั้น ${dungeonLevel}`,
                        rarity,
                        type: itemType.type,
                        slot: itemType.type === 'armor' ? itemType.slots?.[nameIdx] : itemType.slot,
                        stats,
                        value: 10 * (['common', 'uncommon', 'rare', 'legendary', 'mythic'].indexOf(rarity) + 1) * dungeonLevel,
                        icon: itemType.icons[nameIdx],
                        quantity: itemType.type === 'consumable' ? Math.floor(Math.random() * 3) + 1 : undefined,
                        enhancement: 0,
                        maxSockets: itemType.type === 'consumable' ? 0 : maxSockets,
                        sockets: itemType.type === 'consumable' ? [] : Array(maxSockets).fill(null)
                    };
                }, [dungeonLevel, generateUniqueId, totalStats]);

                // Item management
                const pickupItem = useCallback((item: ItemData) => {
                    if (item.type === 'consumable' || item.type === 'material' || item.type === 'gem') {
                        let found = false;
                        const newInventory = inventory.map(i => {
                            if (i.name === item.name && i.type === item.type) {
                                found = true;
                                return { ...i, quantity: (i.quantity ?? 1) + (item.quantity ?? 1) };
                            }
                            return i;
                        });

                        if (found) {
                            setInventory(newInventory);
                            showNotification(`ได้รับ ${item.name} x${item.quantity || 1}`);
                            return;
                        }
                    }
                    
                    if (inventory.length >= maxInventorySlots) {
                        showNotification('กระเป๋าเต็ม!', 'error');
                        window.soundSystem?.play('error', { volume: settings.sfxVolume * 0.5 });
                        return;
                    }
                    
                    setInventory(prev => [...prev, item]);
                    showNotification(`ได้รับ ${item.name}!`);
                    
                    if (item.rarity === 'legendary') {
                        addAchievement('legendary_finder', 'ผู้ค้นพบตำนาน');
                    } else if (item.rarity === 'mythic') {
                        addAchievement('mythic_finder', 'ผู้ค้นพบของเทพ');
                    }
                }, [inventory, maxInventorySlots, settings.sfxVolume, showNotification, addAchievement]);

                const equipItem = useCallback((item: ItemData) => {
                    if (!item.slot) return;
                    
                    const currentEquipped = equipment[item.slot];
                    
                    const newInventory = inventory.filter(i => i.uniqueId !== item.uniqueId);
                    if (currentEquipped) {
                        newInventory.push(currentEquipped);
                    }
                    
                    setEquipment({ ...equipment, [item.slot]: item });
                    setInventory(newInventory);
                    
                    window.soundSystem?.play('equip', { volume: settings.sfxVolume });
                    showNotification(`สวมใส่ ${item.name}`);
                }, [equipment, inventory, settings.sfxVolume, showNotification]);

                const unequipItem = useCallback((slot: string) => {
                    if (!slot) return;
                    const item = equipment[slot as keyof typeof equipment];
                    if (!item) return;
                    
                    if (inventory.length >= maxInventorySlots) {
                        showNotification('กระเป๋าเต็ม!', 'error');
                        return;
                    }
                    
                    setEquipment({ ...equipment, [slot]: null });
                    setInventory([...inventory, item]);
                    
                    window.soundSystem?.play('unequip', { volume: settings.sfxVolume });
                }, [equipment, inventory, maxInventorySlots, settings.sfxVolume, showNotification]);

                const useItem = useCallback((item: ItemData) => {
                    if (item.type !== 'consumable') return;

                    const consume = () => {
                        setInventory(prev => {
                            const newInventory = [...prev];
                            const index = newInventory.findIndex(i => i.uniqueId === item.uniqueId);
                            if (index === -1) return prev;
                            
                            const currentItem = newInventory[index];
                            if (currentItem.quantity && currentItem.quantity > 1) {
                                newInventory[index] = { ...currentItem, quantity: currentItem.quantity - 1 };
                                return newInventory;
                            } else {
                                return newInventory.filter(i => i.uniqueId !== item.uniqueId);
                            }
                        });
                    }
                    
                    if (item.stats?.heal) {
                        setPlayerStats(prev => {
                            const healAmount = Math.min(item.stats?.heal ?? 0, prev.maxHealth - prev.health);
                            if (effectsManager.current) effectsManager.current.createHealEffect(playerPosition.current);
                            showNotification(`ฟื้นฟู ${healAmount} HP`);
                            return {
                                ...prev,
                                health: prev.health + healAmount
                            }
                        });
                        consume();
                    } else if (item.stats?.mana) {
                        setPlayerStats(prev => {
                            const manaAmount = Math.min(item.stats?.mana ?? 0, prev.maxMana - prev.mana);
                            showNotification(`ฟื้นฟู ${manaAmount} Mana`);
                            return {
                                ...prev,
                                mana: prev.mana + manaAmount
                            }
                        });
                        consume();
                    } else if (item.stats?.attack_buff) {
                        // Future: implement player status effects
                        showNotification(`พลังโจมตีเพิ่มขึ้น!`);
                        consume();
                    }
                        
                    window.soundSystem?.play('potion', { volume: settings.sfxVolume });
                        
                }, [settings.sfxVolume, showNotification]);

                const openModal = useCallback((type: ModalType, payload: any = null) => {
                    setActiveModal(type);
                    setModalPayload(payload);
                    if (gameScreen === 'dungeon') {
                        setIsPaused(true);
                    }
                }, [gameScreen]);

                const closeModal = useCallback(() => {
                    playClickSound();
                    setActiveModal(null);
                    setModalPayload(null);
                    setIsPaused(false);
                }, [playClickSound]);


                const playerDefeated = useCallback(() => {
                    window.soundSystem?.play('playerDeath', { volume: settings.sfxVolume });
                    setIsBossFightActive(false);
                    window.soundSystem?.switchToNormalBGM();
                    openModal('playerDefeated');
                }, [settings.sfxVolume, openModal]);

                const enemyAttack = useCallback((enemy: Entity) => {
                    if (!enemy.stats) return;

                    setPlayerStats(prevPlayerStats => {
                        if (!enemy.stats) return prevPlayerStats;
                        
                        let damage = Math.max(1, enemy.stats.attack - totalStats.defense);
                        if (isAdminMode) damage = 0; // Admin mode god mode

                        const finalDamage = Math.floor(damage);
                        const newHealth = prevPlayerStats.health - finalDamage;

                        if (effectsManager.current) {
                            effectsManager.current.createHitEffect(playerPosition.current, false, finalDamage);
                        }

                        if (canvasContainerRef.current) {
                            canvasContainerRef.current.classList.add('animate-damage-shake');
                            setTimeout(() => {
                                if (canvasContainerRef.current) {
                                    canvasContainerRef.current.classList.remove('animate-damage-shake');
                                }
                            }, 300);
                        }

                        window.soundSystem?.play('playerHit', { volume: settings.sfxVolume });

                        if (newHealth <= 0 && !isAdminMode) {
                            playerDefeated();
                        }

                        return {
                            ...prevPlayerStats,
                            health: Math.max(0, newHealth)
                        };
                    });
                }, [totalStats, playerDefeated, settings.sfxVolume, isAdminMode]);


                const defeatedEnemy = useCallback((enemy: Entity) => {
                    if (!enemy.stats) return;
                    
                    if (effectsManager.current) {
                        effectsManager.current.createEnemyDeathEffect(enemy.position, enemy.sprite);
                    }

                    const expGained = Math.floor(enemy.stats.experience * (1 + (ascensionLevel * 0.1)));
                    const goldGained = Math.floor((10 + (enemy.stats.level ?? 1) * 5 + Math.floor(Math.random() * 20)) * (1 + totalStats.goldFind / 100));

                    applyLevelUp(expGained);
                    setResources(prev => ({ ...prev, gold: prev.gold + goldGained }));

                    // Handle material drops
                    const enemyTypeKey = Object.keys(ENEMY_TYPES).find(key => ENEMY_TYPES[key as keyof typeof ENEMY_TYPES].sprite.includes(enemy.sprite.replace('🌟','')));
                    if (enemyTypeKey) {
                        const enemyData = ENEMY_TYPES[enemyTypeKey as keyof typeof ENEMY_TYPES];
                        if (enemyData.drops) {
                            Object.entries(enemyData.drops).forEach(([material, chance]) => {
                                if (Math.random() < chance * (1 + totalStats.magicFind / 200)) { // Magic find slightly increases material drops
                                    setResources(prev => ({
                                        ...prev,
                                        materials: { ...prev.materials, [material]: (prev.materials[material as keyof typeof prev.materials] || 0) + 1 }
                                    }));
                                    window.soundSystem?.play('materialDrop', { volume: settings.sfxVolume });
                                }
                            });
                        }
                    }
                    
                    // Gem Drop
                    if (Math.random() < (0.1 + (dungeonLevel * 0.01)) * (1 + totalStats.magicFind / 100)) {
                        const gem = generateGem();
                        pickupItem(gem);
                    }

                    // Remove enemy and potentially drop item
                    const currentEntities = entities.current.filter(e => e.id !== enemy.id);
                    if (enemy.type === 'boss') {
                        entities.current = currentEntities;
                    }
                    else if (Math.random() < (0.3 + ((enemy.stats?.level ?? 1) * 0.05)) * (1 + totalStats.magicFind / 100)) {
                        const item = generateRandomItem();
                        const itemEntity: Entity = {
                            id: `drop-${Date.now()}-${Math.random()}`,
                            type: 'item',
                            position: { ...enemy.position },
                            sprite: '📦',
                            item,
                            skillCooldowns: {},
                            statusEffects: [],
                        };
                        window.soundSystem?.play('itemDrop', { volume: settings.sfxVolume });
                        entities.current = [...currentEntities, itemEntity];
                    } else {
                        entities.current = currentEntities;
                    }

                    window.soundSystem?.play('enemyDeath', { volume: settings.sfxVolume });

                    if (enemy.type === 'boss') {
                        setIsBossFightActive(false);
                        window.soundSystem?.switchToNormalBGM();
                        addAchievement('boss_slayer', `ผู้พิชิตบอสชั้น ${dungeonLevel}`);
                        pickupItem(generateRandomItem(Math.random() < 0.5 ? 'legendary' : 'mythic'));
                    }

                    if (enemy.stats.level >= 5 && enemy.type !== 'boss') {
                        addAchievement('strong_foe', 'ผู้ล่ามอนสเตอร์แข็งแกร่ง');
                    }
                }, [settings.sfxVolume, addAchievement, generateRandomItem, applyLevelUp, dungeonLevel, pickupItem, totalStats, ascensionLevel, generateGem]);

                // Combat System
                const attackEnemy = useCallback((enemy: Entity) => {
                    if (!enemy.stats || !enemy.health || enemy.health <= 0 || !hasLineOfSight(playerPosition.current, enemy.position)) return;
                    
                    const damage = Math.max(1, totalStats.attack - (enemy.stats.defense || 0));
                    const isCrit = Math.random() * 100 < totalStats.critChance;
                    const finalDamage = Math.floor(isCrit ? damage * 1.5 : damage);
                    
                    if (effectsManager.current) {
                        effectsManager.current.createHitEffect(enemy.position, isCrit, finalDamage);
                    }
                    
                    window.soundSystem?.play(isCrit ? 'critical' : 'hit', { volume: settings.sfxVolume });
                    
                    // Lifesteal / Manasteal
                    if (totalStats.lifesteal > 0) {
                        const lifeleech = Math.ceil(finalDamage * (totalStats.lifesteal / 100));
                        setPlayerStats(prev => ({...prev, health: Math.min(prev.maxHealth, prev.health + lifeleech)}));
                    }
                    if (totalStats.manasteal > 0) {
                        const manaleech = Math.ceil(finalDamage * (totalStats.manasteal / 100));
                        setPlayerStats(prev => ({...prev, mana: Math.min(prev.maxMana, prev.mana + manaleech)}));
                    }
                    
                    // Apply damage immutably
                    entities.current = entities.current.map(e => 
                        e.id === enemy.id ? { ...e, health: (e.health || 0) - finalDamage } : e
                    );
                }, [totalStats, settings.sfxVolume, hasLineOfSight]);

                const damageWall = useCallback((x: number, y: number) => {
                    const newMap = dungeonMap.current.map(row => [...row]);
                    const tile = newMap[y]?.[x];

                    if (tile && tile.isDestructible) {
                        const newHealth = (tile.health || 1) - 1;
                        if (newHealth <= 0) {
                            newMap[y][x] = { ...tile, type: 'floor', isDestructible: false, health: 0, decoration: '💥' };
                            window.soundSystem?.play('trap', { volume: settings.sfxVolume }); // Reuse trap sound for breaking
                            addAchievement('wall_breaker', 'นักทำลายกำแพง');
                        } else {
                            newMap[y][x] = { ...tile, health: newHealth };
                            window.soundSystem?.play('hit', { volume: settings.sfxVolume * 0.5 });
                        }
                    }
                    dungeonMap.current = newMap;
                }, [settings.sfxVolume, addAchievement]);
                
                // Helper functions
                
                const findNearestEnemy = useCallback((range: number): Entity | null => {
                    const enemiesInRange = entities.current.filter(e => (e.type === 'enemy' || e.type === 'boss') && (e.health ?? 0) > 0);
                    let nearest: Entity | null = null;
                    let minDistance = range;
                    
                    enemiesInRange.forEach(enemy => {
                        const distance = getDistance(playerPosition.current, enemy.position);
                        if (distance < minDistance && hasLineOfSight(playerPosition.current, enemy.position)) {
                            minDistance = distance;
                            nearest = enemy;
                        }
                    });
                    
                    return nearest;
                }, [getDistance, hasLineOfSight]);

                // Skill System
                const useSkill = useCallback((slotIndex: number) => {
                    const skillId = activeSkills[slotIndex];
                    if (!skillId) return;
                    
                    const skill = ALL_SKILLS.find(s => s.id === skillId);
                    if (!skill) return;

                    const finalCooldown = skill.cooldown * (1 - (totalStats.cooldownReduction / 100));

                    if ((skillCooldowns[skillId] || 0) > 0) {
                        showNotification(`${skill.name} ยังไม่พร้อม! (${Math.ceil(skillCooldowns[skillId] ?? 0)}s)`, 'error');
                        return;
                    }
                    
                    if (playerStats.mana < skill.manaCost && !isAdminMode) {
                        showNotification('มานาไม่พอ!', 'error');
                        window.soundSystem?.play('error', { volume: settings.sfxVolume * 0.5 });
                        return;
                    }
                    
                    if (!isAdminMode) {
                        setPlayerStats(prev => ({ ...prev, mana: prev.mana - skill.manaCost }));
                    }
                    setSkillCooldowns(prev => ({ ...prev, [skillId]: finalCooldown }));
                    
                    switch(skill.id) {
                        case 'fireball': {
                            const nearestEnemy = findNearestEnemy(skill.range || 5);
                            if (nearestEnemy && effectsManager.current) {
                                effectsManager.current.createFireball(playerPosition.current, nearestEnemy.position, () => {
                                    const targetExists = entities.current.find(e => e.id === nearestEnemy.id && (e.health ?? 0) > 0);
                                    if(targetExists) {
                                        const damage = skill.damage || 0;
                                        entities.current = entities.current.map(e => e.id === nearestEnemy.id ? {...e, health: (e.health ?? 0) - damage} : e);
                                        if (effectsManager.current) effectsManager.current.createHitEffect(nearestEnemy.position, false, damage);
                                    }
                                });
                            }
                            break;
                        }
                        case 'heal': {
                            const healAmount = Math.abs(skill.damage || 30);
                            setPlayerStats(prev => ({...prev, health: Math.min(prev.maxHealth, prev.health + healAmount) }));
                            if (effectsManager.current) effectsManager.current.createHealEffect(playerPosition.current);
                            break;
                        }
                        case 'whirlwind': {
                            const damage = skill.damage || 0;
                            const aoe = (skill.area || 2) * (1 + totalStats.aoeSize / 100);
                            const nearbyEnemies = entities.current.filter(e => 
                                (e.type === 'enemy' || e.type === 'boss') && (e.health ?? 0) > 0 &&
                                getDistance(playerPosition.current, e.position) <= aoe
                            );
                            const enemyIds = nearbyEnemies.map(e => e.id);
                            
                            if (enemyIds.length > 0) {
                                entities.current = entities.current.map(e => 
                                    enemyIds.includes(e.id) ? { ...e, health: (e.health ?? 0) - damage } : e
                                );
                                nearbyEnemies.forEach(e => effectsManager.current?.createHitEffect(e.position, false, damage));
                            }
                            if (effectsManager.current) effectsManager.current.createWhirlwindEffect(playerPosition.current);
                            break;
                        }
                        case 'dash': {
                            const dashDistance = 4;
                            const targetX = playerPosition.current.x + playerVelocity.current.x * dashDistance;
                            const targetY = playerPosition.current.y + playerVelocity.current.y * dashDistance;
                            
                            // Basic collision check for dash
                            if (dungeonMap.current[Math.floor(targetY)]?.[Math.floor(targetX)]?.type !== 'wall') {
                                playerPosition.current = { x: targetX, y: targetY };
                            } else {
                                playerPosition.current = { x: playerPosition.current.x + playerVelocity.current.x, y: playerPosition.current.y + playerVelocity.current.y };
                            }
                            if (effectsManager.current) effectsManager.current.createDashEffect(playerPosition.current, playerVelocity.current);
                            break;
                        }
                        case 'shield_bash': {
                            const nearestEnemy = findNearestEnemy(skill.range || ATTACK_RANGE);
                            if (nearestEnemy) {
                                const damage = skill.damage || 0;
                                const duration = skill.duration || 2;
                                entities.current = entities.current.map(e => {
                                    if (e.id === nearestEnemy.id) {
                                        const newStatusEffect: StatusEffect = { id: 'stun', duration: duration };
                                        return { ...e, health: (e.health ?? 0) - damage, statusEffects: [...e.statusEffects, newStatusEffect], aiState: 'stunned' };
                                    }
                                    return e;
                                });
                                if (effectsManager.current) {
                                    effectsManager.current.createShieldBashEffect(nearestEnemy.position);
                                    effectsManager.current.createHitEffect(nearestEnemy.position, false, damage);
                                }
                            }
                            break;
                        }
                        case 'poison_nova': {
                            const damagePerSecond = skill.damage || 0;
                            const duration = skill.duration || 5;
                            const aoe = (skill.area || 3) * (1 + totalStats.aoeSize / 100);

                            const nearbyEnemies = entities.current.filter(e => 
                                (e.type === 'enemy' || e.type === 'boss') && (e.health ?? 0) > 0 &&
                                getDistance(playerPosition.current, e.position) <= aoe
                            );

                            entities.current = entities.current.map(e => {
                                if (nearbyEnemies.some(ne => ne.id === e.id)) {
                                    const newStatusEffect: StatusEffect = { id: 'poison', duration, damage: damagePerSecond, interval: 1, lastTick: Date.now() };
                                    const newStatusEffects: StatusEffect[] = [...e.statusEffects.filter(se => se.id !== 'poison'), newStatusEffect];
                                    return { ...e, statusEffects: newStatusEffects };
                                }
                                return e;
                            });

                            if (effectsManager.current) effectsManager.current.createPoisonNovaEffect(playerPosition.current, aoe);
                            break;
                        }
                    }
                    
                    window.soundSystem?.play('skill', { volume: settings.sfxVolume });
                    
                }, [skillCooldowns, playerStats.mana, settings.sfxVolume, showNotification, findNearestEnemy, getDistance, totalStats, isAdminMode, activeSkills]);

                // Special tile interactions
                const openChest = (x: number, y: number) => {
                    if (effectsManager.current) effectsManager.current.createChestOpenEffect({ x, y });

                    const item = generateRandomItem();
                    if (item.rarity === 'legendary' || item.rarity === 'mythic') {
                        item.value *= 2;
                    }
                    
                    pickupItem(item);
                    
                    const newMap = [...dungeonMap.current];
                    newMap[y] = [...newMap[y]];
                    newMap[y][x] = {...newMap[y][x], type: 'floor', decoration: '🔓'};
                    dungeonMap.current = newMap;
                    
                    window.soundSystem?.play('chest', { volume: settings.sfxVolume });
                };

                const triggerTrap = (x: number, y: number) => {
                    const damage = isAdminMode ? 0 : (10 + dungeonLevel * 5);
                    
                    setPlayerStats(prev => ({
                        ...prev,
                        health: Math.max(0, prev.health - damage)
                    }));
                    
                    if (effectsManager.current) {
                        effectsManager.current.createTrapEffect({x,y});
                    }
                    
                    const newMap = [...dungeonMap.current];
                    newMap[y][x].type = 'floor';
                    newMap[y][x].effect = 'fire';
                    dungeonMap.current = newMap;
                    
                    window.soundSystem?.play('trap', { volume: settings.sfxVolume });
                    
                    if (playerStats.health - damage <= 0) {
                        playerDefeated();
                    }
                };

                // Building management
                const purchaseBuilding = useCallback((buildingId: string) => {
                    const building = buildings.find(b => b.id === buildingId);
                    if (!building || building.unlocked) return;

                    if (resources.gold < building.purchaseCost && !isAdminMode) {
                        showNotification('ทองไม่พอ!', 'error');
                        window.soundSystem?.play('error', { volume: settings.sfxVolume * 0.5 });
                        return;
                    }
                    
                    if (!isAdminMode) {
                        setResources(prev => ({ ...prev, gold: prev.gold - building.purchaseCost }));
                    }
                    setBuildings(prev => prev.map(b => b.id === buildingId ? {...b, unlocked: true} : b));

                    window.soundSystem?.play('upgrade', { volume: settings.sfxVolume });
                    showNotification(`สร้าง ${building.name} สำเร็จ!`);
                    addAchievement('builder', 'ผู้สร้าง');
                    closeModal();
                }, [buildings, resources.gold, settings.sfxVolume, showNotification, addAchievement, isAdminMode, closeModal]);

                const purchaseInventorySlot = useCallback(() => {
                    const cost = 1000 * Math.pow(1.1, maxInventorySlots - INITIAL_INVENTORY_SLOTS);
                    if (resources.gold < cost && !isAdminMode) {
                        showNotification('ทองไม่พอ!', 'error');
                        return;
                    }
                    if (!isAdminMode) {
                        setResources(prev => ({ ...prev, gold: prev.gold - Math.floor(cost)}));
                    }
                    setMaxInventorySlots(prev => prev + 1);
                    showNotification('ขยายช่องเก็บของสำเร็จ!', 'success');
                    window.soundSystem?.play('buy', { volume: settings.sfxVolume });

                }, [maxInventorySlots, resources.gold, showNotification, settings.sfxVolume, isAdminMode]);

                // Blacksmith Functions
                const enhanceItem = useCallback((item: ItemData, isProtected: boolean = false) => {
                    const enhancement = item.enhancement || 0;
                    if (enhancement >= MAX_ENHANCEMENT) {
                        showNotification('ไอเทมถึงระดับสูงสุดแล้ว', 'error');
                        return;
                    }
                    
                    const costGold = 100 * Math.pow(enhancement + 1, 2);
                    const costCrystal = Math.ceil(Math.pow(enhancement + 1, 1.5));
                    const protectCostGems = 10 + Math.floor(Math.pow(enhancement, 1.2));

                    if (isProtected && resources.gems < protectCostGems && !isAdminMode) {
                        showNotification(`ต้องการ ${protectCostGems} เพชรสำหรับป้องกัน!`, 'error');
                        return;
                    }

                    if ((resources.gold < costGold || (resources.materials.corruptedCrystals || 0) < costCrystal) && !isAdminMode) {
                        showNotification('วัตถุดิบไม่พอ!', 'error');
                        return;
                    }
                    
                    if (!isAdminMode) {
                        setResources(prev => ({
                            ...prev,
                            gold: prev.gold - costGold,
                            materials: { ...prev.materials, corruptedCrystals: (prev.materials.corruptedCrystals || 0) - costCrystal },
                            gems: isProtected ? prev.gems - protectCostGems : prev.gems
                        }));
                    }

                    const successChance = isAdminMode ? 1.0 : (1.0 - (enhancement * 0.06)); // 100% -> 94% -> 88% ...
                    const roll = Math.random();
                    
                    let newItem = { ...item };

                    if (roll < successChance) {
                        newItem.enhancement = enhancement + 1;
                        showNotification(`ตีบวกสำเร็จ! ${item.name} เป็น +${newItem.enhancement}`, 'success');
                        window.soundSystem?.play('upgrade', { volume: settings.sfxVolume });
                    } else {
                        if (isProtected) {
                            showNotification(`ตีบวกล้มเหลว แต่เพชรช่วยป้องกันไอเทมไว้!`, 'success');
                            window.soundSystem?.play('secretFound', { volume: settings.sfxVolume });
                        } else {
                            const destructionChance = enhancement >= 10 ? 0.1 * (enhancement - 9) : 0;
                            const downgradeChance = enhancement >= 5 ? 0.5 : 0;

                            if (Math.random() < destructionChance) {
                                setInventory(prev => prev.filter(i => i.uniqueId !== item.uniqueId));
                                setSelectedForgeItem(null);
                                showNotification(`ตีบวกล้มเหลวรุนแรง... ${item.name} แตกสลาย!`, 'error');
                                window.soundSystem?.play('playerDeath', { volume: settings.sfxVolume });
                                return;
                            } else if (Math.random() < downgradeChance) {
                                newItem.enhancement = Math.max(0, enhancement - 1);
                                showNotification(`ตีบวกล้มเหลว... ${item.name} ลดระดับเป็น +${newItem.enhancement}`, 'error');
                                window.soundSystem?.play('error', { volume: settings.sfxVolume });
                            } else {
                                showNotification('ตีบวกล้มเหลว! โชคดีที่ไอเทมไม่เสียหาย', 'error');
                                window.soundSystem?.play('error', { volume: settings.sfxVolume });
                            }
                        }
                    }
                    
                    setInventory(prev => prev.map(i => i.uniqueId === item.uniqueId ? newItem : i));
                    setSelectedForgeItem(newItem);

                }, [resources, settings.sfxVolume, showNotification, isAdminMode]);

                const socketGem = useCallback((item: ItemData, gem: ItemData, socketIndex: number) => {
                    if (!item.sockets || !gem.gemData) return;
                    if (item.sockets[socketIndex] !== null) {
                        showNotification('ช่องนี้มีอัญมณีอยู่แล้ว', 'error');
                        return;
                    }

                    const newItem = { ...item, sockets: [...item.sockets] };
                    newItem.sockets[socketIndex] = gem.gemData;
                    
                    // Remove one gem from inventory
                    const newInventory = [...inventory];
                    const gemInvIndex = newInventory.findIndex(i => i.uniqueId === gem.uniqueId);
                    if (gemInvIndex !== -1) {
                        if ((newInventory[gemInvIndex].quantity || 1) > 1) {
                            newInventory[gemInvIndex].quantity! -= 1;
                        } else {
                            newInventory.splice(gemInvIndex, 1);
                        }
                    }
                    
                    const itemIndex = newInventory.findIndex(i => i.uniqueId === item.uniqueId);
                    if (itemIndex > -1) {
                        newInventory[itemIndex] = newItem;
                    }

                    setInventory(newInventory);
                    setSelectedForgeItem(newItem);
                    setSelectedGem(null);
                    showNotification(`ใส่ ${gem.name} สำเร็จ!`, 'success');
                    window.soundSystem?.play('equip', { volume: settings.sfxVolume });

                }, [inventory, settings.sfxVolume, showNotification]);

                const combineGems = useCallback((gemToCombine: ItemData) => {
                    if (!gemToCombine.gemData || (gemToCombine.quantity || 1) < 3) {
                        showNotification('ต้องการอัญมณีชนิดเดียวกัน 3 เม็ด', 'error');
                        return;
                    }

                    const { level } = gemToCombine.gemData;
                    
                    // Remove 3 gems
                    const newInventory = [...inventory];
                    const gemIndex = newInventory.findIndex(i => i.uniqueId === gemToCombine.uniqueId);
                    if (gemIndex === -1) return;

                    newInventory[gemIndex].quantity! -= 3;
                    if (newInventory[gemIndex].quantity! <= 0) {
                        newInventory.splice(gemIndex, 1);
                    }

                    // Add 1 higher tier gem
                    const newGem = generateGem(level + 1);
                    const existingStack = newInventory.find(i => i.name === newGem.name);
                    if (existingStack) {
                        existingStack.quantity = (existingStack.quantity || 1) + 1;
                    } else {
                        newInventory.push({ ...newGem, quantity: 1 });
                    }
                    
                    setInventory(newInventory);
                    showNotification(`รวม ${gemToCombine.name} x3 -> ${newGem.name} สำเร็จ!`, 'success');
                    window.soundSystem?.play('crafting', { volume: settings.sfxVolume });

                }, [inventory, settings.sfxVolume, showNotification, generateGem]);


                // NFT Minting System
                const mintItemAsNFT = async (item: ItemData) => {
                    if (!contract || !signer || !userAddress || !item) {
                        showNotification('กรุณาเชื่อมต่อ Wallet หรือเลือกไอเทม!', 'error');
                        return;
                    }

                    if (item.isNFT) {
                        showNotification('ไอเทมนี้เป็น NFT แล้ว!', 'error');
                        return;
                    }

                    const mintCost = item.rarity === 'mythic' ? 1000 : item.rarity === 'legendary' ? 500 : 200;
                    if (resources.gold < mintCost && !isAdminMode) {
                        showNotification(`ต้องการ ${mintCost} Gold สำหรับ Mint!`, 'error');
                        return;
                    }

                    setLoading(true);
                    showNotification('กำลังสร้าง NFT... กรุณายืนยันใน Wallet');

                    try {
                        const tx = await contract.mintWeapon(userAddress, item.name, item.description, item.uniqueId || item.id);
                        const receipt = await tx.wait();

                        if (!receipt || receipt.status === 0) {
                            throw new Error("The transaction was reverted by the contract.");
                        }
                        
                        if (!isAdminMode) {
                            setResources(prev => ({
                                ...prev,
                                gold: prev.gold - mintCost
                            }));
                        }
                        
                        setInventory(prevInventory => prevInventory.filter(i => i.uniqueId !== item.uniqueId));
                        await loadNFTItems();

                        window.soundSystem?.play('mint', { volume: settings.sfxVolume });
                        showNotification('สร้าง NFT สำเร็จ!');
                        showNotification(`หักค่าธรรมเนียม ${mintCost} Gold`, 'info');
                        addAchievement('nft_creator', 'ผู้สร้าง NFT');

                    } catch (err: any) {
                        console.error('Minting failed:', err);
                        let message = "การทำธุรกรรมล้มเหลว กรุณาลองใหม่";
                        if (err.code === 'CALL_EXCEPTION' || err.reason?.includes('require(false)')) {
                            message = "Smart Contract ปฏิเสธการทำธุรกรรม: อาจส่งข้อมูลไม่ถูกต้อง หรือไม่เข้าเงื่อนไข require ใน contract";
                        } else if (err.code === 'ACTION_REJECTED') {
                            message = "คุณปฏิเสธการทำธุรกรรมใน Wallet";
                        }
                        showNotification(`สร้าง NFT ล้มเหลว: ${message}`, 'error');
                    } finally {
                        setLoading(false);
                        closeModal();
                        setSelectedSoulforgeItem(null);
                    }
                };

                const craftItem = useCallback((recipe: CraftingRecipe) => {
                    // Check costs
                    if (resources.gold < recipe.goldCost && !isAdminMode) {
                        showNotification('ทองไม่พอ!', 'error');
                        return;
                    }

                    for (const [material, amount] of Object.entries(recipe.cost)) {
                        if ((resources.materials[material as keyof typeof resources.materials] || 0) < amount && !isAdminMode) {
                            showNotification(`วัตถุดิบไม่พอ: ${material}!`, 'error');
                            return;
                        }
                    }

                    // Deduct costs
                    if (!isAdminMode) {
                        setResources(prev => {
                            const newMaterials = { ...prev.materials };
                            for (const [material, amount] of Object.entries(recipe.cost)) {
                                (newMaterials[material as keyof typeof newMaterials] as number) -= amount;
                            }
                            return {
                                ...prev,
                                gold: prev.gold - recipe.goldCost,
                                materials: newMaterials
                            };
                        });
                    }

                    // Add item to inventory
                    const baseItem = CONSUMABLE_ITEMS_BASE.find(i => i.name === recipe.result.name);
                    if (baseItem) {
                        const newItemUniqueId = generateUniqueId();
                        const newItem: ItemData = {
                            ...baseItem,
                            id: newItemUniqueId,
                            uniqueId: newItemUniqueId,
                            quantity: recipe.result.quantity,
                            enhancement: 0,
                            maxSockets: 0,
                            sockets: [],
                        };
                        pickupItem(newItem);
                    }

                    window.soundSystem?.play('crafting', { volume: settings.sfxVolume });
                    showNotification(`สร้าง ${recipe.name} สำเร็จ!`);

                }, [resources, settings.sfxVolume, pickupItem, showNotification, isAdminMode, generateUniqueId]);

                // Complete dungeon
                const completeDungeon = useCallback(() => {
                    const bonusGold = Math.floor(50 * dungeonLevel * (1 + totalStats.goldFind / 100));
                    const bonusExp = 100 * dungeonLevel;
                    
                    setResources(prev => ({ ...prev, gold: prev.gold + bonusGold }));
                    applyLevelUp(bonusExp);
                    
                    if (dungeonLevel % 5 === 0) {
                        // Reward is given on boss defeat, not here.
                    }
                    
                    window.soundSystem?.play('victory', { volume: settings.sfxVolume });
                    
                    // Show modal using new system
                    openModal('playerDefeated', {
                        victory: true,
                        bonusGold,
                        bonusExp,
                        nextLevel: dungeonLevel + 1
                    });
                    
                    if (dungeonLevel === 1) addAchievement('first_clear', 'ผู้กล้าหาญ');
                    else if (dungeonLevel === 10) addAchievement('dungeon_10', 'ผู้พิชิตดันเจี้ยน');

                }, [dungeonLevel, settings.sfxVolume, applyLevelUp, addAchievement, totalStats, openModal]);

                // AI System for enemies
                const getEnemyTypeFromSprite = (sprite: string) => {
                    const cleanSprite = sprite.replace('🌟', ''); // Handle elites
                    for (const type in ENEMY_TYPES) {
                        if (ENEMY_TYPES[type as keyof typeof ENEMY_TYPES].sprite === cleanSprite) {
                            return ENEMY_TYPES[type as keyof typeof ENEMY_TYPES];
                        }
                    }
                    return null;
                }

                const updateEnemyAI = useCallback((deltaTime: number) => {
                    if (!entities.current || entities.current.length === 0) {
                        return; // Guard against running on empty or uninitialized entities
                    }
                    const now = Date.now();
                
                    const isOccupiedByOther = (x: number, y: number, excludeId?: string): boolean => {
                        const tileX = Math.floor(x);
                        const tileY = Math.floor(y);
                        return entities.current.some(e =>
                            e.id !== excludeId &&
                            e.type !== 'item' &&
                            Math.floor(e.position.x) === tileX &&
                            Math.floor(e.position.y) === tileY
                        );
                    };
                
                    const isValidMove = (x: number, y: number): boolean => {
                        return x >= 0 && x < DUNGEON_SIZE.width &&
                            y >= 0 && y < DUNGEON_SIZE.height &&
                            dungeonMap.current[Math.floor(y)]?.[Math.floor(x)]?.type !== 'wall';
                    };
                
                    const playerPos = playerPosition.current;
                
                    entities.current = entities.current.map(entity => {
                        if (entity.type !== 'enemy' && entity.type !== 'boss') return entity;
                        if (!entity.stats || !entity.health || entity.health <= 0) return entity;
                
                        const newEntity = { ...entity };
                        
                        // Initialize skillCooldowns if it's undefined
                        if (!newEntity.skillCooldowns) {
                            newEntity.skillCooldowns = {};
                        }

                        // --- Status Effect Updates ---
                        let isStunned = false;
                        newEntity.statusEffects = newEntity.statusEffects.map(effect => {
                            effect.duration -= deltaTime;
                            
                            if (effect.id === 'stun') {
                                isStunned = effect.duration > 0;
                            }
                            
                            if (effect.id === 'poison' && effect.duration > 0) {
                                if (now - (effect.lastTick ?? 0) >= (effect.interval ?? 1) * 1000) {
                                    newEntity.health = (newEntity.health ?? 0) - (effect.damage ?? 0);
                                    if (effectsManager.current) effectsManager.current.createHitEffect(newEntity.position, false, effect.damage ?? 0);
                                    effect.lastTick = now;
                                }
                            }

                            return effect;
                        }).filter(effect => effect.duration > 0);
                        
                        if (isStunned) {
                            newEntity.aiState = 'stunned';
                        } else if (newEntity.aiState === 'stunned') {
                            newEntity.aiState = 'idle'; // Reset state after stun wears off
                        }

                        if (newEntity.aiState === 'stunned') {
                            return newEntity; // Skip AI logic if stunned
                        }

                        const distance = getDistance(playerPos, newEntity.position);
                        const enemyData = getEnemyTypeFromSprite(newEntity.sprite);
                
                        // Cooldowns
                        Object.keys(newEntity.skillCooldowns).forEach(skillId => {
                            newEntity.skillCooldowns[skillId] = Math.max(0, (newEntity.skillCooldowns[skillId] ?? 0) - deltaTime);
                        });
                        if (newEntity.attackCooldown) newEntity.attackCooldown = Math.max(0, newEntity.attackCooldown - deltaTime);

                        // State Logic
                        let canUseSkill = false;
                        let skillToUse = null;
                        if (enemyData?.skills && distance < VISION_RANGE) {
                            for(const skill of enemyData.skills) {
                                if ((newEntity.skillCooldowns[skill.id] || 0) <= 0 && Math.random() < skill.chance) {
                                    canUseSkill = true;
                                    skillToUse = skill;
                                    break;
                                }
                            }
                        }

                        if (newEntity.aiState === 'casting') {
                            // Stay in casting state until finished
                        } else if (canUseSkill) {
                            newEntity.aiState = 'casting';
                        } else if (distance <= ATTACK_RANGE && hasLineOfSight(newEntity.position, playerPos)) {
                            newEntity.aiState = 'attack';
                        } else if (distance <= VISION_RANGE * 1.5 && hasLineOfSight(newEntity.position, playerPos)) {
                            newEntity.aiState = 'chase';
                        } else {
                            newEntity.aiState = 'patrol';
                        }

                        // Action Logic
                        const moveSpeed = (newEntity.stats?.speed ?? ENEMY_MOVE_SPEED) * deltaTime;
                
                        switch (newEntity.aiState) {
                            case 'chase':
                                if (distance > ATTACK_RANGE) {
                                    const angle = Math.atan2(playerPos.y - newEntity.position.y, playerPos.x - newEntity.position.x);
                                    const targetX = newEntity.position.x + Math.cos(angle) * moveSpeed;
                                    const targetY = newEntity.position.y + Math.sin(angle) * moveSpeed;
                                    if (isValidMove(targetX, targetY) && !isOccupiedByOther(targetX, targetY, newEntity.id)) {
                                        newEntity.position = { x: targetX, y: targetY };
                                    }
                                }
                                break;
                
                            case 'attack':
                                if (!newEntity.attackCooldown || newEntity.attackCooldown === 0) {
                                    enemyAttack(newEntity);
                                    newEntity.attackCooldown = 2; // 2 second cooldown
                                }
                                break;
                
                            case 'casting':
                                if (skillToUse && effectsManager.current) {
                                    window.soundSystem?.play('bossSkill', { volume: settings.sfxVolume * 0.8 });

                                    if(skillToUse.id === 'fire_breath') {
                                        effectsManager.current.createFireBreath(newEntity.position, playerPos);
                                        // Damage will be applied by the effect animation later
                                    } else if (skillToUse.id === 'aoe_stomp') {
                                        effectsManager.current.createAoeStomp(newEntity.position, (stompCenter) => {
                                            if(getDistance(playerPos, stompCenter) < 3) {
                                                enemyAttack({...newEntity, stats: {...newEntity.stats!, attack: (newEntity.stats?.attack || 0) * 1.5}});
                                            }
                                        });
                                    }

                                    newEntity.skillCooldowns[skillToUse.id] = skillToUse.cooldown;
                                }
                                newEntity.aiState = 'chase'; // Go back to chasing after casting
                                break;

                            case 'patrol':
                                if (now - (newEntity.lastMove || 0) > 2000) { // Patrol every 2s
                                    if (Math.random() < 0.3) {
                                        const angle = Math.random() * Math.PI * 2;
                                        const targetX = newEntity.position.x + Math.cos(angle) * 1; // move 1 tile
                                        const targetY = newEntity.position.y + Math.sin(angle) * 1;
                                        if (isValidMove(targetX, targetY) && !isOccupiedByOther(targetX, targetY, newEntity.id)) {
                                            newEntity.position = { x: targetX, y: targetY };
                                        }
                                    }
                                    newEntity.lastMove = now;
                                }
                                break;
                        }
                        return newEntity;
                    });
                }, [enemyAttack, getDistance, settings.sfxVolume, hasLineOfSight]);

                const filteredInventory = useMemo(() => {
                    switch (inventoryFilter) {
                        case 'weapon': return inventory.filter(item => item.type === 'weapon');
                        case 'armor': return inventory.filter(item => item.type === 'armor');
                        case 'accessory': return inventory.filter(item => item.type === 'accessory');
                        case 'item': return inventory.filter(item => item.type === 'consumable' || item.type === 'material');
                        case 'gem': return inventory.filter(item => item.type === 'gem');
                        case 'nft': return inventory.filter(item => item.isNFT);
                        case 'common':
                        case 'uncommon':
                        case 'rare':
                        case 'legendary':
                        case 'mythic':
                            return inventory.filter(item => item.rarity === inventoryFilter);
                        case 'all':
                        default:
                            return inventory;
                    }
                }, [inventory, inventoryFilter]);

                const filteredForgeInventory = useMemo(() => {
                    const list = inventory.filter(item => item.slot);
                    if (forgeFilter === 'all') return list;
                    return list.filter(item => item.type === forgeFilter || item.rarity === forgeFilter);
                }, [inventory, forgeFilter]);

                
                const handleSellSelected = () => {
                    const itemsToSell = inventory.filter(item => item.uniqueId && selectedForSale.includes(item.uniqueId));
                    if (itemsToSell.length === 0) {
                        showNotification("ไม่ได้เลือกไอเทม", "error");
                        return;
                    }

                    const totalValue = itemsToSell.reduce((sum, item) => sum + Math.floor(item.value * 0.5), 0);

                    openModal('sellMultipleConfirm', { itemsToSell, totalValue });
                };

                const toggleSellMode = useCallback(() => {
                    playClickSound();
                    setIsSellMode(prev => {
                        if (prev) { // If turning off
                            setSelectedForSale([]);
                        }
                        return !prev;
                    });
                }, [playClickSound]);
                
                const toggleItemForSale = useCallback((uniqueId: string) => {
                    playClickSound();
                    setSelectedForSale(prev => 
                        prev.includes(uniqueId) 
                            ? prev.filter(id => id !== uniqueId) 
                            : [...prev, uniqueId]
                    );
                }, [playClickSound]);

                const selectedSellValue = useMemo(() => {
                    if (!isSellMode || selectedForSale.length === 0) return 0;
                    return inventory
                        .filter(i => i.uniqueId && selectedForSale.includes(i.uniqueId))
                        .reduce((sum, item) => sum + Math.floor(item.value * 0.5), 0);
                }, [selectedForSale, inventory, isSellMode]);

                const performAscension = useCallback(() => {
                    setAscensionLevel(prev => prev + 1);
                    setAscensionPoints(prev => prev + 1); 
                
                    setPlayerStats(prev => ({
                        ...prev,
                        level: 1,
                        health: 100,
                        maxHealth: 100,
                        mana: 50,
                        maxMana: 50,
                        attack: 10,
                        defense: 5,
                        speed: 5,
                        critChance: 10,
                        experience: 0,
                        experienceToNext: 100,
                    }));
                    
                    setDungeonLevel(1);
                    setSkillPoints(0);
                    setLearnedSkills({});
                
                    showNotification(`จุติสำเร็จ! ยินดีต้อนรับสู่ระดับจุติ ${ascensionLevel + 1}`, 'success');
                    window.soundSystem?.play('victory', { volume: settings.sfxVolume });
                }, [ascensionLevel, settings.sfxVolume, showNotification]);

                const handleAscend = useCallback(() => {
                    if (totalStats.level < MAX_LEVEL) {
                        showNotification(`ต้องเลเวล ${MAX_LEVEL} ก่อนถึงจะจุติได้!`, 'error');
                        return;
                    }
                    playClickSound();
                    openModal('ascend');
                }, [totalStats.level, playClickSound, openModal]);
                
                const handleUpgradeAscension = useCallback((upgradeId: string) => {
                    const upgradeInfo = ASCENSION_UPGRADES.find(u => u.id === upgradeId);
                    if (!upgradeInfo) return;
                    
                    const currentLevel = ascensionUpgrades[upgradeId] || 0;
                    if (currentLevel >= upgradeInfo.maxLevel) {
                        showNotification('อัปเกรดถึงระดับสูงสุดแล้ว', 'error');
                        return;
                    }

                    const cost = upgradeInfo.costPerLevel(currentLevel + 1);
                    if (ascensionPoints < cost) {
                        showNotification('แต้มจุติไม่พอ!', 'error');
                        return;
                    }

                    setAscensionPoints(prev => Math.max(0, prev - cost));
                    setAscensionUpgrades(prev => ({
                        ...prev,
                        [upgradeId]: currentLevel + 1
                    }));
                    showNotification(`อัปเกรด ${upgradeInfo.name} สำเร็จ!`, 'success');
                    playClickSound();
                }, [ascensionPoints, ascensionUpgrades, showNotification, playClickSound]);

                // --- Core Game Loop and Rendering ---
                useEffect(() => {
                    if (gameScreen !== 'dungeon') return;
                    if (!canvasContainerRef.current) return;
                    
                    const initPixi = async () => {
                        const app = new PIXI.Application();
                        pixiAppRef.current = app;
                    
                        await app.init({
                            resizeTo: canvasContainerRef.current!,
                            backgroundColor: PIXI.Color.shared.setValue(currentBiome.ambientColor || '#1a1a2e').toNumber(),
                            resolution: window.devicePixelRatio || 1,
                            autoDensity: true,
                            antialias: false, // Use false for crisp pixel art
                        });
                    
                        if (canvasContainerRef.current) {
                            while (canvasContainerRef.current.firstChild) {
                                canvasContainerRef.current.removeChild(canvasContainerRef.current.firstChild);
                            }
                            canvasContainerRef.current.appendChild(app.canvas);
                        }
                    
                        tileContainerRef.current = new PIXI.Container();
                        app.stage.addChild(tileContainerRef.current);
                        
                        entityContainerRef.current = new PIXI.Container();
                        app.stage.addChild(entityContainerRef.current);
                        
                        effectsManager.current = new EffectsManager(app);
                        app.stage.addChild(effectsManager.current.getContainer());
                        effectsManager.current.preWarmTextures();
                    
                        tileSpritesRef.current.clear();
                        entitySpritesRef.current.clear();
                        tileTexturesRef.current.clear();
                        emojiTexturesRef.current.clear();

                        return app;
                    };

                    const getTileTexture = (type: 'floor' | 'wall', color: number, seed: number): PIXI.Texture => {
                        const key = `${type}-${color}-${seed % 5}`; // Cache a few variations
                        if (tileTexturesRef.current.has(key)) return tileTexturesRef.current.get(key)!;
                        if (!pixiAppRef.current) return PIXI.Texture.EMPTY;
                    
                        const g = new PIXI.Graphics();
                        const rand = new SeededRandom(seed);
                    
                        // Base color
                        g.rect(0, 0, TILE_SIZE, TILE_SIZE).fill({ color });
                    
                        if (type === 'floor') {
                            const detailColor = new PIXI.Color(color).multiply(0.85).toNumber();
                            const shadowColor = new PIXI.Color(color).multiply(0.7).toNumber();
                    
                            // Add some cracks or patterns
                            for (let i = 0; i < rand.realInRange(1, 3); i++) {
                                g.moveTo(rand.realInRange(0, TILE_SIZE), rand.realInRange(0, TILE_SIZE));
                                g.lineTo(
                                    g.x + rand.realInRange(-10, 10),
                                    g.y + rand.realInRange(-10, 10)
                                ).stroke({ width: 1, color: shadowColor, alpha: 0.6 });
                            }
                            // Add some pebbles
                            for (let i = 0; i < rand.realInRange(2, 5); i++) {
                                g.circle(
                                    rand.realInRange(0, TILE_SIZE),
                                    rand.realInRange(0, TILE_SIZE),
                                    rand.realInRange(1, 3)
                                ).fill({ color: detailColor });
                            }
                        } else if (type === 'wall') {
                            const highlightColor = new PIXI.Color(color).multiply(1.2).toNumber();
                            const shadowColor = new PIXI.Color(color).multiply(0.7).toNumber();
                    
                            // Draw mortar lines for a brick pattern
                            const strokeStyle = { width: 2, color: shadowColor };
                            g.stroke(strokeStyle);
                            // Horizontal lines
                            g.moveTo(0, TILE_SIZE / 2).lineTo(TILE_SIZE, TILE_SIZE / 2);
                            // Vertical lines (staggered)
                            if (seed % 2 === 0) {
                                g.moveTo(TILE_SIZE / 2, 0).lineTo(TILE_SIZE / 2, TILE_SIZE / 2);
                                g.moveTo(TILE_SIZE / 4, TILE_SIZE / 2).lineTo(TILE_SIZE / 4, TILE_SIZE);
                                g.moveTo((TILE_SIZE * 3) / 4, TILE_SIZE / 2).lineTo((TILE_SIZE * 3) / 4, TILE_SIZE);
                            } else {
                                g.moveTo(TILE_SIZE / 4, 0).lineTo(TILE_SIZE / 4, TILE_SIZE / 2);
                                g.moveTo((TILE_SIZE * 3) / 4, 0).lineTo((TILE_SIZE * 3) / 4, TILE_SIZE / 2);
                                g.moveTo(TILE_SIZE / 2, TILE_SIZE / 2).lineTo(TILE_SIZE / 2, TILE_SIZE);
                            }
                            
                            // Add a highlight and shadow for 3D effect
                            g.rect(1, 1, TILE_SIZE-2, TILE_SIZE-2).stroke({ width: 1, color: highlightColor, alpha: 0.5 });
                            g.rect(2, 2, TILE_SIZE-4, TILE_SIZE-4).stroke({ width: 1, color: shadowColor, alpha: 0.5 });
                        }
                    
                        const texture = pixiAppRef.current.renderer.generateTexture({target: g});
                        tileTexturesRef.current.set(key, texture);
                        g.destroy();
                        return texture;
                    };

                    const getEmojiTexture = (emoji: string): PIXI.Texture => {
                        if (emojiTexturesRef.current.has(emoji)) return emojiTexturesRef.current.get(emoji)!;
                        if (!pixiAppRef.current) return PIXI.Texture.EMPTY;

                        const text = new PIXI.Text({
                            text: emoji,
                            style: {
                                fontSize: TILE_SIZE * (emoji.includes('🌟') ? 0.9 : 0.8),
                                fontFamily: 'sans-serif',
                                align: 'center'
                            }
                        });
                        const texture = pixiAppRef.current.renderer.generateTexture({target: text});
                        emojiTexturesRef.current.set(emoji, texture);
                        text.destroy();
                        return texture;
                    };
                    
                    const renderScene = () => {
                        const app = pixiAppRef.current;
                        const tileContainer = tileContainerRef.current;
                        const entityContainer = entityContainerRef.current;
                        const tileSprites = tileSpritesRef.current;
                        const entitySprites = entitySpritesRef.current;
                        
                        if (!app?.stage || !tileContainer || !entityContainer || !isDungeonReady.current || dungeonMap.current.length === 0 || !app.renderer) return;

                        app.stage.x = -playerPosition.current.x * TILE_SIZE + window.innerWidth / 2;
                        app.stage.y = -playerPosition.current.y * TILE_SIZE + window.innerHeight / 2;
                        
                        const viewportWidthInTiles = Math.ceil(window.innerWidth / TILE_SIZE) + 4;
                        const viewportHeightInTiles = Math.ceil(window.innerHeight / TILE_SIZE) + 4;
                        const startX = Math.max(0, Math.floor(playerPosition.current.x - viewportWidthInTiles / 2));
                        const endX = Math.min(DUNGEON_SIZE.width, startX + viewportWidthInTiles);
                        const startY = Math.max(0, Math.floor(playerPosition.current.y - viewportHeightInTiles / 2));
                        const endY = Math.min(DUNGEON_SIZE.height, startY + viewportHeightInTiles);

                        // Use a set to track which sprites should be visible. All others will be hidden.
                        const activeSpriteKeys = new Set<string>();

                        for (let y = startY; y < endY; y++) {
                            for (let x = startX; x < endX; x++) {
                                const tile = dungeonMap.current[y]?.[x];
                                if (!tile || !tile.explored) continue;

                                const isVisible = getDistance(playerPosition.current, {x: x + 0.5, y: y + 0.5}) <= VISION_RANGE;

                                // --- Tile Rendering ---
                                const tileKey = `tile-${x}-${y}`;
                                activeSpriteKeys.add(tileKey);
                                let tileSprite = tileSprites.get(tileKey);
                                
                                if (!tileSprite) {
                                    tileSprite = new PIXI.Sprite();
                                    tileSprite.width = TILE_SIZE;
                                    tileSprite.height = TILE_SIZE;
                                    tileSprite.position.set(x * TILE_SIZE, y * TILE_SIZE);
                                    tileSprites.set(tileKey, tileSprite);
                                    tileContainer.addChild(tileSprite);
                                }
                                
                                const tintSeed = (x * 13 + y * 31);
                                let currentTexture: PIXI.Texture | null = null;
                                switch (tile.type) {
                                    case 'wall':
                                        const wallColor = currentBiome.tilesets.wall[tintSeed % currentBiome.tilesets.wall.length];
                                        currentTexture = getTileTexture('wall', wallColor, tintSeed);
                                        break;
                                    case 'chest': currentTexture = getEmojiTexture(tile.decoration === '🔓' ? '🔓' : '📦'); break;
                                    case 'portal': currentTexture = getEmojiTexture('🌀'); break;
                                    default: // floor
                                        const floorColor = currentBiome.tilesets.floor[tintSeed % currentBiome.tilesets.floor.length];
                                        currentTexture = getTileTexture('floor', floorColor, tintSeed);
                                }

                                if (currentTexture && tileSprite.texture !== currentTexture) {
                                    tileSprite.texture = currentTexture;
                                }
                                tileSprite.alpha = isVisible ? 1 : tile.type === 'wall' ? 0.5 : 0.4;
                                tileSprite.visible = true;

                                // --- Decoration Rendering ---
                                if (tile.decoration && tile.type !== 'chest') {
                                    const decoKey = `deco-${x}-${y}`;
                                    activeSpriteKeys.add(decoKey);
                                    let decoSprite = tileSprites.get(decoKey);
                                    if (!decoSprite) {
                                        decoSprite = new PIXI.Sprite(getEmojiTexture(tile.decoration));
                                        decoSprite.anchor.set(0.5);
                                        decoSprite.position.set((x + 0.5) * TILE_SIZE, (y + 0.5) * TILE_SIZE);
                                        decoSprite.width = TILE_SIZE * 0.7;
                                        decoSprite.height = TILE_SIZE * 0.7;
                                        tileSprites.set(decoKey, decoSprite);
                                        tileContainer.addChild(decoSprite);
                                    }
                                    decoSprite.visible = isVisible; // Only visible in direct line of sight
                                }
                            }
                        }
                        
                        // --- Entity Rendering ---
                        const playerKey = 'player';
                        activeSpriteKeys.add(playerKey);
                        let playerSprite = entitySprites.get(playerKey);
                        if (!playerSprite) {
                            playerSprite = new PIXI.Container();
                            const emojiSprite = new PIXI.Sprite(getEmojiTexture('🧙'));
                            emojiSprite.anchor.set(0.5);
                            playerSprite.addChild(emojiSprite);
                            entitySprites.set(playerKey, playerSprite);
                            entityContainer.addChild(playerSprite);
                        }
                        playerSprite.position.set(playerPosition.current.x * TILE_SIZE, playerPosition.current.y * TILE_SIZE);
                        playerSprite.visible = true;

                        entities.current.forEach(entity => {
                            const isVisible = getDistance(playerPosition.current, entity.position) <= VISION_RANGE;
                            if (!isVisible) return; // Don't even process entities out of sight

                            const key = `ent-${entity.id}`;
                            activeSpriteKeys.add(key);
                            let container = entitySprites.get(key);
                            
                            if (!container) {
                                container = new PIXI.Container();
                                const sprite = new PIXI.Sprite(getEmojiTexture(entity.sprite));
                                sprite.label = 'sprite';
                                sprite.anchor.set(0.5);
                                container.addChild(sprite);

                                if(entity.type === 'enemy' || entity.type === 'boss') {
                                    const hpBar = new PIXI.Graphics();
                                    hpBar.label = 'hpBar';
                                    container.addChild(hpBar);
                                }
                                entitySprites.set(key, container);
                                entityContainer.addChild(container);
                            }
                            
                            container.visible = true;
                            container.position.set(entity.position.x * TILE_SIZE, entity.position.y * TILE_SIZE);

                            if((entity.type === 'enemy' || entity.type === 'boss') && entity.health !== undefined && entity.maxHealth !== undefined) {
                                const hpBar = container.getChildByLabel('hpBar') as PIXI.Graphics;
                                if (hpBar) {
                                    hpBar.clear();
                                    if (entity.health > 0 && entity.health < entity.maxHealth) {
                                        const percent = entity.health / entity.maxHealth;
                                        hpBar.rect(-TILE_SIZE/2, TILE_SIZE/2 - 2, TILE_SIZE, 4).fill({ color: 0x333333 });
                                        hpBar.rect(-TILE_SIZE/2, TILE_SIZE/2 - 2, TILE_SIZE * percent, 4).fill({ color: 0xff0000 });
                                    }
                                }
                            }
                        });

                        // Hide any sprites that are no longer active
                        tileSprites.forEach((sprite, key) => {
                            if (!activeSpriteKeys.has(key)) sprite.visible = false;
                        });
                        entitySprites.forEach((sprite, key) => {
                            if (!activeSpriteKeys.has(key)) sprite.visible = false;
                        });

                        if (effectsManager.current) {
                            effectsManager.current.update(app.ticker.deltaMS / 1000);
                        }
                    };

                    let lastTime = performance.now();
                    let lastAttackTime = 0;
                    const ATTACK_COOLDOWN = 300; // ms
                    
                    const loop = (currentTime: number) => {
                        gameLoopRef.current = requestAnimationFrame(loop);
                        if (isPaused || !isDungeonReady.current || !pixiAppRef.current?.stage || !pixiAppRef.current?.renderer) return;

                        const deltaTime = Math.min(0.05, (currentTime - lastTime) / 1000);
                        lastTime = currentTime;
                        
                        playerVelocity.current.x = 0;
                        playerVelocity.current.y = 0;
                        if (keysDown.current['w'] || keysDown.current['arrowup']) playerVelocity.current.y -= 1;
                        if (keysDown.current['s'] || keysDown.current['arrowdown']) playerVelocity.current.y += 1;
                        if (keysDown.current['a'] || keysDown.current['arrowleft']) playerVelocity.current.x -= 1;
                        if (keysDown.current['d'] || keysDown.current['arrowright']) playerVelocity.current.x += 1;

                        const magnitude = Math.sqrt(playerVelocity.current.x ** 2 + playerVelocity.current.y ** 2);
                        if (magnitude > 1) {
                            playerVelocity.current.x /= magnitude;
                            playerVelocity.current.y /= magnitude;
                        }
                        
                        if (playerVelocity.current.x !== 0 || playerVelocity.current.y !== 0) {
                            const currentPos = playerPosition.current;
                            const moveSpeed = totalStats.speed;
                            const velocityX = playerVelocity.current.x * moveSpeed * deltaTime;
                            const velocityY = playerVelocity.current.y * moveSpeed * deltaTime;

                            let targetX = currentPos.x + velocityX;
                            let targetY = currentPos.y + velocityY;
                            
                            if (dungeonMap.current[Math.floor(currentPos.y)]?.[Math.floor(targetX)]?.type === 'wall') {
                                targetX = currentPos.x;
                            }
                            if (dungeonMap.current[Math.floor(targetY)]?.[Math.floor(currentPos.x)]?.type === 'wall') {
                                targetY = currentPos.y;
                            }

                            const targetTileX = Math.floor(targetX);
                            const targetTileY = Math.floor(targetY);
                            const tile = dungeonMap.current[targetTileY]?.[targetTileX];
                            if (tile) {
                                if (tile.type === 'chest') openChest(targetTileX, targetTileY);
                                else if (tile.type === 'trap') triggerTrap(targetTileX, targetTileY);
                                else if (tile.type === 'portal') {
                                    const remainingEnemies = entities.current.filter(e => e.type === 'enemy' || e.type === 'boss').length;
                                    if (remainingEnemies === 0) {
                                        completeDungeon();
                                    } else {
                                        const now = Date.now();
                                        if (now - lastPortalWarning.current > 3000) {
                                            showNotification(`ต้องกำจัดศัตรูทั้งหมดก่อน! เหลืออีก ${remainingEnemies} ตัว`, 'error');
                                            lastPortalWarning.current = now;
                                        }
                                    }
                                }
                            }
                            
                            const itemToPickup = entities.current.find(e => e.type === 'item' && getDistance(e.position, {x: targetX, y: targetY}) < 0.8);
                            if (itemToPickup && itemToPickup.item) {
                                pickupItem(itemToPickup.item);
                                entities.current = entities.current.filter(e => e.id !== itemToPickup.id);
                                window.soundSystem?.play('pickup',{volume: settings.sfxVolume});
                            }

                            playerPosition.current = { x: targetX, y: targetY };
                            updateVision(targetX, targetY);
                        }
                        
                        // Ambient effects
                        if (effectsManager.current && Math.random() < 0.05) {
                            const randomX = playerPosition.current.x + (Math.random() - 0.5) * VISION_RANGE * 2;
                            const randomY = playerPosition.current.y + (Math.random() - 0.5) * VISION_RANGE * 2;
                            if(dungeonMap.current[Math.floor(randomY)]?.[Math.floor(randomX)]?.type === 'floor') {
                                effectsManager.current.createAmbientEffect({ x: randomX, y: randomY }, currentBiome.id);
                            }
                        }

                        if (keysDown.current[' ']) {
                            const now = Date.now();
                            if(now - lastAttackTime > ATTACK_COOLDOWN) {
                                handleMainAttack();
                                lastAttackTime = now;
                            }
                        }
                        
                        setSkillCooldowns(prevCooldowns => {
                            let hasChanged = false;
                            const newCooldowns = { ...prevCooldowns };
                            for (const skill of ALL_SKILLS) {
                                if (newCooldowns[skill.id] > 0) {
                                    hasChanged = true;
                                    newCooldowns[skill.id] = Math.max(0, newCooldowns[skill.id] - deltaTime);
                                }
                            }
                            return hasChanged ? newCooldowns : prevCooldowns;
                        });
                        
                        updateEnemyAI(deltaTime);
                    
                        const deadEnemy = entities.current.find(e => (e.type === 'enemy' || e.type === 'boss') && (e.health ?? 0) <= 0 && !defeatedEnemiesRef.current.has(e.id));
                        if (deadEnemy) {
                            defeatedEnemiesRef.current.add(deadEnemy.id);
                            defeatedEnemy(deadEnemy);
                        }

                        bossEntity.current = entities.current.find(e => e.type === 'boss') || null;

                        renderScene();
                    };
                    
                    const start = async () => {
                        isDungeonReady.current = false;
                        await initPixi();
                        
                        if (dungeonGeneratedForLevel.current !== dungeonLevel) {
                            generateDungeon();
                            dungeonGeneratedForLevel.current = dungeonLevel;
                        } else {
                            isDungeonReady.current = true;
                        }

                        setTimeout(() => {
                            if (isDungeonReady.current) {
                                renderScene();
                                gameLoopRef.current = requestAnimationFrame(loop);
                            }
                        }, 16);
                    };

                    start();

                    const handleKeyDown = (e: KeyboardEvent) => { keysDown.current[e.key.toLowerCase()] = true; };
                    const handleKeyUp = (e: KeyboardEvent) => { keysDown.current[e.key.toLowerCase()] = false; };
                    window.addEventListener('keydown', handleKeyDown);
                    window.addEventListener('keyup', handleKeyUp);

                    return () => {
                        cancelAnimationFrame(gameLoopRef.current);
                        window.removeEventListener('keydown', handleKeyDown);
                        window.removeEventListener('keyup', handleKeyUp);
                        if (pixiAppRef.current) {
                            pixiAppRef.current.destroy(true, { children: true, texture: true });
                            pixiAppRef.current = null;
                        }
                    };
                }, [gameScreen, getDistance, generateDungeon, dungeonLevel]);


                useEffect(() => {
                    initializeWeb3();
                }, [initializeWeb3]);

                useEffect(() => {
                    if (userAddress) {
                        loadGameData();
                        if (contract) {
                            loadNFTItems();
                        }
                        setLoading(false);
                    }
                // eslint-disable-next-line react-hooks/exhaustive-deps
                }, [userAddress, contract]);
                

                useEffect(() => {
                    if (settings.autoSave) {
                        saveTimerRef.current = setInterval(saveGameData, 30000);
                    }
                    
                    return () => {
                        if (saveTimerRef.current) clearInterval(saveTimerRef.current);
                    };
                }, [saveGameData, settings.autoSave]);

                // Authoritative sound effect hook
                useEffect(() => {
                    if (window.soundSystem?.isInitialized) {
                        if (settings.soundEnabled) {
                            window.soundSystem.unmute();
                            window.soundSystem.setVolume('music', settings.musicVolume);
                            window.soundSystem.setVolume('sfx', settings.sfxVolume);
                        } else {
                            window.soundSystem.mute();
                        }
                    }
                }, [settings.soundEnabled, settings.musicVolume, settings.sfxVolume]);

                // Keyboard controls (for UI, not movement)
                useEffect(() => {
                    const handleKeyPress = (e: KeyboardEvent) => {
                        if (activeModal) {
                            if (e.key === 'Escape') closeModal();
                            return;
                        }
                        if (showInventory) {
                            if (e.key === 'Escape' || e.key.toLowerCase() === 'i') {
                                playClickSound();
                                setShowInventory(false);
                                setIsSellMode(false);
                                setSelectedForSale([]);
                            }
                            return;
                        }
                        if(isPaused) return;

                        if (gameScreen === 'dungeon') {
                            switch (e.key.toLowerCase()) {
                                case 'i': playClickSound(); setShowInventory(true); break;
                                case '1': useSkill(0); break;
                                case '2': useSkill(1); break;
                                case '3': useSkill(2); break;
                                case 'escape': openModal('settings'); break;
                            }
                        } else {
                            if (e.key === 'Escape') openModal('settings');
                            if (e.key.toLowerCase() === 'i') {
                                playClickSound();
                                setShowInventory(true);
                            }
                        }
                    };

                    const handleKeyUp = (e: KeyboardEvent) => {
                        if(e.key === ' ') {
                            keysDown.current[' '] = false;
                        }
                    }

                    window.addEventListener('keydown', handleKeyPress);
                    window.addEventListener('keyup', handleKeyUp);
                    return () => {
                        window.removeEventListener('keydown', handleKeyPress);
                        window.removeEventListener('keyup', handleKeyUp);
                    }
                }, [gameScreen, activeModal, isPaused, showInventory, useSkill, playClickSound, closeModal, openModal]);

                useEffect(() => {
                    if (dungeonLevel % 5 === 0 && entities.current.some(e => e.type === 'boss')) {
                        const bossRoom = entities.current.find(e => e.type === 'boss');
                        if (bossRoom && getDistance(playerPosition.current, bossRoom.position) < VISION_RANGE * 1.5 && !isBossFightActive) {
                            setIsBossFightActive(true);
                            window.soundSystem?.playBossBGM();
                        }
                    }
                }, [dungeonLevel, isBossFightActive, getDistance]);

                useEffect(() => {
                    if (gameScreen === 'forge') {
                    setForgeTab('enhance');
                    const firstEquippable = inventory.find(item => item.slot);
                    setSelectedForgeItem(firstEquippable || null);
                    setSelectedGem(null);
                    setForgeFilter('all');
                    } else {
                        setSelectedForgeItem(null);
                    }
                }, [gameScreen, inventory])

                useEffect(() => {
                    if (gameScreen === 'soulforge') {
                        const firstMintable = inventory.find(item => item.slot && !item.isNFT);
                        setSelectedSoulforgeItem(firstMintable || null);
                    }
                }, [gameScreen, inventory]);

                useEffect(() => {
                    if (gameScreen === 'alchemist') {
                        setSelectedRecipe(CRAFTING_RECIPES[0] || null);
                    } else {
                        setSelectedRecipe(null);
                    }
                }, [gameScreen]);

                useEffect(() => {
                    if (gameScreen === 'museum' && !selectedMuseumSet) {
                        setSelectedMuseumSet(MUSEUM_SETS[0] || null);
                    }
                }, [gameScreen, selectedMuseumSet]);

                useEffect(() => {
                    const interval = setInterval(() => {
                        if(!isPaused) setTotalPlayTime(prev => prev + 1);
                    }, 1000);
                    
                    return () => clearInterval(interval);
                }, [isPaused]);
                
                useEffect(() => {
                    if (gameScreen === 'shop' && shopItems.length === 0) {
                        generateShopItems();
                    }
                    
                    const interval = setInterval(() => {
                        if (!isPaused && gameScreen === 'shop') {
                            setShopRefreshTimer(prev => {
                                if (prev <= 1) {
                                    generateShopItems();
                                    return SHOP_REFRESH_INTERVAL;
                                }
                                return prev - 1;
                            });
                        }
                    }, 1000);

                    return () => clearInterval(interval);
                }, [gameScreen, isPaused, shopItems.length, generateShopItems]);

                useEffect(() => {
                    if (totalStats.level >= MAX_LEVEL && !buildings.find(b => b.id === 'ascensionAltar')?.unlocked) {
                        setBuildings(prev => prev.map(b => b.id === 'ascensionAltar' ? { ...b, unlocked: true } : b));
                        showNotification('ปลดล็อค: แท่นบูชาจุติ!', 'success');
                    }
                }, [totalStats.level, buildings, showNotification]);
                
                useLayoutEffect(() => {
                    if (gameScreen === 'skillTree' && skillScreenTab === 'passive' && skillTreeContainerRef.current) {
                        const container = skillTreeContainerRef.current;
                        // Center horizontally
                        container.scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
                        // Scroll to top
                        container.scrollTop = 0;
                    }
                }, [gameScreen, skillScreenTab]);

                if (loading) {
                    return (
                        <div className="fixed inset-0 bg-game-dark flex items-center justify-center z-40">
                            <div className="text-center">
                                <div className="pixel-loader mb-4"></div>
                                <p className="font-pixel text-game-gold animate-pulse">CONNECTING TO VOXELVERSE...</p>
                            </div>
                        </div>
                    );
                }

                if (error) {
                    return (
                        <div className="fixed inset-0 bg-game-dark flex items-center justify-center">
                            <div className="text-center p-4">
                                <p className="font-pixel text-red-500 mb-4 text-2xl">ERROR</p>
                                <p className="font-kanit mb-6">{error}</p>
                                <button 
                                    className="pixel-button mt-4"
                                    onClick={() => window.location.reload()}
                                >
                                    Reload
                                </button>
                            </div>
                        </div>
                    );
                }

                const handleMainAttack = () => {
                    if (gameScreen !== 'dungeon' || isPaused || !isDungeonReady.current) return;
                
                    // Check for destructible wall in front
                    const p = playerPosition.current;
                    const faceOffset = { up: {x:0, y:-1}, down: {x:0, y:1}, left: {x:-1, y:0}, right: {x:1, y:0} }[playerFacing.current];
                    const wallX = Math.floor(p.x + faceOffset.x);
                    const wallY = Math.floor(p.y + faceOffset.y);
                    if(dungeonMap.current[wallY]?.[wallX]?.isDestructible) {
                        damageWall(wallX, wallY);
                        return;
                    }
                
                    const nearestEnemy = findNearestEnemy(ATTACK_RANGE);
                    if (nearestEnemy) {
                        attackEnemy(nearestEnemy);
                    } else {
                        window.soundSystem?.play('error', { volume: settings.sfxVolume * 0.3 });
                    }
                };

                const formatPlayTime = (totalSeconds: number): string => {
                    const hours = Math.floor(totalSeconds / 3600);
                    const minutes = Math.floor((totalSeconds % 3600) / 60);
                    const seconds = Math.floor(totalSeconds % 60);
                
                    if (hours > 0) {
                        return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
                    }
                    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
                };

                return (
                    <div className="game-container">
                        {/* Top HUD */}
                        <div className="game-hud-top">
                            <div className="player-info">
                                <div className="player-avatar">⚔️</div>
                                <div className="player-stats">
                                    <div className="stat-bar hp-bar">
                                        <div 
                                            className="stat-bar-fill"
                                            style={{ width: `${Math.min(100, Math.max(0, (totalStats.health / totalStats.maxHealth) * 100))}%` }}
                                        />
                                        <span className="stat-bar-text">
                                            {totalStats.health}/{totalStats.maxHealth}
                                        </span>
                                    </div>
                                    <div className="stat-bar mp-bar">
                                        <div 
                                            className="stat-bar-fill"
                                            style={{ width: `${Math.min(100, Math.max(0, (totalStats.mana / totalStats.maxMana) * 100))}%` }}
                                        />
                                        <span className="stat-bar-text">
                                            {totalStats.mana}/{totalStats.maxMana}
                                        </span>
                                    </div>
                                    <div className="stat-bar exp-bar">
                                        <div 
                                            className="stat-bar-fill"
                                            style={{ width: `${Math.min(100, Math.max(0, (totalStats.experience / totalStats.experienceToNext) * 100))}%` }}
                                        />
                                        <span className="stat-bar-text">
                                            Lv.{totalStats.level}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="game-resources">
                                <div className="resource-item">
                                    <span className="resource-icon">💰</span>
                                    <span className="resource-value">{resources.gold.toLocaleString()}</span>
                                </div>
                                <div className="resource-item hidden sm:flex">
                                    <span className="resource-icon">💎</span>
                                    <span className="resource-value">{resources.gems}</span>
                                </div>
                                {/* These buttons are visible on all screen sizes now unless inside the dungeon on mobile */}
                                <button 
                                    className={`pixel-button icon-button ${gameScreen === 'dungeon' ? 'hidden sm:flex' : 'flex'}`}
                                    onClick={() => {
                                        playClickSound();
                                        saveGameData();
                                        showNotification('บันทึกเกมแล้ว!');
                                    }}
                                    onMouseEnter={playHoverSound}
                                >
                                    💾
                                </button>
                                <button 
                                    className={`pixel-button icon-button ${gameScreen === 'dungeon' ? 'hidden sm:flex' : 'flex'}`}
                                    onClick={() => {
                                        playClickSound();
                                        setShowInventory(true)
                                    }}
                                    onMouseEnter={playHoverSound}
                                >
                                    🎒
                                </button>
                                <button 
                                    className="pixel-button icon-button"
                                    onClick={() => openModal('settings')}
                                    onMouseEnter={playHoverSound}
                                >
                                    ⚙️
                                </button>
                            </div>
                        </div>

                        {/* Main Game Area */}
                        <main className="game-main">
                            {gameScreen === 'camp' && (
                                <div className="camp-view">
                                    <div className="camp-stars-bg"></div>
                                    <h1 className="camp-title">THE CAMP</h1>
                                    <div className="camp-buildings-container">
                                        {buildings.map(building => (
                                            <div 
                                                key={building.id}
                                                className={`building-card ${!building.unlocked ? 'locked' : 'hover:animate-pulse-slow'}`}
                                                onClick={(e) => {
                                                    handleHideTooltip();
                                                    playClickSound();
                                                    if (!building.unlocked) {
                                                        if (building.id !== 'ascensionAltar') { // Don't show purchase for ascension altar
                                                            openModal('purchaseBuilding', building);
                                                        }
                                                        return;
                                                    }

                                                    if (building.id === 'merchant') setGameScreen('shop');
                                                    else if (building.id === 'blacksmith') setGameScreen('forge');
                                                    else if (building.id === 'alchemist') setGameScreen('alchemist');
                                                    else if (building.id === 'museum') setGameScreen('museum');
                                                    else if (building.id === 'skillShrine') setGameScreen('skillTree');
                                                    else if (building.id === 'soulforge') setGameScreen('soulforge');
                                                    else if (building.id === 'ascensionAltar') openModal('ascend');
                                                }}
                                                onMouseEnter={(e) => handleShowGenericTooltip(<div className="building-tooltip">
                                                        <h4 className="font-pixel text-lg text-gold">{building.name}</h4>
                                                        <p className="text-sm text-gray-300 my-2">{building.description}</p>
                                                        {!building.unlocked && (
                                                            <div className="border-t border-gray-600 pt-2 mt-2">
                                                                {building.id === 'ascensionAltar' ? (
                                                                    <p className="unlock-hint text-purple-400">🔒 ต้องมีเลเวล {MAX_LEVEL}</p>
                                                                ) : (
                                                                    <p className="unlock-hint text-yellow-400">🔒 ราคา: {building.purchaseCost} ทอง</p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>, e)}
                                                onMouseLeave={handleHideTooltip}
                                            >
                                                <div className="building-icon">{building.icon}</div>
                                                <div className="building-name">{building.name}</div>
                                                {!building.unlocked && (
                                                    <div className="building-lock-overlay">
                                                    <span className="lock-icon">🔒</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    
                                    <button 
                                        className="pixel-button danger animate-pulse mt-auto"
                                        onClick={() => {
                                            playClickSound();
                                            setGameScreen('dungeon');
                                        }}
                                        onMouseEnter={playHoverSound}
                                    >
                                        เข้าดันเจี้ยน (ชั้น {dungeonLevel})
                                    </button>
                                </div>
                            )}

                            {gameScreen === 'dungeon' && (
                                <div className="dungeon-view">
                                    {bossEntity.current && (
                                        <div className="boss-hud">
                                            <h4 className="boss-name">{bossEntity.current.sprite} {bossEntity.current.type.toUpperCase()} {bossEntity.current.sprite}</h4>
                                            <div className="stat-bar hp-bar boss-hp-bar">
                                                <div 
                                                    className="stat-bar-fill"
                                                    style={{ width: `${Math.min(100, Math.max(0, ((bossEntity.current.health ?? 0) / (bossEntity.current.maxHealth ?? 1)) * 100))}%` }}
                                                />
                                                <span className="stat-bar-text">
                                                    {Math.max(0, Math.floor(bossEntity.current.health ?? 0))} / {bossEntity.current.maxHealth}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="dungeon-top-center-ui">
                                        <button 
                                            className="pixel-button danger"
                                            onClick={() => {
                                                playClickSound();
                                                openModal('leaveDungeon');
                                            }}
                                            onMouseEnter={playHoverSound}
                                        >
                                            ออกจากดันเจี้ยน
                                        </button>
                                        {!bossEntity.current && (
                                        <div className="dungeon-info-overlay">
                                            <h2 className="font-pixel text-lg md:text-xl text-gold">{currentBiome.name}</h2>
                                            <div className="flex flex-col sm:flex-row gap-x-4 gap-y-1">
                                                <p className="font-kanit text-sm">ชั้น {dungeonLevel}</p>
                                                <p className="font-kanit text-xs text-gray-400">
                                                    ศัตรูที่เหลือ: {entities.current.filter(e => e.type === 'enemy' || e.type === 'boss').length}
                                                </p>
                                            </div>
                                        </div>
                                        )}
                                    </div>
                                    
                                    <div ref={canvasContainerRef} className="dungeon-container" style={{ touchAction: 'none' }}>
                                        {/* Canvas will be appended here by Pixi */}
                                    </div>
                                    
                                </div>
                            )}

                            {gameScreen === 'shop' && (
                                <div className="camp-view">
                                    <h2 className="font-pixel text-2xl md:text-3xl text-gold mb-2 md:mb-4">MERCHANT SHOP</h2>
                                    <div className="shop-timer mb-4 md:mb-8">
                                        ของใหม่ใน: {Math.floor(shopRefreshTimer / 60)}:{(shopRefreshTimer % 60).toString().padStart(2, '0')}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-6 w-full max-w-7xl">
                                        {/* Inventory Slot Purchase */}
                                        <div className={`building-card hover:animate-pulse legendary`}>
                                            <div className="text-4xl mb-2">🛍️</div>
                                            <div className="font-pixelify text-lg">ขยายช่องเก็บของ</div>
                                            <div className="text-gold">{Math.floor(1000 * Math.pow(1.1, maxInventorySlots - INITIAL_INVENTORY_SLOTS))} ทอง</div>
                                            <div className="text-xs text-gray-400 mt-1">
                                                <div>เพิ่มช่องเก็บของ 1 ช่อง</div>
                                            </div>
                                            <button
                                                className="pixel-button gold mt-2"
                                                onClick={() => { playClickSound(); purchaseInventorySlot(); }}
                                            >
                                                ซื้อ
                                            </button>
                                        </div>

                                        {shopItems.map(shopItem => (
                                            <div key={shopItem.uniqueId} 
                                                className={`building-card hover:animate-pulse ${shopItem.rarity}`}
                                                onMouseEnter={(e) => handleShowTooltip(shopItem, e)}
                                                onMouseLeave={handleHideTooltip}
                                            >
                                                <div className="text-4xl mb-2">{shopItem.icon}</div>
                                                <div className="font-pixelify text-lg">{shopItem.name}</div>
                                                <div className="text-gold">{shopItem.value} ทอง</div>
                                                <div className="text-xs text-gray-400 mt-1">
                                                    {shopItem.stats && Object.entries(shopItem.stats).map(([key, value]) => (
                                                        <div key={key}>+{value} {key}</div>
                                                    ))}
                                                </div>
                                                <button 
                                                    className="pixel-button gold mt-2"
                                                    onClick={() => {
                                                        playClickSound();
                                                        if (resources.gold >= shopItem.value || isAdminMode) {
                                                            const newItemUniqueId = generateUniqueId();
                                                            const newItem: ItemData = { ...shopItem, id: newItemUniqueId, uniqueId: newItemUniqueId };
                                                            pickupItem(newItem);
                                                            if (!isAdminMode) {
                                                                setResources(prev => ({ ...prev, gold: prev.gold - shopItem.value }));
                                                            }
                                                            window.soundSystem?.play('buy', { volume: settings.sfxVolume });
                                                        } else {
                                                            showNotification('ทองไม่พอ!', 'error');
                                                        }
                                                    }}
                                                    disabled={resources.gold < shopItem.value && !isAdminMode}
                                                >
                                                    ซื้อ
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <button 
                                        className="pixel-button mt-8"
                                        onClick={() => { playClickSound(); setGameScreen('camp'); }}
                                        onMouseEnter={playHoverSound}
                                    >
                                        กลับ
                                    </button>
                                </div>
                            )}

                            {gameScreen === 'forge' && (() => {
                                const item = selectedForgeItem;
                                const equippableItems = inventory.filter(i => i.slot && i.type !== 'gem');
                                const socketableItems = inventory.filter(i => i.slot && i.maxSockets > 0 && i.sockets.some(s => s === null));
                                const gemsInInventory = inventory.filter(i => i.type === 'gem');
                                const protectCostGems = item ? 10 + Math.floor(Math.pow((item.enhancement || 0), 1.2)) : 0;

                                const renderList = () => {
                                    let baseList: ItemData[] = [];
                                    if (forgeTab === 'enhance') baseList = equippableItems;
                                    else if (forgeTab === 'socket') baseList = socketableItems;
                                    else if (forgeTab === 'combine') baseList = gemsInInventory;
                                    
                                    if (forgeFilter === 'all') return baseList;
                                    return baseList.filter(item => item.type === forgeFilter || item.rarity === forgeFilter);
                                }

                                return (
                                    <div className="forge-view">
                                        <div className="forge-header">
                                            <h2 className="font-pixel text-2xl md:text-3xl text-gold">โรงตีเหล็ก</h2>
                                            <button className="pixel-button" onClick={() => { playClickSound(); setGameScreen('camp'); }} onMouseEnter={playHoverSound}>กลับ</button>
                                        </div>

                                        <div className="forge-tabs">
                                            <button className={`tab-button ${forgeTab === 'enhance' ? 'active' : ''}`} onClick={() => { playClickSound(); setForgeTab('enhance'); }}>ตีบวก</button>
                                            <button className={`tab-button ${forgeTab === 'socket' ? 'active' : ''}`} onClick={() => { playClickSound(); setForgeTab('socket'); }}>ใส่ Gem</button>
                                            <button className={`tab-button ${forgeTab === 'combine' ? 'active' : ''}`} onClick={() => { playClickSound(); setForgeTab('combine'); }}>รวม Gem</button>
                                        </div>

                                        <div className="forge-container">
                                            {/* ITEM LIST (LEFT) */}
                                            <div className="forge-item-list-wrapper">
                                                <div className="inventory-filters-container">
                                                    <div className="filter-buttons">
                                                        {inventoryCategoryFilters.filter(f => ['all', 'weapon', 'armor', 'accessory'].includes(f.filter)).map(({ filter, icon, label }) => (
                                                            <button key={filter} aria-label={label} className={`filter-icon-button ${forgeFilter === filter ? 'active' : ''}`} onClick={() => { playClickSound(); setForgeFilter(filter as InventoryFilter); }} >{icon}</button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="forge-item-list">
                                                {renderList().map(listItem => (
                                                    <div 
                                                        key={listItem.uniqueId}
                                                        className={`forge-item-entry ${listItem.rarity} ${item?.uniqueId === listItem.uniqueId ? 'selected' : ''}`}
                                                        onClick={() => { playClickSound(); setSelectedForgeItem(listItem); setSelectedGem(null); }}
                                                        onMouseEnter={(e) => handleShowTooltip(listItem, e)}
                                                        onMouseLeave={handleHideTooltip}
                                                    >
                                                        <span className="item-icon">{listItem.icon}</span>
                                                        <div className="item-info">
                                                            <span className="item-name">{listItem.name} {listItem.enhancement > 0 && `+${listItem.enhancement}`}</span>
                                                            {listItem.type === 'gem' ? (
                                                                <span className="item-quantity">x{listItem.quantity || 1}</span>
                                                            ) : (
                                                                <span className={`item-rarity-text rarity-${listItem.rarity}`}>{listItem.rarity}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                                </div>
                                            </div>
                                            
                                            {/* INTERACTION PANEL (RIGHT) */}
                                            <div className="forge-interaction-panel">
                                                {!item ? (
                                                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                                                        <div className="text-6xl mb-4">⚒️</div>
                                                        <h3 className="font-pixel text-xl">เลือกไอเทม</h3>
                                                        <p>เลือกไอเทมจากรายการด้านซ้าย</p>
                                                    </div>
                                                ) : (
                                                    <>
                                                    {/* Enhance Tab */}
                                                    {forgeTab === 'enhance' && (
                                                        <div className="forge-panel-content">
                                                            <h3 className={`font-pixel text-xl rarity-${item.rarity}`}>{item.name} +{item.enhancement || 0}</h3>
                                                            <div className={`item-icon text-7xl my-4`}>{item.icon}</div>
                                                            <div className="forge-details">
                                                                <p>ระดับปัจจุบัน: <span className="text-gold">+{item.enhancement || 0}</span></p>
                                                                <p>ค่าใช้จ่าย: <span className="text-yellow-400">{100 * Math.pow((item.enhancement || 0) + 1, 2)} G</span>, <span className="text-purple-400">{Math.ceil(Math.pow((item.enhancement || 0) + 1, 1.5))} Crystals</span></p>
                                                                <p>โอกาสสำเร็จ: <span className="text-green-400">{((1.0 - ((item.enhancement || 0) * 0.06)) * 100).toFixed(0)}%</span></p>
                                                                {(item.enhancement || 0) >= 5 && <p className="text-red-500 text-sm">!! มีโอกาสลดระดับหรือถูกทำลาย !!</p>}
                                                            </div>
                                                            <button className="pixel-button gold w-full mt-4" onClick={() => enhanceItem(item)}>ตีบวก</button>
                                                            <button
                                                                className="pixel-button purple w-full mt-2"
                                                                onClick={() => enhanceItem(item, true)}
                                                                disabled={!isAdminMode && resources.gems < protectCostGems}
                                                            >
                                                                ตีบวกแบบป้องกัน ({protectCostGems} 💎)
                                                            </button>
                                                        </div>
                                                    )}

                                                    {forgeTab === 'socket' && (
                                                        <div className="forge-panel-content socketing">
                                                            <h3 className={`font-pixel text-xl rarity-${item.rarity}`}>{item.name}</h3>
                                                            <div className="item-sockets-display">
                                                                {(item.sockets || []).map((gem, i) => (
                                                                    <div key={`${item.uniqueId}-socket-display-${i}`} className="socket-slot" data-gem={!!gem}>{gem ? gem.icon : 'ว่าง'}</div>
                                                                ))}
                                                            </div>
                                                            <div className="gem-selection-list">
                                                                {gemsInInventory.map(gem => (
                                                                    <div 
                                                                        key={gem.uniqueId}
                                                                        className={`gem-slot ${selectedGem?.uniqueId === gem.uniqueId ? 'selected' : ''}`}
                                                                        onClick={() => { playClickSound(); setSelectedGem(gem); }}
                                                                        onMouseEnter={(e) => handleShowTooltip(gem, e)}
                                                                        onMouseLeave={handleHideTooltip}
                                                                    >
                                                                        {gem.icon} <span className="gem-quantity">x{gem.quantity}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <button 
                                                                className="pixel-button success w-full mt-4"
                                                                disabled={!selectedGem || item.sockets?.every(s => s !== null)}
                                                                onClick={() => {
                                                                    const emptySocketIndex = item.sockets?.indexOf(null) ?? -1;
                                                                    if(selectedGem && emptySocketIndex !== -1) {
                                                                        socketGem(item, selectedGem, emptySocketIndex);
                                                                    }
                                                                }}
                                                            >
                                                                ใส่ Gem
                                                            </button>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Combine Tab */}
                                                    {forgeTab === 'combine' && item.type === 'gem' && item.gemData && (
                                                        <div className="forge-panel-content">
                                                            <h3 className={`font-pixel text-xl rarity-${item.rarity}`}>รวม {item.name}</h3>
                                                            <div className="flex items-center justify-center gap-2 my-8">
                                                                <div className="item-icon text-4xl">{item.icon}</div>
                                                                <div className="item-icon text-4xl">{item.icon}</div>
                                                                <div className="item-icon text-4xl">{item.icon}</div>
                                                                <div className="text-4xl mx-2 text-gold">→</div>
                                                                <div className="item-icon text-5xl text-green-400">{item.icon}</div>
                                                            </div>
                                                            <div className="forge-details">
                                                                <p>คุณมี: <span className="text-gold">{item.quantity}</span> เม็ด</p>
                                                                <p>ต้องการ: <span className="text-yellow-400">3</span> เม็ดเพื่อรวมเป็น Tier {item.gemData.level + 1}</p>
                                                            </div>
                                                            <button
                                                                className="pixel-button purple w-full mt-4"
                                                                disabled={(item.quantity || 1) < 3}
                                                                onClick={() => combineGems(item)}
                                                            >
                                                                รวม
                                                            </button>
                                                        </div>
                                                    )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                            
                            {gameScreen === 'soulforge' && (() => {
                                const item = selectedSoulforgeItem;
                                const mintableItems = inventory.filter(i => i.slot && !i.isNFT);
                                const mintCost = item ? (item.rarity === 'mythic' ? 1000 : item.rarity === 'legendary' ? 500 : 200) : 0;
                                return (
                                    <div className="forge-view">
                                        <div className="forge-header">
                                            <h2 className="font-pixel text-2xl md:text-3xl text-gold">เตาหลอมวิญญาณ</h2>
                                            <button className="pixel-button" onClick={() => { playClickSound(); setGameScreen('camp'); }} onMouseEnter={playHoverSound}>กลับ</button>
                                        </div>
                                        <div className="forge-container">
                                            <div className="forge-item-list-wrapper">
                                                <h3 className="font-pixel text-lg text-gold mb-2">เลือกไอเทมที่จะสร้างเป็น NFT</h3>
                                                <div className="forge-item-list">
                                                    {mintableItems.map(listItem => (
                                                        <div key={listItem.uniqueId} className={`forge-item-entry ${listItem.rarity} ${item?.uniqueId === listItem.uniqueId ? 'selected' : ''}`} onClick={() => { playClickSound(); setSelectedSoulforgeItem(listItem); }} onMouseEnter={(e) => handleShowTooltip(listItem, e)} onMouseLeave={handleHideTooltip} >
                                                            <span className="item-icon">{listItem.icon}</span>
                                                            <div className="item-info">
                                                                <span className="item-name">{listItem.name} {listItem.enhancement > 0 && `+${listItem.enhancement}`}</span>
                                                                <span className={`item-rarity-text rarity-${listItem.rarity}`}>{listItem.rarity}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="forge-interaction-panel">
                                                {!item ? (
                                                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                                                        <div className="text-6xl mb-4">🔥</div>
                                                        <h3 className="font-pixel text-xl">เลือกไอเทม</h3>
                                                        <p>เลือกไอเทมจากรายการเพื่อผนึกวิญญาณ</p>
                                                    </div>
                                                ) : (
                                                    <div className="forge-panel-content">
                                                        <h3 className={`font-pixel text-xl rarity-${item.rarity}`}>{item.name}</h3>
                                                        <div className={`item-icon text-7xl my-4`}>{item.icon}</div>
                                                        <div className="forge-details">
                                                            <p>เปลี่ยนไอเทมนี้ให้เป็น NFT ถาวรบน Blockchain</p>
                                                            <p className="mt-2">ค่าใช้จ่าย: <span className="text-yellow-400">{mintCost} G</span></p>
                                                            <p className="text-red-500 text-sm mt-1">!! การกระทำนี้ไม่สามารถย้อนกลับได้ !!</p>
                                                        </div>
                                                        <button className="pixel-button purple w-full mt-4" onClick={() => mintItemAsNFT(item)}>สร้าง NFT</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}


                            {gameScreen === 'alchemist' && (() => {
                                const recipe = selectedRecipe;
                                const canCraft = recipe && (isAdminMode || (resources.gold >= recipe.goldCost && Object.entries(recipe.cost).every(([mat, amount]) => (resources.materials[mat as keyof typeof resources.materials] || 0) >= amount)));

                                return (
                                    <div className="alchemist-view">
                                        <div className="alchemist-header">
                                            <h2 className="font-pixel text-2xl md:text-3xl text-gold">ห้องปรุงยา</h2>
                                            <button 
                                                className="pixel-button"
                                                onClick={() => { playClickSound(); setGameScreen('camp'); }}
                                                onMouseEnter={playHoverSound}
                                            >
                                                กลับ
                                            </button>
                                        </div>

                                        <div className="alchemist-container">
                                            <div className="alchemist-recipe-list-wrapper">
                                                <div className="alchemist-materials">
                                                    <h4 className="font-pixel text-gold mb-2">วัตถุดิบ</h4>
                                                    <div className="materials-grid">
                                                        <span><span className="material-icon">🔩</span> Iron: {resources.materials.iron}</span>
                                                        <span><span className="material-icon">📜</span> Leather: {resources.materials.leather}</span>
                                                        <span><span className="material-icon">💎</span> Crystal: {resources.materials.crystal}</span>
                                                        <span><span className="material-icon">🔮</span> Corrupted: {resources.materials.corruptedCrystals}</span>
                                                    </div>
                                                </div>
                                                <div className="alchemist-recipe-list">
                                                    {CRAFTING_RECIPES.map(listRecipe => (
                                                        <div 
                                                            key={listRecipe.id}
                                                            className={`recipe-entry ${listRecipe.rarity} ${recipe?.id === listRecipe.id ? 'selected' : ''}`}
                                                            onClick={() => { playClickSound(); setSelectedRecipe(listRecipe); }}
                                                            onMouseEnter={(e) => handleShowGenericTooltip(<div>{listRecipe.description}</div>, e)}
                                                            onMouseLeave={handleHideTooltip}
                                                        >
                                                            <span className="item-icon">{listRecipe.icon}</span>
                                                            <div className="item-info">
                                                                <span className="item-name">{listRecipe.name}</span>
                                                                <span className={`item-rarity-text rarity-${listRecipe.rarity}`}>{listRecipe.rarity}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="alchemist-recipe-preview">
                                                {recipe ? (
                                                    <>
                                                        <div className="preview-header">
                                                            <h3 className={`font-pixel text-2xl rarity-${recipe.rarity}`}>{recipe.name}</h3>
                                                            <div className={`item-icon text-7xl my-4`}>{recipe.icon}</div>
                                                        </div>
                                                        <p className="preview-description">{recipe.description}</p>
                                                        <div className="recipe-cost">
                                                            <h4 className="font-bold mb-2 text-gold">ส่วนผสมที่ต้องใช้</h4>
                                                            {Object.entries(recipe.cost).map(([mat, amount]) => {
                                                                const hasEnough = isAdminMode || (resources.materials[mat as keyof typeof resources.materials] || 0) >= amount;
                                                                return <p key={mat} className={hasEnough ? 'text-green-400' : 'text-red-400'}>- {mat}: {amount}</p>;
                                                            })}
                                                            <p className={isAdminMode || resources.gold >= recipe.goldCost ? 'text-green-400' : 'text-red-400'}>- Gold: {recipe.goldCost}</p>
                                                        </div>
                                                        <div className="preview-footer">
                                                            <button 
                                                                className="pixel-button success w-full mt-4"
                                                                onClick={() => craftItem(recipe)}
                                                                onMouseEnter={playHoverSound}
                                                                disabled={!canCraft}
                                                            >
                                                                สร้าง
                                                            </button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                                                        <div className="text-6xl mb-4">⚗️</div>
                                                        <h3 className="font-pixel text-xl">เลือกสูตรยา</h3>
                                                        <p>เลือกสูตรจากรายการด้านซ้ายเพื่อดูรายละเอียด</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {gameScreen === 'skillTree' && (() => {
                                const getNodeById = (id: string) => SKILL_TREE_DATA.find(n => n.id === id);

                                const learnSkillNode = (node: SkillTreeNode) => {
                                    playClickSound();
                                    const currentLevel = learnedSkills[node.id] || 0;
                                    const maxLevel = node.maxLevel || 1;

                                    if (skillPoints < node.cost) {
                                        showNotification('แต้มทักษะไม่พอ!', 'error');
                                        return;
                                    }
                                    if (currentLevel >= maxLevel) {
                                        showNotification('ทักษะถึงระดับสูงสุดแล้ว', 'error');
                                        return;
                                    }
                                    
                                    setLearnedSkills(prev => ({ ...prev, [node.id]: currentLevel + 1 }));
                                    setSkillPoints(prev => prev - node.cost);
                                    
                                    if (node.type === 'active_unlock' && node.unlocksSkill) {
                                        setUnlockedSkills(prev => {
                                            if(prev.includes(node.unlocksSkill!)) return prev;
                                            return [...prev, node.unlocksSkill!]
                                        });
                                    }

                                    window.soundSystem?.play('upgrade', { volume: settings.sfxVolume });
                                    showNotification(`เรียนรู้ ${node.name} ระดับ ${currentLevel + 1}!`);
                                };

                                const handleSkillSlotClick = (slotIndex: number) => {
                                    playClickSound();
                                    if (selectedSkillToEquip) {
                                        // Equip skill
                                        const newActiveSkills = [...activeSkills];
                                        // Prevent equipping the same skill twice by first removing it if it exists
                                        const existingIndex = newActiveSkills.indexOf(selectedSkillToEquip);
                                        if (existingIndex > -1) {
                                            newActiveSkills[existingIndex] = null;
                                        }
                                        newActiveSkills[slotIndex] = selectedSkillToEquip;
                                        setActiveSkills(newActiveSkills);
                                        setSelectedSkillToEquip(null);
                                    } else if (activeSkills[slotIndex]) {
                                        // Unequip skill by clicking on an equipped slot
                                        const newActiveSkills = [...activeSkills];
                                        newActiveSkills[slotIndex] = null;
                                        setActiveSkills(newActiveSkills);
                                    }
                                };
                                const nodeToDisplay = selectedSkillNode;
                                const canLearnSelected = nodeToDisplay && nodeToDisplay.dependencies.every(depId => (learnedSkills[depId] || 0) > 0) && skillPoints >= nodeToDisplay.cost && (learnedSkills[nodeToDisplay.id] || 0) < (nodeToDisplay.maxLevel || 1);

                                return (
                                    <div className="skilltree-view">
                                        <div className="skilltree-header">
                                            <h2 className="font-pixel text-2xl md:text-3xl text-gold">แท่นบูชาทักษะ</h2>
                                            <div className="skilltree-points">แต้มทักษะ: <span className="text-yellow-300">{skillPoints}</span></div>
                                            <button className="pixel-button" onClick={() => { playClickSound(); setGameScreen('camp'); }} onMouseEnter={playHoverSound}>กลับ</button>
                                        </div>

                                        <div className="forge-tabs">
                                            <button className={`tab-button ${skillScreenTab === 'passive' ? 'active' : ''}`} onClick={() => { playClickSound(); setSkillScreenTab('passive'); }}>ทักษะติดตัว</button>
                                            <button className={`tab-button ${skillScreenTab === 'active' ? 'active' : ''}`} onClick={() => { playClickSound(); setSkillScreenTab('active'); }}>จัดการสกิลใช้งาน</button>
                                        </div>

                                        {skillScreenTab === 'passive' &&
                                            <div className="skilltree-main-content">
                                                <div className="skilltree-container-wrapper">
                                                    <div className="skilltree-container" ref={skillTreeContainerRef} onMouseLeave={() => setSelectedSkillNode(null)}>
                                                        <div className="skilltree-tree">
                                                            <svg width="1200px" height="800px">
                                                                {SKILL_TREE_DATA.map(node => 
                                                                    node.dependencies.map(depId => {
                                                                        const depNode = getNodeById(depId);
                                                                        if (!depNode) return null;
                                                                        const isLearned = (learnedSkills[depId] || 0) > 0;
                                                                        const isAvailable = isLearned && !((learnedSkills[node.id] || 0) > 0);
                                                                        return (
                                                                            <line
                                                                                key={`${depId}-${node.id}`}
                                                                                x1={depNode.position.x} y1={depNode.position.y}
                                                                                x2={node.position.x} y2={node.position.y}
                                                                                className={isLearned ? 'learned' : isAvailable ? 'available' : ''}
                                                                            />
                                                                        )
                                                                    })
                                                                )}
                                                            </svg>

                                                                {SKILL_TREE_DATA.map(node => {
                                                                    const currentLevel = learnedSkills[node.id] || 0;
                                                                    const maxLevel = node.maxLevel || 1;
                                                                    const dependenciesMet = node.dependencies.every(depId => (learnedSkills[depId] || 0) > 0);
                                                                    const canLearn = dependenciesMet && skillPoints >= node.cost && currentLevel < maxLevel;
                                                                    const isLearned = currentLevel > 0;
                                                                    const isMaxed = currentLevel >= maxLevel;
                                                                    
                                                                    let nodeClass = '';
                                                                    if (isLearned) nodeClass = 'learned';
                                                                    if (canLearn) nodeClass = 'available';
                                                                    if(isMaxed) nodeClass += ' maxed';

                                                                    return (
                                                                        <div
                                                                            key={node.id}
                                                                            className={`skill-node ${nodeClass}`}
                                                                            style={{ left: `${node.position.x - 36}px`, top: `${node.position.y - 36}px` }}
                                                                            onClick={() => {if(canLearn) learnSkillNode(node)}}
                                                                            onMouseEnter={() => setSelectedSkillNode(node)}
                                                                        >
                                                                            <div className="skill-icon">{node.icon}</div>
                                                                            {isLearned && <div className="skill-level">{currentLevel}/{maxLevel}</div>}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="skilltree-info-panel">
                                                        {nodeToDisplay ? (
                                                            <>
                                                                <div className="skilltree-info-header">
                                                                    <div className={`skill-node-static ${nodeToDisplay && (learnedSkills[nodeToDisplay.id] || 0) > 0 ? 'learned' : ''}`}>
                                                                        <div className="skill-icon">{nodeToDisplay.icon}</div>
                                                                    </div>
                                                                    <h4 className="font-pixel text-xl text-gold">{nodeToDisplay.name}</h4>
                                                                </div>
                                                                <p className="text-sm text-gray-300 my-2 flex-grow">{nodeToDisplay.description}</p>
                                                                <div className="w-full border-t border-gray-600 pt-2 mt-2 text-left space-y-1">
                                                                    <p>ระดับปัจจุบัน: {learnedSkills[nodeToDisplay.id] || 0} / {nodeToDisplay.maxLevel || 1}</p>
                                                                    <p>ค่าใช้จ่าย: {nodeToDisplay.cost} แต้ม</p>
                                                                </div>
                                                                <button 
                                                                    className="pixel-button success w-full"
                                                                    disabled={!canLearnSelected}
                                                                    onClick={() => learnSkillNode(nodeToDisplay)}
                                                                >
                                                                เรียนรู้
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <div className="text-center text-gray-500">
                                                                <div className="text-6xl mb-4">✨</div>
                                                                <p>เลื่อนเมาส์ไปบนสกิลเพื่อดูรายละเอียด</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            }
                                            {skillScreenTab === 'active' &&
                                                <div className="active-skill-manager">
                                                    <div className="active-skill-slots">
                                                        <h3 className="font-pixel text-xl text-gold">ช่องสกิลใช้งาน</h3>
                                                        <p className="text-sm text-gray-400">เลือกสกิลจากด้านขวา แล้วเลือกช่องด้านล่าง</p>
                                                        <div className="slots-container">
                                                            {activeSkills.map((skillId, index) => {
                                                                const skill = ALL_SKILLS.find(s => s.id === skillId);
                                                                return (
                                                                    <div key={index} className={`action-slot large ${skill ? '' : 'empty'} ${selectedSkillToEquip ? 'selectable' : ''}`} onClick={() => handleSkillSlotClick(index)}>
                                                                        {skill ? <span className="action-slot-icon">{skill.icon}</span> : <span className="text-gray-500">ว่าง</span>}
                                                                        <span className="action-slot-key">{index + 1}</span>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                    <div className="available-skills">
                                                        <h3 className="font-pixel text-xl text-gold">สกิลที่ปลดล็อค</h3>
                                                        <div className="skills-grid">
                                                            {unlockedSkills.map(skillId => {
                                                                const skill = ALL_SKILLS.find(s => s.id === skillId);
                                                                if (!skill) return null;
                                                                return (
                                                                    <div 
                                                                        key={skillId} 
                                                                        className={`action-slot large ${selectedSkillToEquip === skillId ? 'selected' : ''}`}
                                                                        onClick={() => { playClickSound(); setSelectedSkillToEquip(skillId); }}
                                                                        onMouseEnter={e => handleShowGenericTooltip(<div><h4 className="font-pixel text-lg text-gold">{skill.name}</h4><p className="text-sm">{skill.description}</p></div>, e)}
                                                                        onMouseLeave={handleHideTooltip}
                                                                    >
                                                                        <span className="action-slot-icon">{skill.icon}</span>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            }
                                        </div>
                                    );
                                })()}

                                {gameScreen === 'museum' && (() => {
                                    const nftItemsInInventory = inventory.filter(i => i.isNFT);
                                    const isSetComplete = (set: MuseumSet) => {
                                        const displayed = museumItems[set.id] || [];
                                        return set.itemNames.length === displayed.length;
                                    }
                                    
                                    const handlePlaceItem = (slotName: string) => {
                                        if (!selectedMuseumItem || !selectedMuseumSet) return;

                                        // Check if the selected item matches the required slot name (using nameEn)
                                        if (selectedMuseumItem.nameEn !== slotName) {
                                            showNotification('ไอเทมไม่ตรงกับช่อง', 'error');
                                            return;
                                        }

                                        // Check if this specific item is already placed in another set
                                        const isAlreadyPlaced = Object.values(museumItems).flat().some(i => i.uniqueId === selectedMuseumItem.uniqueId);
                                        if (isAlreadyPlaced) {
                                            showNotification('ไอเทมนี้ถูกจัดแสดงแล้ว', 'error');
                                            return;
                                        }
                                        
                                        const currentSetItems = museumItems[selectedMuseumSet.id] || [];
                                        setMuseumItems(prev => ({
                                            ...prev,
                                            [selectedMuseumSet.id]: [...currentSetItems, selectedMuseumItem]
                                        }));

                                        setInventory(prev => prev.filter(i => i.uniqueId !== selectedMuseumItem.uniqueId));
                                        setSelectedMuseumItem(null);
                                        window.soundSystem?.play('equip', { volume: settings.sfxVolume });
                                    };

                                    const handleRemoveItem = (itemToRemove: ItemData) => {
                                        if (!selectedMuseumSet || inventory.length >= maxInventorySlots) {
                                            if(inventory.length >= maxInventorySlots) showNotification('กระเป๋าเต็ม!', 'error');
                                            return;
                                        }
                                        
                                        // Add item back to inventory
                                        setInventory(prev => [...prev, itemToRemove]);

                                        // Remove from museum state
                                        setMuseumItems(prev => {
                                            const newSetItems = (prev[selectedMuseumSet.id] || []).filter(i => i.uniqueId !== itemToRemove.uniqueId);
                                            return { ...prev, [selectedMuseumSet.id]: newSetItems };
                                        });
                                        
                                        window.soundSystem?.play('unequip', { volume: settings.sfxVolume });
                                    };

                                    return (
                                        <div className="museum-view">
                                            <div className="museum-header">
                                                <h2 className="font-pixel text-2xl md:text-3xl text-gold">พิพิธภัณฑ์วิญญาณ</h2>
                                                <button className="pixel-button" onClick={() => { playClickSound(); setGameScreen('camp'); }} onMouseEnter={playHoverSound}>กลับ</button>
                                            </div>
                                            <div className="museum-container">
                                                <div className="museum-set-list">
                                                    <h3 className="font-pixel text-xl text-gold mb-2">ชุดสะสม</h3>
                                                    {MUSEUM_SETS.map(set => (
                                                        <div 
                                                            key={set.id}
                                                            className={`museum-set-entry ${selectedMuseumSet?.id === set.id ? 'active' : ''} ${isSetComplete(set) ? 'completed' : ''}`}
                                                            onClick={() => { playClickSound(); setSelectedMuseumSet(set); }}
                                                        >
                                                            <h4 className="font-bold">{set.name}</h4>
                                                            <p className="text-sm text-gray-400">{set.bonusDescription}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                                
                                                <div className="museum-item-display">
                                                    {selectedMuseumSet ? (
                                                    <>
                                                        <div>
                                                            <h3 className="font-pixel text-xl mb-2">{selectedMuseumSet.name}</h3>
                                                            <p className="text-gray-400">วางไอเทม NFT ที่ถูกต้องเพื่อรับโบนัส</p>
                                                        </div>
                                                        <div className="museum-item-slots">
                                                            {selectedMuseumSet.itemNames.map(itemName => {
                                                                const displayedItemsForSet = museumItems[selectedMuseumSet.id] || [];
                                                                const displayedItem = displayedItemsForSet.find(i => i.nameEn === itemName);
                                                                
                                                                return (
                                                                    <div 
                                                                        key={itemName}
                                                                        className={`museum-item-slot ${displayedItem ? `filled ${displayedItem.rarity}` : ''}`}
                                                                        onClick={() => {
                                                                            if (displayedItem) {
                                                                                handleRemoveItem(displayedItem);
                                                                            } else {
                                                                                handlePlaceItem(itemName);
                                                                            }
                                                                        }}
                                                                        onMouseEnter={(e) => displayedItem && handleShowTooltip(displayedItem, e)}
                                                                        onMouseLeave={handleHideTooltip}
                                                                    >
                                                                        {displayedItem ? <span className="item-icon">{displayedItem.icon}</span> : <span>{itemName}</span>}
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                        <div className={`museum-set-bonus ${isSetComplete(selectedMuseumSet) ? 'active-bonus' : ''}`}>
                                                            <h4 className="font-bold">โบนัสเซ็ต:</h4>
                                                            <p>{selectedMuseumSet.bonusDescription}</p>
                                                        </div>

                                                        <div className="museum-inventory">
                                                            <h4 className="font-pixel text-lg mb-2">NFT ของคุณในกระเป๋า</h4>
                                                            <div className="flex gap-2 flex-wrap">
                                                            {nftItemsInInventory.map(item => (
                                                                <div 
                                                                    key={item.uniqueId} 
                                                                    className={`inventory-slot occupied ${item.rarity} ${selectedMuseumItem?.uniqueId === item.uniqueId ? 'selected-for-sale' : ''}`}
                                                                    onClick={() => setSelectedMuseumItem(item)}
                                                                >
                                                                    <div className="item-icon">{item.icon}</div>
                                                                </div>
                                                            ))}
                                                            </div>
                                                        </div>
                                                    </>
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                                                            <div className="text-6xl mb-4">🏛️</div>
                                                            <p>เลือกชุดสะสมเพื่อดูรายละเอียด</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                            </main>
                            {/* Inventory Panel */}
                            <div className={`inventory-panel ${showInventory ? 'open' : ''} ${`mobile-tab-view-${mobileInventoryTab}`}`}>
                                <div className="inventory-header">
                                    <div className="inventory-title-container">
                                        <h3 className="inventory-title">INVENTORY ({inventory.length}/{maxInventorySlots})</h3>
                                        <button className={`pixel-button ${isSellMode ? 'danger' : ''}`} onClick={toggleSellMode}>
                                            {isSellMode ? 'ยกเลิก' : 'ขาย'}
                                        </button>
                                    </div>
                                    <button 
                                        className="pixel-button"
                                        onClick={() => {
                                            playClickSound();
                                            setShowInventory(false);
                                            setIsSellMode(false);
                                            setSelectedForSale([]);
                                        }}
                                        onMouseEnter={playHoverSound}
                                    >
                                        ✕
                                    </button>
                                </div>
                                
                                {/* Mobile-only tabs */}
                                <div className="mobile-inventory-tabs">
                                    <button className={`mobile-tab-button ${mobileInventoryTab === 'inventory' ? 'active' : ''}`} onClick={() => { playClickSound(); setMobileInventoryTab('inventory'); }}>ช่องเก็บของ</button>
                                    <button className={`mobile-tab-button ${mobileInventoryTab === 'equipment' ? 'active' : ''}`} onClick={() => { playClickSound(); setMobileInventoryTab('equipment'); }}>อุปกรณ์</button>
                                    <button className={`mobile-tab-button ${mobileInventoryTab === 'stats' ? 'active' : ''}`} onClick={() => { playClickSound(); setMobileInventoryTab('stats'); }}>ค่าสถานะ</button>
                                </div>

                                <div className="inventory-panel-content">
                                    <div className="inventory-grid-wrapper">
                                        <div className="inventory-sub-header">
                                            <div className="inventory-filters-container">
                                                <div className="filter-group">
                                                    <h4 className="filter-group-title">ประเภท</h4>
                                                    <div className="filter-buttons">
                                                        {inventoryCategoryFilters.map(({ filter, icon, label }) => (
                                                            <button
                                                                key={filter}
                                                                aria-label={label}
                                                                className={`filter-icon-button ${inventoryFilter === filter ? 'active' : ''}`}
                                                                onClick={() => { playClickSound(); setInventoryFilter(filter); }}
                                                                onMouseEnter={(e) => handleShowGenericTooltip(<div>{label}</div>, e)}
                                                                onMouseLeave={handleHideTooltip}
                                                            >
                                                                {icon}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="filter-group">
                                                    <h4 className="filter-group-title">ระดับความหายาก</h4>
                                                    <div className="filter-buttons">
                                                        {(['common', 'uncommon', 'rare', 'legendary', 'mythic'] as const).map(rarity => (
                                                            <button
                                                                key={rarity}
                                                                className={`filter-rarity-tag rarity-tag-${rarity} ${inventoryFilter === rarity ? 'active' : ''}`}
                                                                onClick={() => { playClickSound(); setInventoryFilter(rarity); }}
                                                                onMouseEnter={playHoverSound}
                                                            >
                                                                {rarity}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="inventory-grid">
                                            {Array.from({ length: maxInventorySlots }).map((_, index) => {
                                                const item = filteredInventory[index];
                                                return (
                                                    <div 
                                                        key={item?.uniqueId || index}
                                                        className={`inventory-slot ${item ? `occupied ${item.rarity}` : ''} ${isSellMode && item ? 'selectable' : ''} ${item?.uniqueId && selectedForSale.includes(item.uniqueId) ? 'selected-for-sale' : ''}`}
                                                        onClick={() => {
                                                            if (!item || !item.uniqueId) return;
                                                            if (isSellMode) {
                                                                toggleItemForSale(item.uniqueId);
                                                            } else {
                                                                playClickSound();
                                                                setActiveModal('itemActions');
                                                                setModalPayload(item);
                                                            }
                                                        }}
                                                        onMouseEnter={(e) => item && handleShowTooltip(item, e)}
                                                        onMouseLeave={handleHideTooltip}
                                                    >
                                                        {item && (
                                                            <>
                                                                <div className="item-icon">{item.icon}</div>
                                                                {item.enhancement > 0 && (
                                                                    <span className="item-enhancement-badge">+{item.enhancement}</span>
                                                                )}
                                                                {item.quantity && item.quantity > 1 && (
                                                                    <span className="item-quantity">{item.quantity}</span>
                                                                )}
                                                                {item.isNFT && <div className="item-nft-badge">NFT</div>}
                                                                <div className="item-socket-display">
                                                                    {(item.sockets || []).map((socket, i) => 
                                                                        <div key={`${item.uniqueId}-socket-${i}`} className={`socket-indicator ${socket ? 'filled' : 'empty'}`}></div>
                                                                    )}
                                                                </div>
                                                                {isSellMode && !item.isNFT && (
                                                                    <div className="selection-checkbox">
                                                                        {item.uniqueId && selectedForSale.includes(item.uniqueId) ? '✔' : ''}
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {isSellMode && (
                                            <div className="inventory-footer sell-mode">
                                                <div className="sell-info">
                                                    เลือก: {selectedForSale.length} ชิ้น / รวม: <span className="text-gold">{selectedSellValue} Gold</span>
                                                </div>
                                                <button
                                                    className="pixel-button danger"
                                                    onClick={handleSellSelected}
                                                    disabled={selectedForSale.length === 0}
                                                    onMouseEnter={playHoverSound}
                                                >
                                                    ขายที่เลือก
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="character-details-wrapper">
                                        <div className="equipment-section">
                                            <h4 className="font-pixel text-gold mb-4">EQUIPMENT</h4>
                                            <div className="equipment-slots">
                                                {Object.entries(equipment).map(([slot, item]) => (
                                                    <div 
                                                        key={slot}
                                                        className={`equipment-slot ${item ? `equipped ${item.rarity} ${item.isNFT ? 'nft-item' : ''}` : ''}`}
                                                        data-slot={slot}
                                                        onClick={() => {
                                                            if (item) {
                                                                playClickSound();
                                                                setActiveModal('itemActions');
                                                                setModalPayload(item);
                                                            }
                                                        }}
                                                        onMouseEnter={(e) => item && handleShowTooltip(item, e)}
                                                        onMouseLeave={handleHideTooltip}
                                                    >
                                                        {item ? (
                                                            <>
                                                                <div className="item-icon text-2xl">{item.icon}</div>
                                                                {item.enhancement > 0 && <span className="item-enhancement-badge">+{item.enhancement}</span>}
                                                            </>
                                                        ) : (
                                                            <div className="text-gray-600 text-xs capitalize">{slot}</div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        
                                        <div className="character-stats-panel">
                                            <h4 className="font-pixel text-gold mb-4">PLAYER STATS</h4>
                                            <div className="stats-grid">
                                                <div><span className="stat-icon">⭐</span> Level</div><span className="stat-value">{totalStats.level}</span>
                                                <div><span className="stat-icon">❤️</span> Health</div><span className="stat-value">{totalStats.health} / {totalStats.maxHealth}</span>
                                                <div><span className="stat-icon">💧</span> Mana</div><span className="stat-value">{totalStats.mana} / {totalStats.maxMana}</span>
                                                <div><span className="stat-icon">📈</span> Experience</div><span className="stat-value">{totalStats.experience} / {totalStats.experienceToNext}</span>
                                                <div className="stat-divider"></div>
                                                <div><span className="stat-icon">⚔️</span> Attack</div><span className="stat-value text-red-400">{totalStats.attack}</span>
                                                <div><span className="stat-icon">🛡️</span> Defense</div><span className="stat-value text-blue-400">{totalStats.defense}</span>
                                                <div><span className="stat-icon">⚡</span> Speed</div><span className="stat-value text-green-400">{Math.round(totalStats.speed * 10)/10}</span>
                                                <div><span className="stat-icon">🎯</span> Crit Chance</div><span className="stat-value text-yellow-400">{Math.round(totalStats.critChance * 10)/10}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Bottom Action Bar for Desktop */}
                            <div className="game-action-bar">
                                <div className="action-slots">
                                    <div className="action-slot" onClick={() => { playClickSound(); setShowInventory(!showInventory); }} onMouseEnter={playHoverSound}>
                                        <span className="action-slot-icon">🎒</span>
                                        <span className="action-slot-key">I</span>
                                    </div>
                                    {activeSkills.map((skillId, index) => {
                                        const skill = skillId ? ALL_SKILLS.find(s => s.id === skillId) : null;
                                        const currentCooldown = skillId ? (skillCooldowns[skillId] || 0) : 0;
                                        return (
                                            <div 
                                                key={index}
                                                className={`action-slot ${currentCooldown > 0 ? 'cooldown' : ''} ${!skill ? 'empty' : ''}`}
                                                onClick={() => { if(skill) {playClickSound(); if (gameScreen === 'dungeon' && !isPaused) useSkill(index);} }}
                                                onMouseEnter={playHoverSound}
                                            >
                                                {skill ? <span className="action-slot-icon">{skill.icon}</span> : null}
                                                <span className="action-slot-key">{index + 1}</span>
                                                {currentCooldown > 0 && (
                                                    <span className="action-slot-cooldown">
                                                        {Math.ceil(currentCooldown)}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                    <div className="action-slot" onClick={() => setActiveModal('settings')} onMouseEnter={playHoverSound}>
                                        <span className="action-slot-icon">⚙️</span>
                                        <span className="action-slot-key">ESC</span>
                                    </div>
                                </div>
                                
                                <div className="quick-info">
                                    <span className="text-xs text-gray-400">
                                        เวลาเล่น: {formatPlayTime(totalPlayTime)}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                        🏆 {achievements.length}
                                    </span>
                                </div>
                            </div>

                            {/* Modal Container */}
                            {activeModal && (
                                <Modal
                                    type={activeModal}
                                    payload={modalPayload}
                                    onClose={closeModal}
                                    gameActions={{
                                        setGameScreen,
                                        setPlayerStats,
                                        setDungeonLevel,
                                        purchaseBuilding,
                                        handleAscend,
                                        handleUpgradeAscension,
                                        performAscension,
                                        useItem,
                                        equipItem,
                                        unequipItem,
                                        setInventory,
                                        setResources,
                                        setSettings,
                                        playClickSound,
                                        showNotification,
                                        setSelectedForSale,
                                    }}
                                    gameState={{
                                        settings,
                                        ascensionLevel,
                                        ascensionPoints,
                                        ascensionUpgrades,
                                        totalStats,
                                        dungeonLevel,
                                        equipment
                                    }}
                                />
                            )}

                            {/* Tooltip Container */}
                            {tooltip && (
                                <div
                                    className="tooltip-container"
                                    style={{
                                        top: `${tooltip.y + 15}px`,
                                        left: `${tooltip.x + 15}px`,
                                        transform: 'translate(-50%, 0)', // Position better for comparison
                                        pointerEvents: 'none'
                                    }}
                                >
                                    {tooltip.content}
                                </div>
                            )}
                            
                            {/* Mobile Only Action Buttons */}
                            {gameScreen === 'dungeon' && (
                                <div className="mobile-action-buttons">
                                    <div className="mobile-skill-buttons">
                                        {activeSkills.map((skillId, index) => {
                                            const skill = skillId ? ALL_SKILLS.find(s => s.id === skillId) : null;
                                            const currentCooldown = skillId ? (skillCooldowns[skillId] || 0) : 0;
                                            return (
                                                <button 
                                                    key={index}
                                                    className={`action-slot ${currentCooldown > 0 ? 'cooldown' : ''} ${!skill ? 'empty' : ''}`}
                                                    onClick={() => { if(skill) { playClickSound(); if (gameScreen === 'dungeon' && !isPaused) useSkill(index); } }}
                                                    onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
                                                >
                                                    {skill ? <span className="action-slot-icon">{skill.icon}</span> : null}
                                                    {currentCooldown > 0 && (
                                                        <span className="action-slot-cooldown">
                                                            {Math.ceil(currentCooldown)}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <button 
                                        className="action-slot attack-button"
                                        onClick={() => { playClickSound(); handleMainAttack(); }}
                                        onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
                                    >
                                        ⚔️
                                    </button>
                                </div>
                            )}

                            {/* Global Notification Container */}
                            <div id="notification-container"></div>
                        </div>
                    );
                }

                const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
                root.render(
                    <React.StrictMode>
                        <VoxelverseChronicles />
                    </React.StrictMode>
                );
                
                // This is a global handler that must run before the React component mounts.
                // It initializes the sound system after the first user interaction.
                const initializeOnInteraction = () => {
                    if (!window.soundSystem?.isInitialized) {
                        window.soundSystem.init();
                        window.soundSystem.play('connect');
                        window.soundSystem.playBGM();
                        console.log('Sound system started on user interaction.');
                    }
                    // This listener is only needed once.
                    document.body.removeEventListener('click', initializeOnInteraction);
                    document.body.removeEventListener('keydown', initializeOnInteraction);
                };
                
                document.body.addEventListener('click', initializeOnInteraction);
                document.body.addEventListener('keydown', initializeOnInteraction);
                