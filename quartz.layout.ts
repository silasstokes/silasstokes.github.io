import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [],
  footer: Component.Footer({
    links: {
      GitHub: "https://github.com/silasstokes",
      // "Discord Community": "https://discord.gg/cRFFHYye7t",
    },
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.TagList(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
        { Component: Component.ReaderMode() },
      ],
    }),
    Component.Explorer({
      filterFn: (node) => {
        // Hide asset folders
        if (node.isFolder && node.displayName === "assets") {
          return false
        }
        return true
      },
      mapFn: (node) => {
        // Convert folders with no visible children to files
        // This makes folders like "header pin switches" (which only have index.md + assets)
        // appear as regular links without a dropdown
        // Add dash prefix to titles
        // if (!node.isFolder && !node.displayName.startsWith("- ")) {
        //   node.displayName = "- " + node.displayName
        // }
        // if (node.isFolder) {
        //   node.displayName = "📁 " + node.displayName
        // } else {
        //   node.displayName = "📄 " + node.displayName
        // }

        if (node.isFolder && node.children.length === 0) {
          node.isFolder = false
        }
      },

      sortFn: (a, b) => {
        // First, sort folders before files    
        // if (a.isFolder && !b.isFolder) return -1
        // if (!a.isFolder && b.isFolder) return 1

        // // If both are folders, sort alphabetically    
        // if (a.isFolder && b.isFolder) {
        //   return a.displayName.localeCompare(b.displayName, undefined, {
        //     numeric: true,
        //     sensitivity: "base",
        //   })
        // }

        // If both are files, sort by creation date (newest first)  
        const aCreated = a.data?.date  // Changed from frontmatter.created  
        const bCreated = b.data?.date  // Changed from frontmatter.created  

        if (aCreated && bCreated) {
          return new Date(bCreated).getTime() - new Date(aCreated).getTime()
        }

        // If only one has a creation date, prioritize it    
        if (aCreated && !bCreated) return -1
        if (!aCreated && bCreated) return 1

        // Fallback to alphabetical sorting    
        return a.displayName.localeCompare(b.displayName, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      },

      order: ["filter", "sort", "map"],
    }),
  ],
  right: [
    // Component.Graph(),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
      ],
    }),
    Component.Explorer({
      filterFn: (node) => {
        // Hide asset folders
        if (node.isFolder && node.displayName === "assets") {
          return false
        }
        return true
      },
      mapFn: (node) => {
        // Add dash prefix to titles
        if (!node.displayName.startsWith("- ")) {
          node.displayName = "- " + node.displayName
        }
        // Convert folders with no visible children to files
        if (node.isFolder && node.children.length === 0) {
          node.isFolder = false
        }
      },
      sortFn: (a, b) => {
        // Sort by date (newest first), falling back to alphabetical
        const aDate = a.data?.date
        const bDate = b.data?.date
        if (aDate && bDate) {
          return new Date(bDate).getTime() - new Date(aDate).getTime()
        }
        if (aDate && !bDate) return -1
        if (!aDate && bDate) return 1
        return a.displayName.localeCompare(b.displayName)
      },
      order: ["filter", "map", "sort"],
    }),
  ],
  right: [],
}
