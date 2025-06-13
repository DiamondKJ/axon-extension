const { zip } = require('zip-a-folder');
const fs = require('fs');
const path = require('path');

async function createZip() {
    try {
        // Create dist directory if it doesn't exist
        if (!fs.existsSync('dist')) {
            fs.mkdirSync('dist');
        }

        // Create necessary subdirectories
        fs.mkdirSync('dist/content_scripts', { recursive: true });
        fs.mkdirSync('dist/lib', { recursive: true });

        // Copy files to their correct locations (using original source paths)
        const filesToCopy = [
            { src: 'manifest.json', dest: 'dist/manifest.json' },
            { src: 'content_scripts/styles.css', dest: 'dist/content_scripts/styles.css' },
            { src: 'lib/gpt-tokenizer.min.js', dest: 'dist/lib/gpt-tokenizer.min.js' } // This is already minified
        ];

        // Copy each file
        for (const file of filesToCopy) {
            if (fs.existsSync(file.src)) {
                fs.copyFileSync(file.src, file.dest);
                console.log(`Copied ${file.src} to ${file.dest}`);
            } else {
                console.error(`Source file not found: ${file.src}`);
            }
        }

        // Update manifest.json to use correct paths (already done by copy)
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

        // Log the final directory structure
        console.log('\nFinal directory structure:');
        function listDir(dir, prefix = '') {
            const files = fs.readdirSync(dir);
            files.forEach(file => {
                const filePath = path.join(dir, file);
                const stats = fs.statSync(filePath);
                console.log(`${prefix}${file}${stats.isDirectory() ? '/' : ''}`);
                if (stats.isDirectory()) {
                    listDir(filePath, prefix + '  ');
                }
            });
        }
        listDir('dist');
    } catch (error) {
        console.error('Error creating zip:', error);
        process.exit(1);
    }
}

createZip(); 