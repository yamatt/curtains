const path = require("path");

const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  mode: "production",
  entry: {
    main: "./src/js/index.js",
    draw: "./src/js/draw-entry.js",
    pong: "./src/js/pong-entry.js",
    breakout: "./src/js/breakout-entry.js",
    tetris: "./src/js/tetris-entry.js",
    meteors: "./src/js/meteors-entry.js"
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
  },
  plugins: [
    new HtmlWebpackPlugin({ 
      template: "./src/html/index.html",
      filename: "index.html",
      chunks: ["main"]
    }),
    new HtmlWebpackPlugin({ 
      template: "./src/html/draw.html",
      filename: "draw.html",
      chunks: ["draw"]
    }),
    new HtmlWebpackPlugin({
      template: "./src/html/pong.html",
      filename: "pong.html",
      chunks: ["pong"]
    }),
    new HtmlWebpackPlugin({
      template: "./src/html/breakout.html",
      filename: "breakout.html",
      chunks: ["breakout"]
    }),
    new HtmlWebpackPlugin({
      template: "./src/html/tetris.html",
      filename: "tetris.html",
      chunks: ["tetris"]
    }),
    new HtmlWebpackPlugin({
      template: "./src/html/meteors.html",
      filename: "meteors.html",
      chunks: ["meteors"]
    })
  ],
};
