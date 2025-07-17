import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  entry: './src/backend/index.js',
  devtool: 'source-map', // pkgバイナリでの実行時はinline-source-map不可
  target: 'node',
  mode: 'production',
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'bundle.js',
    libraryTarget: 'umd'
  },
  externals: {
    // Node.js内蔵モジュールをexternalsに指定してバンドルから除外
    'path': 'commonjs path',
    'fs': 'commonjs fs',
    'os': 'commonjs os',
    'crypto': 'commonjs crypto',
    'http': 'commonjs http',
    'https': 'commonjs https',
    'url': 'commonjs url',
    'querystring': 'commonjs querystring',
    'util': 'commonjs util',
    'events': 'commonjs events',
    'stream': 'commonjs stream',
    'buffer': 'commonjs buffer',
    'zlib': 'commonjs zlib',
    'child_process': 'commonjs child_process',
    'net': 'commonjs net',
    'tls': 'commonjs tls',
    'dns': 'commonjs dns'
  },
  module: {
    rules: []
  }
};
