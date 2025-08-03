

import * as PIXI from 'pixi.js';

const TILE_SIZE = 32;

// Interfaces
interface Position {
    x: number;
    y: number;
}

interface Particle {
    sprite: PIXI.Sprite | PIXI.Graphics | PIXI.Text;
    vx: number;
    vy: number;
    life: number;
    totalLife: number;
    gravity?: number;
    rotationSpeed?: number;
    fade?: boolean;
    onComplete?: () => void;
    orbit?: {
        center: Position;
        radius: number;
        speed: number;
        angle: number;
    };
    scaleWobble?: {
        speed: number;
        amount: number;
    };
}

interface Projectile {
    sprite: PIXI.Sprite;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    speed: number;
    progress: number;
    onComplete: () => void;
}

export class EffectsManager {
    private app: PIXI.Application;
    private container: PIXI.Container;
    private particleContainer: PIXI.Container;
    private textEffectContainer: PIXI.Container;
    private particles: Particle[] = [];
    private projectiles: Projectile[] = [];
    private textures: { [key: string]: PIXI.Texture } = {};

    constructor(app: PIXI.Application) {
        this.app = app;
        
        this.container = new PIXI.Container();
        this.particleContainer = new PIXI.Container();
        this.textEffectContainer = new PIXI.Container();
        
        this.container.addChild(this.particleContainer, this.textEffectContainer);

        console.log('PixiJS EffectsManager Initialized');
    }

    public getContainer(): PIXI.Container {
        return this.container;
    }

    private getTexture(name: string, generator: () => PIXI.Graphics | PIXI.Text): PIXI.Texture {
        if (!this.textures[name]) {
            const graphic = generator();
            this.textures[name] = this.app.renderer.generateTexture({target: graphic});
            graphic.destroy();
        }
        return this.textures[name];
    }
    
    public preWarmTextures(): void {
        this.getTexture('particle_white', () => new PIXI.Graphics().circle(0, 0, 3).fill({ color: 0xFFFFFF }));
        this.getTexture('particle_plus', () => new PIXI.Text({ text: '+', style: { fill: 0x00FF00, fontSize: 16 }}));
        this.getTexture('particle_skull', () => new PIXI.Text({ text: '💀', style: { fontSize: 24 }}));
        this.getTexture('fire_particle', () => new PIXI.Graphics().circle(0,0,8).fill({ color: 0xFF8C00 }));
        this.getTexture('wind_particle', () => new PIXI.Graphics().rect(0,0,10,2).fill({ color: 0xFFFFFF }));
        this.getTexture('poison_particle', () => new PIXI.Graphics().circle(0,0,5).fill({ color: 0x00FF00 }));
        this.getTexture('spike_particle', () => new PIXI.Graphics().moveTo(0, -8).lineTo(-5, 8).lineTo(5, 8).closePath().fill({ color: 0x666666 }));
        this.getTexture('dust_particle', () => new PIXI.Graphics().circle(0,0,4).fill({ color: 0x966919 }));
        this.getTexture('blood_particle', () => new PIXI.Graphics().circle(0, 0, 2).fill({ color: 0xcc0000 }));
        this.getTexture('gold_coin_particle', () => new PIXI.Text({ text: '💰', style: { fontSize: 18 } }));
        this.getTexture('mana_particle', () => new PIXI.Graphics().circle(0, 0, 3).fill({ color: 0x3498db }));
        this.getTexture('star_particle', () => {
            const g = new PIXI.Graphics();
            g.star(0, 0, 5, 8).fill({ color: 0xFFFF00 });
            return g;
        });
        this.getTexture('poison_bubble', () => {
            const g = new PIXI.Graphics();
            g.circle(0, 0, 6).stroke({width: 1, color: 0x00FF00}).fill({ color: 0x00FF00, alpha: 0.3 });
            return g;
        });
        this.getTexture('aura_particle', () => {
             const g = new PIXI.Graphics();
             g.circle(0, 0, 20).fill({
                color: 0xFFFFFF,
                alpha: 0.5,
             });
             return g;
        });
        this.getTexture('light_beam', () => new PIXI.Graphics().rect(0,0, 8, TILE_SIZE * 3).fill({ color: 0xFFFFFF }));
        this.getTexture('soul_wisp', () => new PIXI.Graphics().ellipse(0,0, 4, 8).fill({ color: 0xADD8E6, alpha: 0.7 }));
    }

