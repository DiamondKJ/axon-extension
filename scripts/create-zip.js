const { zip } = require('zip-a-folder');
const fs = require('fs');
const path = require('path');

async function createZip() {
    try {
        // Create dist directory if it doesn't exist
        if (!fs.existsSync('dist')) {
            fs.mkdirSync('dist');
        }

        // Copy necessary files to dist
        const filesToCopy = [
            { src: 'manifest.json', dest: 'dist/manifest.json' },
            { src: 'content_scripts/styles.css', dest: 'dist/content_scripts/styles.css' },
            { src: 'lib/gpt-tokenizer.min.js', dest: 'dist/lib/gpt-tokenizer.min.js' }
        ];

        // Create content_scripts and lib directories in dist
        fs.mkdirSync('dist/content_scripts', { recursive: true });
        fs.mkdirSync('dist/lib', { recursive: true });

        // Copy files
        filesToCopy.forEach(file => {
            fs.copyFileSync(file.src, file.dest);
        });

        // Update manifest.json to use minified files
        const manifest = JSON.parse(fs.readFileSync('dist/manifest.json', 'utf8'));
        manifest.background.service_worker = 'background.min.js';
        manifest.content_scripts[0].js = [
            'lib/gpt-tokenizer.min.js',
            'content_scripts/chatgpt_tracker.min.js'
        ];
        fs.writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2));

        // Create zip file
        await zip('dist', 'axon-extension.zip');
        console.log('Extension packaged successfully as axon-extension.zip');
    } catch (error) {
        console.error('Error creating zip:', error);
        process.exit(1);
    }
}

createZip(); 