import type { App, CachedMetadata } from 'obsidian'
import type { GraphNode, GraphEdge } from '../domain/graph.types'
import type { RelationshipType, RelationshipConfig, EdgeStyle } from '../domain/relationship.types'
import { DEFAULT_EDGE_STYLES } from '../domain/relationship.types'

/**
 * Service for computing relationships (edges) between graph nodes
 */
export class RelationshipEngine {
    constructor(private app: App) {}

    /**
     * Compute all edges based on the relationship configuration
     * @param nodes - All graph nodes
     * @param config - Relationship configuration
     * @returns Array of edges
     */
    compute(nodes: GraphNode[], config: RelationshipConfig): GraphEdge[] {
        const edges: GraphEdge[] = []
        const nodeMap = new Map<string, GraphNode>()

        // Build a map of path -> node for quick lookup
        for (const node of nodes) {
            nodeMap.set(node.id, node)
        }

        if (config.showWikilinks) {
            const wikilinkEdges = this.computeWikilinkEdges(nodes, nodeMap, config)
            edges.push(...wikilinkEdges)
        }

        if (config.showFolders) {
            const folderEdges = this.computeFolderEdges(nodes, config)
            edges.push(...folderEdges)
        }

        if (config.showProperties && config.propertyNames.length > 0) {
            const propertyEdges = this.computePropertyEdges(nodes, config.propertyNames, config)
            edges.push(...propertyEdges)
        }

        return edges
    }

    /**
     * Compute edges based on wikilinks between notes
     */
    private computeWikilinkEdges(
        nodes: GraphNode[],
        nodeMap: Map<string, GraphNode>,
        config: RelationshipConfig
    ): GraphEdge[] {
        const edges: GraphEdge[] = []
        const seenEdges = new Set<string>()

        for (const node of nodes) {
            const resolvedLinks = this.app.metadataCache.resolvedLinks[node.id]
            if (!resolvedLinks) continue

            for (const targetPath of Object.keys(resolvedLinks)) {
                // Only create edges to nodes that are in our graph
                if (!nodeMap.has(targetPath)) continue

                // Create a unique key for the edge (sorted to avoid duplicates)
                const edgeKey = [node.id, targetPath].sort().join('|')
                if (seenEdges.has(edgeKey)) continue
                seenEdges.add(edgeKey)

                const edge: GraphEdge = {
                    id: `wikilink-${node.id}-${targetPath}`,
                    source: node.id,
                    target: targetPath,
                    type: 'wikilink',
                    style: this.getEdgeStyle('wikilink', config),
                    metadata: {
                        linkText: this.getLinkText(node.id, targetPath)
                    }
                }

                edges.push(edge)
            }
        }

        return edges
    }

    /**
     * Get the display text used for a link
     */
    private getLinkText(sourcePath: string, targetPath: string): string | undefined {
        const cache = this.app.metadataCache.getCache(sourcePath)
        if (!cache?.links) return undefined

        for (const link of cache.links) {
            const resolvedPath = this.app.metadataCache.getFirstLinkpathDest(
                link.link,
                sourcePath
            )?.path
            if (resolvedPath === targetPath) {
                return link.displayText ?? link.link
            }
        }

        return undefined
    }

    /**
     * Compute edges based on folder hierarchy
     * Nodes in the same folder are connected
     */
    private computeFolderEdges(nodes: GraphNode[], config: RelationshipConfig): GraphEdge[] {
        const edges: GraphEdge[] = []
        const folderGroups = new Map<string, GraphNode[]>()

        // Group nodes by folder
        for (const node of nodes) {
            if (!node.folder) continue
            const existing = folderGroups.get(node.folder) ?? []
            existing.push(node)
            folderGroups.set(node.folder, existing)
        }

        // Create edges between nodes in the same folder
        for (const [folder, folderNodes] of folderGroups) {
            if (folderNodes.length < 2) continue

            // Connect each node to the first node in the folder (star topology)
            // This reduces edge count while maintaining the folder relationship
            const firstNode = folderNodes[0]
            if (!firstNode) continue

            for (let i = 1; i < folderNodes.length; i++) {
                const otherNode = folderNodes[i]
                if (!otherNode) continue

                const edge: GraphEdge = {
                    id: `folder-${firstNode.id}-${otherNode.id}`,
                    source: firstNode.id,
                    target: otherNode.id,
                    type: 'folder',
                    style: this.getEdgeStyle('folder', config),
                    metadata: {
                        propertyName: 'folder',
                        propertyValue: folder
                    }
                }

                edges.push(edge)
            }
        }

        return edges
    }

