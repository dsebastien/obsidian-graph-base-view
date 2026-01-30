import type { GraphNode, GraphEdge, GraphData, ClusterNode } from '../domain/graph.types'
import { isClusterNode } from '../domain/graph.types'

/**
 * Service for clustering nodes to improve performance with large graphs
 */
export class ClusterManager {
    /**
     * Cluster nodes to reduce visual complexity
     * Uses folder-based clustering for semantic grouping
     *
     * @param data - Original graph data
     * @param threshold - Node count above which to enable clustering
     * @returns Clustered graph data
     */
    cluster(data: GraphData, threshold: number): GraphData {
        const { nodes, edges } = data

        // If under threshold, return as-is
        if (nodes.length <= threshold) {
            return data
        }

        // Group nodes by folder
        const folderGroups = new Map<string, GraphNode[]>()

        for (const node of nodes) {
            if (isClusterNode(node)) continue

            const folder = node.folder || 'root'
            const existing = folderGroups.get(folder) ?? []
            existing.push(node)
            folderGroups.set(folder, existing)
        }

        // Create clusters for large folders
        const clusteredNodes: (GraphNode | ClusterNode)[] = []
        const clusterMap = new Map<string, ClusterNode>() // nodeId -> cluster
        const clusterThreshold = Math.max(5, Math.floor(threshold / 20))

        for (const [folder, folderNodes] of folderGroups) {
            if (folderNodes.length > clusterThreshold) {
                // Create a cluster for this folder
                const cluster = this.createCluster(folder, folderNodes)
                clusteredNodes.push(cluster)

                // Map all original nodes to this cluster
                for (const node of folderNodes) {
                    clusterMap.set(node.id, cluster)
                }
            } else {
                // Keep individual nodes
                clusteredNodes.push(...folderNodes)
            }
        }

        // Update edges to point to clusters
        const clusteredEdges = this.clusterEdges(edges, clusterMap)

        return {
            nodes: clusteredNodes,
            edges: clusteredEdges
        }
    }

    /**
     * Create a cluster node from a group of nodes
     */
    private createCluster(folder: string, nodes: GraphNode[]): ClusterNode {
        // Calculate center position (average of all node positions)
        let sumX = 0
        let sumY = 0
        let countPos = 0

        for (const node of nodes) {
            if (node.x !== undefined && node.y !== undefined) {
                sumX += node.x
                sumY += node.y
                countPos++
            }
        }

        // Get most recent modification time
        let maxMtime = 0
        let minCtime = Infinity

        for (const node of nodes) {
            maxMtime = Math.max(maxMtime, node.mtime)
            minCtime = Math.min(minCtime, node.ctime)
        }

        // Get folder name for label
        const folderName = folder.split('/').pop() || folder || 'Root'

        const cluster: ClusterNode = {
            id: `cluster-${folder}`,
            label: `${folderName} (${nodes.length})`,
            mtime: maxMtime,
            ctime: minCtime === Infinity ? 0 : minCtime,
            folder,
            isCluster: true,
            childCount: nodes.length,
            childIds: nodes.map((n) => n.id),
            expanded: false,
            x: countPos > 0 ? sumX / countPos : undefined,
            y: countPos > 0 ? sumY / countPos : undefined
        }

        return cluster
    }

    /**
     * Update edges to point to clusters instead of individual nodes
     */
    private clusterEdges(edges: GraphEdge[], clusterMap: Map<string, ClusterNode>): GraphEdge[] {
        const clusteredEdges: GraphEdge[] = []
        const seenEdges = new Set<string>()

        for (const edge of edges) {
            const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id
            const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id

            // Get cluster or keep original
            const sourceCluster = clusterMap.get(sourceId)
            const targetCluster = clusterMap.get(targetId)

            const newSourceId = sourceCluster?.id ?? sourceId
            const newTargetId = targetCluster?.id ?? targetId

            // Skip self-loops (edges within the same cluster)
            if (newSourceId === newTargetId) continue

            // Skip duplicate edges
            const edgeKey = [newSourceId, newTargetId].sort().join('|')
            if (seenEdges.has(edgeKey)) continue
            seenEdges.add(edgeKey)

            clusteredEdges.push({
                ...edge,
                id: `clustered-${edge.id}`,
                source: newSourceId,
                target: newTargetId
            })
        }

        return clusteredEdges
    }

