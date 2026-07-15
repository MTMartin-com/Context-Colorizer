import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Structure representing the storage model for classified workspace items.
 * Maps an absolute file path to its designated color and icon.
 */
interface ColorIconMapping {
    [key: string]: { color: string; icon: string };
}

/**
 * Custom QuickPickItem contract extending native API to support 
 * separation of concerns between raw data storage and interactive localized UI labels.
 */
interface VisualQuickPickItem extends vscode.QuickPickItem {
    value: string;
}

/**
 * Extension activation lifecycle hook.
 * Initializes core states, registers commands, event watchers, and bindings.
 */
export function activate(context: vscode.ExtensionContext) {
    // In-memory stack to manage the undo history transaction state (Cmd+Z / Ctrl+Z)
    const undoStack: ColorIconMapping[] = [];
    
    /**
     * Custom FileDecorationProvider driven by the workspace state sandbox.
     * Intercepts the VS Code file explorer view to apply custom color layers and badges.
     */
    const decorationProvider = new class implements vscode.FileDecorationProvider {
        private _onDidChangeFileDecorations: vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined> = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
        readonly onDidChangeFileDecorations: vscode.Event<vscode.Uri | vscode.Uri[] | undefined> = this._onDidChangeFileDecorations.event;

        /**
         * Triggers a global UI redraw across the active file explorer panel.
         */
        refresh() {
            this._onDidChangeFileDecorations.fire(undefined);
        }

        /**
         * Evaluates whether a given file system resource requires custom styling context.
         * Implementation uses a fast directory-tree traversal algorithm O(Depth) instead of loop-checking keys O(N).
         */
        provideFileDecoration(uri: vscode.Uri): vscode.ProviderResult<vscode.FileDecoration> {
            const mapping = context.workspaceState.get<ColorIconMapping>('contextColorMappingV3') || {};
            const currentPath = uri.fsPath;

            // --- 1. DIRECT MATCH SPECIFICITY (Highest Priority) ---
            if (mapping[currentPath]) {
                const data = mapping[currentPath];
                return this.buildDecoration(data.color, data.icon, false);
            }

            // --- 2. HIERARCHICAL FOLDER INHERITANCE (Cascading fallback) ---
            let parentPath = path.dirname(currentPath);
            let rootEvaluatedPath = currentPath;

            while (parentPath && parentPath !== rootEvaluatedPath) {
                if (mapping[parentPath]) {
                    const parentData = mapping[parentPath];
                    // Inherit color state but explicitly omit icon badge to prevent file-tree visual clutter
                    return this.buildDecoration(parentData.color, undefined, true);
                }
                const nextParent = path.dirname(parentPath);
                if (nextParent === parentPath) break; // Traversal boundary guard (OS Root)
                rootEvaluatedPath = parentPath;
                parentPath = nextParent;
            }

            // --- 3. AUTOMATIC EXTENSION-BASED FALLBACKS (Lowest Priority) ---
            const ext = path.extname(currentPath).toLowerCase();
            if (ext === '.toml' || ext === '.yaml' || ext === '.json' || ext === '.lock') {
                return this.buildDecoration('Orange', 'Gear (Configuración)', false);
            }
            if (currentPath.includes('.test.') || currentPath.includes('.spec.')) {
                return this.buildDecoration('Green', 'Check (Validado/Test)', false);
            }

            // Explicitly yield execution back to VS Code default native rendering engine
            return undefined;
        }

        /**
         * Maps human-readable context tokens into native VS Code ThemeColors and vector glyphs.
         * Handles visual isolation flags to adjust tooltip metadata.
         */
        private buildDecoration(color: string, icon: string | undefined, isInherited: boolean): vscode.FileDecoration {
            let themeColor = 'charts.foreground';
            switch (color) {
                case 'Purple': themeColor = 'charts.purple'; break;
                case 'Blue': themeColor = 'charts.blue'; break;
                case 'Green': themeColor = 'charts.green'; break;
                case 'Orange': themeColor = 'charts.orange'; break;
                case 'Red': themeColor = 'charts.red'; break;
                case 'Yellow': themeColor = 'charts.yellow'; break;
            }

            let iconCharacter: string | undefined = undefined;
            if (!isInherited && icon) {
                switch (icon) {
                    case 'Star (Destacado)': iconCharacter = '★'; break;
                    case 'Gear (Configuración)': iconCharacter = '⚙'; break;
                    case 'Lock (Seguridad/Core)': iconCharacter = '🔒'; break;
                    case 'Terminal (Scripts)': iconCharacter = '⌨'; break;
                    case 'Flame (Importante)': iconCharacter = '🔥'; break;
                    case 'Check (Validado/Test)': iconCharacter = '✔'; break;
                    case 'Tag (Etiqueta)': iconCharacter = '🏷'; break;
                    case 'Dot (Punto clásico)': iconCharacter = '•'; break;
                }
            }

            return {
                badge: iconCharacter,
                tooltip: isInherited ? `Inherited Context: ${color}` : `Context: ${color}`,
                color: new vscode.ThemeColor(themeColor)
            };
        }
    };

    /**
     * Creates an isolated, deep-copied snapshot of the state object to prevent mutation reference bugs.
     */
    function cloneMapping(obj: ColorIconMapping): ColorIconMapping {
        return JSON.parse(JSON.stringify(obj));
    }

    /**
     * Command: Interactive context-menu colorizer execution flow.
     * Upgraded with Rich Visual Elements (High-fidelity emojis) in quick pick menus.
     */
    const assignColorCommand = vscode.commands.registerCommand('context-colorizer.assignColor', async (uri: vscode.Uri) => {
        if (!uri) return;

        const colorOptions: VisualQuickPickItem[] = [
            { label: '🟣 Purple', value: 'Purple', description: 'Deep focus context' },
            { label: '🔵 Blue', value: 'Blue', description: 'Standard feature branch' },
            { label: '🟢 Green', value: 'Green', description: 'Validated / Stable code' },
            { label: '🟠 Orange', value: 'Orange', description: 'Configuration & tooling' },
            { label: '🔴 Red', value: 'Red', description: 'Critical or core system pathways' },
            { label: '🟡 Yellow', value: 'Yellow', description: 'Refactor or documentation pending' },
            { label: '❌ Remove All Tags', value: 'Remove', description: 'Clear custom styling from this resource' }
        ];

        const selectedColorPick = await vscode.window.showQuickPick(colorOptions, {
            placeHolder: `Choose context color for: ${vscode.workspace.asRelativePath(uri)}`
        });
        
        if (!selectedColorPick) return;
        const selectedColor = selectedColorPick.value;

        const mapping = context.workspaceState.get<ColorIconMapping>('contextColorMappingV3') || {};
        undoStack.push(cloneMapping(mapping));

        if (selectedColor === 'Remove') {
            delete mapping[uri.fsPath];
            await context.workspaceState.update('contextColorMappingV3', mapping);
            decorationProvider.refresh();
            return;
        }

        const iconOptions: VisualQuickPickItem[] = [
            { label: '★ Star', value: 'Star (Destacado)', description: 'Flag as an entry point or main file' },
            { label: '⚙ Gear', value: 'Gear (Configuración)', description: 'Settings, builders, or pipeline configs' },
            { label: '🔒 Lock', value: 'Lock (Seguridad/Core)', description: 'Sensitive, secure, or read-only domain layers' },
            { label: '⌨ Terminal', value: 'Terminal (Scripts)', description: 'Shell tasks, utilities, or automation scripts' },
            { label: '🔥 Flame', value: 'Flame (Importante)', description: 'High-activity or bottleneck file' },
            { label: '✔ Check', value: 'Check (Validado/Test)', description: 'Fully validated test-suites' },
            { label: '🏷 Tag', value: 'Tag (Etiqueta)', description: 'Generic custom category index' },
            { label: '• Dot', value: 'Dot (Punto clásico)', description: 'Minimalist flat decorator bullet' }
        ];

        const selectedIconPick = await vscode.window.showQuickPick(iconOptions, { 
            placeHolder: `Anchor identification symbol for: ${path.basename(uri.fsPath)}` 
        });

        if (selectedIconPick) {
            mapping[uri.fsPath] = { color: selectedColor, icon: selectedIconPick.value };
            await context.workspaceState.update('contextColorMappingV3', mapping);
            decorationProvider.refresh();
        } else {
            undoStack.pop(); // Evacuate invalid transactional snapshot if user aborts process
        }
    });

    /**
     * Command: State rollback sequence (Undo mechanism).
     */
    const undoCommand = vscode.commands.registerCommand('context-colorizer.undo', async () => {
        if (undoStack.length === 0) return;
        const previousMapping = undoStack.pop();
        if (previousMapping) {
            await context.workspaceState.update('contextColorMappingV3', previousMapping);
            decorationProvider.refresh();
        }
    });

    /**
     * Workspace Event Observer: Intercepts physical rename operations.
     * Prevents orphaned state data-loss by auto-migrating relative paths on deep folder renames.
     */
    const renameWatcher = vscode.workspace.onDidRenameFiles(async (e) => {
        const mapping = context.workspaceState.get<ColorIconMapping>('contextColorMappingV3') || {};
        let changed = false;

        for (const file of e.files) {
            const oldPath = file.oldUri.fsPath;
            const newPath = file.newUri.fsPath;

            // 1. Direct item rename migration
            if (mapping[oldPath]) {
                mapping[newPath] = mapping[oldPath];
                delete mapping[oldPath];
                changed = true;
            }

            // 2. Cascade child-paths migration on folder rename operations
            const oldPrefix = oldPath + path.sep;
            for (const savedPath in mapping) {
                if (savedPath.startsWith(oldPrefix)) {
                    const relativePath = savedPath.substring(oldPrefix.length);
                    const newChildPath = path.join(newPath, relativePath);
                    mapping[newChildPath] = mapping[savedPath];
                    delete mapping[savedPath];
                    changed = true;
                }
            }
        }

        if (changed) {
            await context.workspaceState.update('contextColorMappingV3', mapping);
            decorationProvider.refresh();
        }
    });

    // Register active subscription transactions for proper cleanup upon extension deactivation
    context.subscriptions.push(
        assignColorCommand,
        undoCommand,
        renameWatcher,
        vscode.window.registerFileDecorationProvider(decorationProvider)
    );
}

/**
 * Extension termination lifecycle hook.
 */
export function deactivate() {}