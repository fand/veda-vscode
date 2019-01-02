'use strict';
import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as p from 'pify';
import * as os from 'os';
import * as path from 'path';

const tmpdir = os.tmpdir();

const objectToCssString = (settings: any): string => {
    let value = '';
    const cssString = Object.keys(settings).map(setting => {
        value = settings[setting];
        if (typeof value === 'string' || typeof value === 'number') {
            return `${setting}: ${value} !important;`;
        }
    }).join(' ');

    return cssString;
};

const defaultCss = {
    display: `block`,
    width: '100vw',
    height: `100vh`,

    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,

    ['z-index']: `-1`,
};
const defaultCssString = objectToCssString(defaultCss);

const getDecoration = (explosionUrl: string): vscode.TextEditorDecorationType => {
    const backgroundCssString = `
        background-repeat: no-repeat;
        background-size: contain;
        background-image: url(${explosionUrl});
    `;

    return vscode.window.createTextEditorDecorationType(<vscode.DecorationRenderOptions>{
        before: {
            contentText: '',
            textDecoration: `none; ${defaultCssString} ${backgroundCssString}`,
        },
        textDecoration: `none; position: relative; overflow: visible; transform: none !important;`,
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    });
};

// App state
class VedaExtension {
    _isInitialized: boolean = false;
    startTime: number = 0;
    textDecoration?: vscode.TextEditorDecorationType;
    lastShaderDecoration?: vscode.TextEditorDecorationType;
    lastImageWorker?: cp.ChildProcess;

    public isEnabled(): boolean {
        return this._isInitialized;
    }

    initialize(): void {
        this.startTime = Date.now();

        this.initializeTextBackground();
        vscode.window.onDidChangeActiveTextEditor(() => {
            this.initializeTextBackground();
        });

        this._isInitialized = true;
    }

    public play(): void {
        if (!this._isInitialized) {
            this.initialize();
        }

        this.loadShader();
    }

    public stop(): void {
        if (this.textDecoration) {
            this.textDecoration.dispose();
        }
        if (this.lastShaderDecoration) {
            this.lastShaderDecoration.dispose();
        }

        this._isInitialized = false;
    }

    loadShader = async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }

        // Kill last process
        if (this.lastImageWorker) {
            this.lastImageWorker.kill('SIGTERM');
        }

        // Prepare working directory
        const tmpdir = os.tmpdir();
        try {
            await p(fs.mkdir)(path.join(tmpdir, 'veda'), { recursive: true });
        } catch(e) {}

        // Save the shader to tmp file
        const text = editor.document.getText();
        const filepath = path.join(tmpdir, 'veda', `in.frag`);
        await p(fs.writeFile)(filepath, text, 'utf8');

        // Start process
        const time = (Date.now() - this.startTime) / 1000;
        const outdir = path.join(tmpdir, 'veda');
        const cmd = path.resolve(__dirname, '../bin/glsl2png');
        this.lastImageWorker = cp.spawn(cmd, ['-outdir', outdir, '-time', time.toString(), '-size', '720x450', '-hide', filepath]);
        this.lastImageWorker.stdout.on('data', (d) => {
            this.loadImage(parseInt(d.toString('utf8')));
        });
        this.lastImageWorker.stderr.on('data', (d) => {
            console.log('>> veda error: glsl2png throwed an error');
            console.log(d.toString());
        });
        this.lastImageWorker.on('close', (code) => {
            console.log(`>> veda info: child process exited with code ${code}`);
        });
    }

    loadImage = (idx: number) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }

        const now = Date.now();
        const outpath = path.join(tmpdir, 'veda', `out${idx}.png?time=${now}`);

        // Add decoration
        const decoration = getDecoration(outpath);
        editor.setDecorations(decoration, [editor.visibleRanges[0]]);

        if (this.lastShaderDecoration) {
            const ls = this.lastShaderDecoration;
            setTimeout(() => {
                ls.dispose();
            }, 300);
        }
        this.lastShaderDecoration = decoration;
    }

    initializeTextBackground = () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }

        this.textDecoration = vscode.window.createTextEditorDecorationType(<vscode.DecorationRenderOptions>{
            textDecoration: `none; background: black;`,
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
        });
        editor.setDecorations(this.textDecoration, [new vscode.Range(
            new vscode.Position(0, 0),
            new vscode.Position(editor.document.lineCount, 9999)
        )]);
    }
}

let ext: VedaExtension | undefined;

export function activate(context: vscode.ExtensionContext) {
    if (ext === undefined) {
        ext = new VedaExtension();
    }

    context.subscriptions.push(vscode.commands.registerCommand('veda.play', () => {
        ext!.play();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('veda.stop', () => {
        ext!.stop();
    }));
}

export function deactivate(context: vscode.ExtensionContext) {
    if (ext) {
        ext.stop();
        ext = undefined;
    }
}
