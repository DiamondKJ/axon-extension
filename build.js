const JavaScriptObfuscator = require('javascript-obfuscator');
const { minify } = require('terser');
const fs = require('fs-extra');
const path = require('path');

// Configuration for obfuscation
const obfuscatorOptions = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    debugProtection: true,
    debugProtectionInterval: 2000,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: true,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayCallsTransformThreshold: 0.75,
    stringArrayEncoding: ['base64'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 2,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 4,
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 0.75,
    transformObjectKeys: true,
    unicodeEscapeSequence: false
};

// Files to process
const filesToProcess = [
    'background.js',
    'content_scripts/chatgpt_tracker.js',
    'lib/genai.js',
    'lib/anthropic.js',
    'lib/gpt-tokenizer.js',
    'offscreen.js'
];

// Create dist directory
const distDir = path.join(__dirname, 'dist');
fs.ensureDirSync(distDir);

// Process each file
async function processFiles() {
    for (const file of filesToProcess) {
        console.log(`Processing ${file}...`);
        
        // Read the file
        const filePath = path.join(__dirname, file);
        const code = await fs.readFile(filePath, 'utf8');
        
        // Minify the code
        const minified = await minify(code, {
            compress: {
                dead_code: true,
                drop_console: false,
                drop_debugger: true
            },
            mangle: true
        });
        
        // Obfuscate the minified code
        const obfuscated = JavaScriptObfuscator.obfuscate(minified.code, obfuscatorOptions);
        
        // Create the output directory if it doesn't exist
        const outputDir = path.join(distDir, path.dirname(file));
        fs.ensureDirSync(outputDir);
        
        // Write the obfuscated code
        const outputPath = path.join(distDir, file);
        await fs.writeFile(outputPath, obfuscated.getObfuscatedCode());
    }
    
    // Copy other necessary files
    const filesToCopy = [
        'manifest.json',
        'offscreen.html',
        'options/options.html',
        'options/options.js',
        'content_scripts/styles.css'
    ];
    
    for (const file of filesToCopy) {
        console.log(`Copying ${file}...`);
        const sourcePath = path.join(__dirname, file);
        const destPath = path.join(distDir, file);
        fs.ensureDirSync(path.dirname(destPath));
        await fs.copy(sourcePath, destPath);
    }
    
    console.log('Build complete! Check the dist directory for the obfuscated version.');
}

processFiles().catch(console.error); 