const path = require("path");
const dotenv = require("dotenv-webpack");

module.exports = {
  entry: "./index.ts",
  mode: "production",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  output: {
    filename: "index.js",
    path: path.resolve(__dirname, "build"),
  },
  target: "node",
  plugins: [new dotenv()],
};
