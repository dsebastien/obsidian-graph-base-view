# Architecture

## Overview

The plugin implements a graph visualization view for Obsidian's Bases feature. Notes are displayed as glowing nodes with animated connections based on wikilinks, folder hierarchy, and shared properties.

## Component Architecture

```
GraphView (BasesView)
    ├── GraphDataService      → Transforms BasesEntry[] to GraphNode[]
    ├── RelationshipEngine    → Computes edges (wikilinks, folders, properties)
    ├── D3Renderer            → Force simulation + SVG rendering
    ├── ClusterManager        → Groups dense areas for performance
    ├── ParticleSystem        → Canvas-based particle animations
    └── DetailsPanel          → Side panel UI component
```

## Data Flow

1. `onDataUpdated()` receives `BasesEntry[]` from Obsidian Bases
2. `GraphDataService.transform()` creates `GraphNode[]` with file metadata
3. `RelationshipEngine.compute()` creates `GraphEdge[]` for enabled types
4. `ClusterManager.cluster()` groups dense areas (if enabled and above threshold)
5. `D3Renderer.render()` updates force simulation and SVG
6. `ParticleSystem.spawn()` adds particles for recent changes

## Key Types

### GraphNode

Represents a single note in the graph:

- `id`: File path (unique identifier)
- `label`: Display name (basename)
- `file`: TFile reference
- `mtime/ctime`: Timestamps
- `folder`: Parent folder path
- `properties`: Frontmatter properties
- `x/y`: D3 simulation coordinates

### GraphEdge

Represents a connection between nodes:

- `source/target`: Node IDs
- `type`: 'wikilink' | 'folder' | 'property'
- `style`: Visual style (color, width, dash pattern)
- `metadata`: Additional info (link text, property name/value)

### ClusterNode

Represents a group of nodes (extends GraphNode):

- `isCluster`: true
- `childCount`: Number of contained nodes
- `childIds`: IDs of contained nodes
- `expanded`: Whether cluster is expanded

## Rendering Layers

1. **SVG Layer** (D3Renderer)
    - Edges rendered as `<line>` elements
    - Nodes rendered as `<circle>` elements with glow filter
    - Labels rendered as `<text>` elements
    - Handles zoom/pan via D3 zoom behavior

2. **Canvas Layer** (ParticleSystem)
    - Overlaid on SVG
    - Particle effects for recent modifications
    - Higher performance for many animated elements

3. **DOM Layer** (DetailsPanel)
    - Positioned absolutely over graph
    - Shows node details when selected

## Relationship Types

| Type     | Source                      | Edge Style         |
| -------- | --------------------------- | ------------------ |
| Wikilink | MetadataCache.resolvedLinks | Solid green line   |
| Folder   | TFile.parent comparison     | Dashed blue line   |
| Property | Shared frontmatter values   | Dotted orange line |

## Performance Optimizations

1. **Clustering**: When node count exceeds threshold, nodes are grouped by folder
2. **Viewport culling**: Only visible nodes are rendered (planned)
3. **Particle pooling**: Canvas particles are lightweight and pooled
4. **Debounced updates**: Rapid changes are debounced

## Configuration

User-configurable via ViewOptions:

- Layout type (force-directed, radial)
- Relationship toggles
- Visual settings (node size, glow intensity, labels)
- Edge colors
- Animation settings (particles, speed, threshold)
- Performance settings (clustering threshold)
