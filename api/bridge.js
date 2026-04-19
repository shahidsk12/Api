const axios = require('axios');

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt, apiKey } = req.body;

    // 1. Simple Security Check
    if (!apiKey || apiKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ error: 'Invalid or missing API Key' });
    }

    try {
        // 2. Call Text Model (My-Free-AI-API)
        // Adjusting for Gradio/HF Spaces API format
        const textResponse = await axios.post(`${process.env.TEXT_MODEL_URL}/api/predict`, {
            data: [prompt]
        });
        
        const generatedText = textResponse.data.data[0];

        // 3. Call Kokoro TTS
        // We trigger the generation on your TTS space
        await axios.post(`${process.env.TTS_MODEL_URL}/generate`, {
            text: generatedText
        });

        // 4. Return combined result
        // Users get the text and the direct link to the wav file
        res.status(200).json({
            success: true,
            text: generatedText,
            audio_url: `${process.env.TTS_MODEL_URL}/static/output.wav`,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Bridge error: Model connection failed' });
    }
}

