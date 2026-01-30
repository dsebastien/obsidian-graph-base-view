import type { GraphNode, GraphEdge, ClusterNode } from '../app/domain/graph.types'
import { isClusterNode } from '../app/domain/graph.types'

/**
 * Options for the details panel
 */
export interface DetailsPanelOptions {
    onClose?: () => void
    onOpenFile?: (node: GraphNode) => void
}

/**
 * Side panel for displaying node details
 */
export class DetailsPanel {
    private panelEl: HTMLElement
    private options: DetailsPanelOptions
    private isVisible = false

    constructor(container: HTMLElement, options: DetailsPanelOptions) {
        this.options = options

        // Create panel element
        this.panelEl = container.createDiv({ cls: 'graph-details-panel' })
        this.panelEl.style.display = 'none'
    }

    /**
     * Show the panel with node details
     */
    show(
        node: GraphNode | ClusterNode,
        connectedEdges: GraphEdge[],
        allNodes: (GraphNode | ClusterNode)[]
    ): void {
        this.isVisible = true
        this.panelEl.style.display = 'block'
        this.panelEl.empty()

        // Header
        const header = this.panelEl.createDiv({ cls: 'graph-details-header' })

        const title = header.createDiv({ cls: 'graph-details-title' })
        title.setText(node.label)

        const closeBtn = header.createEl('button', { cls: 'graph-details-close' })
        closeBtn.setText('\u00D7')
        closeBtn.addEventListener('click', () => {
            this.options.onClose?.()
        })

        if (isClusterNode(node)) {
            this.renderClusterDetails(node)
        } else {
            this.renderNodeDetails(node, connectedEdges, allNodes)
        }
    }

    /**
     * Render details for a regular node
     */
    private renderNodeDetails(
        node: GraphNode,
        connectedEdges: GraphEdge[],
        allNodes: (GraphNode | ClusterNode)[]
    ): void {
        // File info section
        const fileSection = this.panelEl.createDiv({ cls: 'graph-details-section' })
        fileSection.createEl('h4', { text: 'File Info' })

        const fileInfo = fileSection.createDiv({ cls: 'graph-details-file-info' })
        this.addInfoRow(fileInfo, 'Path', node.id)
        this.addInfoRow(fileInfo, 'Folder', node.folder || 'Root')
        this.addInfoRow(fileInfo, 'Modified', this.formatDate(node.mtime))
        this.addInfoRow(fileInfo, 'Created', this.formatDate(node.ctime))

        // Open file button
        const openBtn = fileSection.createEl('button', {
            cls: 'graph-details-open-btn',
            text: 'Open note'
        })
        openBtn.addEventListener('click', () => {
            this.options.onOpenFile?.(node)
        })

        // Properties section
        const propKeys = Object.keys(node.properties).filter((k) => !k.startsWith('file.'))
        if (propKeys.length > 0) {
            const propsSection = this.panelEl.createDiv({ cls: 'graph-details-section' })
            propsSection.createEl('h4', { text: 'Properties' })

            const propsDiv = propsSection.createDiv({ cls: 'graph-details-properties' })
            for (const key of propKeys) {
                const value = node.properties[key]
                this.addPropertyRow(propsDiv, key, value)
            }
        }

        // Connections section
        const connectionsSection = this.panelEl.createDiv({
            cls: 'graph-details-section'
        })
        connectionsSection.createEl('h4', { text: 'Connections' })

        // Group edges by type
        const wikilinkEdges = connectedEdges.filter((e) => e.type === 'wikilink')
        const folderEdges = connectedEdges.filter((e) => e.type === 'folder')
        const propertyEdges = connectedEdges.filter((e) => e.type === 'property')

        const connectionsDiv = connectionsSection.createDiv({
            cls: 'graph-details-connections'
        })

        if (wikilinkEdges.length > 0) {
            this.addConnectionGroup(connectionsDiv, 'Wikilinks', wikilinkEdges, node.id, allNodes)
        }

        if (folderEdges.length > 0) {
            this.addConnectionGroup(connectionsDiv, 'Same folder', folderEdges, node.id, allNodes)
        }

        if (propertyEdges.length > 0) {
            this.addConnectionGroup(
                connectionsDiv,
                'Shared properties',
                propertyEdges,
                node.id,
                allNodes
            )
        }

        if (connectedEdges.length === 0) {
            connectionsDiv.createDiv({
                cls: 'graph-details-no-connections',
                text: 'No connections'
            })
        }

        // Summary
        const summaryDiv = connectionsSection.createDiv({
            cls: 'graph-details-summary'
        })
        summaryDiv.setText(
            `Total: ${connectedEdges.length} connection${connectedEdges.length === 1 ? '' : 's'}`
        )
    }

