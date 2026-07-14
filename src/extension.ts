import * as vscode from 'vscode';
import * as path from 'path';

interface ColorIconMapping {
    [key: string]: { color: string, icon: string };
}

export function activate(context: vscode.ExtensionContext) {
    let undoStack: ColorIconMapping[] = [];
    
    // 1. Proveedor de decoraciones visuales inteligentes
    const decorationProvider = new class implements vscode.FileDecorationProvider {
        private _onDidChangeFileDecorations: vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined> = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
        readonly onDidChangeFileDecorations: vscode.Event<vscode.Uri | vscode.Uri[] | undefined> = this._onDidChangeFileDecorations.event;

        refresh() {
            this._onDidChangeFileDecorations.fire(undefined);
        }

        provideFileDecoration(uri: vscode.Uri): vscode.ProviderResult<vscode.FileDecoration> {
            const mapping = context.workspaceState.get<ColorIconMapping>('contextColorMappingV3') || {};

            // REGLA MANUAL (Clic Derecho e Herencia de carpetas)
            for (const savedPath in mapping) {
                const relative = path.relative(savedPath, uri.fsPath);
                const isChild = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
                
                if (uri.fsPath === savedPath || isChild) {
                    const data = mapping[savedPath];
                    return this.buildDecoration(data.color, data.icon);
                }
            }

            // REGLA AUTOMÁTICA (Queja de Reddit: Colorear por extensión si no hay regla manual)
            const ext = path.extname(uri.fsPath).toLowerCase();
            if (ext === '.toml' || ext === '.yaml' || ext === '.json' || ext === '.lock') {
                return this.buildDecoration('Orange', 'Gear (Configuración)');
            }
            if (uri.fsPath.includes('.test.') || uri.fsPath.includes('.spec.')) {
                return this.buildDecoration('Green', 'Check (Validado/Test)');
            }

            return null;
        }

        // Generador interno de estilos de color e iconos vectoriales
        private buildDecoration(color: string, icon: string): vscode.FileDecoration {
            let themeColor = 'charts.foreground';
            switch (color) {
                case 'Purple': themeColor = 'charts.purple'; break;
                case 'Blue': themeColor = 'charts.blue'; break;
                case 'Green': themeColor = 'charts.green'; break;
                case 'Orange': themeColor = 'charts.orange'; break;
                case 'Red': themeColor = 'charts.red'; break;
                case 'Yellow': themeColor = 'charts.yellow'; break;
            }

            let iconCharacter = '•';
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

            return {
                badge: iconCharacter,
                tooltip: `Context: ${color}`,
                color: new vscode.ThemeColor(themeColor)
            };
        }
    };

    function cloneMapping(obj: ColorIconMapping): ColorIconMapping {
        return JSON.parse(JSON.stringify(obj));
    }

    // 2. Comando principal del clic derecho
    let assignColorCommand = vscode.commands.registerCommand('context-colorizer.assignColor', async (uri: vscode.Uri) => {
        if (!uri) return;

        const colorOptions = ['Purple', 'Blue', 'Green', 'Orange', 'Red', 'Yellow', 'Remove All Tags ❌'];
        const selectedColor = await vscode.window.showQuickPick(colorOptions, {
            placeHolder: `Choose color for: ${vscode.workspace.asRelativePath(uri)}`
        });
        
        if (!selectedColor) return;

        let mapping = context.workspaceState.get<ColorIconMapping>('contextColorMappingV3') || {};
        undoStack.push(cloneMapping(mapping));

        if (selectedColor.includes('Remove All Tags')) {
            delete mapping[uri.fsPath];
            await context.workspaceState.update('contextColorMappingV3', mapping);
            decorationProvider.refresh();
            return;
        }

        const iconOptions = ['Star (Destacado)', 'Gear (Configuración)', 'Lock (Seguridad/Core)', 'Terminal (Scripts)', 'Flame (Importante)', 'Check (Validado/Test)', 'Tag (Etiqueta)', 'Dot (Punto clásico)'];
        const selectedIcon = await vscode.window.showQuickPick(iconOptions, { placeHolder: `Choose icon symbol` });

        if (selectedIcon) {
            mapping[uri.fsPath] = { color: selectedColor, icon: selectedIcon };
            await context.workspaceState.update('contextColorMappingV3', mapping);
            decorationProvider.refresh();
        } else {
            undoStack.pop();
        }
    });

    // 3. Comando Deshacer (Undo)
    let undoCommand = vscode.commands.registerCommand('context-colorizer.undo', async () => {
        if (undoStack.length === 0) return;
        const previousMapping = undoStack.pop();
        if (previousMapping) {
            await context.workspaceState.update('contextColorMappingV3', previousMapping);
            decorationProvider.refresh();
        }
    });

    // 4. SOLUCIÓN A BUG DE FOROS: Escuchar renames del sistema de archivos
    let renameWatcher = vscode.workspace.onDidRenameFiles(async (e) => {
        let mapping = context.workspaceState.get<ColorIconMapping>('contextColorMappingV3') || {};
        let changed = false;

        for (const file of e.files) {
            if (mapping[file.oldUri.fsPath]) {
                // Transferimos los datos de color del path antiguo al nuevo
                mapping[file.newUri.fsPath] = mapping[file.oldUri.fsPath];
                delete mapping[file.oldUri.fsPath];
                changed = true;
            }
        }

        if (changed) {
            await context.workspaceState.update('contextColorMappingV3', mapping);
            decorationProvider.refresh();
        }
    });

    context.subscriptions.push(
        assignColorCommand,
        undoCommand,
        renameWatcher,
        vscode.window.registerFileDecorationProvider(decorationProvider)
    );
}

export function deactivate() {}
