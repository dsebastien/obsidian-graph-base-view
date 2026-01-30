import * as d3 from 'd3'
import type {
    GraphNode,
    GraphEdge,
    GraphData,
    ClusterNode,
    LayoutType
} from '../domain/graph.types'
import { isClusterNode } from '../domain/graph.types'

/**
 * Configuration options for the D3 renderer
 */
export interface D3RendererOptions {
    layout: LayoutType
    nodeSize: number
    glowIntensity: number
    showLabels: boolean
    labelSize: number
    onNodeClick?: (node: GraphNode | ClusterNode) => void
    onNodeRightClick?: (event: MouseEvent, node: GraphNode | ClusterNode) => void
    onBackgroundClick?: () => void
}

/**
 * D3-based renderer for the graph visualization
 */
export class D3Renderer {
    private container: HTMLElement
    private options: D3RendererOptions
    private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null
    private g: d3.Selection<SVGGElement, unknown, null, undefined> | null = null
    private simulation: d3.Simulation<GraphNode | ClusterNode, GraphEdge> | null = null
    private zoom: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null

    // Selection references for updates
    private nodeGroup: d3.Selection<
        SVGGElement,
        GraphNode | ClusterNode,
        SVGGElement,
        unknown
    > | null = null
    private linkGroup: d3.Selection<SVGLineElement, GraphEdge, SVGGElement, unknown> | null = null
    private labelGroup: d3.Selection<
        SVGTextElement,
        GraphNode | ClusterNode,
        SVGGElement,
        unknown
    > | null = null

    // Current data
    private currentData: GraphData | null = null

    constructor(container: HTMLElement, options: D3RendererOptions) {
        this.container = container
        this.options = options
    }

    /**
     * Render the graph with the given data
     */
    render(data: GraphData): void {
        this.currentData = data
        const { nodes, edges } = data

        // Get container dimensions
        const width = this.container.clientWidth || 800
        const height = this.container.clientHeight || 600

        // Clear existing SVG
        this.destroy()

        // Create SVG
        this.svg = d3
            .select(this.container)
            .append('svg')
            .attr('class', 'graph-svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`)

        // Add defs for gradients and filters
        this.createDefs()

        // Create main group for zoom/pan
        this.g = this.svg.append('g').attr('class', 'graph-main-group')

        // Setup zoom
        this.zoom = d3
            .zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                this.g?.attr('transform', event.transform)
            })

        this.svg.call(this.zoom)

        // Handle background click
        this.svg.on('click', (event) => {
            if (event.target === this.svg?.node()) {
                this.options.onBackgroundClick?.()
            }
        })

        // Create link group (rendered first, below nodes)
        const linkGroup = this.g.append('g').attr('class', 'graph-links')

        // Create links
        this.linkGroup = linkGroup
            .selectAll<SVGLineElement, GraphEdge>('line')
            .data(edges)
            .join('line')
            .attr('class', (d) => `graph-edge graph-edge--${d.type}`)
            .attr('stroke', (d) => d.style.color)
            .attr('stroke-width', (d) => d.style.width)
            .attr('stroke-dasharray', (d) => d.style.dashArray)
            .attr('stroke-opacity', (d) => d.style.opacity)

        // Create node group
        const nodeGroup = this.g.append('g').attr('class', 'graph-nodes')

        // Create nodes
        this.nodeGroup = nodeGroup
            .selectAll<SVGGElement, GraphNode | ClusterNode>('g')
            .data(nodes)
            .join('g')
            .attr('class', (d) => (isClusterNode(d) ? 'graph-cluster' : 'graph-node-group'))
            .call(this.createDragBehavior())
            .on('click', (event, d) => {
                event.stopPropagation()
                this.options.onNodeClick?.(d)
            })
            .on('contextmenu', (event, d) => {
                event.preventDefault()
                event.stopPropagation()
                this.options.onNodeRightClick?.(event, d)
            })

        // Add circles to nodes
        this.nodeGroup
            .append('circle')
            .attr('class', 'graph-node')
            .attr('r', (d) =>
                isClusterNode(d) ? this.options.nodeSize * 1.5 : this.options.nodeSize
            )
            .attr('fill', (d) => this.getNodeColor(d))
            .style('filter', this.options.glowIntensity > 0 ? 'url(#graph-glow)' : 'none')

        // Add cluster count badge
        this.nodeGroup
            .filter((d) => isClusterNode(d))
            .append('text')
            .attr('class', 'graph-cluster-count')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('fill', '#ffffff')
            .attr('font-size', this.options.nodeSize)
            .text((d) => (isClusterNode(d) ? d.childCount.toString() : ''))

        // Create labels
        if (this.options.showLabels) {
            const labelGroupEl = this.g.append('g').attr('class', 'graph-labels')

            this.labelGroup = labelGroupEl
                .selectAll<SVGTextElement, GraphNode | ClusterNode>('text')
                .data(nodes)
                .join('text')
                .attr('class', 'graph-label')
                .attr('text-anchor', 'middle')
                .attr('dy', this.options.nodeSize + this.options.labelSize)
                .attr('font-size', this.options.labelSize)
                .text((d) => d.label)
        }