    // --- PARTICLE CREATION HELPERS ---
    private createParticle(x: number, y: number, texture: PIXI.Texture, options: Partial<Particle> = {}): Particle {
        const sprite = new PIXI.Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.x = x * TILE_SIZE + TILE_SIZE / 2;
        sprite.y = y * TILE_SIZE + TILE_SIZE / 2;
        
        const particle: Particle = {
            sprite,
            vx: options.vx ?? (Math.random() - 0.5) * 4,
            vy: options.vy ?? (Math.random() - 0.5) * 4,
            life: options.life ?? 1,
            totalLife: options.totalLife ?? options.life ?? 1,
            gravity: options.gravity,
            rotationSpeed: options.rotationSpeed,
            fade: options.fade,
            onComplete: options.onComplete,
            orbit: options.orbit,
            scaleWobble: options.scaleWobble,
        };
        this.particleContainer.addChild(sprite);
        this.particles.push(particle);
        return particle;
    }
    
    private createTextEffect(position: Position, text: string, color: string | number): Particle {
        const textStyle = new PIXI.TextStyle({
            fontFamily: '"Pixelify Sans"',
            fontSize: 24,
            fill: color,
            stroke: { color: '#000000', width: 4, join: 'round' },
            dropShadow: {
                color: '#000000',
                blur: 4,
                angle: Math.PI / 6,
                distance: 3,
            },
        });

        const damageText = new PIXI.Text({ text, style: textStyle });
        damageText.anchor.set(0.5);
        damageText.x = position.x * TILE_SIZE + TILE_SIZE / 2;
        damageText.y = position.y * TILE_SIZE + TILE_SIZE / 2;
        this.textEffectContainer.addChild(damageText);

        const particle: Particle = {
            sprite: damageText,
            vx: (Math.random() - 0.5) * 1,
            vy: -2,
            life: 1.5,
            totalLife: 1.5,
            gravity: 0.1,
            fade: true,
        };
        this.particles.push(particle);
        return particle;
    }

    public update(deltaTime: number): void {
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= deltaTime;
    
            if (p.life <= 0) {
                p.sprite.destroy();
                this.particles.splice(i, 1);
                p.onComplete?.();
                continue;
            }

            if (p.orbit) {
                p.orbit.angle += p.orbit.speed * deltaTime;
                p.sprite.x = (p.orbit.center.x * TILE_SIZE + TILE_SIZE / 2) + Math.cos(p.orbit.angle) * p.orbit.radius;
                p.sprite.y = (p.orbit.center.y * TILE_SIZE + TILE_SIZE / 2) + Math.sin(p.orbit.angle) * p.orbit.radius;
            } else {
                p.sprite.x += p.vx;
                p.sprite.y += p.vy;
            }
    
            if (p.gravity) {
                p.vy += p.gravity;
            }
            if (p.rotationSpeed) {
                p.sprite.rotation += p.rotationSpeed * deltaTime;
            }
            if (p.fade) {
                p.sprite.alpha = p.life / p.totalLife;
            }
            if (p.scaleWobble) {
                const scale = 1 + Math.sin(p.life * p.scaleWobble.speed) * p.scaleWobble.amount;
                p.sprite.scale.set(scale);
            }
        }
    
        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            proj.progress += proj.speed * deltaTime * 60; // speed is per frame
    
            if (proj.progress >= 1) {
                proj.onComplete();
                proj.sprite.destroy();
                this.projectiles.splice(i, 1);
                continue;
            }
    
