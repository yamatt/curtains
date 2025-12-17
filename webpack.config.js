const path = require("path");

const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  mode: "production",
  entry: {
    main: "./src/js/index.js",
    draw: "./src/js/draw-entry.js"
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
    })
  ],
};
