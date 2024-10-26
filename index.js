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

app.post('/api', async (req, res) => {
    const api_key = generateKey();
    const api = new API({
        api_key
    });
    await api.save();
    res.json({ api_key });
})

app.get('/', async (req, res) => {
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
                    totalReviews: product.totalReviews
                };
            }
        }).filter(Boolean)
        // store data in database

        const datatoStore = formattedResult?.map(product => {
            return {
                ...product,
                query: searchTerm
            };
        })
        await Product.deleteMany({ query: searchTerm });

        await Product.insertMany(datatoStore);

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



// connect to database
// 1Tig2Zm7O6AL1q5Q
//amazon
mongoose.connect('mongodb+srv://amazon:1Tig2Zm7O6AL1q5Q@genzit.roulp.mongodb.net/products?retryWrites=true&w=majority&appName=Genzit', {
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