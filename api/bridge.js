import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
    // 1. Handle non-POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Please use POST' });
    }

    // 2. Safely initialize Supabase inside the handler
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { prompt, apiKey } = req.body;

    try {
        // 3. Check Supabase
        const { data: user, error: dbError } = await supabase
            .from('subscribers')
            .select('*')
            .eq('api_key', apiKey)
            .eq('status', 'active')
            .single();

        if (dbError || !user) {
            return res.status(403).json({ error: 'Invalid API Key' });
        }

        // 4. Call Hugging Face Text Model
        const textRes = await axios.post(`${process.env.TEXT_MODEL_URL}/run/predict`, {
            data: [prompt]
        });

        const generatedText = textRes.data?.data?.[0] || "No response text";

        // 5. Call Kokoro TTS
        await axios.post(`${process.env.TTS_MODEL_URL}/generate`, {
            text: generatedText
        });

        // 6. Final Result
        return res.status(200).json({
            success: true,
            text: generatedText,
            audio: `${process.env.TTS_MODEL_URL}/static/output.wav`
        });

    } catch (err) {
        return res.status(500).json({ 
            error: 'Runtime Error', 
            message: err.message 
        });
    }
          }
