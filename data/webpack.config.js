import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ヘルパーごとにエントリを自動生成
const helpersDir = path.resolve(__dirname, 'src/helpers');
const helperFiles = fs.readdirSync(helpersDir).filter(f => f.endsWith('Helper.js'));
const helperEntries = Object.fromEntries(
  helperFiles.map(f => [
    f.replace(/\.js$/, ''),
    path.join(helpersDir, f)
  ])
);

export default [
  // 全体バンドル
  {
    entry: './src/index.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'handlebars-d3-charts.js',
      library: 'HandlebarsD3Charts',
      libraryTarget: 'umd',
      libraryExport: 'default',
      globalObject: "typeof self !== 'undefined' ? self : this",
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env'],
            },
          },
        },
      ],
    },
    externals: {},
    devtool: 'source-map',
  },
  // ヘルパー個別バンドル
  ...Object.entries(helperEntries).map(([name, entryPath]) => ({
    entry: entryPath,
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: `${name}.js`,
      library: name.charAt(0).toUpperCase() + name.slice(1),
      libraryTarget: 'umd',
      libraryExport: 'default',
      globalObject: "typeof self !== 'undefined' ? self : this",
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env'],
            },
          },
        },
      ],
    },
    externals: {},
    devtool: 'source-map',
  })),
  // util個別バンドル
  {
    entry: path.resolve(__dirname, 'src/util/index.js'),
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'util.js',
      library: 'Util',
      libraryTarget: 'umd',
      libraryExport: 'default',
      globalObject: "typeof self !== 'undefined' ? self : this",
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env'],
            },
          },
        },
      ],
    },
    externals: {},
    devtool: 'source-map',
  },
];
