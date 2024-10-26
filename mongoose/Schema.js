const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
    query: String,
    id: {
        type: String,
    },
    title: String,
    image: String,
    price: String,
    link: String,
    rating: String,
    totalReviews: String
}, { timestamps: true });

const Product = mongoose.model("Product", Schema);
module.exports = Product;