    /**
     * Expand a cluster to show its children
     *
     * @param data - Current graph data
     * @param clusterId - ID of the cluster to expand
     * @param originalNodes - Original unclustered nodes
     * @param originalEdges - Original unclustered edges
     * @returns Updated graph data with cluster expanded
     */
    expandCluster(
        data: GraphData,
        clusterId: string,
        originalNodes: GraphNode[],
        originalEdges: GraphEdge[]
    ): GraphData {
        const cluster = data.nodes.find((n) => n.id === clusterId && isClusterNode(n)) as
            | ClusterNode
            | undefined

        if (!cluster) return data

        // Mark cluster as expanded
        cluster.expanded = true

        // Get the child nodes
        const childNodes = originalNodes.filter((n) => cluster.childIds.includes(n.id))

        // Position children around the cluster center
        const clusterX = cluster.x ?? 0
        const clusterY = cluster.y ?? 0
        const radius = Math.sqrt(cluster.childCount) * 30

        for (let i = 0; i < childNodes.length; i++) {
            const child = childNodes[i]
            if (!child) continue
            const angle = (i / childNodes.length) * Math.PI * 2
            child.x = clusterX + Math.cos(angle) * radius
            child.y = clusterY + Math.sin(angle) * radius
        }

        // Remove the cluster, add children
        const newNodes = data.nodes.filter((n) => n.id !== clusterId)
        newNodes.push(...childNodes)

        // Get edges for the child nodes
        const childNodeIds = new Set(childNodes.map((n) => n.id))
        const childEdges = originalEdges.filter((e) => {
            const sourceId = typeof e.source === 'string' ? e.source : e.source.id
            const targetId = typeof e.target === 'string' ? e.target : e.target.id
            return childNodeIds.has(sourceId) || childNodeIds.has(targetId)
        })

        // Re-add original edges, filter out cluster edges
        const newEdges = data.edges.filter((e) => {
            const sourceId = typeof e.source === 'string' ? e.source : e.source.id
            const targetId = typeof e.target === 'string' ? e.target : e.target.id
            return sourceId !== clusterId && targetId !== clusterId
        })
        newEdges.push(...childEdges)

        return { nodes: newNodes, edges: newEdges }
    }

    /**
     * Collapse expanded nodes back into a cluster
     *
     * @param data - Current graph data
     * @param folder - Folder path to collapse
     * @returns Updated graph data with cluster collapsed
     */
    collapseToCluster(data: GraphData, folder: string): GraphData {
        // Find nodes in this folder
        const folderNodes = data.nodes.filter(
            (n) => !isClusterNode(n) && n.folder === folder
        ) as GraphNode[]

        if (folderNodes.length === 0) return data

        // Create cluster
        const cluster = this.createCluster(folder, folderNodes)

        // Remove individual nodes, add cluster
        const nodeIdsToRemove = new Set(folderNodes.map((n) => n.id))
        const newNodes = data.nodes.filter((n) => !nodeIdsToRemove.has(n.id))
        newNodes.push(cluster)

        // Update edges
        const clusterMap = new Map<string, ClusterNode>()
        for (const node of folderNodes) {
            clusterMap.set(node.id, cluster)
        }
        const newEdges = this.clusterEdges(data.edges, clusterMap)

        return { nodes: newNodes, edges: newEdges }
    }

    /**
     * Get statistics about the current clustering
     */
    getClusterStats(data: GraphData): {
        totalNodes: number
        clusterCount: number
        expandedClusters: number
        individualNodes: number
    } {
        let clusterCount = 0
        let expandedClusters = 0
        let individualNodes = 0

        for (const node of data.nodes) {
            if (isClusterNode(node)) {
                clusterCount++
                if (node.expanded) {
                    expandedClusters++
                }
            } else {
                individualNodes++
            }
        }

        return {
            totalNodes: data.nodes.length,
            clusterCount,
            expandedClusters,
            individualNodes
        }
    }
}
