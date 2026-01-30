import { BasesView, Menu, type QueryController } from 'obsidian'
import type { MyPlugin } from '../plugin'
import type { GraphNode, GraphEdge, GraphData, ClusterNode } from '../domain/graph.types'
import { isClusterNode } from '../domain/graph.types'
import type { RelationshipConfig } from '../domain/relationship.types'
import { GraphDataService } from '../services/graph-data.service'
import { RelationshipEngine } from '../services/relationship-engine'
import { D3Renderer } from '../services/d3-renderer'
import { ParticleSystem } from '../services/particle-system'
import { ClusterManager } from '../services/cluster-manager'
import { DetailsPanel } from '../../components/details-panel'
import { GRAPH_VIEW_TYPE, DEFAULT_GRAPH_CONFIG } from './graph-view-options'
import type { GraphViewConfig } from './graph-view-options'

/**
 * Graph visualization view for Obsidian Bases
 */
export class GraphView extends BasesView {
    type = GRAPH_VIEW_TYPE

    private plugin: MyPlugin
    private containerEl: HTMLElement
    private graphContainer: HTMLElement | null = null
    private detailsPanel: DetailsPanel | null = null

    // Services
    private graphDataService: GraphDataService
    private relationshipEngine: RelationshipEngine
    private d3Renderer: D3Renderer | null = null
    private particleSystem: ParticleSystem | null = null
    private clusterManager: ClusterManager

    // State
    private nodes: GraphNode[] = []
    private edges: GraphEdge[] = []
    private selectedNodeId: string | null = null
    private isInitialized = false

    constructor(controller: QueryController, scrollEl: HTMLElement, plugin: MyPlugin) {
        super(controller)
        this.plugin = plugin

        // Create main container
        this.containerEl = scrollEl.createDiv({ cls: 'graph-container' })

        // Initialize services
        this.graphDataService = new GraphDataService()
        this.relationshipEngine = new RelationshipEngine(this.plugin.app)
        this.clusterManager = new ClusterManager()

        // Register cleanup
        this.register(() => this.cleanup())

        // Register file modification listener for live particles
        this.registerEvent(
            this.plugin.app.vault.on('modify', (file) => {
                this.handleFileModified(file.path)
            })
        )

        // Register keyboard events
        this.registerDomEvent(this.containerEl, 'keydown', (e) => {
            if (e.key === 'Escape') {
                this.deselectNode()
            }
        })
    }

    override onload(): void {
        // Make container focusable for keyboard events
        this.containerEl.tabIndex = 0
    }

    override onunload(): void {
        this.cleanup()
    }

    /**
     * Called when Base data changes - main render logic
     */
    override onDataUpdated(): void {
        // Get configuration
        const config = this.getConfig()

        // Clear container on re-render
        this.containerEl.empty()
        this.containerEl.addClass('graph-container')

        // Get query results
        const entries = this.data.data
        const properties = this.config.getOrder()

        // Handle empty state
        if (entries.length === 0) {
            this.renderEmptyState()
            return
        }

        // Transform entries to graph nodes
        this.nodes = this.graphDataService.transform(entries, properties)

        // Build relationship config from view options
        const relationshipConfig = this.buildRelationshipConfig(config)

        // Compute edges
        this.edges = this.relationshipEngine.compute(this.nodes, relationshipConfig)

        // Apply clustering if enabled and node count exceeds threshold
        let graphData: GraphData = { nodes: this.nodes, edges: this.edges }
        if (config.enableClustering && this.nodes.length > config.clusterThreshold) {
            graphData = this.clusterManager.cluster(graphData, config.clusterThreshold)
        }

        // Create graph container
        this.graphContainer = this.containerEl.createDiv({ cls: 'graph-view' })

        // Initialize D3 renderer
        this.d3Renderer = new D3Renderer(this.graphContainer, {
            layout: config.layout,
            nodeSize: config.nodeSize,
            glowIntensity: config.glowIntensity,
            showLabels: config.showLabels,
            labelSize: config.labelSize,
            onNodeClick: (node) => this.handleNodeClick(node),
            onNodeRightClick: (event, node) => this.handleNodeRightClick(event, node as GraphNode),
            onBackgroundClick: () => this.deselectNode()
        })

        // Render graph
        this.d3Renderer.render(graphData)

        // Initialize particle system if enabled
        if (config.enableParticles) {
            const canvasContainer = this.containerEl.createDiv({
                cls: 'graph-particles'
            })
            this.particleSystem = new ParticleSystem(canvasContainer, {
                speed: config.particleSpeed
            })

            // Spawn particles for recently modified files
            const thresholdMs = config.recentThresholdHours * 60 * 60 * 1000
            const recentNodes = this.graphDataService.getRecentlyModified(this.nodes, thresholdMs)
            for (const node of recentNodes) {
                if (node.x !== undefined && node.y !== undefined) {
                    this.particleSystem.spawnBurst(node.x, node.y)
                }
            }
        }

        // Create details panel (initially hidden)
        this.detailsPanel = new DetailsPanel(this.containerEl, {
            onClose: () => this.deselectNode(),
            onOpenFile: (node) => this.openFile(node)
        })

        this.isInitialized = true
    }

