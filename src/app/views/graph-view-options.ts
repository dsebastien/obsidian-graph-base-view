import type { ViewOption } from 'obsidian'

/**
 * View type identifier for the Graph view
 */
export const GRAPH_VIEW_TYPE = 'graph-base-view'

/**
 * Get the view options for the Graph view
 * These options appear in the view configuration panel
 */
export function getGraphViewOptions(): ViewOption[] {
    return [
        // Layout settings
        {
            type: 'dropdown',
            key: 'layout',
            displayName: 'Layout',
            default: 'force',
            options: {
                force: 'Force-directed',
                radial: 'Radial tree'
            }
        },

        // Relationship toggles
        {
            type: 'group',
            displayName: 'Relationships',
            items: [
                {
                    type: 'toggle',
                    key: 'showWikilinks',
                    displayName: 'Show wikilinks',
                    default: true
                },
                {
                    type: 'toggle',
                    key: 'showFolders',
                    displayName: 'Show folder connections',
                    default: true
                },
                {
                    type: 'toggle',
                    key: 'showProperties',
                    displayName: 'Show shared properties',
                    default: false
                },
                {
                    type: 'text',
                    key: 'propertyNames',
                    displayName: 'Property names (comma-separated)',
                    placeholder: 'tags, category, type'
                }
            ]
        },

        // Visual settings
        {
            type: 'group',
            displayName: 'Appearance',
            items: [
                {
                    type: 'slider',
                    key: 'nodeSize',
                    displayName: 'Node size',
                    min: 4,
                    max: 24,
                    step: 2,
                    default: 4
                },
                {
                    type: 'slider',
                    key: 'glowIntensity',
                    displayName: 'Glow intensity',
                    min: 0,
                    max: 20,
                    step: 2,
                    default: 8
                },
                {
                    type: 'toggle',
                    key: 'showLabels',
                    displayName: 'Show labels',
                    default: true
                },
                {
                    type: 'slider',
                    key: 'labelSize',
                    displayName: 'Label size',
                    min: 8,
                    max: 16,
                    step: 1,
                    default: 11
                }
            ]
        },

        // Edge colors (user-configurable)
        {
            type: 'group',
            displayName: 'Edge colors',
            items: [
                {
                    type: 'text',
                    key: 'wikilinkColor',
                    displayName: 'Wikilink color',
                    placeholder: '#00ff88'
                },
                {
                    type: 'text',
                    key: 'folderColor',
                    displayName: 'Folder color',
                    placeholder: '#0088ff'
                },
                {
                    type: 'text',
                    key: 'propertyColor',
                    displayName: 'Property color',
                    placeholder: '#ff8800'
                }
            ]
        },

        // Animation settings
        {
            type: 'group',
            displayName: 'Animation',
            items: [
                {
                    type: 'toggle',
                    key: 'enableParticles',
                    displayName: 'Enable particles',
                    default: true
                },
                {
                    type: 'slider',
                    key: 'particleSpeed',
                    displayName: 'Particle speed',
                    min: 0.5,
                    max: 3,
                    step: 0.5,
                    default: 1
                },
                {
                    type: 'slider',
                    key: 'recentThresholdHours',
                    displayName: 'Recent changes (hours)',
                    min: 1,
                    max: 168,
                    step: 1,
                    default: 24
                }
            ]
        },

        // Performance settings
        {
            type: 'group',
            displayName: 'Performance',
            items: [
                {
                    type: 'toggle',
                    key: 'enableClustering',
                    displayName: 'Enable clustering',
                    default: true
                },
                {
                    type: 'slider',
                    key: 'clusterThreshold',
                    displayName: 'Cluster threshold (nodes)',
                    min: 100,
                    max: 1000,
                    step: 50,
                    default: 200
                }
            ]
        }
    ]
}

/**
 * Interface for the view configuration values
 */
export interface GraphViewConfig {
    // Layout
    layout: 'force' | 'radial'

    // Relationships
    showWikilinks: boolean
    showFolders: boolean
    showProperties: boolean
    propertyNames: string

    // Appearance
    nodeSize: number
    glowIntensity: number
    showLabels: boolean
    labelSize: number

    // Edge colors
    wikilinkColor: string
    folderColor: string
    propertyColor: string

    // Animation
    enableParticles: boolean
    particleSpeed: number
    recentThresholdHours: number

    // Performance
    enableClustering: boolean
    clusterThreshold: number
}

/**
 * Default configuration values
 */
export const DEFAULT_GRAPH_CONFIG: GraphViewConfig = {
    layout: 'force',
    showWikilinks: true,
    showFolders: true,
    showProperties: false,
    propertyNames: 'tags, category, type',
    nodeSize: 4,
    glowIntensity: 8,
    showLabels: true,
    labelSize: 11,
    wikilinkColor: '#00ff88',
    folderColor: '#0088ff',
    propertyColor: '#ff8800',
    enableParticles: true,
    particleSpeed: 1,
    recentThresholdHours: 24,
    enableClustering: true,
    clusterThreshold: 200
}
