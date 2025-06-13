const path = require('path');
const WebpackObfuscator = require('webpack-obfuscator');

module.exports = {
    entry: {
        background: './background.js',
        chatgpt_tracker: './content_scripts/chatgpt_tracker.js'
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: (pathData) => {
            // Output background.min.js to root and chatgpt_tracker.min.js to content_scripts
            return pathData.chunk.name === 'background' 
                ? '[name].min.js'
                : 'content_scripts/[name].min.js';
        }
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            }
        ]
    },
    plugins: [
        new WebpackObfuscator({
            rotateStringArray: true,
            stringArray: true,
            stringArrayEncoding: ['base64'],
            stringArrayThreshold: 0.75,
            identifierNamesGenerator: 'hexadecimal',
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.75,
            deadCodeInjection: true,
            deadCodeInjectionThreshold: 0.4,
            debugProtection: true,
            debugProtectionInterval: 4000,
            disableConsoleOutput: true,
            numbersToExpressions: true,
            renameGlobals: false,
            selfDefending: true,
            simplify: true,
            splitStrings: true,
            splitStringsChunkLength: 10,
            transformObjectKeys: true,
            unicodeEscapeSequence: false
        })
    ]
}; 