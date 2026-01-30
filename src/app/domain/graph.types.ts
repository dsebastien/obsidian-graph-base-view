import type { TFile } from 'obsidian'
import type { RelationshipType, EdgeStyle } from './relationship.types'

/**
 * A node in the graph visualization representing a note
 */
export interface GraphNode {
    /** Unique identifier (file path) */
    id: string
    /** Display label (file basename without extension) */
    label: string
    /** Reference to the Obsidian TFile */
    file: TFile
    /** File modification time (unix timestamp) */
    mtime: number
    /** File creation time (unix timestamp) */
    ctime: number
    /** Folder path the file belongs to */
    folder: string
    /** All frontmatter properties from the file */
    properties: Record<string, unknown>
    /** Whether this node is currently selected */
    selected?: boolean
    /** Whether this node is dimmed (when another node is selected) */
    dimmed?: boolean
    /** D3 force simulation position X */
    x?: number
    /** D3 force simulation position Y */
    y?: number
    /** D3 force simulation velocity X */
    vx?: number
    /** D3 force simulation velocity Y */
    vy?: number
    /** D3 fixed position X (for dragging) */
    fx?: number | null
    /** D3 fixed position Y (for dragging) */
    fy?: number | null
}

/**
 * An edge connecting two nodes in the graph
 */
export interface GraphEdge {
    /** Unique identifier for the edge */
    id: string
    /** Source node ID */
    source: string | GraphNode
    /** Target node ID */
    target: string | GraphNode
    /** Type of relationship this edge represents */
    type: RelationshipType
    /** Visual style for the edge */
    style: EdgeStyle
    /** Additional metadata about the relationship */
    metadata?: EdgeMetadata
    /** Whether this edge is highlighted (connected to selected node) */
    highlighted?: boolean
}

/**
 * Additional metadata for an edge
 */
export interface EdgeMetadata {
    /** For wikilinks: the link text used */
    linkText?: string
    /** For properties: the shared property name */
    propertyName?: string
    /** For properties: the shared property value */
    propertyValue?: unknown
}

/**
 * A cluster node representing multiple nodes grouped together
 */
export interface ClusterNode extends Omit<GraphNode, 'file' | 'properties'> {
    /** This is a cluster, not a regular node */
    isCluster: true
    /** Number of nodes in this cluster */
    childCount: number
    /** IDs of all nodes contained in this cluster */
    childIds: string[]
    /** Whether the cluster is currently expanded */
    expanded: boolean
    /** Representative file for the cluster (e.g., first file) */
    file?: TFile
    /** Aggregated properties placeholder */
    properties?: Record<string, unknown>
}

/**
 * Type guard to check if a node is a cluster
 */
export function isClusterNode(node: GraphNode | ClusterNode): node is ClusterNode {
    return 'isCluster' in node && node.isCluster === true
}

/**
 * Graph data structure containing nodes and edges
 */
export interface GraphData {
    nodes: (GraphNode | ClusterNode)[]
    edges: GraphEdge[]
}

/**
 * Position in the graph coordinate system
 */
export interface GraphPosition {
    x: number
    y: number
}

/**
 * Viewport bounds for the graph
 */
export interface GraphViewport {
    x: number
    y: number
    width: number
    height: number
    scale: number
}

/**
 * Layout type for the graph
 */
export type LayoutType = 'force' | 'radial'

/**
 * Configuration for the graph layout
 */
export interface LayoutConfig {
    type: LayoutType
    /** Force strength for force-directed layout */
    forceStrength?: number
    /** Link distance */
    linkDistance?: number
    /** Collision radius */
    collisionRadius?: number
    /** Center force strength */
    centerStrength?: number
    /** For radial layout: radius multiplier */
    radiusMultiplier?: number
}
