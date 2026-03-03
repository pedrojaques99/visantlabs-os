[Skip to main content](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/#__docusaurus_skipToContent_fallback)

On this page

Boolean operations combine any set of shape layers through one of four formulas: Union, Subtract, Intersect, and Exclude. The layers to be combined are stored in its `children` array. You can create boolean operation nodes using [`figma.union`](https://developers.figma.com/docs/plugins/api/figma/#union), [`figma.subtract`](https://developers.figma.com/docs/plugins/api/figma/#subtract), [`figma.intersect`](https://developers.figma.com/docs/plugins/api/figma/#intersect), [`figma.exclude`](https://developers.figma.com/docs/plugins/api/figma/#exclude).

Like the group node, the boolean operations node is always set to fit its children. As such, its position and size can change when you add or resize its children.

More information on how boolean operations work can be found on our [help page](https://help.figma.com/hc/en-us/articles/360039957534).

## Boolean operation properties [​](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/\#boolean-operation-properties "Direct link to Boolean operation properties")

### type: 'BOOLEAN\_OPERATION' \[readonly\]

The type of this node, represented by the string literal "BOOLEAN\_OPERATION"

* * *

### clone(): [BooleanOperationNode](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/)

Duplicates the boolean operation node. By default, the duplicate will be parented under `figma.currentPage`.

* * *

### booleanOperation: 'UNION' \| 'INTERSECT' \| 'SUBTRACT' \| 'EXCLUDE'

The type of operation used to combine the children of this node.

* * *

### expanded: boolean

Whether this container is shown as expanded in the layers panel.

* * *

## Base node properties [​](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/\#base-node-properties "Direct link to Base node properties")

### [id](https://developers.figma.com/docs/plugins/api/properties/nodes-id/): string \[readonly\]

The unique identifier of a node. For example, `1:3`. The node id can be used with methods such as [`figma.getNodeByIdAsync`](https://developers.figma.com/docs/plugins/api/figma/#getnodebyidasync), but plugins typically don't need to use this since you can usually just access a node directly.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-id/)

* * *

### [parent](https://developers.figma.com/docs/plugins/api/properties/nodes-parent/): ( [BaseNode](https://developers.figma.com/docs/plugins/api/nodes/\#base-node) & [ChildrenMixin](https://developers.figma.com/docs/plugins/api/node-properties/\#children-mixin)) \| null \[readonly\]

Returns the parent of this node, if any. This property is not meant to be directly edited. To reparent, see [`appendChild`](https://developers.figma.com/docs/plugins/api/properties/nodes-appendchild/).

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-parent/)

* * *

### [name](https://developers.figma.com/docs/plugins/api/properties/nodes-name/): string

The name of the layer that appears in the layers panel. Calling `figma.root.name` will return the name, read-only, of the current file.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-name/)

* * *

### [removed](https://developers.figma.com/docs/plugins/api/properties/nodes-removed/): boolean \[readonly\]

Returns true if this node has been removed since it was first accessed. If your plugin stays open for a while and stores references to nodes, you should write your code defensively and check that the nodes haven't been removed by the user.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-removed/)

* * *

### [toString](https://developers.figma.com/docs/plugins/api/properties/nodes-tostring/)(): string

Returns a string representation of the node. For debugging purposes only, do not rely on the exact output of this string in production code.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-tostring/)

* * *

### [remove](https://developers.figma.com/docs/plugins/api/properties/nodes-remove/)(): void

Removes this node and **all of its children** from the document.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-remove/)

* * *

### [setRelaunchData](https://developers.figma.com/docs/plugins/api/properties/nodes-setrelaunchdata/)(data: { \[command: string\]: string }): void

Sets state on the node to show a button and description when the node is selected. Clears the button and description when `relaunchData` is `{}`.

info

In Figma and Dev Mode, this shows up in the properties panel. In FigJam, this shows up in the property menu. See [here](https://developers.figma.com/docs/plugins/api/properties/nodes-setrelaunchdata/#example-figma-design-ui) for examples.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-setrelaunchdata/)

* * *

### getRelaunchData(): { \[command: string\]: string }

Retreives the reluanch data stored on this node using [`setRelaunchData`](https://developers.figma.com/docs/plugins/api/properties/nodes-setrelaunchdata/)

* * *

### isAsset: boolean \[readonly\]

Returns true if Figma detects that a node is an asset, otherwise returns false. An asset is is either an icon or a raster image.

This property is useful if you're building a [plugin for code generation](https://developers.figma.com/docs/plugins/codegen-plugins/).

info

This property uses a set of heuristics to determine if a node is an asset. At a high level an icon is a small vector graphic and an image is a node with an image fill.

* * *

### getCSSAsync(): Promise<{ \[key: string\]: string }>

Resolves to a JSON object of CSS properties of the node. This is the same CSS that Figma shows in the inspect panel and is helpful if you are building a [plugin for code generation](https://developers.figma.com/docs/plugins/codegen-plugins/).

* * *

### getTopLevelFrame(): [FrameNode](https://developers.figma.com/docs/plugins/api/FrameNode/) \| undefined

Returns the top-most frame that contains this node. If the node is not inside a frame, this will return undefined.

info

This function will only work in Figma Design and will throw an error if called in FigJam or Slides.

* * *

## Plugin data properties [​](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/\#plugin-data-properties "Direct link to Plugin data properties")

### getPluginData(key: string): string

Retrieves custom information that was stored on this node or style using [`setPluginData`](https://developers.figma.com/docs/plugins/api/properties/nodes-setplugindata/). If there is no data stored for the provided key, an empty string is returned.

* * *

### [setPluginData](https://developers.figma.com/docs/plugins/api/properties/nodes-setplugindata/)(key: string, value: string): void

Lets you store custom information on any node or style, **private** to your plugin. The total size of your entry (`pluginId`, `key`, `value`) cannot exceed 100 kB.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-setplugindata/)

* * *

### getPluginDataKeys(): string\[\]

Retrieves a list of all keys stored on this node or style using using [`setPluginData`](https://developers.figma.com/docs/plugins/api/properties/nodes-setplugindata/). This enables iterating through all data stored privately on a node or style by your plugin.

* * *

### getSharedPluginData(namespace: string, key: string): string

Retrieves custom information that was stored on this node or style using [`setSharedPluginData`](https://developers.figma.com/docs/plugins/api/properties/nodes-setsharedplugindata/). If there is no data stored for the provided namespace and key, an empty string is returned.

* * *

### [setSharedPluginData](https://developers.figma.com/docs/plugins/api/properties/nodes-setsharedplugindata/)(namespace: string, key: string, value: string): void

Lets you store custom information on any node or style, **public** to all plugins. The total size of your entry (`namespace`, `key`, `value`) cannot exceed 100 kB.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-setsharedplugindata/)

* * *

### getSharedPluginDataKeys(namespace: string): string\[\]

Retrieves a list of all keys stored on this node or style using [`setSharedPluginData`](https://developers.figma.com/docs/plugins/api/properties/nodes-setsharedplugindata/). This enables iterating through all data stored in a given namespace.

* * *

## Dev resource properties [​](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/\#dev-resource-properties "Direct link to Dev resource properties")

### getDevResourcesAsync(options?: { includeChildren: boolean }): Promise< [DevResourceWithNodeId](https://developers.figma.com/docs/plugins/api/DevResource/\#dev-resource-with-node-id)\[\]>

Gets all of the dev resources on a node. This includes any inherited dev resources from components and component sets.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-getdevresourcesasync/)

* * *

### addDevResourceAsync(url: string, name?: string): Promise<void>

Adds a dev resource to a node. This will fail if the node already has a dev resource with the same url.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-adddevresourceasync/)

* * *

### editDevResourceAsync(currentUrl: string, newValue: { name: string; url: string }): Promise<void>

Edits a dev resource on a node. This will fail if the node does not have a dev resource with the same url.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-editdevresourceasync/)

* * *

### deleteDevResourceAsync(url: string): Promise<void>

Deletes a dev resource on a node. This will fail if the node does not have a dev resource with the same url.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-deletedevresourceasync/)

* * *

### setDevResourcePreviewAsync(url: string, preview: PlainTextElement): Promise<void>

caution

This is a private API only available to [Figma partners](https://www.figma.com/partners/)

* * *

## Scene node properties [​](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/\#scene-node-properties "Direct link to Scene node properties")

### [visible](https://developers.figma.com/docs/plugins/api/properties/nodes-visible/): boolean

Whether the node is visible or not. Does not affect a plugin's ability to access the node.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-visible/)

* * *

### [locked](https://developers.figma.com/docs/plugins/api/properties/nodes-locked/): boolean

Whether the node is locked or not, preventing certain user interactions on the canvas such as selecting and dragging. Does not affect a plugin's ability to write to those properties.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-locked/)

* * *

### [stuckNodes](https://developers.figma.com/docs/plugins/api/properties/nodes-stucknodes/): [SceneNode](https://developers.figma.com/docs/plugins/api/nodes/\#scene-node)\[\] \[readonly\]

An array of nodes that are "stuck" to this node. In FigJam, stamps, highlights, and some widgets can "stick"
to other nodes if they are dragged on top of another node.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-stucknodes/)

* * *

### attachedConnectors: [ConnectorNode](https://developers.figma.com/docs/plugins/api/ConnectorNode/)\[\] \[readonly\]

An array of `ConnectorNode`s that are attached to a node.

* * *

### componentPropertyReferences: { \[nodeProperty in 'visible' \| 'characters' \| 'mainComponent'\]?: string} \| null

All component properties that are attached on this node. A node can only have `componentPropertyReferences` if it is a component sublayer or an instance sublayer. It will be `null` otherwise. The value in the key-value pair refers to the component property name as returned by `componentPropertyDefinitions` on the containing component, component set or main component (for instances).

* * *

### boundVariables?: { readonly \[field in [VariableBindableNodeField](https://developers.figma.com/docs/plugins/api/VariableBindableNodeField/)\]?: [VariableAlias](https://developers.figma.com/docs/plugins/api/VariableAlias/)} & { readonly \[field in [VariableBindableTextField](https://developers.figma.com/docs/plugins/api/VariableBindableTextField/)\]?: [VariableAlias](https://developers.figma.com/docs/plugins/api/VariableAlias/)\[\]} & { fills: [VariableAlias](https://developers.figma.com/docs/plugins/api/VariableAlias/)\[\]; strokes: [VariableAlias](https://developers.figma.com/docs/plugins/api/VariableAlias/)\[\]; effects: [VariableAlias](https://developers.figma.com/docs/plugins/api/VariableAlias/)\[\]; layoutGrids: [VariableAlias](https://developers.figma.com/docs/plugins/api/VariableAlias/)\[\]; componentProperties: { \[propertyName: string\]: [VariableAlias](https://developers.figma.com/docs/plugins/api/VariableAlias/) }; textRangeFills: [VariableAlias](https://developers.figma.com/docs/plugins/api/VariableAlias/)\[\] } \[readonly\]

The variables bound to a particular field on this node. Please see the [Working with Variables](https://developers.figma.com/docs/plugins/working-with-variables/) guide for how to get and set variable bindings.

* * *

### setBoundVariable(field: [VariableBindableNodeField](https://developers.figma.com/docs/plugins/api/VariableBindableNodeField/) \| [VariableBindableTextField](https://developers.figma.com/docs/plugins/api/VariableBindableTextField/), variable: [Variable](https://developers.figma.com/docs/plugins/api/Variable/) \| null): void

Binds the provided `field` on this node to the given variable. Please see the [Working with Variables](https://developers.figma.com/docs/plugins/working-with-variables/) guide for how to get and set variable bindings.

If `null` is provided as the variable, the given `field` will be unbound from any variables.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-setboundvariable/)

* * *

### [inferredVariables](https://developers.figma.com/docs/plugins/api/properties/nodes-inferredvariables/)?: { readonly \[field in [VariableBindableNodeField](https://developers.figma.com/docs/plugins/api/VariableBindableNodeField/)\]?: [VariableAlias](https://developers.figma.com/docs/plugins/api/VariableAlias/)\[\]} & { fills: [VariableAlias](https://developers.figma.com/docs/plugins/api/VariableAlias/)\[\]\[\]; strokes: [VariableAlias](https://developers.figma.com/docs/plugins/api/VariableAlias/)\[\]\[\] } \[readonly\]

An object, keyed by field, returning any variables that match the raw value of that field for the mode of the node (or the default variable value if no mode is set)

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-inferredvariables/)

* * *

### [resolvedVariableModes](https://developers.figma.com/docs/plugins/api/properties/nodes-resolvedvariablemodes/): { \[collectionId: string\]: string }

The resolved mode for this node for each variable collection in this file.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-resolvedvariablemodes/)

* * *

### explicitVariableModes: { \[collectionId: string\]: string }

The explicitly set modes for this node.
For `SceneNodes`, represents a subset of [`resolvedVariableModes`](https://developers.figma.com/docs/plugins/api/properties/nodes-resolvedvariablemodes/).
Note that this does not include [workspace and team-default modes](https://help.figma.com/hc/en-us/articles/12611253730071).

* * *

### clearExplicitVariableModeForCollection(collection: [VariableCollection](https://developers.figma.com/docs/plugins/api/VariableCollection/)): void

Clears an explicit mode for the given collection on this node

[View more →](https://developers.figma.com/docs/plugins/api/properties/ExplicitVariableModesMixin-clearexplicitvariablemodeforcollection/)

* * *

### setExplicitVariableModeForCollection(collection: [VariableCollection](https://developers.figma.com/docs/plugins/api/VariableCollection/), modeId: string): void

Sets an explicit mode for the given collection on this node

[View more →](https://developers.figma.com/docs/plugins/api/properties/ExplicitVariableModesMixin-setexplicitvariablemodeforcollection/)

* * *

## Blend-related properties [​](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/\#blend-related-properties "Direct link to Blend-related properties")

### opacity: number

Opacity of the node, as shown in the Layer panel. Must be between 0 and 1.

* * *

### blendMode: [BlendMode](https://developers.figma.com/docs/plugins/api/BlendMode/)

Blend mode of this node, as shown in the Layer panel. In addition to the blend modes that paints & effects support, the layer blend mode can also have the value PASS\_THROUGH.

* * *

### [isMask](https://developers.figma.com/docs/plugins/api/properties/nodes-ismask/): boolean

Whether this node is a mask. A mask node masks its subsequent siblings.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-ismask/)

* * *

### maskType: [MaskType](https://developers.figma.com/docs/plugins/api/MaskType/)

Type of masking to use if this node is a mask. Defaults to `"ALPHA"`. You must check `isMask` to verify that this is a mask; changing `maskType` does not automatically turn on `isMask`, and a node that is not a mask can still have a `maskType`.

* * *

### effects: ReadonlyArray< [Effect](https://developers.figma.com/docs/plugins/api/Effect/) >

Array of effects. See [`Effect`](https://developers.figma.com/docs/plugins/api/Effect/) type. For help on how to change this value, see [Editing Properties](https://developers.figma.com/docs/plugins/editing-properties/).

* * *

### effectStyleId: string

The id of the [`EffectStyle`](https://developers.figma.com/docs/plugins/api/EffectStyle/) object that the properties of this node are linked to.

If the manifest contains`"documentAccess": "dynamic-page"`, this property is read-only. Use `setEffectStyleIdAsync` to update the style.

* * *

### setEffectStyleIdAsync(styleId: string): Promise<void>

Set the [`EffectStyle`](https://developers.figma.com/docs/plugins/api/EffectStyle/) that the properties of this node are linked to.

* * *

## Children-related properties [​](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/\#children-related-properties "Direct link to Children-related properties")

### [children](https://developers.figma.com/docs/plugins/api/properties/nodes-children/): ReadonlyArray< [SceneNode](https://developers.figma.com/docs/plugins/api/nodes/\#scene-node) \> \[readonly\]

The list of children, sorted back-to-front. That is, the first child in the array is the bottommost layer on the screen, and the last child in the array is the topmost layer.

If the manifest contains `"documentAccess": "dynamic-page"`, **and** the node is a [`PageNode`](https://developers.figma.com/docs/plugins/api/PageNode/), you must first call [`loadAsync`](https://developers.figma.com/docs/plugins/api/PageNode/#loadasync) to access this property.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-children/)

* * *

### [appendChild](https://developers.figma.com/docs/plugins/api/properties/nodes-appendchild/)(child: [SceneNode](https://developers.figma.com/docs/plugins/api/nodes/\#scene-node)): void

Adds a new child to the end of the [`children`](https://developers.figma.com/docs/plugins/api/properties/nodes-children/) array. That is, visually on top of all other children.

If the manifest contains `"documentAccess": "dynamic-page"`, **and** the node is a [`PageNode`](https://developers.figma.com/docs/plugins/api/PageNode/), you must first call [`loadAsync`](https://developers.figma.com/docs/plugins/api/PageNode/#loadasync) to access this function.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-appendchild/)

* * *

### [insertChild](https://developers.figma.com/docs/plugins/api/properties/nodes-insertchild/)(index: number, child: [SceneNode](https://developers.figma.com/docs/plugins/api/nodes/\#scene-node)): void

Adds a new child at the specified index in the [`children`](https://developers.figma.com/docs/plugins/api/properties/nodes-children/) array.

If the manifest contains `"documentAccess": "dynamic-page"`, **and** the node is a [`PageNode`](https://developers.figma.com/docs/plugins/api/PageNode/), you must first call [`loadAsync`](https://developers.figma.com/docs/plugins/api/PageNode/#loadasync) to access this function.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-insertchild/)

* * *

### [findChildren](https://developers.figma.com/docs/plugins/api/properties/nodes-findchildren/)(callback?: (node: [SceneNode](https://developers.figma.com/docs/plugins/api/nodes/\#scene-node)) =\> boolean): [SceneNode](https://developers.figma.com/docs/plugins/api/nodes/\#scene-node)\[\]

Searches the immediate children of this node (i.e. not including the children's children). Returns all nodes for which `callback` returns true.

If the manifest contains `"documentAccess": "dynamic-page"`, **and** the node is a [`PageNode`](https://developers.figma.com/docs/plugins/api/PageNode/), you must first call [`loadAsync`](https://developers.figma.com/docs/plugins/api/PageNode/#loadasync) to access this function.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-findchildren/)

* * *

### [findChild](https://developers.figma.com/docs/plugins/api/properties/nodes-findchild/)(callback: (node: [SceneNode](https://developers.figma.com/docs/plugins/api/nodes/\#scene-node)) =\> boolean): [SceneNode](https://developers.figma.com/docs/plugins/api/nodes/\#scene-node) \| null

Searches the immediate children of this node (i.e. not including the children's children). Returns the first node for which `callback` returns true.

If the manifest contains `"documentAccess": "dynamic-page"`, **and** the node is a [`PageNode`](https://developers.figma.com/docs/plugins/api/PageNode/), you must first call [`loadAsync`](https://developers.figma.com/docs/plugins/api/PageNode/#loadasync) to access this function.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-findchild/)

* * *

### [findAll](https://developers.figma.com/docs/plugins/api/properties/nodes-findall/)(callback?: (node: [SceneNode](https://developers.figma.com/docs/plugins/api/nodes/\#scene-node)) =\> boolean): [SceneNode](https://developers.figma.com/docs/plugins/api/nodes/\#scene-node)\[\]

Searches this entire subtree (this node's children, its children's children, etc). Returns all nodes for which `callback` returns true.

If the manifest contains `"documentAccess": "dynamic-page"`, **and** the node is a [`PageNode`](https://developers.figma.com/docs/plugins/api/PageNode/), you must first call [`loadAsync`](https://developers.figma.com/docs/plugins/api/PageNode/#loadasync) to access this function.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-findall/)

* * *

### [findOne](https://developers.figma.com/docs/plugins/api/properties/nodes-findone/)(callback: (node: [SceneNode](https://developers.figma.com/docs/plugins/api/nodes/\#scene-node)) =\> boolean): [SceneNode](https://developers.figma.com/docs/plugins/api/nodes/\#scene-node) \| null

Searches this entire subtree (this node's children, its children's children, etc). Returns the first node for which `callback` returns true.

If the manifest contains `"documentAccess": "dynamic-page"`, **and** the node is a [`PageNode`](https://developers.figma.com/docs/plugins/api/PageNode/), you must first call [`loadAsync`](https://developers.figma.com/docs/plugins/api/PageNode/#loadasync) to access this function.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-findone/)

* * *

### [findAllWithCriteria](https://developers.figma.com/docs/plugins/api/properties/nodes-findallwithcriteria/) <T extends NodeType\[\]>(criteria: [FindAllCriteria](https://developers.figma.com/docs/plugins/api/FindAllCriteria/) <T>): Array<{ type: T\[number\] } & [SceneNode](https://developers.figma.com/docs/plugins/api/nodes/\#scene-node) >

Searches this entire subtree (this node's children, its children's children, etc). Returns all nodes that satisfy all of specified criteria.

If the manifest contains `"documentAccess": "dynamic-page"`, **and** the node is a [`PageNode`](https://developers.figma.com/docs/plugins/api/PageNode/), you must first call [`loadAsync`](https://developers.figma.com/docs/plugins/api/PageNode/#loadasync) to access this function.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-findallwithcriteria/)

* * *

### [findWidgetNodesByWidgetId](https://developers.figma.com/docs/plugins/api/properties/nodes-findwidgetnodesbywidgetid/)(widgetId: string): Array< [WidgetNode](https://developers.figma.com/docs/plugins/api/WidgetNode/) >

Searches this entire subtree (this node's children, its children's children, etc). Returns all widget nodes that match the provided `widgetId`.

If the manifest contains `"documentAccess": "dynamic-page"`, **and** the node is a [`PageNode`](https://developers.figma.com/docs/plugins/api/PageNode/), you must first call [`loadAsync`](https://developers.figma.com/docs/plugins/api/PageNode/#loadasync) to access this function.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-findwidgetnodesbywidgetid/)

* * *

## Layout-related properties [​](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/\#layout-related-properties "Direct link to Layout-related properties")

### [x](https://developers.figma.com/docs/plugins/api/properties/nodes-x/): number

The position of the node. Identical to `relativeTransform[0][2]`.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-x/)

* * *

### [y](https://developers.figma.com/docs/plugins/api/properties/nodes-y/): number

The position of the node. Identical to `relativeTransform[1][2]`.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-y/)

* * *

### width: number \[readonly\]

The width of the node. Use a resizing method to change this value.

* * *

### height: number \[readonly\]

The height of the node. Use a resizing method to change this value.

* * *

### minWidth: number \| null

Applicable only to auto-layout frames and their direct children. Value must be positive. Set to `null` to remove `minWidth`.

* * *

### maxWidth: number \| null

Applicable only to auto-layout frames and their direct children. Value must be positive. Set to `null` to remove `maxWidth`.

* * *

### minHeight: number \| null

Applicable only to auto-layout frames and their direct children. Value must be positive. Set to null to remove `minHeight`.

* * *

### maxHeight: number \| null

Applicable only to auto-layout frames and their direct children. Value must be positive. Set to `null` to remove `maxHeight`.

* * *

### [relativeTransform](https://developers.figma.com/docs/plugins/api/properties/nodes-relativetransform/): [Transform](https://developers.figma.com/docs/plugins/api/Transform/)

The position of a node relative to its **containing parent** as a [`Transform`](https://developers.figma.com/docs/plugins/api/Transform/) matrix. Not used for scaling, see `width` and `height` instead. Read the details page to understand the nuances of this property.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-relativetransform/)

* * *

### absoluteTransform: [Transform](https://developers.figma.com/docs/plugins/api/Transform/)\[readonly\]

The position of a node relative to its **containing page** as a [`Transform`](https://developers.figma.com/docs/plugins/api/Transform/) matrix.

* * *

### absoluteBoundingBox: [Rect](https://developers.figma.com/docs/plugins/api/Rect/) \| null \[readonly\]

The bounds of the node that does not include rendered properties like drop shadows or strokes. The `x` and `y` inside this property represent the absolute position of the node on the page.

* * *

### [layoutAlign](https://developers.figma.com/docs/plugins/api/properties/nodes-layoutalign/): 'MIN' \| 'CENTER' \| 'MAX' \| 'STRETCH' \| 'INHERIT'

Applicable only on direct children of auto-layout frames. Determines if the layer should stretch along the parent’s counter axis. Defaults to `“INHERIT”`.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-layoutalign/)

* * *

### [layoutGrow](https://developers.figma.com/docs/plugins/api/properties/nodes-layoutgrow/): number

This property is applicable only for direct children of auto-layout frames. Determines whether a layer should stretch along the parent’s primary axis. 0 corresponds to a fixed size and 1 corresponds to stretch.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-layoutgrow/)

* * *

### [layoutPositioning](https://developers.figma.com/docs/plugins/api/properties/nodes-layoutpositioning/): 'AUTO' \| 'ABSOLUTE'

This property is applicable only for direct children of auto-layout frames. Determines whether a layer's size and position should be dermined by auto-layout settings or manually adjustable.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-layoutpositioning/)

* * *

### [setGridChildPosition](https://developers.figma.com/docs/plugins/api/properties/nodes-setgridchildposition/)(rowIndex: number, columnIndex: number): void

Applicable only on direct children of 'GRID' auto-layout frames. Sets the position of the node

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-setgridchildposition/)

* * *

### [gridRowAnchorIndex](https://developers.figma.com/docs/plugins/api/properties/nodes-gridrowanchorindex/): number \[readonly\]

Applicable only on direct children of grid auto-layout frames. Determines the starting row index for this node within the parent grid.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-gridrowanchorindex/)

* * *

### [gridColumnAnchorIndex](https://developers.figma.com/docs/plugins/api/properties/nodes-gridcolumnanchorindex/): number \[readonly\]

Applicable only on direct children of grid auto-layout frames. Determines the starting column index for this node within the parent grid.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-gridcolumnanchorindex/)

* * *

### [gridRowSpan](https://developers.figma.com/docs/plugins/api/properties/nodes-gridrowspan/): number

Applicable only on direct children of grid auto-layout frames. Determines the number of rows this node will span within the parent grid.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-gridrowspan/)

* * *

### [gridColumnSpan](https://developers.figma.com/docs/plugins/api/properties/nodes-gridcolumnspan/): number

Applicable only on direct children of grid auto-layout frames. Determines the number of columns this node will span within the parent grid.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-gridcolumnspan/)

* * *

### [gridChildHorizontalAlign](https://developers.figma.com/docs/plugins/api/properties/nodes-gridchildhorizontalalign/): 'MIN' \| 'CENTER' \| 'MAX' \| 'AUTO'

Applicable only on direct children of grid auto-layout frames. Controls the horizontal alignment of the node within its grid cell.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-gridchildhorizontalalign/)

* * *

### [gridChildVerticalAlign](https://developers.figma.com/docs/plugins/api/properties/nodes-gridchildverticalalign/): 'MIN' \| 'CENTER' \| 'MAX' \| 'AUTO'

Applicable only on direct children of grid auto-layout frames. Controls the vertical alignment of the node within its grid cell.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-gridchildverticalalign/)

* * *

### absoluteRenderBounds: [Rect](https://developers.figma.com/docs/plugins/api/Rect/) \| null \[readonly\]

The actual bounds of a node accounting for drop shadows, thick strokes, and anything else that may fall outside the node's regular bounding box defined in `x`, `y`, `width`, and `height`. The `x` and `y` inside this property represent the absolute position of the node on the page. This value will be `null` if the node is invisible.

* * *

### constrainProportions: boolean

**DEPRECATED:** Use `targetAspectRatio`, `lockAspectRatio`, and `unlockAspectRatio` instead.

When toggled, causes the layer to keep its proportions when the user resizes it via the properties panel.

* * *

### [rotation](https://developers.figma.com/docs/plugins/api/properties/nodes-rotation/): number

The rotation of the node in degrees. Returns values from -180 to 180. Identical to `Math.atan2(-m10, m00)` in the [`relativeTransform`](https://developers.figma.com/docs/plugins/api/properties/nodes-relativetransform/) matrix. When setting `rotation`, it will also set `m00`, `m01`, `m10`, `m11`.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-rotation/)

* * *

### [layoutSizingHorizontal](https://developers.figma.com/docs/plugins/api/properties/nodes-layoutsizinghorizontal/): 'FIXED' \| 'HUG' \| 'FILL'

Applicable only on auto-layout frames, their children, and text nodes. This is a shorthand for setting [`layoutGrow`](https://developers.figma.com/docs/plugins/api/properties/nodes-layoutgrow/), [`layoutAlign`](https://developers.figma.com/docs/plugins/api/properties/nodes-layoutalign/), [`primaryAxisSizingMode`](https://developers.figma.com/docs/plugins/api/properties/nodes-primaryaxissizingmode/), and [`counterAxisSizingMode`](https://developers.figma.com/docs/plugins/api/properties/nodes-counteraxissizingmode/). This field maps directly to the "Horizontal sizing" dropdown in the Figma UI.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-layoutsizinghorizontal/)

* * *

### [layoutSizingVertical](https://developers.figma.com/docs/plugins/api/properties/nodes-layoutsizingvertical/): 'FIXED' \| 'HUG' \| 'FILL'

Applicable only on auto-layout frames, their children, and text nodes. This is a shorthand for setting [`layoutGrow`](https://developers.figma.com/docs/plugins/api/properties/nodes-layoutgrow/), [`layoutAlign`](https://developers.figma.com/docs/plugins/api/properties/nodes-layoutalign/), [`primaryAxisSizingMode`](https://developers.figma.com/docs/plugins/api/properties/nodes-primaryaxissizingmode/), and [`counterAxisSizingMode`](https://developers.figma.com/docs/plugins/api/properties/nodes-counteraxissizingmode/). This field maps directly to the "Vertical sizing" dropdown in the Figma UI.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-layoutsizingvertical/)

* * *

### [resize](https://developers.figma.com/docs/plugins/api/properties/nodes-resize/)(width: number, height: number): void

Resizes the node. If the node contains children with constraints, it applies those constraints during resizing. If the parent has auto-layout, causes the parent to be resized.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-resize/)

* * *

### [resizeWithoutConstraints](https://developers.figma.com/docs/plugins/api/properties/nodes-resizewithoutconstraints/)(width: number, height: number): void

Resizes the node. Children of the node are never resized, even if those children have constraints. If the parent has auto-layout, causes the parent to be resized (this constraint cannot be ignored).

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-resizewithoutconstraints/)

* * *

### [rescale](https://developers.figma.com/docs/plugins/api/properties/nodes-rescale/)(scale: number): void

Rescales the node. This API function is the equivalent of using the Scale Tool from the toolbar.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-rescale/)

* * *

## Lock aspect ratio properties [​](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/\#lock-aspect-ratio-properties "Direct link to Lock aspect ratio properties")

### [targetAspectRatio](https://developers.figma.com/docs/plugins/api/properties/nodes-targetaspectratio/): [Vector](https://developers.figma.com/docs/plugins/api/Vector/) \| null \[readonly\]

When toggled, causes the layer to keep its proportions when the user resizes it via auto layout, constraints, the properties panel, or on-canvas.
If not set, the node does NOT resize toward a specific targetAspectRatio.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-targetaspectratio/)

* * *

### lockAspectRatio(): void

Locks the node's `targetAspectRatio` to the current ratio of its width and height.

* * *

### unlockAspectRatio(): void

Unlocks the node's `targetAspectRatio`.

* * *

## Export-related properties [​](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/\#export-related-properties "Direct link to Export-related properties")

### exportSettings: ReadonlyArray< [ExportSettings](https://developers.figma.com/docs/plugins/api/ExportSettings/) >

List of export settings stored on the node. For help on how to change this value, see [Editing Properties](https://developers.figma.com/docs/plugins/editing-properties/).

* * *

### exportAsync(settings?: [ExportSettings](https://developers.figma.com/docs/plugins/api/ExportSettings/)): Promise<Uint8Array>

### exportAsync(settings: [ExportSettingsSVGString](https://developers.figma.com/docs/plugins/api/ExportSettings/\#export-settings-svgstring)): Promise<string>

### exportAsync(settings: [ExportSettingsREST](https://developers.figma.com/docs/plugins/api/ExportSettings/\#export-settings-rest)): Promise<Object>

Exports the node as an encoded image.

If the manifest contains `"documentAccess": "dynamic-page"`, **and** the node is a [`PageNode`](https://developers.figma.com/docs/plugins/api/PageNode/), you must first call [`loadAsync`](https://developers.figma.com/docs/plugins/api/PageNode/#loadasync) to access this function.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-exportasync/)

* * *

## Reaction prototyping-related properties [​](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/\#reaction-prototyping-related-properties "Direct link to Reaction prototyping-related properties")

### [reactions](https://developers.figma.com/docs/plugins/api/properties/nodes-reactions/): ReadonlyArray< [Reaction](https://developers.figma.com/docs/plugins/api/Reaction/) >

List of [Reactions](https://developers.figma.com/docs/plugins/api/Reaction/) on this node, which includes both the method of interaction with this node in a prototype, and the behavior of that interaction. For help on how to change this value, see [Editing Properties](https://developers.figma.com/docs/plugins/editing-properties/).

If the manifest contains`"documentAccess": "dynamic-page"`, this property is read-only. Use `setReactionsAsync` to update the value.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-reactions/)

* * *

### setReactionsAsync(reactions: Array< [Reaction](https://developers.figma.com/docs/plugins/api/Reaction/) >): Promise<void>

Updates the reactions on this node. See [`reactions`](https://developers.figma.com/docs/plugins/api/properties/nodes-reactions/) for a usage example.

* * *

## Corner-related properties [​](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/\#corner-related-properties "Direct link to Corner-related properties")

### [cornerRadius](https://developers.figma.com/docs/plugins/api/properties/nodes-cornerradius/): number \| [figma.mixed](https://developers.figma.com/docs/plugins/api/properties/figma-mixed/)

The number of pixels to round the corners of the object by.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-cornerradius/)

* * *

### [cornerSmoothing](https://developers.figma.com/docs/plugins/api/properties/nodes-cornersmoothing/): number

A value that lets you control how "smooth" the corners are. Ranges from 0 to 1.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-cornersmoothing/)

* * *

## Geometry-related properties [​](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/\#geometry-related-properties "Direct link to Geometry-related properties")

### [fills](https://developers.figma.com/docs/plugins/api/properties/nodes-fills/): ReadonlyArray< [Paint](https://developers.figma.com/docs/plugins/api/Paint/) \> \| [figma.mixed](https://developers.figma.com/docs/plugins/api/properties/figma-mixed/)

The paints used to fill the area of the shape. For help on how to change this value, see [Editing Properties](https://developers.figma.com/docs/plugins/editing-properties/).

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-fills/)

* * *

### [fillStyleId](https://developers.figma.com/docs/plugins/api/properties/nodes-fillstyleid/): string \| [figma.mixed](https://developers.figma.com/docs/plugins/api/properties/figma-mixed/)

The id of the [`PaintStyle`](https://developers.figma.com/docs/plugins/api/PaintStyle/) object that the [`fills`](https://developers.figma.com/docs/plugins/api/properties/nodes-fills/) property of this node is linked to.

If the manifest contains`"documentAccess": "dynamic-page"`, this property is read-only. Use `setFillStyleIdAsync` to update the style.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-fillstyleid/)

* * *

### setFillStyleIdAsync(styleId: string): Promise<void>

Sets the [`PaintStyle`](https://developers.figma.com/docs/plugins/api/PaintStyle/) that the [`fills`](https://developers.figma.com/docs/plugins/api/properties/nodes-fills/) property of this node is linked to.

* * *

### setFillsAsync(paints: ReadonlyArray< [Paint](https://developers.figma.com/docs/plugins/api/Paint/) >): Promise<void>

Sets the fills of the node asynchronously. This is the only way to set pattern fills on a node, since we need to ensure that the source node of the pattern is loaded first. See [Adding Pattern Fills and Strokes](https://developers.figma.com/docs/plugins/adding-pattern-fills-and-strokes/) for more information.

* * *

### [strokes](https://developers.figma.com/docs/plugins/api/properties/nodes-strokes/): ReadonlyArray< [Paint](https://developers.figma.com/docs/plugins/api/Paint/) >

The paints used to fill the area of the shape's strokes. For help on how to change this value, see [Editing Properties](https://developers.figma.com/docs/plugins/editing-properties/).

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-strokes/)

* * *

### strokeStyleId: string

The id of the [`PaintStyle`](https://developers.figma.com/docs/plugins/api/PaintStyle/) object that the [`strokes`](https://developers.figma.com/docs/plugins/api/properties/nodes-strokes/) property of this node is linked to.

If the manifest contains`"documentAccess": "dynamic-page"`, this property is read-only. Use `setStrokeStyleIdAsync` to update the style.

* * *

### setStrokeStyleIdAsync(styleId: string): Promise<void>

Set the [`PaintStyle`](https://developers.figma.com/docs/plugins/api/PaintStyle/) that the [`strokes`](https://developers.figma.com/docs/plugins/api/properties/nodes-strokes/) property of this node is linked to.

* * *

### strokeWeight: number \| [figma.mixed](https://developers.figma.com/docs/plugins/api/properties/figma-mixed/)

The thickness of the stroke, in pixels. This value must be non-negative and can be fractional.

caution

For rectangle nodes or frame-like nodes using different individual stroke weights, this property will return [`figma.mixed`](https://developers.figma.com/docs/plugins/api/properties/figma-mixed/).

info

For rectangle nodes or frame-like nodes, individual stroke weights can be set for each side using the following properties:

- [`strokeTopWeight`](https://developers.figma.com/docs/plugins/api/node-properties/#stroketopweight)
- [`strokeBottomWeight`](https://developers.figma.com/docs/plugins/api/node-properties/#strokebottomweight)
- [`strokeLeftWeight`](https://developers.figma.com/docs/plugins/api/node-properties/#strokeleftweight)
- [`strokeRightWeight`](https://developers.figma.com/docs/plugins/api/node-properties/#strokerightweight)

* * *

### [strokeJoin](https://developers.figma.com/docs/plugins/api/properties/nodes-strokejoin/): [StrokeJoin](https://developers.figma.com/docs/plugins/api/StrokeJoin/) \| [figma.mixed](https://developers.figma.com/docs/plugins/api/properties/figma-mixed/)

The decoration applied to vertices which have two or more connected segments.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-strokejoin/)

* * *

### [strokeAlign](https://developers.figma.com/docs/plugins/api/properties/nodes-strokealign/): 'CENTER' \| 'INSIDE' \| 'OUTSIDE'

The alignment of the stroke with respect to the boundaries of the shape.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-strokealign/)

* * *

### dashPattern: ReadonlyArray<number>

A list of numbers specifying alternating dash and gap lengths, in pixels.

* * *

### strokeGeometry: [VectorPaths](https://developers.figma.com/docs/plugins/api/VectorPath/\#vector-paths)\[readonly\]

An array of paths representing the object strokes relative to the node.
StrokeGeometry is always from the center regardless of the nodes `strokeAlign`.

* * *

### setStrokesAsync(strokes: ReadonlyArray< [Paint](https://developers.figma.com/docs/plugins/api/Paint/) >): Promise<void>

Sets the strokes of the node asynchronously. This is the only way to set pattern strokes on a node, since we need to ensure that the source node of the pattern is loaded first. See [Adding Pattern Fills and Strokes](https://developers.figma.com/docs/plugins/adding-pattern-fills-and-strokes/) for more information.

* * *

### [strokeCap](https://developers.figma.com/docs/plugins/api/properties/nodes-strokecap/): [StrokeCap](https://developers.figma.com/docs/plugins/api/StrokeCap/) \| [figma.mixed](https://developers.figma.com/docs/plugins/api/properties/figma-mixed/)

The decoration applied to vertices which have only one connected segment.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-strokecap/)

* * *

### strokeMiterLimit: number

The miter limit on the stroke. This is the same as the [SVG miter limit](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-miterlimit).

* * *

### outlineStroke(): [VectorNode](https://developers.figma.com/docs/plugins/api/VectorNode/) \| null

This method performs an action similar to using the "Outline Stroke" function in the editor from the right-click menu. However, this method creates and returns a new node while leaving the original intact. Returns `null` if the node has no strokes.

* * *

### fillGeometry: [VectorPaths](https://developers.figma.com/docs/plugins/api/VectorPath/\#vector-paths)\[readonly\]

An array of paths representing the object fills relative to the node.

* * *

## Complex stroke-related properties [​](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/\#complex-stroke-related-properties "Direct link to Complex stroke-related properties")

### [variableWidthStrokeProperties](https://developers.figma.com/docs/plugins/api/properties/nodes-variablewidthstrokeproperties/): [VariableWidthStrokeProperties](https://developers.figma.com/docs/plugins/api/VariableWidthStrokeProperties/) \| null

The variable width stroke properties for the node.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-variablewidthstrokeproperties/)

* * *

### [complexStrokeProperties](https://developers.figma.com/docs/plugins/api/properties/nodes-complexstrokeproperties/): [ComplexStrokeProperties](https://developers.figma.com/docs/plugins/api/ComplexStrokeProperties/)

The complex stroke properties for nodes using brush or dynamic strokes.

[View more →](https://developers.figma.com/docs/plugins/api/properties/nodes-complexstrokeproperties/)

* * *

- [Boolean operation properties](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/#boolean-operation-properties)
- [Base node properties](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/#base-node-properties)
- [Plugin data properties](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/#plugin-data-properties)
- [Dev resource properties](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/#dev-resource-properties)
- [Scene node properties](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/#scene-node-properties)
- [Blend-related properties](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/#blend-related-properties)
- [Children-related properties](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/#children-related-properties)
- [Layout-related properties](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/#layout-related-properties)
- [Lock aspect ratio properties](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/#lock-aspect-ratio-properties)
- [Export-related properties](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/#export-related-properties)
- [Reaction prototyping-related properties](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/#reaction-prototyping-related-properties)
- [Corner-related properties](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/#corner-related-properties)
- [Geometry-related properties](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/#geometry-related-properties)
- [Complex stroke-related properties](https://developers.figma.com/docs/plugins/api/BooleanOperationNode/#complex-stroke-related-properties)

Was this page helpful?

[Leave us feedback](https://form.asana.com/?k=6r2Tos6p01DyVKGLeYJByg&d=10497086658021)

* * *

- [Community Forum](https://forum.figma.com/)
- [Discord Server](https://discord.gg/xzQhe2Vcvx)
- [GitHub Samples](https://github.com/figma/widget-samples)