    /**
     * Compute edges based on shared property values
     */
    private computePropertyEdges(
        nodes: GraphNode[],
        propertyNames: string[],
        config: RelationshipConfig
    ): GraphEdge[] {
        const edges: GraphEdge[] = []
        const seenEdges = new Set<string>()

        for (const propertyName of propertyNames) {
            // Group nodes by property value
            const valueGroups = new Map<string, GraphNode[]>()

            for (const node of nodes) {
                const value = node.properties[propertyName]
                if (value === undefined || value === null) continue

                // Handle array values (e.g., tags)
                const values = Array.isArray(value) ? value : [value]

                for (const v of values) {
                    const key = String(v)
                    const existing = valueGroups.get(key) ?? []
                    existing.push(node)
                    valueGroups.set(key, existing)
                }
            }

            // Create edges between nodes with the same property value
            for (const [valueStr, groupNodes] of valueGroups) {
                if (groupNodes.length < 2) continue

                // Create edges between all pairs (limited to avoid explosion)
                const maxEdges = Math.min(groupNodes.length, 10)
                for (let i = 0; i < maxEdges; i++) {
                    for (let j = i + 1; j < maxEdges; j++) {
                        const nodeA = groupNodes[i]
                        const nodeB = groupNodes[j]
                        if (!nodeA || !nodeB) continue

                        const edgeKey = [nodeA.id, nodeB.id, propertyName].sort().join('|')
                        if (seenEdges.has(edgeKey)) continue
                        seenEdges.add(edgeKey)

                        const edge: GraphEdge = {
                            id: `property-${propertyName}-${nodeA.id}-${nodeB.id}`,
                            source: nodeA.id,
                            target: nodeB.id,
                            type: 'property',
                            style: this.getEdgeStyle('property', config),
                            metadata: {
                                propertyName,
                                propertyValue: valueStr
                            }
                        }

                        edges.push(edge)
                    }
                }
            }
        }

        return edges
    }

    /**
     * Get edge style for a relationship type, applying any custom overrides
     */
    private getEdgeStyle(type: RelationshipType, config: RelationshipConfig): EdgeStyle {
        const defaultStyle = DEFAULT_EDGE_STYLES[type]
        const customStyle = config.edgeStyles[type]

        if (!customStyle) {
            return { ...defaultStyle }
        }

        return {
            ...defaultStyle,
            ...customStyle
        }
    }

    /**
     * Get all incoming links to a node
     * @param nodePath - Path of the target node
     * @param edges - All edges in the graph
     * @returns Edges where the node is the target
     */
    getIncomingEdges(nodePath: string, edges: GraphEdge[]): GraphEdge[] {
        return edges.filter((edge) => {
            const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id
            return targetId === nodePath
        })
    }

    /**
     * Get all outgoing links from a node
     * @param nodePath - Path of the source node
     * @param edges - All edges in the graph
     * @returns Edges where the node is the source
     */
    getOutgoingEdges(nodePath: string, edges: GraphEdge[]): GraphEdge[] {
        return edges.filter((edge) => {
            const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id
            return sourceId === nodePath
        })
    }

    /**
     * Get all edges connected to a node (incoming + outgoing)
     * @param nodePath - Path of the node
     * @param edges - All edges in the graph
     * @returns All edges connected to the node
     */
    getConnectedEdges(nodePath: string, edges: GraphEdge[]): GraphEdge[] {
        return edges.filter((edge) => {
            const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id
            const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id
            return sourceId === nodePath || targetId === nodePath
        })
    }

    /**
     * Get all nodes connected to a given node
     * @param nodePath - Path of the node
     * @param edges - All edges in the graph
     * @returns Set of connected node IDs
     */
    getConnectedNodeIds(nodePath: string, edges: GraphEdge[]): Set<string> {
        const connected = new Set<string>()

        for (const edge of edges) {
            const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id
            const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id

            if (sourceId === nodePath) {
                connected.add(targetId)
            } else if (targetId === nodePath) {
                connected.add(sourceId)
            }
        }

        return connected
    }

    /**
     * Get backlinks (incoming wikilinks) for a node
     * @param nodePath - Path of the node
     * @returns Array of source file paths that link to this node
     */
    getBacklinks(nodePath: string): string[] {
        const backlinks: string[] = []
        const allLinks = this.app.metadataCache.resolvedLinks

        for (const [sourcePath, links] of Object.entries(allLinks)) {
            if (links[nodePath]) {
                backlinks.push(sourcePath)
            }
        }

        return backlinks
    }

    /**
     * Get outgoing links for a node
     * @param nodePath - Path of the node
     * @returns Array of target file paths that this node links to
     */
    getOutlinks(nodePath: string): string[] {
        const resolvedLinks = this.app.metadataCache.resolvedLinks[nodePath]
        if (!resolvedLinks) return []
        return Object.keys(resolvedLinks)
    }

    /**
     * Get metadata cache for a file
     */
    getFileCache(path: string): CachedMetadata | null {
        return this.app.metadataCache.getCache(path)
    }
}
