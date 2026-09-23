import 'dotenv/config';
import express from 'express';
import analyzeOfferLetter from './api/analyze_offer_letter.js';
const app = express();
app.use(express.json({limit: '50mb'}));
app.post('/api/analyze_offer_letter', async (req, res) => {
  try {
    await analyzeOfferLetter(req, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({error: err.message});
  }
});
app.listen(3001, () => console.log('API Server running on port 3001'));
