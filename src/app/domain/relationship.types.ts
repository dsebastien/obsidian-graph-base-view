/**
 * Types of relationships that can exist between notes
 */
export type RelationshipType = 'wikilink' | 'folder' | 'property'

/**
 * Visual style for an edge
 */
export interface EdgeStyle {
    /** Stroke color (CSS color string) */
    color: string
    /** Stroke width in pixels */
    width: number
    /** Dash pattern (e.g., "5,5" for dashed, "" for solid) */
    dashArray: string
    /** Opacity (0-1) */
    opacity: number
}

/**
 * Default edge styles for each relationship type
 */
export const DEFAULT_EDGE_STYLES: Record<RelationshipType, EdgeStyle> = {
    wikilink: {
        color: '#00ff88',
        width: 1.5,
        dashArray: '',
        opacity: 0.7
    },
    folder: {
        color: '#0088ff',
        width: 1,
        dashArray: '5,5',
        opacity: 0.5
    },
    property: {
        color: '#ff8800',
        width: 1,
        dashArray: '2,2',
        opacity: 0.4
    }
}

/**
 * Configuration for which relationship types to display
 */
export interface RelationshipConfig {
    /** Show wikilink connections */
    showWikilinks: boolean
    /** Show folder hierarchy connections */
    showFolders: boolean
    /** Show shared property connections */
    showProperties: boolean
    /** Property names to use for property-based connections */
    propertyNames: string[]
    /** Custom edge styles (overrides defaults) */
    edgeStyles: Partial<Record<RelationshipType, Partial<EdgeStyle>>>
}

/**
 * Default relationship configuration
 */
export const DEFAULT_RELATIONSHIP_CONFIG: RelationshipConfig = {
    showWikilinks: true,
    showFolders: true,
    showProperties: false,
    propertyNames: ['tags', 'category', 'type'],
    edgeStyles: {}
}

/**
 * Edge direction for directed relationships
 */
export type EdgeDirection = 'outgoing' | 'incoming' | 'bidirectional'

/**
 * Information about a single relationship
 */
export interface RelationshipInfo {
    type: RelationshipType
    direction: EdgeDirection
    sourceId: string
    targetId: string
    metadata?: {
        linkText?: string
        propertyName?: string
        propertyValue?: unknown
    }
}
