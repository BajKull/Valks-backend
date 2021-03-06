const path = require("path");
const webpack = require("webpack");

module.exports = (env) => {
  console.log(env);
  return {
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
    plugins: [
      new webpack.DefinePlugin({
        "process.env": {
          FB_TYPE: JSON.stringify(process.env.FB_TYPE),
          FB_PROJECT_ID: JSON.stringify(process.env.FB_PROJECT_ID),
          FB_PRIVATE_KEY_ID: JSON.stringify(process.env.FB_PRIVATE_KEY_ID),
          FB_PRIVATE_KEY: JSON.stringify(process.env.FB_PRIVATE_KEY),
          FB_CLIENT_EMAIL: JSON.stringify(process.env.FB_CLIENT_EMAIL),
          FB_CLIENT_ID: JSON.stringify(process.env.FB_CLIENT_ID),
          FB_AUTH_URI: JSON.stringify(process.env.FB_AUTH_URI),
          FB_TOKEN_URI: JSON.stringify(process.env.FB_TOKEN_URI),
          FB_AUTH_PROVIDER_CERT_URI: JSON.stringify(
            process.env.FB_AUTH_PROVIDER_CERT_URI
          ),
          FB_CLIENT_CERT_URI: JSON.stringify(process.env.FB_CLIENT_CERT_URI),
          PORT: JSON.stringify(process.env.PORT) || env.PORT || 5000,
        },
      }),
    ],
  };
};
