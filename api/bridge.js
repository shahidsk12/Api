export const config = {
  maxDuration: 60, // Sets the timeout to 60 seconds
};

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send();

    const { prompt, apiKey } = req.body;

    // 1. VALIDATE API KEY FROM DATABASE
    const { data: user, error } = await supabase
        .from('subscribers')
        .select('*')
        .eq('api_key', apiKey)
        .eq('status', 'active')
        .single();

    if (error || !user) {
        return res.status(403).json({ error: "Invalid or expired subscription." });
    }

    try {
        // 2. RUN THE MODELS
        const textRes = await axios.post(`${process.env.TEXT_MODEL_URL}/api/predict`, { data: [prompt] });
        const generatedText = textRes.data.data[0];

        // Trigger Kokoro TTS (Your link: https://shahid202-kokoro-api.hf.space/generate)
        await axios.post(`${process.env.TTS_MODEL_URL}/generate`, { text: generatedText });

        // 3. LOG THE USAGE (Update request count)
        await supabase
            .from('subscribers')
            .update({ requests_count: user.requests_count + 1 })
            .eq('api_key', apiKey);

        // 4. SEND RESPONSE
        res.status(200).json({
            text: generatedText,
            audio: `${process.env.TTS_MODEL_URL}/static/output.wav`
        });

    } catch (err) {
        res.status(500).json({ error: "Service busy. Try again." });
    }
                   }