    /**
     * Render details for a cluster node
     */
    private renderClusterDetails(cluster: ClusterNode): void {
        const clusterSection = this.panelEl.createDiv({ cls: 'graph-details-section' })
        clusterSection.createEl('h4', { text: 'Cluster Info' })

        const clusterInfo = clusterSection.createDiv({
            cls: 'graph-details-cluster-info'
        })
        this.addInfoRow(clusterInfo, 'Folder', cluster.folder || 'Root')
        this.addInfoRow(clusterInfo, 'Notes', cluster.childCount.toString())
        this.addInfoRow(clusterInfo, 'Last modified', this.formatDate(cluster.mtime))

        // List of child files
        if (cluster.childIds.length > 0) {
            const childSection = this.panelEl.createDiv({
                cls: 'graph-details-section'
            })
            childSection.createEl('h4', { text: 'Contains' })

            const childList = childSection.createDiv({ cls: 'graph-details-child-list' })
            const maxDisplay = 10
            const displayIds = cluster.childIds.slice(0, maxDisplay)

            for (const childId of displayIds) {
                const childEl = childList.createDiv({ cls: 'graph-details-child-item' })
                // Extract filename from path
                const filename = childId.split('/').pop() ?? childId
                childEl.setText(filename)
            }

            if (cluster.childIds.length > maxDisplay) {
                const moreEl = childList.createDiv({ cls: 'graph-details-more' })
                moreEl.setText(`... and ${cluster.childIds.length - maxDisplay} more`)
            }
        }
    }

    /**
     * Add an info row to a container
     */
    private addInfoRow(container: HTMLElement, label: string, value: string): void {
        const row = container.createDiv({ cls: 'graph-details-row' })
        row.createSpan({ cls: 'graph-details-label', text: label })
        row.createSpan({ cls: 'graph-details-value', text: value })
    }

    /**
     * Add a property row
     */
    private addPropertyRow(container: HTMLElement, key: string, value: unknown): void {
        const row = container.createDiv({ cls: 'graph-details-prop-row' })

        // Extract property name from full key (e.g., "note.tags" -> "tags")
        const displayKey = key.includes('.') ? (key.split('.').pop() ?? key) : key
        row.createSpan({ cls: 'graph-details-prop-key', text: displayKey })

        let displayValue: string
        if (Array.isArray(value)) {
            displayValue = value.join(', ')
        } else if (value === null || value === undefined) {
            displayValue = '-'
        } else {
            displayValue = String(value)
        }

        row.createSpan({ cls: 'graph-details-prop-value', text: displayValue })
    }

    /**
     * Add a connection group
     */
    private addConnectionGroup(
        container: HTMLElement,
        title: string,
        edges: GraphEdge[],
        currentNodeId: string,
        allNodes: (GraphNode | ClusterNode)[]
    ): void {
        const group = container.createDiv({ cls: 'graph-details-connection-group' })
        group.createDiv({
            cls: 'graph-details-connection-title',
            text: `${title} (${edges.length})`
        })

        const list = group.createDiv({ cls: 'graph-details-connection-list' })
        const maxDisplay = 5
        const displayEdges = edges.slice(0, maxDisplay)

        for (const edge of displayEdges) {
            const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id
            const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id

            // Get the connected node (not the current one)
            const connectedId = sourceId === currentNodeId ? targetId : sourceId
            const connectedNode = allNodes.find((n) => n.id === connectedId)

            const item = list.createDiv({ cls: 'graph-details-connection-item' })
            item.setText(connectedNode?.label ?? connectedId)
        }

        if (edges.length > maxDisplay) {
            const more = list.createDiv({ cls: 'graph-details-more' })
            more.setText(`... and ${edges.length - maxDisplay} more`)
        }
    }

    /**
     * Format a timestamp as a readable date
     */
    private formatDate(timestamp: number): string {
        const date = new Date(timestamp)
        return date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    /**
     * Hide the panel
     */
    hide(): void {
        this.isVisible = false
        this.panelEl.style.display = 'none'
    }

    /**
     * Toggle panel visibility
     */
    toggle(): void {
        if (this.isVisible) {
            this.hide()
        }
    }

    /**
     * Check if panel is visible
     */
    getIsVisible(): boolean {
        return this.isVisible
    }
}