        // Create force simulation
        if (this.options.layout === 'force') {
            this.createForceSimulation(nodes, edges, width, height)
        } else {
            this.createRadialLayout(nodes, edges, width, height)
        }
    }

    /**
     * Create SVG defs for gradients and filters
     */
    private createDefs(): void {
        if (!this.svg) return

        const defs = this.svg.append('defs')

        // Glow filter
        const filter = defs
            .append('filter')
            .attr('id', 'graph-glow')
            .attr('x', '-50%')
            .attr('y', '-50%')
            .attr('width', '200%')
            .attr('height', '200%')

        filter
            .append('feGaussianBlur')
            .attr('stdDeviation', this.options.glowIntensity / 2)
            .attr('result', 'coloredBlur')

        const feMerge = filter.append('feMerge')
        feMerge.append('feMergeNode').attr('in', 'coloredBlur')
        feMerge.append('feMergeNode').attr('in', 'SourceGraphic')
    }

    /**
     * Create force-directed simulation
     */
    private createForceSimulation(
        nodes: (GraphNode | ClusterNode)[],
        edges: GraphEdge[],
        width: number,
        height: number
    ): void {
        this.simulation = d3
            .forceSimulation<GraphNode | ClusterNode, GraphEdge>(nodes)
            .force(
                'link',
                d3
                    .forceLink<GraphNode | ClusterNode, GraphEdge>(edges)
                    .id((d) => d.id)
                    .distance(100)
                    .strength(0.5)
            )
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force(
                'collision',
                d3
                    .forceCollide<GraphNode | ClusterNode>()
                    .radius(
                        (d) =>
                            (isClusterNode(d)
                                ? this.options.nodeSize * 1.5
                                : this.options.nodeSize) + 5
                    )
            )
            .on('tick', () => this.tick())

        // Entry animation
        this.simulation.alpha(1).restart()
    }

    /**
     * Create radial tree layout
     */
    private createRadialLayout(
        nodes: (GraphNode | ClusterNode)[],
        edges: GraphEdge[],
        width: number,
        height: number
    ): void {
        // Build hierarchy from edges
        const root = this.buildHierarchy(nodes, edges)

        // Create tree layout
        const treeLayout = d3
            .tree<GraphNode | ClusterNode>()
            .size([2 * Math.PI, Math.min(width, height) / 2 - 100])

        // Apply layout
        const treeRoot = d3.hierarchy(root)
        treeLayout(treeRoot as d3.HierarchyNode<GraphNode | ClusterNode>)

        // Convert polar to Cartesian coordinates
        const centerX = width / 2
        const centerY = height / 2

        treeRoot.each((d) => {
            const node = d.data
            const angle = (d as unknown as { x: number }).x
            const radius = (d as unknown as { y: number }).y
            node.x = centerX + radius * Math.cos(angle - Math.PI / 2)
            node.y = centerY + radius * Math.sin(angle - Math.PI / 2)
        })

        // Update positions
        this.tick()
    }

    /**
     * Build hierarchy from nodes and edges for radial layout
     */
    private buildHierarchy(
        nodes: (GraphNode | ClusterNode)[],
        edges: GraphEdge[]
    ): GraphNode | ClusterNode {
        // Create a map of node connections
        const children = new Map<string, Set<string>>()
        const hasParent = new Set<string>()

        for (const edge of edges) {
            const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id
            const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id

            if (!children.has(sourceId)) {
                children.set(sourceId, new Set())
            }
            children.get(sourceId)?.add(targetId)
            hasParent.add(targetId)
        }

        // Find root nodes (nodes without parents)
        const roots = nodes.filter((n) => !hasParent.has(n.id))
        const firstRoot = roots[0]

        // If no clear root, use first node
        const root = firstRoot ??
            nodes[0] ?? {
                id: 'virtual-root',
                label: 'Root',
                mtime: 0,
                ctime: 0,
                folder: '',
                properties: {}
            }

        // Build tree structure recursively
        const visited = new Set<string>()
        const buildTree = (node: GraphNode | ClusterNode): GraphNode | ClusterNode => {
            visited.add(node.id)
            const nodeChildren = children.get(node.id)

            if (nodeChildren) {
                const childNodes = nodes.filter((n) => nodeChildren.has(n.id) && !visited.has(n.id))
                // @ts-expect-error - Adding children property for d3 hierarchy
                node.children = childNodes.map((c) => buildTree(c))
            }

            return node
        }

        return buildTree(root as GraphNode | ClusterNode)
    }

    /**
     * Update positions on each simulation tick
     */
    private tick(): void {
        this.linkGroup
            ?.attr('x1', (d) => {
                const source = d.source as GraphNode | ClusterNode
                return source.x ?? 0
            })
            .attr('y1', (d) => {
                const source = d.source as GraphNode | ClusterNode
                return source.y ?? 0
            })
            .attr('x2', (d) => {
                const target = d.target as GraphNode | ClusterNode
                return target.x ?? 0
            })
            .attr('y2', (d) => {
                const target = d.target as GraphNode | ClusterNode
                return target.y ?? 0
            })

        this.nodeGroup?.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)

        this.labelGroup?.attr('x', (d) => d.x ?? 0).attr('y', (d) => d.y ?? 0)
    }

    /**
     * Create drag behavior for nodes
     */
    private createDragBehavior(): d3.DragBehavior<SVGGElement, GraphNode | ClusterNode, unknown> {
        return d3
            .drag<SVGGElement, GraphNode | ClusterNode>()
            .on('start', (event, d) => {
                if (!event.active && this.simulation) {
                    this.simulation.alphaTarget(0.3).restart()
                }
                d.fx = d.x
                d.fy = d.y
            })
            .on('drag', (event, d) => {
                d.fx = event.x
                d.fy = event.y
            })
            .on('end', (event, d) => {
                if (!event.active && this.simulation) {
                    this.simulation.alphaTarget(0)
                }
                d.fx = null
                d.fy = null
            })
    }

    /**
     * Get node color based on type or folder
     */
    private getNodeColor(node: GraphNode | ClusterNode): string {
        if (isClusterNode(node)) {
            return '#ff6600'
        }

        // Color based on folder hash for visual grouping
        const folderHash = this.hashString(node.folder)
        const hue = folderHash % 360
        return `hsl(${hue}, 70%, 60%)`
    }

    /**
     * Simple string hash function
     */
    private hashString(str: string): number {
        let hash = 0
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i)
            hash = (hash << 5) - hash + char
            hash = hash & hash // Convert to 32bit integer
        }
        return Math.abs(hash)
    }

    /**
     * Highlight a node and its connections
     */
    highlightNode(
        nodeId: string,
        connectedNodeIds: Set<string>,
        connectedEdges: GraphEdge[]
    ): void {
        const connectedEdgeIds = new Set(connectedEdges.map((e) => e.id))

        // Dim all nodes except selected and connected
        this.nodeGroup?.classed('graph-node-group--dimmed', (d) => {
            return d.id !== nodeId && !connectedNodeIds.has(d.id)
        })

        // Highlight selected node
        this.nodeGroup?.classed('graph-node-group--selected', (d) => d.id === nodeId)

        // Dim unconnected edges
        this.linkGroup?.classed('graph-edge--dimmed', (d) => !connectedEdgeIds.has(d.id))

        // Highlight connected edges
        this.linkGroup?.classed('graph-edge--highlighted', (d) => connectedEdgeIds.has(d.id))

        // Dim labels
        this.labelGroup?.classed('graph-label--dimmed', (d) => {
            return d.id !== nodeId && !connectedNodeIds.has(d.id)
        })
    }

    /**
     * Clear all highlights
     */
    clearHighlight(): void {
        this.nodeGroup
            ?.classed('graph-node-group--dimmed', false)
            .classed('graph-node-group--selected', false)

        this.linkGroup
            ?.classed('graph-edge--dimmed', false)
            .classed('graph-edge--highlighted', false)

        this.labelGroup?.classed('graph-label--dimmed', false)
    }

    /**
     * Get the current position of a node
     */
    getNodePosition(nodeId: string): { x: number; y: number } | null {
        if (!this.currentData) return null

        const node = this.currentData.nodes.find((n) => n.id === nodeId)
        if (node && node.x !== undefined && node.y !== undefined) {
            return { x: node.x, y: node.y }
        }

        return null
    }

    /**
     * Reset zoom to default
     */
    resetZoom(): void {
        if (!this.svg || !this.zoom) return

        this.svg.transition().duration(500).call(this.zoom.transform, d3.zoomIdentity)
    }

    /**
     * Fit all nodes in view
     */
    fitToView(): void {
        if (!this.svg || !this.zoom || !this.currentData) return

        const nodes = this.currentData.nodes
        if (nodes.length === 0) return

        // Calculate bounding box
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity

        for (const node of nodes) {
            if (node.x !== undefined && node.y !== undefined) {
                minX = Math.min(minX, node.x)
                minY = Math.min(minY, node.y)
                maxX = Math.max(maxX, node.x)
                maxY = Math.max(maxY, node.y)
            }
        }

        if (!isFinite(minX)) return

        const width = this.container.clientWidth
        const height = this.container.clientHeight
        const padding = 50

        const graphWidth = maxX - minX + padding * 2
        const graphHeight = maxY - minY + padding * 2

        const scale = Math.min(
            width / graphWidth,
            height / graphHeight,
            2 // Max zoom
        )

        const centerX = (minX + maxX) / 2
        const centerY = (minY + maxY) / 2

        this.svg
            .transition()
            .duration(500)
            .call(
                this.zoom.transform,
                d3.zoomIdentity
                    .translate(width / 2, height / 2)
                    .scale(scale)
                    .translate(-centerX, -centerY)
            )
    }

    /**
     * Destroy the renderer and cleanup
     */
    destroy(): void {
        this.simulation?.stop()
        this.simulation = null
        this.svg?.remove()
        this.svg = null
        this.g = null
        this.nodeGroup = null
        this.linkGroup = null
        this.labelGroup = null
        this.zoom = null
        this.currentData = null
    }
}
