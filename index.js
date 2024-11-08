const express = require('express');
const cors = require('cors');
const Xray = require('x-ray');
const x = Xray();
const mongoose = require('mongoose');
const Product = require('./mongoose/Schema');
const API = require('./mongoose/APISchema');
const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3333;
const generateKey = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = '';
    for (let i = 0; i < 60; i++) {
        key += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return key;
}

// app.post('/api', async (req, res) => {
//     const api_key = generateKey();
//     const api = new API({
//         api_key
//     });
//     await api.save();
//     res.json({ api_key });
// })

app.get('/api/amazon', async (req, res) => {
    const searchTerm = req.query.q;
    const api_key = req.headers['x-api-key'];
    try {
        const api = await API.findOne({ api_key });
        if (!api) {
            return res.status(401).send({ error: 'Invalid API key' });
        }

        const products = await Product.find({ query: searchTerm, createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } });

        if (products.length > 0) {
            return res.json({
                success: true,
                total: products.length,
                data: products
            });
        }

        const result = await x(`https://www.amazon.com/s?k=${encodeURIComponent(searchTerm)}`, {
            products: x('div.s-result-item', [
                {
                    id: '@data-asin',
                    title: 'a.a-link-normal span.a-size-base-plus.a-color-base.a-text-normal',
                    image: 'div.s-image-square-aspect img.s-image@src',
                    price: 'span.a-price span.a-offscreen',
                    link: 'h2 a.a-link-normal@href',
                    rating: 'span.a-icon-alt',
                    totalReviews: 'span.a-size-base',
                }
            ])
        });

        // Format the result to return an array of products
        const formattedResult = result.products.map(product => {
            if (product.title && product.image && product.price && product.link) {
                return {
                    id: product.id,
                    title: product.title,
                    image: product.image,
                    price: product.price,
                    link: product.link,
                    rating: product.rating?.split(' ')[0],
                    totalReviews: product.totalReviews?.split(' ')[0]
                };
            }
        }).filter(Boolean)
        // store data in database

        if (formattedResult.length > 0) {
            const datatoStore = formattedResult?.map(product => {
                return {
                    ...product,
                    query: searchTerm
                };
            })
            await Product.deleteMany({ query: searchTerm });

            await Product.insertMany(datatoStore);
        }
        else {
            const data = await Product.find({ query: searchTerm });
            return res.json({
                success: true,
                total: data.length,
                data
            })
        }

        // Return the formatted result
        res.json({
            success: true,
            total: formattedResult.length,
            data: formattedResult
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'An error occurred while scraping data.', message: error.message });
    }
});

app.get('/api/duplicate', async (req, res) => {
    const api_key = req.headers['x-api-key'];
    try {
        // Check for API key
        const api = await API.findOne({ api_key });
        if (!api) {
            return res.status(401).send({ error: 'Invalid API key' });
        }

        // Fetch all products
        const products = await Product.find();

        // Find duplicates based on `_id`
        const duplicates = Object.values(
            products.reduce((acc, item) => {
                acc[item.id] = acc[item.id] || { ...item.toObject(), count: 0 };
                acc[item.id].count += 1;
                return acc;
            }, {})
        ).filter(item => item.count > 1);

        // Remove duplicates
        await Product.deleteMany({ _id: { $in: duplicates.map(item => item._id) } });
        // Send response
        res.json({
            success: true,
            total: duplicates.length,
            data: duplicates
        });
    } catch (error) {
        res.status(500).send({
            error: 'An error occurred while fetching products.',
            message: error.message
        });
    }
});

app.get('/api/products', async (req, res) => {
    try {
        const q = req.query.q;
        const api_key = req.headers['x-api-key'];

        const limit = parseInt(req.query.limit) || 30;
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * limit;

        if (!api_key) {
            return res.status(401).send({ error: 'Missing API key' });
        }

        const api = await API.findOne({ api_key });
        if (!api) {
            return res.status(401).send({ error: 'Invalid API key' });
        }

        const filters = {};
        if (q) {
            filters.$or = [
                { query: new RegExp(q, 'i') },
                { title: new RegExp(q, 'i') }
            ];
        }

        const products = await Product.find(filters)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .exec();

        const total = await Product.countDocuments(filters); // Await the countDocuments method

        res.json({
            success: true,
            result: products.length,
            total: total,
            data: products
        });
    } catch (error) {
        res.status(500).send({
            error: 'An error occurred while fetching products.',
            message: error.message
        });
    }
});

// connect to database
// 1Tig2Zm7O6AL1q5Q
//amazon
mongoose.connect(process.env.DB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => {
        console.log('Connected to MongoDB');
    })
    .catch((error) => {
        console.error('Error connecting to MongoDB:', error);
    });

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