            proj.sprite.x = proj.startX + (proj.endX - proj.startX) * proj.progress;
            proj.sprite.y = proj.startY + (proj.endY - proj.startY) * proj.progress;
        }
    }

    public clearAll(): void {
        this.particleContainer.removeChildren().forEach(c => c.destroy());
        this.textEffectContainer.removeChildren().forEach(c => c.destroy());
        this.particles = [];
        this.projectiles = [];
    }

    public createLevelUpEffect(position: Position): void {
        for (let i = 0; i < 50; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 5 + 2;
            this.createParticle(position.x, position.y, this.getTexture('particle_white', () => new PIXI.Graphics().circle(0, 0, 3).fill({ color: 0xFFFF00 })), {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.5,
                gravity: 0,
                fade: true,
                rotationSpeed: Math.random() * 4 - 2,
            });
        }
        this.createTextEffect(position, 'LEVEL UP!', 0xFFD700);
    }
    
    public createHealEffect(position: Position): void {
        for (let i = 0; i < 5; i++) {
            const p = this.createParticle(position.x, position.y, this.getTexture('particle_plus', () => new PIXI.Text({ text: '+', style: { fill: 0x00FF00, fontSize: 16 }})), {
                vx: Math.random() - 0.5,
                vy: -1 - Math.random(),
                life: 1.2,
                gravity: 0,
                fade: true
            });
            p.sprite.x += (Math.random() - 0.5) * TILE_SIZE;
        }
    }

    public createHitEffect(position: Position, isCrit: boolean, damage: number): void {
        const color = isCrit ? 0xFFD700 : 0xFFFFFF;
        const text = isCrit ? `CRIT! ${damage}` : `${damage}`;
        const p = this.createTextEffect(position, text, color);

        // Blood splatter effect
        for (let i = 0; i < 7; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1.5;
            this.createParticle(position.x, position.y, this.getTexture('blood_particle', () => new PIXI.Graphics().circle(0, 0, 2).fill({ color: 0xcc0000 })), {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.5,
                gravity: 0.15,
                fade: true,
            });
        }
    
        if (isCrit) {
            p.sprite.scale.set(1.5);
            for (let i = 0; i < 15; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 3 + 1;
                this.createParticle(position.x, position.y, this.getTexture('particle_white', () => new PIXI.Graphics().circle(0, 0, 2).fill({ color: 0xFF8C00 })), {
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 0.5,
                    gravity: 0.1,
                    fade: true,
                });
            }
        }
    }

    public createEnemyDeathEffect(position: Position, spriteEmoji: string): void {
        // Emoji shatter
        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 4 + 1;
            this.createParticle(position.x, position.y, this.getTexture(`death_${spriteEmoji}`, () => new PIXI.Text({text: spriteEmoji, style: {fontSize: 24}})), {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                gravity: 0.2,
                fade: true,
                rotationSpeed: Math.random() * 6 - 3
            });
        }
        // Soul wisps
        for (let i = 0; i < 5; i++) {
            this.createParticle(position.x, position.y, this.getTexture('soul_wisp', () => new PIXI.Graphics().ellipse(0,0, 4, 8).fill({ color: 0xADD8E6, alpha: 0.7 })), {
                vx: (Math.random() - 0.5) * 1.5,
                vy: -Math.random() * 2 - 1,
                life: 2.0,
                gravity: 0,
                fade: true,
                scaleWobble: { speed: 5, amount: 0.2 },
            });
        }
    }
    
    public createFireball(start: Position, end: Position, onComplete: () => void): void {
        const sprite = new PIXI.Sprite(this.getTexture('fire_particle', () => new PIXI.Graphics().circle(0,0,8).fill({ color: 0xFF8C00 })));
        sprite.anchor.set(0.5);
        this.particleContainer.addChild(sprite);
    
        const projectile: Projectile = {
            sprite,
            startX: start.x * TILE_SIZE + TILE_SIZE / 2,
            startY: start.y * TILE_SIZE + TILE_SIZE / 2,
            endX: end.x * TILE_SIZE + TILE_SIZE / 2,
            endY: end.y * TILE_SIZE + TILE_SIZE / 2,
            speed: 0.05,
            progress: 0,
            onComplete: () => {
                for(let i=0; i<20; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = Math.random() * 3 + 1;
                    this.createParticle(end.x, end.y, this.getTexture('fire_particle', () => new PIXI.Graphics().circle(0,0,5).fill({ color: 0xFF4500 })), {
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        life: 0.5,
                        gravity: 0.1,
                        fade: true,
                    });
                }
                onComplete();
            },
        };
        this.projectiles.push(projectile);
    }

    public createWhirlwindEffect(position: Position): void {
         for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * TILE_SIZE * 1.5;
            const p = this.createParticle(
                position.x + Math.cos(angle) * radius / TILE_SIZE,
                position.y + Math.sin(angle) * radius / TILE_SIZE,
                this.getTexture('wind_particle', () => new PIXI.Graphics().rect(0,0,10,2).fill({ color: 0xFFFFFF })), 
                { life: 0.8, fade: true, vx: 0, vy: 0 }
            );
            p.sprite.rotation = angle;
        }
    }
    
    public createDashEffect(position: Position, direction: {x: number, y: number}): void {
        for (let i = 0; i < 10; i++) {
            this.createParticle(position.x - direction.x * i * 0.2, position.y - direction.y * i * 0.2, this.getTexture('wind_particle', () => new PIXI.Graphics().rect(0,0,8,1).fill({ color: 0xAAAAFF })), {
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                life: 0.4,
                fade: true
            });
        }
    }

    public createShieldBashEffect(position: Position): void {
        const color = 0xFFFF00;
        const speed = 4;
        for (let i = 0; i < 36; i++) {
            const angle = i * 10 * (Math.PI / 180);
            this.createParticle(position.x, position.y, this.getTexture('particle_white', () => new PIXI.Graphics().circle(0,0,3).fill({ color })), {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.5,
                gravity: 0,
                fade: true,
            });
        }
    }

    public createPoisonNovaEffect(position: Position, radius: number): void {
        const numParticles = 50;
        const duration = 1.0;
        for (let i = 0; i < numParticles; i++) {
            const angle = (i / numParticles) * Math.PI * 2;
            const dist = Math.random() * radius * TILE_SIZE;
            this.createParticle(position.x, position.y, this.getTexture('poison_particle', () => new PIXI.Graphics().circle(0, 0, 5).fill({ color: 0x00FF00 })), {
                vx: Math.cos(angle) * dist / duration,
                vy: Math.sin(angle) * dist / duration,
                life: duration,
                fade: true,
                gravity: -0.1,
            });
        }
    }

    public createTrapEffect(position: Position): void {
        for (let i = 0; i < 5; i++) {
            const p = this.createParticle(
                position.x + (Math.random() - 0.5) * 0.8,
                position.y + (Math.random() - 0.5) * 0.8,
                this.getTexture('spike_particle', () => new PIXI.Graphics().moveTo(0, -8).lineTo(-5, 8).lineTo(5, 8).closePath().fill({ color: 0x666666 })),
                {
                    vx: 0,
                    vy: -Math.random() * 2 - 1,
                    life: 0.5,
                    fade: true,
                    gravity: 0.1,
                }
            );
            p.sprite.rotation = (Math.random() - 0.5) * 0.5;
        }
    }

    public createFireBreath(start: Position, end: Position): void {
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const coneAngle = Math.PI / 4; 
    
        for (let i = 0; i < 60; i++) {
            const fireAngle = angle + (Math.random() - 0.5) * coneAngle;
            const speed = Math.random() * 8 + 4;
            const life = Math.random() * 0.5 + 0.3;
    
            const p = this.createParticle(start.x, start.y, this.getTexture('fire_particle', () => new PIXI.Graphics().circle(0,0,8).fill({ color: 0xFF8C00 })), {
                vx: Math.cos(fireAngle) * speed,
                vy: Math.sin(fireAngle) * speed,
                life: life,
                gravity: Math.random() * 0.1,
                fade: true
            });
            p.sprite.scale.set(Math.random() * 0.5 + 0.5);
        }
    }

    public createAoeStomp(position: Position, onComplete: (stompCenter: Position) => void): void {
        const shockwave = new PIXI.Graphics();
        shockwave.x = position.x * TILE_SIZE + TILE_SIZE / 2;
        shockwave.y = position.y * TILE_SIZE + TILE_SIZE / 2;
        this.particleContainer.addChild(shockwave);
    
        const maxRadius = TILE_SIZE * 3;
        const duration = 0.4;
        let elapsed = 0;
    
        const animation = (ticker: PIXI.Ticker) => {
            elapsed += ticker.deltaMS / 1000;
            const progress = Math.min(elapsed / duration, 1.0);
    
            const easedProgress = 1 - Math.pow(1 - progress, 3); // easeOutCubic
    
            const currentRadius = maxRadius * easedProgress;
            const lineWidth = Math.max(1, 15 * (1 - progress));
            const alpha = 1 - progress;
    
            shockwave.clear();
            shockwave.circle(0, 0, currentRadius).stroke({ width: lineWidth, color: 0x8B4513, alpha });
    
            if (progress >= 1) {
                this.app.ticker.remove(animation);
                shockwave.destroy();
                onComplete(position);
                
                // Kick up dust
                for(let i=0; i<15; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = (Math.random() * 0.7 + 0.3) * maxRadius; // kick up from the outer ring
                    this.createParticle(
                        position.x + Math.cos(angle) * dist / TILE_SIZE,
                        position.y + Math.sin(angle) * dist / TILE_SIZE,
                        this.getTexture('dust_particle', () => new PIXI.Graphics().circle(0,0,4).fill({ color: 0x966919 })),
                        {
                            life: Math.random() * 0.5 + 0.4,
                            vx: (Math.random() - 0.5) * 3,
                            vy: -Math.random() * 4 - 1,
                            gravity: 0.2,
                            fade: true,
                        }
                    );
                }
            }
        };
    
        this.app.ticker.add(animation);
    }
    
    public createChestOpenEffect(position: Position): void {
        for (let i = 0; i < 40; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 4 + 2;
            this.createParticle(position.x, position.y, this.getTexture('gold_particle', () => new PIXI.Graphics().circle(0, 0, 3).fill({ color: 0xFFD700 })), {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                gravity: 0.1,
                fade: true
            });
        }
    }

    public createAmbientEffect(position: Position, biomeId: string): void {
        let textureName: string;
        let options: Partial<Particle>;

        switch(biomeId) {
            case 'forest':
                textureName = 'leaf_particle';
                options = {
                    vx: Math.random() * 0.5 + 0.1,
                    vy: Math.random() * 0.5 + 0.2,
                    life: 4,
                    fade: true,
                    rotationSpeed: Math.random() * 0.5
                };
                break;
            case 'crypts':
                textureName = 'mist_particle';
                 options = {
                    vx: (Math.random() - 0.5) * 0.3,
                    vy: (Math.random() - 0.5) * 0.3,
                    life: 5,
                    fade: true,
                };
                break;
            case 'volcano':
                textureName = 'ember_particle';
                options = {
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: -Math.random() * 1.5 - 0.5,
                    life: 3,
                    fade: true,
                    gravity: 0,
                };
                break;
            default:
                return;
        }

        const p = this.createParticle(
            position.x, 
            position.y, 
            this.getTexture(textureName, () => {
                const g = new PIXI.Graphics().circle(0, 0, 4);
                if (biomeId === 'forest') g.fill({ color: 0x228B22 });
                else if (biomeId === 'crypts') g.fill({ color: 0x708090, alpha: 0.3 });
                else g.fill({ color: 0xFF4500 });
                return g;
            }), 
            options
        );
        p.sprite.scale.set(Math.random() * 0.5 + 0.5);
    }

    public createGoldPickupEffect(position: Position): void {
        for (let i = 0; i < 15; i++) {
            this.createParticle(position.x, position.y, this.getTexture('gold_coin_particle', () => new PIXI.Text({ text: '💰', style: { fontSize: 18 } })), {
                vx: (Math.random() - 0.5) * 4,
                vy: -Math.random() * 5 - 2,
                life: 1.0,
                gravity: 0.2,
                fade: true,
                rotationSpeed: (Math.random() - 0.5) * 6
            });
        }
    }

    public createManaGainEffect(position: Position): void {
        for (let i = 0; i < 25; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            const p = this.createParticle(position.x, position.y, this.getTexture('mana_particle', () => new PIXI.Graphics().circle(0, 0, 3).fill({ color: 0x3498db })), {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.8,
                gravity: -0.05, // makes them float up
                fade: true
            });
            p.sprite.scale.set(Math.random() * 0.5 + 0.5);
        }
    }

    // --- NEW STATUS & SPECIAL EFFECTS ---

    public createRarityBeam(position: Position, rarity: 'legendary' | 'mythic' | string): void {
        const color = rarity === 'mythic' ? 0xe91e63 : 0xf1c40f;
        
        const p = this.createParticle(position.x, position.y, this.getTexture('light_beam', () => new PIXI.Graphics().rect(0,0, 8, TILE_SIZE * 3).fill({ color: 0xFFFFFF })), {
            vx: 0,
            vy: 0,
            life: 4.0,
            fade: false, // Custom fade logic
            onComplete: () => {
                // Add sparkle burst on complete
                 for (let i = 0; i < 20; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = Math.random() * 3 + 1;
                    this.createParticle(position.x, position.y + 0.5, this.getTexture('particle_white', () => new PIXI.Graphics().circle(0, 0, 2).fill({ color })), {
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        life: 0.8,
                        gravity: 0.1,
                        fade: true,
                    });
                }
            }
        });
        
        p.sprite.tint = color;
        p.sprite.y -= TILE_SIZE * 1.5; // Anchor at the bottom
        
        // Custom fade in/out
        const life = p.life;
        const tick = () => {
            if (p.life <= 0) return;
            const progress = (life - p.life) / life;
            if (progress < 0.2) { // Fade in
                p.sprite.alpha = progress / 0.2;
            } else if (progress > 0.8) { // Fade out
                p.sprite.alpha = (1 - progress) / 0.2;
            } else {
                p.sprite.alpha = 1 + Math.sin(p.life * 5) * 0.1; // Gentle pulse
            }
            requestAnimationFrame(tick);
        };
        tick();
    }

    public createStunEffect(position: Position): void {
        const numStars = 3;
        for (let i = 0; i < numStars; i++) {
            this.createParticle(position.x, position.y - 0.7, this.getTexture('star_particle', () => new PIXI.Graphics().star(0,0,5,8).fill({color: 0xFFFF00})), {
                vx: 0, vy: 0, life: 1.2,
                orbit: {
                    center: {x: position.x, y: position.y - 0.7},
                    radius: 20,
                    speed: 5 + i * 0.5,
                    angle: (i / numStars) * Math.PI * 2,
                },
                rotationSpeed: 2
            });
        }
    }

    public createPoisonEffect(position: Position): void {
        if (Math.random() > 0.2) return; // Don't spawn every frame
        this.createParticle(position.x + (Math.random()-0.5)*0.5, position.y, this.getTexture('poison_bubble', () => new PIXI.Graphics().circle(0,0,6).stroke({width:1, color:0x00ff00}).fill({color:0x00ff00, alpha: 0.3})), {
            vx: (Math.random() - 0.5) * 0.5,
            vy: -1 - Math.random(),
            life: 1.0,
            gravity: 0,
            fade: true,
            scaleWobble: { speed: 4, amount: 0.1 }
        });
    }

    public createBuffAura(position: Position, color: number): void {
        if (Math.random() > 0.3) return;
        const p = this.createParticle(position.x, position.y, this.getTexture('aura_particle', () => new PIXI.Graphics().circle(0,0,20).fill({color: 0xffffff})), {
            vx: 0,
            vy: 0,
            life: 0.8,
            fade: true,
        });
        p.sprite.tint = color;
        p.sprite.scale.set(0.2); // Start small
        // Custom scale-up logic
        const life = p.life;
        const tick = () => {
            if (p.life <= 0) return;
            const progress = (life - p.life) / life;
            p.sprite.scale.set(0.2 + progress * 0.8);
            requestAnimationFrame(tick);
        };
        tick();
    }
}
