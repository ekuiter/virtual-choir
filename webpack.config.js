const path = require("path");

module.exports = {
    mode: "production",
    entry: "./js/app.js",
    output: {
        filename: "app.min.js",
        path: path.resolve(__dirname, "js"),
        publicPath: "/js/"
    },
    module: {
        rules: [
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"]
            },
            {
                test: /encoderWorker\.js$/,
                loader: "worker-loader"
            },
            {
                test: /\.wasm$/,
                type: "javascript/auto",
                loader: "file-loader"
            }
        ]
    },
    node: {
        fs: "empty"
    }
};