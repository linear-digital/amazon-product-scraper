const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const APISchema = new Schema({
    api_key: String,
}, { timestamps: true });

const API = mongoose.model("API", APISchema);
module.exports = API;