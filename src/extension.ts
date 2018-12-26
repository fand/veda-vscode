'use strict';
import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as p from 'pify';
import * as os from 'os';
import * as path from 'path';

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

const getBackgroundCssSettings = (explosion: string) => {
    return {
        'background-repeat': 'no-repeat',
        'background-size': 'contain',
        'background-image': `url("${explosion}")`,
    };
};

const getDecoration = (explosionUrl: string): vscode.TextEditorDecorationType => {
    const backgroundCss = getBackgroundCssSettings(explosionUrl);

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

    const backgroundCssString = objectToCssString(backgroundCss);
    const defaultCssString = objectToCssString(defaultCss);

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
let startTime = 0;
let textDecoration: vscode.TextEditorDecorationType | null = null;
let lastShaderDecoration: vscode.TextEditorDecorationType | null = null;
let lastProcess: cp.ChildProcess;

const startImageWorker = async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }

    // Kill last process
    if (lastProcess) {
        lastProcess.kill('SIGINT');
    }

    // Prepare working directory
    const tmpdir = os.tmpdir();
    try {
        await p(fs.mkdir)(path.join(tmpdir, 'vsvs'), { recursive: true });
    } catch(e) {}

    // Save the shader to tmp file
    const text = editor.document.getText();
    const filepath = path.join(tmpdir, 'vsvs', `in.frag`);
    await p(fs.writeFile)(filepath, text, 'utf8');

    // Start process
    const time = (Date.now() - startTime) / 1000;
    const outdir = path.join(tmpdir, 'vsvs');
    const cmd = path.resolve(__dirname, '../bin/glsl2png');
    lastProcess = cp.spawn(cmd, ['-outdir', outdir, '-time', time.toString(), '-size', '720x450', '-hide', filepath]);
    lastProcess.stdout.on('data', (d) => {
        loadImage(parseInt(d.toString('utf8')));
    });
};

const loadImage = (idx: number) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }

    const now = Date.now();
    const tmpdir = os.tmpdir();
    const outpath = path.join(tmpdir, 'vsvs', `out${idx}.png?time=${now}`);

    // Add decoration
    const decoration = getDecoration(outpath);
    editor.setDecorations(decoration, [editor.visibleRanges[0]]);

    if (lastShaderDecoration) {
        const ls = lastShaderDecoration;
        setTimeout(() => {
            ls.dispose();
        }, 100);
//        lastShaderDecoration.dispose();
    }
    lastShaderDecoration = decoration;
};

const initializeTextBackground = () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }

    textDecoration = vscode.window.createTextEditorDecorationType(<vscode.DecorationRenderOptions>{
        textDecoration: `none; background: rgba(0, 0, 0, 0.8);`,
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    });
    editor.setDecorations(textDecoration, [new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(editor.document.lineCount, 9999)
    )]);
};

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('extension.sayHello', () => {
        let editor = vscode.window.activeTextEditor;
        if (!editor) { return; }

        initializeTextBackground();

        startTime = Date.now();

        // Register event listeners
        vscode.window.onDidChangeActiveTextEditor(() => {
            initializeTextBackground();
            startImageWorker();
        });
        vscode.workspace.onDidChangeTextDocument(() => {
            startImageWorker();
        });

        // First evaluation
        startImageWorker();
      });

    context.subscriptions.push(disposable);
}

export function deactivate() {
    if (textDecoration) {
        textDecoration.dispose();
    }
    if (lastShaderDecoration) {
        lastShaderDecoration.dispose();
    }
}
