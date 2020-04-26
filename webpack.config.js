const path = require("path");

module.exports = {
    mode: "production",
    entry: "./app/js/index.js",
    output: {
        path: path.resolve(__dirname, "app", "dist"),
        publicPath: "/dist/"
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