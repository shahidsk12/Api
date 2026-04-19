import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

export const config = {
  maxDuration: 60,
};

// Initialize Supabase outside the handler
const supabase = createClient(
  process.env.SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt, apiKey } = req.body;

    // 1. Validate Input
    if (!prompt || !apiKey) {
        return res.status(400).json({ error: 'Missing prompt or apiKey' });
    }

    try {
        // 2. Check Database for user
        const { data: user, error: dbError } = await supabase
            .from('subscribers')
            .select('*')
            .eq('api_key', apiKey)
            .eq('status', 'active')
            .single();

        if (dbError || !user) {
            return res.status(403).json({ error: 'Invalid or Inactive API Key' });
        }

        // 3. Call Text Model
        const textResponse = await axios.post(`${process.env.TEXT_MODEL_URL}/api/predict`, {
            data: [prompt]
        }, { timeout: 30000 });

        const generatedText = textResponse.data.data[0];

        // 4. Call Kokoro TTS
        await axios.post(`${process.env.TTS_MODEL_URL}/generate`, {
            text: generatedText
        }, { timeout: 30000 });

        // 5. Increment Usage (Fire and forget, don't wait for this to finish to send response)
        supabase
            .from('subscribers')
            .update({ requests_count: (user.requests_count || 0) + 1 })
            .eq('api_key', apiKey)
            .then();

        // 6. Send Success Response
        return res.status(200).json({
            success: true,
            text: generatedText,
            audio: `${process.env.TTS_MODEL_URL}/static/output.wav`
        });

    } catch (error) {
        console.error("Bridge Error:", error.message);
        return res.status(500).json({ 
            error: 'Bridge failed', 
            details: error.message 
        });
    }
}
