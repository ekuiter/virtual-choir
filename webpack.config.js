const path = require("path");

module.exports = {
    mode: "production",
    entry: "./js/index.js",
    output: {
        filename: "app.min.js",
        path: path.resolve(__dirname, "js"),
        publicPath: "/js/"
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: ["@babel/preset-env"],
                        plugins: [
                            ["@babel/plugin-transform-react-jsx", {
                                pragma: "h",
                                pragmaFrag: "Fragment"
                            }]
                        ]
                    }
                }
            },
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