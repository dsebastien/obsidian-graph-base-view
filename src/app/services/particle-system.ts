/**
 * Configuration options for the particle system
 */
export interface ParticleSystemOptions {
    speed: number
    particleCount?: number
    particleLifespan?: number
    particleSize?: number
    colors?: string[]
}

/**
 * A single particle in the system
 */
interface Particle {
    x: number
    y: number
    vx: number
    vy: number
    life: number
    maxLife: number
    size: number
    color: string
    alpha: number
}

/**
 * Canvas-based particle animation system for visual effects
 */
export class ParticleSystem {
    private container: HTMLElement
    private canvas: HTMLCanvasElement
    private ctx: CanvasRenderingContext2D
    private particles: Particle[] = []
    private animationFrame: number | null = null
    private options: Required<ParticleSystemOptions>
    private isRunning = false

    // Default colors for particles
    private static readonly DEFAULT_COLORS = [
        '#00ff88', // Green
        '#0088ff', // Blue
        '#ff8800', // Orange
        '#ff00ff', // Magenta
        '#00ffff', // Cyan
        '#ffff00' // Yellow
    ]

    constructor(container: HTMLElement, options: ParticleSystemOptions) {
        this.container = container
        this.options = {
            speed: options.speed,
            particleCount: options.particleCount ?? 20,
            particleLifespan: options.particleLifespan ?? 60,
            particleSize: options.particleSize ?? 3,
            colors: options.colors ?? ParticleSystem.DEFAULT_COLORS
        }

        // Create canvas
        this.canvas = document.createElement('canvas')
        this.canvas.className = 'graph-particle-canvas'
        this.container.appendChild(this.canvas)

        // Get context
        const ctx = this.canvas.getContext('2d')
        if (!ctx) {
            throw new Error('Failed to get 2D context for particle canvas')
        }
        this.ctx = ctx

        // Setup resize observer
        this.setupResizeObserver()

        // Initial resize
        this.resize()
    }

    /**
     * Setup resize observer to handle container size changes
     */
    private setupResizeObserver(): void {
        const resizeObserver = new ResizeObserver(() => {
            this.resize()
        })
        resizeObserver.observe(this.container)
    }

    /**
     * Resize canvas to match container
     */
    private resize(): void {
        const rect = this.container.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1

        this.canvas.width = rect.width * dpr
        this.canvas.height = rect.height * dpr
        this.canvas.style.width = `${rect.width}px`
        this.canvas.style.height = `${rect.height}px`

        this.ctx.scale(dpr, dpr)
    }

    /**
     * Spawn a burst of particles at a position
     */
    spawnBurst(x: number, y: number, count?: number): void {
        const particleCount = count ?? this.options.particleCount

        for (let i = 0; i < particleCount; i++) {
            this.spawnParticle(x, y)
        }

        // Start animation loop if not already running
        if (!this.isRunning) {
            this.isRunning = true
            this.animate()
        }
    }

    /**
     * Spawn a single particle
     */
    private spawnParticle(x: number, y: number): void {
        // Random angle for velocity
        const angle = Math.random() * Math.PI * 2
        const speed = (0.5 + Math.random() * 2) * this.options.speed

        // Random color
        const colors = this.options.colors
        const colorIndex = Math.floor(Math.random() * colors.length)
        const color = colors[colorIndex] ?? ParticleSystem.DEFAULT_COLORS[0] ?? '#00ff88'

        const particle: Particle = {
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: this.options.particleLifespan,
            maxLife: this.options.particleLifespan,
            size: this.options.particleSize * (0.5 + Math.random() * 0.5),
            color,
            alpha: 1
        }

        this.particles.push(particle)
    }

    /**
     * Animation loop
     */
    private animate(): void {
        if (!this.isRunning) return

        this.update()
        this.render()

        // Continue if there are particles
        if (this.particles.length > 0) {
            this.animationFrame = requestAnimationFrame(() => this.animate())
        } else {
            this.isRunning = false
        }
    }

    /**
     * Update particle positions and lifespans
     */
    private update(): void {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i]
            if (!particle) continue

            // Update position
            particle.x += particle.vx
            particle.y += particle.vy

            // Apply friction
            particle.vx *= 0.98
            particle.vy *= 0.98

            // Update life
            particle.life -= 1
            particle.alpha = particle.life / particle.maxLife

            // Remove dead particles
            if (particle.life <= 0) {
                this.particles.splice(i, 1)
            }
        }
    }

    /**
     * Render particles to canvas
     */
    private render(): void {
        const rect = this.container.getBoundingClientRect()

        // Clear canvas
        this.ctx.clearRect(0, 0, rect.width, rect.height)

        // Draw each particle
        for (const particle of this.particles) {
            this.drawParticle(particle)
        }
    }

    /**
     * Draw a single particle
     */
    private drawParticle(particle: Particle): void {
        this.ctx.save()

        // Set alpha
        this.ctx.globalAlpha = particle.alpha

        // Draw glow
        const gradient = this.ctx.createRadialGradient(
            particle.x,
            particle.y,
            0,
            particle.x,
            particle.y,
            particle.size * 2
        )
        gradient.addColorStop(0, particle.color)
        gradient.addColorStop(0.5, this.hexToRgba(particle.color, 0.5))
        gradient.addColorStop(1, this.hexToRgba(particle.color, 0))

        this.ctx.fillStyle = gradient
        this.ctx.beginPath()
        this.ctx.arc(particle.x, particle.y, particle.size * 2, 0, Math.PI * 2)
        this.ctx.fill()

        // Draw core
        this.ctx.fillStyle = particle.color
        this.ctx.beginPath()
        this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        this.ctx.fill()

        this.ctx.restore()
    }

    /**
     * Convert hex color to rgba string
     */
    private hexToRgba(hex: string, alpha: number): string {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
        if (!result || !result[1] || !result[2] || !result[3]) {
            return `rgba(0, 255, 136, ${alpha})`
        }
        const r = parseInt(result[1], 16)
        const g = parseInt(result[2], 16)
        const b = parseInt(result[3], 16)
        return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }

    /**
     * Spawn a trail effect between two points
     */
    spawnTrail(x1: number, y1: number, x2: number, y2: number): void {
        const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
        const particleCount = Math.min(Math.floor(distance / 20), 10)

        for (let i = 0; i < particleCount; i++) {
            const t = i / particleCount
            const x = x1 + (x2 - x1) * t
            const y = y1 + (y2 - y1) * t
            this.spawnParticle(x, y)
        }

        if (!this.isRunning && this.particles.length > 0) {
            this.isRunning = true
            this.animate()
        }
    }

    /**
     * Clear all particles
     */
    clear(): void {
        this.particles = []
    }

    /**
     * Destroy the particle system
     */
    destroy(): void {
        this.isRunning = false
        if (this.animationFrame !== null) {
            cancelAnimationFrame(this.animationFrame)
            this.animationFrame = null
        }
        this.particles = []
        this.canvas.remove()
    }
}
