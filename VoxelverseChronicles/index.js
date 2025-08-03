// Enhanced Sound System for Voxelverse Chronicles
(function() {
    'use strict';

    class SoundSystem {
        constructor() {
            this.sounds = {};
            this.bgm = null;
            this.bossBgm = null;
            this.bossBgm2 = null; // New boss track
            this.currentBgm = null;
            this.bgmVolume = 0.3;
            this.sfxVolume = 0.5;
            this.isMuted = false;
            this.isInitialized = false;
            
            // Sound definitions
            this.soundDefinitions = {
                click: { src: this.generateClick(), volume: 0.5 },
                hover: { src: this.generateHover(), volume: 0.3 },
                equip: { src: this.generateEquip(), volume: 0.6 },
                unequip: { src: this.generateUnequip(), volume: 0.5 },
                buy: { src: this.generateCoin(), volume: 0.7 },
                sell: { src: this.generateCoin(true), volume: 0.6 },
                upgrade: { src: this.generateUpgrade(), volume: 0.8 },
                error: { src: this.generateError(), volume: 0.5 },
                success: { src: this.generateSuccess(), volume: 0.6 },
                save: { src: this.generateSave(), volume: 0.4 },
                hit: { src: this.generateHit(), volume: 0.7 },
                critical: { src: this.generateCritical(), volume: 0.9 },
                miss: { src: this.generateMiss(), volume: 0.4 },
                playerHit: { src: this.generatePlayerHit(), volume: 0.8 },
                enemyDeath: { src: this.generateEnemyDeath(), volume: 0.7 },
                playerDeath: { src: this.generatePlayerDeath(), volume: 0.9 },
                dodge: { src: this.generateDodge(), volume: 0.5 },
                pickup: { src: this.generatePickup(), volume: 0.6 },
                itemDrop: { src: this.generateItemDrop(), volume: 0.5 },
                chest: { src: this.generateChest(), volume: 0.8 },
                potion: { src: this.generatePotion(), volume: 0.6 },
                materialDrop: { src: this.generateMaterialDrop(), volume: 0.5 },
                skill: { src: this.generateSkill(), volume: 0.7 },
                fireball: { src: this.generateFireball(), volume: 0.8 },
                heal: { src: this.generateHeal(), volume: 0.7 },
                whirlwind: { src: this.generateWhirlwind(), volume: 0.8 },
                bossSkill: { src: this.generateBossSkill(), volume: 1.0 },
                step: { src: this.generateStep(), volume: 0.3 },
                trap: { src: this.generateTrap(), volume: 0.8 },
                portal: { src: this.generatePortal(), volume: 0.7 },
                secretFound: { src: this.generateSecretFound(), volume: 0.8 },
                imp_idle: { src: this.generateImpIdle(), volume: 0.4 },
                golem_idle: { src: this.generateGolemIdle(), volume: 0.5 },
                drake_idle: { src: this.generateDrakeIdle(), volume: 0.6 },
                skeleton_idle: { src: this.generateSkeletonIdle(), volume: 0.5 },
                zombie_idle: { src: this.generateZombieIdle(), volume: 0.4 },
                wraith_idle: { src: this.generateWraithIdle(), volume: 0.6 },
                levelup: { src: this.generateLevelUp(), volume: 0.9 },
                achievement: { src: this.generateAchievement(), volume: 0.8 },
                mint: { src: this.generateMint(), volume: 0.9 },
                connect: { src: this.generateConnect(), volume: 0.7 },
                victory: { src: this.generateVictory(), volume: 0.8 },
                crafting: { src: this.generateCrafting(), volume: 0.7 },
                wallBreak: { src: this.generateWallBreak(), volume: 0.8 },
                inventoryToggle: { src: this.generateInventoryToggle(), volume: 0.4 },
                // New Sounds
                buff: { src: this.generateBuff(), volume: 0.7 },
                debuff: { src: this.generateDebuff(), volume: 0.6 },
                rarity_legendary: { src: this.generateRarityLegendary(), volume: 0.9 },
                gem_socket: { src: this.generateGemSocket(), volume: 0.8 },
                gem_combine: { src: this.generateGemCombine(), volume: 0.8 },
                ui_tab_switch: { src: this.generateTabSwitch(), volume: 0.4 },
            };
        }

        init() {
            if (this.isInitialized) return;
            
            Howler.autoUnlock = true;
            Howler.pool = 50;
            // Setup 3D audio
            Howler.pos(0, 0, 0);
            Howler.orientation(0, 0, -1, 0, 1, 0);
            
            Object.entries(this.soundDefinitions).forEach(([key, def]) => {
                this.sounds[key] = new Howl({
                    src: [def.src],
                    volume: def.volume,
                    preload: true,
                    format: ['wav']
                });
            });
            
            this.bgm = new Howl({ src: [this.generateBGM()], loop: true, volume: this.bgmVolume, html5: true, format: ['wav'] });
            this.bossBgm = new Howl({ src: [this.generateBossBGM()], loop: true, volume: this.bgmVolume, html5: true, format: ['wav'] });
            this.bossBgm2 = new Howl({ src: [this.generateBossBGM2()], loop: true, volume: this.bgmVolume, html5: true, format: ['wav'] });
            
            this.currentBgm = this.bgm;
            this.isInitialized = true;
            console.log('3D Sound system initialized');
        }

        generateTone(frequency, duration, type = 'sine', envelope = {}, modulators = []) {
            const sampleRate = 44100;
            const samples = duration * sampleRate;
            const data = new Float32Array(samples);
            
            const { attack = 0.01, decay = 0.1, sustain = 0.7, release = 0.2 } = envelope;
            
            for (let i = 0; i < samples; i++) {
                const t = i / sampleRate;
                let amplitude = 0;
                
                if (t < attack) amplitude = t / attack;
                else if (t < attack + decay) amplitude = 1 - ((t - attack) / decay) * (1 - sustain);
                else if (t < duration - release) amplitude = sustain;
                else amplitude = sustain * (1 - (t - (duration - release)) / release);
                
                let currentFreq = frequency;
                modulators.forEach(mod => {
                    currentFreq *= (1 + Math.sin(2 * Math.PI * mod.freq * t) * mod.amount);
                });

                const phase = 2 * Math.PI * currentFreq * t;
                let wave = 0;
                switch (type) {
                    case 'sine': wave = Math.sin(phase); break;
                    case 'square': wave = Math.sign(Math.sin(phase)); break;
                    case 'sawtooth': wave = 2 * (t * currentFreq % 1) - 1; break;
                    case 'triangle': wave = Math.abs(4 * (t * currentFreq % 1) - 2) - 1; break;
                    case 'noise': wave = Math.random() * 2 - 1; break;
                }
                data[i] = wave * amplitude;
            }
            return data;
        }

        combineTones(...tones) {
            const maxLength = Math.max(...tones.map(t => t.length));
            const combined = new Float32Array(maxLength).fill(0);
            tones.forEach(tone => {
                for(let i=0; i<tone.length; i++) {
                    combined[i] += tone[i];
                }
            });
            
            // Normalize
            let max = 0;
            for(let i=0; i<combined.length; i++) {
                if (Math.abs(combined[i]) > max) max = Math.abs(combined[i]);
            }
            if (max > 1) {
                for(let i=0; i<combined.length; i++) combined[i] /= max;
            }

            return this.createDataURI(combined, 44100);
        }

        createDataURI(data, sampleRate) {
            const length = data.length;
            const buffer = new ArrayBuffer(44 + length * 2);
            const view = new DataView(buffer);
            const write = (offset, str) => str.split('').forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));

            write(0, 'RIFF');
            view.setUint32(4, 36 + length * 2, true);
            write(8, 'WAVEfmt ');
            view.setUint32(16, 16, true);
            view.setUint16(20, 1, true);
            view.setUint16(22, 1, true);
            view.setUint32(24, sampleRate, true);
            view.setUint32(28, sampleRate * 2, true);
            view.setUint16(32, 2, true);
            view.setUint16(34, 16, true);
            write(36, 'data');
            view.setUint32(40, length * 2, true);

            let offset = 44;
            for (let i = 0; i < length; i++, offset += 2) {
                const s = Math.max(-1, Math.min(1, data[i]));
                view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            }
            return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
        }

        generateClick() { return this.combineTones(this.generateTone(1200, 0.08, 'triangle', { attack: 0.005, decay: 0.05, sustain: 0.1, release: 0.02 })); }
        generateHover() { return this.combineTones(this.generateTone(900, 0.04, 'sine', { attack: 0.001, decay: 0.01, sustain: 0.5, release: 0.02 })); }
        generateEquip() { return this.combineTones(this.generateTone(1500, 0.15, 'square'), this.generateTone(300, 0.2, 'sawtooth')); }
        generateHit() { return this.combineTones(this.generateTone(120, 0.15, 'square', { decay: 0.1 }), this.generateTone(2000, 0.2, 'noise', { attack: 0, decay: 0.15 })); }
        generateCritical() { return this.combineTones(this.generateTone(3000, 0.4, 'sawtooth'), this.generateTone(400, 0.3, 'square'), this.generateTone(5000, 0.5, 'noise')); }
        generatePlayerHit() { return this.combineTones(this.generateTone(80, 0.2, 'sawtooth'), this.generateTone(100, 0.25, 'noise', {decay: 0.2})); }
        generateEnemyDeath() { return this.combineTones(this.generateTone(300, 0.6, 'sawtooth', { attack: 0.01, decay: 0.5, sustain: 0, release: 0, modulators: [{freq: 10, amount: -0.8}] })); }
        generatePlayerDeath() { return this.combineTones(this.generateTone(200, 1.2, 'sawtooth', { attack: 0.01, decay: 1, sustain: 0, release: 0, modulators: [{freq: 5, amount: -0.9}] })); }
        generateFireball() { return this.combineTones(this.generateTone(150, 0.6, 'noise', {attack: 0.1, decay: 0.4, sustain: 0.1, modulators: [{freq: 20, amount: 0.5}]}), this.generateTone(250, 0.5, 'sawtooth')); }
        generateHeal() { return this.combineTones(this.generateTone(880, 0.8, 'sine', {attack: 0.3, decay: 0.4, sustain: 0.5, modulators: [{freq: 5, amount: 0.1}]}), this.generateTone(1760, 0.8, 'sine', {attack: 0.4, decay: 0.3})); }
        generateWhirlwind() { return this.combineTones(this.generateTone(200, 1.0, 'noise', {attack: 0.3, decay: 0.6, sustain: 0.2, modulators: [{freq: 10, amount: 0.8}]})); }
        generateLevelUp() { return this.combineTones(this.generateTone(523, 1.2, 'triangle', {attack: 0.1, decay: 1.0, sustain: 0.2}), this.generateTone(1046, 1.2, 'sawtooth', {attack: 0.2, decay: 0.8})); }
        generateBGM() {
            const data = new Float32Array(44100 * 40);
            const sr = 44100;
            const progression = [[65.41, 98.00, 130.81], [58.27, 87.31, 116.54], [55.00, 82.41, 110.00], [73.42, 110.00, 146.83]]; // Cmin, Bbmaj, Amin, Dmaj
            for (let i = 0; i < data.length; i++) {
                const t = i / sr;
                const bar = Math.floor(t / 2) % progression.length;
                const chord = progression[bar];
                const bassNote = chord[0] / 2;
                const bass = Math.sin(2 * Math.PI * bassNote * t) * (0.5 * Math.sin(Math.PI * (t % 1) * 2)) * 0.25;
                const arpPattern = [0, 1, 2, 1];
                const arpNote = chord[arpPattern[Math.floor(t * 8) % arpPattern.length]];
                const arp = Math.sin(2 * Math.PI * arpNote * t) * 0.15 * Math.exp(-(t % 0.125) * 20);
                const pad = (Math.sin(2 * Math.PI * chord[0] * t) + Math.sin(2 * Math.PI * chord[2] * t)) * 0.05 * (0.5 + Math.sin(2 * Math.PI * 0.1 * t) * 0.5);
                data[i] = bass + arp + pad;
            }
            return this.createDataURI(data, sr);
        }
        generateBossBGM() {
            const data = new Float32Array(44100 * 32);
            const sr = 44100;
            const progression = [[55, 82.41], [58.27, 87.31]]; // Am, Bbm
            for (let i = 0; i < data.length; i++) {
                const t = i / sr;
                const bar = Math.floor(t / 1) % progression.length;
                const chord = progression[bar];
                const bass = Math.sin(2 * Math.PI * chord[0] * t) * Math.sin(Math.PI * (t % 0.25) * 8) * 0.3;
                const drum = (Math.random() - 0.5) * Math.exp(-(t % 0.5) * 15) * 0.2 * (Math.floor(t*2)%2);
                const lead = Math.sin(2*Math.PI*chord[1]*4*t * (1 + 0.01 * Math.sin(2*Math.PI*5*t))) * 0.15;
                data[i] = (bass + drum + lead) * 0.8;
            }
            return this.createDataURI(data, sr);
        }
        generateBossBGM2() {
            const data = new Float32Array(44100 * 30);
            const sr = 44100;
            const notes = [61.74, 65.41, 69.30]; // C#, D, D#
            for (let i = 0; i < data.length; i++) {
                const t = i / sr;
                const tempo = 140 / 60; // 140 BPM
                const beat = t * tempo;
                
                const kick = Math.sin(2 * Math.PI * 60 * t) * Math.exp(-(beat % 1) * 20) * 0.4;
                
                let snare = 0;
                if ((beat % 2) > 1) {
                    snare = (Math.random() - 0.5) * Math.exp(-((beat % 1)) * 30) * 0.3;
                }
                
                const hihat = (Math.random() - 0.5) * Math.exp(-(beat % 0.25) * 50) * 0.1;
                
                const bassNote = notes[Math.floor(beat / 2) % notes.length] / 2;
                const bass = Math.sin(2 * Math.PI * bassNote * t) * 0.3 * Math.sin(Math.PI * beat * 4);
                
                const leadPattern = [0,1,2,1,0,2,1,2];
                const leadNote = notes[leadPattern[Math.floor(beat*4) % leadPattern.length]] * 2;
                const lead = (Math.abs(4 * (t * leadNote % 1) - 2) - 1) * 0.15 * Math.exp(-(beat % 0.25) * 10);

                data[i] = (kick + snare + hihat + bass + lead) * 0.6;
            }
            return this.createDataURI(data, sr);
        }
        generateWallBreak() { return this.combineTones(this.generateTone(80, 0.4, 'noise', {attack: 0.01, decay: 0.3, sustain: 0.1}), this.generateTone(150, 0.3, 'sawtooth')); }
        generateInventoryToggle() { return this.combineTones(this.generateTone(1800, 0.15, 'sine', {attack: 0.01, decay: 0.1, sustain: 0, release: 0, modulators: [{freq: 10, amount: -0.9}]})); }
        generateUnequip() { return this.combineTones(this.generateTone(1500, 0.2, 'sine')); }
        generateCoin(reverse=false) { const f = reverse ? 1200 : 1500; return this.combineTones(this.generateTone(f, 0.1, 'triangle'), this.generateTone(f*1.5, 0.15, 'sine')); }
        generateUpgrade() { return this.combineTones(this.generateTone(400, 0.5, 'sawtooth', {attack: 0.1, decay: 0.1, sustain: 0.8}), this.generateTone(800, 0.5, 'sine')); }
        generateError() { return this.combineTones(this.generateTone(160, 0.25, 'square'), this.generateTone(120, 0.3, 'sawtooth')); }
        generateSuccess() { return this.combineTones(this.generateTone(1046, 0.3, 'sine'), this.generateTone(1318, 0.4, 'triangle')); }
        generateSave() { return this.combineTones(this.generateTone(1000, 0.1, 'sine')); }
        generateMiss() { return this.combineTones(this.generateTone(400, 0.15, 'sine')); }
        generateDodge() { return this.combineTones(this.generateTone(1200, 0.1, 'sine')); }
        generatePickup() { return this.combineTones(this.generateTone(1500, 0.2, 'triangle')); }
        generateItemDrop() { return this.combineTones(this.generateTone(800, 0.3, 'triangle')); }
        generateMaterialDrop() { return this.combineTones(this.generateTone(900, 0.15, 'square')); }
        generateChest() { return this.combineTones(this.generateTone(600, 0.4, 'sawtooth', {attack: 0.1}), this.generateCoin()); }
        generatePotion() { return this.combineTones(this.generateTone(800, 0.3, 'sine', {attack: 0.05, decay: 0.2, sustain: 0.4})); }
        generateSkill() { return this.combineTones(this.generateTone(600, 0.4, 'triangle', {attack: 0.1})); }
        generateBossSkill() { return this.combineTones(this.generateTone(150, 1.2, 'sawtooth', {attack: 0.3, decay: 0.6}), this.generateTone(100, 1.2, 'noise')); }
        generateStep() { return this.combineTones(this.generateTone(50, 0.1, 'noise', {decay: 0.08})); }
        generateTrap() { return this.combineTones(this.generateTone(1000, 0.3, 'square'), this.generateHit()); }
        generatePortal() { return this.combineTones(this.generateTone(200, 1.0, 'sawtooth', {attack: 0.4, sustain: 0.8, modulators: [{freq: 2, amount: 0.5}]})); }
        generateSecretFound() { return this.combineTones(this.generateTone(1318, 0.7, 'sine'), this.generateTone(1567, 0.8, 'triangle')); }
        generateImpIdle() { return this.combineTones(this.generateTone(1200, 0.15, 'square')); }
        generateGolemIdle() { return this.combineTones(this.generateTone(60, 0.4, 'noise', {attack: 0.1})); }
        generateDrakeIdle() { return this.combineTones(this.generateTone(120, 0.6, 'sawtooth', {attack: 0.2})); }
        generateSkeletonIdle() { return this.combineTones(this.generateTone(50, 0.3, 'noise', {attack: 0.05, decay: 0.2})); }
        generateZombieIdle() { return this.combineTones(this.generateTone(100, 0.8, 'sawtooth', {decay: 0.4})); }
        generateWraithIdle() { return this.combineTones(this.generateTone(800, 1.2, 'sine', {attack: 0.5, modulators: [{freq: 3, amount: 0.2}]})); }
        generateAchievement() { return this.combineTones(this.generateTone(1200, 0.8, 'triangle', {attack: 0.1}), this.generateSuccess()); }
        generateMint() { return this.combineTones(this.generateTone(100, 1.5, 'sawtooth', {attack: 0.5, sustain: 0.8}), this.generatePortal()); }
        generateConnect() { return this.combineTones(this.generateTone(300, 0.5, 'triangle', {attack: 0.1})); }
        generateVictory() { return this.combineTones(this.generateTone(523, 2.0, 'triangle', {decay: 1.0}), this.generateAchievement()); }
        generateCrafting() { return this.combineTones(this.generateTone(600, 0.6, 'square'), this.generateUpgrade()); }
        generateBuff() { return this.combineTones(this.generateTone(440, 0.5, 'sawtooth', {attack: 0.2, decay: 0.2, modulators:[{freq:20, amount: 0.2}]}), this.generateTone(880, 0.5, 'sine', {attack: 0.2})); }
        generateDebuff() { return this.combineTones(this.generateTone(300, 0.6, 'square', {attack: 0.01, decay: 0.5, sustain: 0, release: 0, modulators: [{freq: 20, amount: -0.5}]})); }
        generateRarityLegendary() { return this.combineTones(this.generateTone(1046, 0.8, 'triangle', {attack: 0.01, decay: 0.7}), this.generateTone(1568, 0.8, 'sine', {attack: 0.2, decay: 0.6}), this.generateTone(2093, 0.8, 'triangle', {attack: 0.4, decay: 0.4})); }
        generateGemSocket() { return this.combineTones(this.generateTone(4000, 0.1, 'triangle', {attack: 0.01, decay: 0.05}), this.generateTone(2000, 0.2, 'sine')); }
        generateGemCombine() { return this.combineTones(this.generateTone(500, 0.7, 'sawtooth', {attack: 0.3, sustain: 0.2, modulators:[{freq: 15, amount: 1}]}), this.generateTone(2500, 0.2, 'triangle', {attack: 0.6})); }
        generateTabSwitch() { return this.combineTones(this.generateTone(1500, 0.1, 'noise', {attack: 0.01, decay: 0.08, sustain: 0})); }

        updateListener(pos) {
            Howler.pos(pos.x, pos.y, 0.5);
        }

        play(soundName, options = {}) {
            if (!this.isInitialized || !this.sounds[soundName] || this.isMuted) return;
            const sound = this.sounds[soundName];
            const baseVolume = this.soundDefinitions[soundName]?.volume || 0.5;
            const finalVolume = (options.volume !== undefined ? options.volume : baseVolume) * this.sfxVolume;
            const soundId = sound.play();
            sound.volume(finalVolume, soundId);
            if (options.pos) {
                sound.pos(options.pos.x, options.pos.y, 0, soundId);
            }
        }
        
        playBGM() {
            if (!this.isInitialized || this.isMuted) return;
            if (this.currentBgm && this.currentBgm.playing()) return;
            this.currentBgm = this.bgm;
            this.currentBgm.volume(this.bgmVolume);
            this.currentBgm.play();
        }

        playBossBGM(bossLevel = 5) {
            if (!this.isInitialized || this.isMuted) return;
            // Alternate boss tracks: e.g., Level 5, 15, 25 use BGM1. Level 10, 20, 30 use BGM2.
            const nextBossBgm = (Math.floor(bossLevel / 5)) % 2 !== 0 ? this.bossBgm : this.bossBgm2;
        
            if (this.currentBgm === nextBossBgm && this.currentBgm.playing()) return;
            if (this.currentBgm) this.currentBgm.fade(this.currentBgm.volume(), 0, 500);
            
            setTimeout(() => {
                this.currentBgm?.stop();
                this.currentBgm = nextBossBgm;
                this.currentBgm.volume(0);
                this.currentBgm.play();
                this.currentBgm.fade(0, this.bgmVolume, 500);
            }, 500);
        }

        stopBGM() {
            if (this.currentBgm) this.currentBgm.stop();
        }
        
        switchToNormalBGM() {
            if (!this.isInitialized || this.isMuted) return;
            if (this.currentBgm === this.bgm && this.currentBgm.playing()) return;
             if (this.currentBgm) this.currentBgm.fade(this.currentBgm.volume(), 0, 500);

            setTimeout(() => {
                this.currentBgm?.stop();
                this.currentBgm = this.bgm;
                this.currentBgm.volume(0);
                this.currentBgm.play();
                this.currentBgm.fade(0, this.bgmVolume, 500);
            }, 500);
        }

        setVolume(type, volume) {
            volume = Math.max(0, Math.min(1, volume));
            if (type === 'music') {
                this.bgmVolume = volume;
                if (this.bgm) this.bgm.volume(volume);
                if (this.bossBgm) this.bossBgm.volume(volume);
                if (this.bossBgm2) this.bossBgm2.volume(volume);
            } else if (type === 'sfx') {
                this.sfxVolume = volume;
            }
        }

        mute() { this.isMuted = true; Howler.mute(true); }
        unmute() { this.isMuted = false; Howler.mute(false); }
        toggle() { this.isMuted ? this.unmute() : this.mute(); }
    }

    window.soundSystem = new SoundSystem();
})();
