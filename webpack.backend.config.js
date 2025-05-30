const path = require('path');

module.exports = {
  entry: './src/backend/index.js',
  devtool: 'inline-source-map',
  target: 'node',
  mode: 'production',
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'bundle.js',
    libraryTarget: 'umd'
  },
  externals: [],
  module: {
    rules: []
  }
};
