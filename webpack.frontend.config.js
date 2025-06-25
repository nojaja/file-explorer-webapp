import path from 'path';

export default {
  mode: 'production',
  entry: './src/frontend/main.js',
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
  resolve: {
    extensions: ['.js']
  },
  target: 'web',
};
