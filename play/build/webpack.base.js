const path = require('path');
const webpack = require('webpack');
const util = require('./utils/util');
const log = require('./utils/log');
const chalk = require('chalk');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HappyPack = require('happypack');

const pugFilters = require('./utils/pugFilters');
const conf = require('./config');

module.exports = ({ NODE_ENV, ...env }) => {

  let envType = env.test ? 'test' : NODE_ENV;
  let envDefine = conf.env[envType];
  log.log(` 当前环境: ${chalk.cyan(envType)}`);
  for (let key of Object.keys(envDefine)) {
    envDefine[key] = JSON.stringify(envDefine[key]);
  }

  const devMode = NODE_ENV === 'dev';

  let entryInfos = util.getEntrys();

  /* 当载入全部入口被关闭时，过滤掉不被pageList包含的入口文件
   * 过滤规则: loadAll为falsy且pageList长度大于0 */
  if (conf.page && !conf.page.loadAll && conf.page.pageList.length) {
    for (let [key, val] of Object.entries(entryInfos.entrys)) {
      if (!conf.page.pageList.includes(key)) {
        delete entryInfos.entrys[key];
      }
    }

    entryInfos.template = entryInfos.template.filter(v => {
      let filename = path.basename(v.template).split('.')[0];
      return conf.page.pageList.includes(filename);

    });
  }

  let htmlPlugins = entryInfos.template.map(v => {
    return new HtmlWebpackPlugin({
      filename: `${v.title}.html`,
      template: v.template,
      minify: false,
      hash: conf.htmlAssetsHash,
      cache: false,
      chunks: ['runtime', 'vendors', 'commons', v.title],
      templateParameters: {
        ...conf,
        title: v.title,
        /* 开发环境publicPath直接设置为空，页面中通过#{public}/来匹配public目录的内容 */
        public: devMode ? '' : conf.publicPath + conf.publicDirName,
        page: v.pageInfo,
      },
    });
  });

  let config = {
    context: path.resolve(__dirname),
    entry: entryInfos.entrys,

    resolve: {
      extensions: conf.extensions,
      alias: conf.alias,
    },

    module: {
      rules: [
        {
          test: /\.(pug|jade)$/,
          use: [
            {
              loader: 'pug-loader',
              options: {
                filters: pugFilters,
              },
            },
          ],
        },
        {
          test: /\.(sa|sc|c)ss$/,
          exclude: /\.module.(sa|sc|c)ss$/,
          use: [
            {
              loader: devMode ? 'style-loader' : MiniCssExtractPlugin.loader,
            },
            {
              loader: 'css-loader',
              options: {
                sourceMap: devMode,
              },
            },
            {
              loader: 'postcss-loader',
              options: {
                sourceMap: devMode,
              },
            },
            {
              loader: 'sass-loader',
              options: {
                ...conf.sassOption,
                sourceMap: devMode,
              },
            },
          ],
        },
        {
          test: /\.module\.(sa|sc|c)ss$/,
          use: [
            {
              loader: devMode ? 'style-loader' : MiniCssExtractPlugin.loader,
            },
            {
              loader: 'css-loader',
              options: {
                sourceMap: devMode,
                modules: true,
                // localIdentName: '[name]_[local]-[hash:base64:7]'
                localIdentName: '[local]-[hash:base64:7]',
              },
            },
            {
              loader: 'postcss-loader',
              options: {
                sourceMap: devMode,
              },
            },
            {
              loader: 'sass-loader',
              options: {
                ...conf.sassOption,
                sourceMap: devMode,
              },
            },
          ],
        },
        {
          test: /\.(js|jsx)$/,
          exclude: /(node_modules|bower_components)/,
          // include: resolve('src'),
          use: 'happypack/loader',
        },
        /* 图 */
        {
          test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
          use: util.fileLoaderOption(
            NODE_ENV,
            `${conf.publicDirName}/img/`,
            conf.hash,
          ),
        },
        /* 影 */
        {
          test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/,
          use: util.fileLoaderOption(
            NODE_ENV,
            `${conf.publicDirName}/video/`,
            conf.hash,
          ),
        },
        /* 字 */
        {
          test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
          use: util.fileLoaderOption(
            NODE_ENV,
            `${conf.publicDirName}/font/`,
            conf.hash,
          ),
        },
      ],
    },

    plugins: [
      /* 在两个pack(lodash+vue)的情况下测试，提升不到100毫秒，先去掉 */
      // new webpack.DllReferencePlugin({
      //   context: path.join(__dirname, "..", "dll"),
      //   manifest: require("../dll/manifest.json")
      // }),
      new HappyPack({
        loaders: [`babel-loader${devMode ? '?cacheDirectory' : ''}`],
      }),
      new webpack.ProgressPlugin(),
      ...htmlPlugins,
      new webpack.DefinePlugin(envDefine),
      new webpack.ContextReplacementPlugin(/moment[\/\\]locale$/, /zh-cn/),
    ],
  };

  if (!devMode) {
    config.plugins.push(
      new MiniCssExtractPlugin({
        filename: `${conf.publicDirName}/css/[name]${
          conf.hash ? '.[contenthash]' : ''
          }.css`,
      }),
    );
  }

  return config;
};
