import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

    const supabase = createClient(
        process.env.SUPABASE_URL || '', 
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    const { prompt, apiKey } = req.body;

    try {
        // 1. DATABASE CHECK
        const { data: user, error: dbError } = await supabase
            .from('subscribers')
            .select('*')
            .eq('api_key', apiKey)
            .eq('status', 'active')
            .single();

        if (dbError || !user) {
            return res.status(403).json({ error: 'Database error or Invalid API Key' });
        }

        // 2. CALL YURI (TEXT MODEL)
        // Note: Using /run/predict for Gradio. If this 404s, we'll try /api/predict
        const textRes = await axios.post(`${process.env.TEXT_MODEL_URL}/run/predict`, {
            data: [prompt]
        });

        const generatedText = textRes.data?.data?.[0] || "Yuri has no response.";

        // 3. SUCCESS RESPONSE
        return res.status(200).json({
            success: true,
            text: generatedText,
            usage_count: (user.requests_count || 0) + 1
        });

    } catch (err) {
        return res.status(500).json({ 
            error: 'Bridge Failed',
            message: err.message,
            failed_at: err.config?.url
        });
    }
            }
