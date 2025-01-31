const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bodyParser = require('body-parser');
const cors = require('cors');

// MongoDB Connection URI and Database Name
const uri = 'mongodb://127.0.0.1:27017/quizmaster'; // Changed from localhost to 127.0.0.1
const dbName = 'quizmaster';

const app = express();
app.use(cors());
app.use(bodyParser.json());

let db;

// Connect to MongoDB with better error handling
async function connectDB() {
    try {
        const client = await MongoClient.connect(uri);
        db = client.db(dbName);
        console.log('Connected to MongoDB successfully');
    } catch (err) {
        console.error('Failed to connect to MongoDB:', err);
        process.exit(1); // Exit if we can't connect to database
    }
}

// Wrap routes in error handling
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Routes
app.get('/users', asyncHandler(async (req, res) => {
    const users = await db.collection('users').find().toArray();
    res.json(users);
}));

app.post('/users', asyncHandler(async (req, res) => {
    const result = await db.collection('users').insertOne(req.body);
    res.json(result);
}));

app.get('/quizzes', asyncHandler(async (req, res) => {
    const quizzes = await db.collection('quizzes').find().toArray();
    res.json(quizzes);
}));

app.post('/quizzes', asyncHandler(async (req, res) => {
    const result = await db.collection('quizzes').insertOne(req.body);
    res.json(result);
}));

app.put('/quizzes/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await db.collection('quizzes').updateOne(
        { _id: new ObjectId(id) },
        { $set: req.body }
    );
    res.json(result);
}));

app.delete('/quizzes/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await db.collection('quizzes').deleteOne({ _id: new ObjectId(id) });
    res.json(result);
}));

app.get('/scores', asyncHandler(async (req, res) => {
    const scores = await db.collection('scores').find().toArray();
    res.json(scores);
}));

app.post('/scores', asyncHandler(async (req, res) => {
    const result = await db.collection('scores').insertOne(req.body);
    res.json(result);
}));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start the server
const PORT = 3000;
async function startServer() {
    await connectDB();
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

startServer().catch(console.error);