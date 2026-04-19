import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

    const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');
    const { prompt, apiKey } = req.body;

    try {
        // 1. DB CHECK
        const { data: user } = await supabase.from('subscribers').select('*').eq('api_key', apiKey).eq('status', 'active').single();
        if (!user) return res.status(403).json({ error: 'Key Invalid' });

        // 2. CALL TEXT MODEL (Trying standard HF endpoint)
        let generatedText = "";
        try {
            const textRes = await axios.post(`${process.env.TEXT_MODEL_URL}/api/predict`, { data: [prompt] });
            generatedText = textRes.data?.data?.[0];
        } catch (e) {
            // If /api/predict fails, try /run/predict
            const textRes2 = await axios.post(`${process.env.TEXT_MODEL_URL}/run/predict`, { data: [prompt] });
            generatedText = textRes2.data?.data?.[0];
        }

        // 3. CALL AUDIO MODEL
        // We will try to call the generate endpoint
        await axios.post(`${process.env.TTS_MODEL_URL}/generate`, { text: generatedText });

        return res.status(200).json({
            success: true,
            text: generatedText,
            audio: `${process.env.TTS_MODEL_URL}/static/output.wav`
        });

    } catch (err) {
        return res.status(err.response?.status || 500).json({ 
            error: '404 Destination Not Found',
            failed_at: err.config?.url, // This tells us WHICH URL is wrong
            status: err.response?.status
        });
    }
}
