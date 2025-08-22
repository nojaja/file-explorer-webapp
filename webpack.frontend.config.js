import path from 'path';
import CopyPlugin from 'copy-webpack-plugin';

export default {
  mode: 'production',
  entry: './src/frontend/js/index.js',
  output: {
    path: path.resolve('./dist'),
    filename: 'frontend.bundle.js',
    libraryTarget: 'umd',
    publicPath: '/dist/',
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
    new CopyPlugin({
      patterns: [
        { from: 'src/frontend/assets/*.tmp', to: 'assets/[name][ext]' }
      ]
    })
  ],
  resolve: {
    extensions: ['.js'],
    fallback: {
      path: 'path-browserify',
      fs: false
    }
  },
  target: 'web',
};
