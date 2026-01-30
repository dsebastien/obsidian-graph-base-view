import type { BasesEntry, BasesPropertyId } from 'obsidian'
import { ListValue } from 'obsidian'
import type { GraphNode } from '../domain/graph.types'

/**
 * Service for transforming BasesEntry data into graph nodes
 */
export class GraphDataService {
    /**
     * Transform BasesEntry[] to GraphNode[]
     * @param entries - Array of BasesEntry from the Base query
     * @param visibleProperties - Property IDs to extract
     * @returns Array of GraphNode objects
     */
    transform(entries: BasesEntry[], visibleProperties: BasesPropertyId[]): GraphNode[] {
        const nodes: GraphNode[] = []

        for (const entry of entries) {
            const file = entry.file
            const folder = file.parent?.path ?? ''

            // Extract all properties from the entry
            const properties: Record<string, unknown> = {}
            for (const propId of visibleProperties) {
                const value = entry.getValue(propId)
                if (value) {
                    properties[propId] = this.extractValue(value)
                }
            }

            // Also extract common metadata properties
            const nameValue = entry.getValue('file.name')
            if (nameValue) {
                properties['file.name'] = nameValue.toString()
            }

            const node: GraphNode = {
                id: file.path,
                label: file.basename,
                file,
                mtime: file.stat.mtime,
                ctime: file.stat.ctime,
                folder,
                properties
            }

            nodes.push(node)
        }

        return nodes
    }

    /**
     * Extract primitive value from a Value object
     */
    private extractValue(value: unknown): unknown {
        if (!value) return null

        // Handle ListValue specially
        if (value instanceof ListValue) {
            const items: string[] = []
            for (let i = 0; i < value.length(); i++) {
                const item = value.get(i)
                if (item) {
                    items.push(item.toString())
                }
            }
            return items
        }

        // For other types, use toString
        if (typeof value === 'object' && value !== null && 'toString' in value) {
            return (value as { toString(): string }).toString()
        }

        return value
    }

    /**
     * Get recently modified nodes (within threshold)
     * @param nodes - All graph nodes
     * @param thresholdMs - Time threshold in milliseconds (default: 24 hours)
     * @returns Nodes modified within the threshold
     */
    getRecentlyModified(nodes: GraphNode[], thresholdMs = 24 * 60 * 60 * 1000): GraphNode[] {
        const now = Date.now()
        return nodes.filter((node) => now - node.mtime < thresholdMs)
    }

    /**
     * Get unique folder paths from nodes
     * @param nodes - All graph nodes
     * @returns Array of unique folder paths
     */
    getUniqueFolders(nodes: GraphNode[]): string[] {
        const folders = new Set<string>()
        for (const node of nodes) {
            if (node.folder) {
                folders.add(node.folder)
            }
        }
        return Array.from(folders).sort()
    }

    /**
     * Get unique property values for a given property across all nodes
     * @param nodes - All graph nodes
     * @param propertyName - Property name to extract values for
     * @returns Array of unique values
     */
    getUniquePropertyValues(nodes: GraphNode[], propertyName: string): unknown[] {
        const values = new Set<string>()

        for (const node of nodes) {
            const value = node.properties[propertyName]
            if (value === undefined || value === null) continue

            if (Array.isArray(value)) {
                for (const item of value) {
                    values.add(String(item))
                }
            } else {
                values.add(String(value))
            }
        }

        return Array.from(values).sort()
    }

    /**
     * Find a node by file path
     * @param nodes - All graph nodes
     * @param path - File path to search for
     * @returns The matching node or undefined
     */
    findNodeByPath(nodes: GraphNode[], path: string): GraphNode | undefined {
        return nodes.find((node) => node.id === path)
    }

    /**
     * Find nodes by folder
     * @param nodes - All graph nodes
     * @param folderPath - Folder path to filter by
     * @returns Nodes in the specified folder
     */
    findNodesByFolder(nodes: GraphNode[], folderPath: string): GraphNode[] {
        return nodes.filter((node) => node.folder === folderPath)
    }

    /**
     * Find nodes by property value
     * @param nodes - All graph nodes
     * @param propertyName - Property to match
     * @param propertyValue - Value to match
     * @returns Nodes with matching property value
     */
    findNodesByProperty(
        nodes: GraphNode[],
        propertyName: string,
        propertyValue: unknown
    ): GraphNode[] {
        return nodes.filter((node) => {
            const value = node.properties[propertyName]
            if (value === undefined) return false

            // Handle array values (e.g., tags)
            if (Array.isArray(value)) {
                return value.includes(propertyValue)
            }

            return value === propertyValue
        })
    }
}