    /**
     * Render empty state when no data
     */
    private renderEmptyState(): void {
        const emptyEl = this.containerEl.createDiv({ cls: 'graph-empty' })
        emptyEl.createEl('div', {
            cls: 'graph-empty-icon',
            text: ''
        })
        emptyEl.createEl('div', {
            cls: 'graph-empty-text',
            text: 'No notes match the current query'
        })
    }

    /**
     * Build relationship configuration from view options
     */
    private buildRelationshipConfig(config: GraphViewConfig): RelationshipConfig {
        // Parse property names from comma-separated string
        const propertyNames = config.propertyNames
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0)

        return {
            showWikilinks: config.showWikilinks,
            showFolders: config.showFolders,
            showProperties: config.showProperties,
            propertyNames,
            edgeStyles: {
                wikilink: { color: config.wikilinkColor },
                folder: { color: config.folderColor },
                property: { color: config.propertyColor }
            }
        }
    }

    /**
     * Get current configuration with defaults
     */
    private getConfig(): GraphViewConfig {
        return {
            layout:
                (this.config.get('layout') as GraphViewConfig['layout']) ??
                DEFAULT_GRAPH_CONFIG.layout,
            showWikilinks:
                (this.config.get('showWikilinks') as boolean) ?? DEFAULT_GRAPH_CONFIG.showWikilinks,
            showFolders:
                (this.config.get('showFolders') as boolean) ?? DEFAULT_GRAPH_CONFIG.showFolders,
            showProperties:
                (this.config.get('showProperties') as boolean) ??
                DEFAULT_GRAPH_CONFIG.showProperties,
            propertyNames:
                (this.config.get('propertyNames') as string) ?? DEFAULT_GRAPH_CONFIG.propertyNames,
            nodeSize: (this.config.get('nodeSize') as number) ?? DEFAULT_GRAPH_CONFIG.nodeSize,
            glowIntensity:
                (this.config.get('glowIntensity') as number) ?? DEFAULT_GRAPH_CONFIG.glowIntensity,
            showLabels:
                (this.config.get('showLabels') as boolean) ?? DEFAULT_GRAPH_CONFIG.showLabels,
            labelSize: (this.config.get('labelSize') as number) ?? DEFAULT_GRAPH_CONFIG.labelSize,
            wikilinkColor:
                (this.config.get('wikilinkColor') as string) ?? DEFAULT_GRAPH_CONFIG.wikilinkColor,
            folderColor:
                (this.config.get('folderColor') as string) ?? DEFAULT_GRAPH_CONFIG.folderColor,
            propertyColor:
                (this.config.get('propertyColor') as string) ?? DEFAULT_GRAPH_CONFIG.propertyColor,
            enableParticles:
                (this.config.get('enableParticles') as boolean) ??
                DEFAULT_GRAPH_CONFIG.enableParticles,
            particleSpeed:
                (this.config.get('particleSpeed') as number) ?? DEFAULT_GRAPH_CONFIG.particleSpeed,
            recentThresholdHours:
                (this.config.get('recentThresholdHours') as number) ??
                DEFAULT_GRAPH_CONFIG.recentThresholdHours,
            enableClustering:
                (this.config.get('enableClustering') as boolean) ??
                DEFAULT_GRAPH_CONFIG.enableClustering,
            clusterThreshold:
                (this.config.get('clusterThreshold') as number) ??
                DEFAULT_GRAPH_CONFIG.clusterThreshold
        }
    }

    /**
     * Handle node click - show details panel
     */
    private handleNodeClick(node: GraphNode | ClusterNode): void {
        if (this.selectedNodeId === node.id) {
            // Clicking selected node deselects it
            this.deselectNode()
            return
        }

        this.selectedNodeId = node.id

        // Get connected edges and nodes
        const connectedEdges = this.relationshipEngine.getConnectedEdges(node.id, this.edges)
        const connectedNodeIds = this.relationshipEngine.getConnectedNodeIds(node.id, this.edges)

        // Update visual state
        this.d3Renderer?.highlightNode(node.id, connectedNodeIds, connectedEdges)

        // Show details panel
        this.detailsPanel?.show(node, connectedEdges, this.nodes)
    }

    /**
     * Handle right-click on node - show context menu
     */
    private handleNodeRightClick(event: MouseEvent, node: GraphNode | ClusterNode): void {
        const menu = new Menu()

        // Only show file operations for non-cluster nodes
        if (!isClusterNode(node)) {
            menu.addItem((item) => {
                item.setTitle('Open note')
                    .setIcon('file')
                    .onClick(() => this.openFile(node))
            })

            menu.addItem((item) => {
                item.setTitle('Open in new tab')
                    .setIcon('file-plus')
                    .onClick(() => this.openFileInNewTab(node))
            })

            menu.addSeparator()

            menu.addItem((item) => {
                item.setTitle('Reveal in file explorer')
                    .setIcon('folder')
                    .onClick(() => {
                        const fileExplorer =
                            this.plugin.app.workspace.getLeavesOfType('file-explorer')[0]
                        if (fileExplorer) {
                            // @ts-expect-error - revealInFolder is not in types
                            fileExplorer.view.revealInFolder?.(node.file)
                        }
                    })
            })
        }

        menu.showAtMouseEvent(event)
    }

    /**
     * Deselect current node
     */
    private deselectNode(): void {
        if (!this.selectedNodeId) return

        this.selectedNodeId = null
        this.d3Renderer?.clearHighlight()
        this.detailsPanel?.hide()
    }

    /**
     * Handle file modification - spawn particle effect
     */
    private handleFileModified(path: string): void {
        if (!this.isInitialized || !this.particleSystem) return

        const node = this.nodes.find((n) => n.id === path)
        if (node && node.x !== undefined && node.y !== undefined) {
            this.particleSystem.spawnBurst(node.x, node.y)
        }
    }

    /**
     * Open file in current leaf
     */
    private async openFile(node: GraphNode): Promise<void> {
        await this.plugin.app.workspace.getLeaf().openFile(node.file)
    }

    /**
     * Open file in new tab
     */
    private async openFileInNewTab(node: GraphNode): Promise<void> {
        await this.plugin.app.workspace.getLeaf('tab').openFile(node.file)
    }

    /**
     * Cleanup resources
     */
    private cleanup(): void {
        this.d3Renderer?.destroy()
        this.d3Renderer = null
        this.particleSystem?.destroy()
        this.particleSystem = null
        this.detailsPanel = null
        this.isInitialized = false
    }
}
